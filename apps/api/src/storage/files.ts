import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

// The file storage port (P4-07): where uploaded files' bytes live. Email attachments use it.
//   database (default): inside the database, as before: included in every backup, nothing else to set up.
//   disk: a folder (FILE_STORAGE_DIR). Smaller database; back the folder up too.
//   s3: any S3-compatible storage (Cloudflare R2, Backblaze B2, MinIO, AWS S3), for a hosted app: files survive redeploys.
// Files saved in one mode stay readable after switching to another (a row remembers where its bytes are).

export type FileStorage = {
  readonly kind: "disk" | "s3";
  put(key: string, data: Uint8Array, mime: string): Promise<void>;
  /** The bytes, or null when there is no such file. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removing a file that is already gone is fine. */
  remove(key: string): Promise<void>;
};

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A new, unguessable name for a file. Only names like this are ever read or written (no path tricks). */
export const newKey = () => randomUUID();
const checked = (key: string) => {
  if (!KEY.test(key)) throw new Error(`Not a file key: ${key}`);
  return key;
};

export function diskStorage(dir: string): FileStorage {
  const root = path.resolve(dir);
  const file = (key: string) => path.join(root, checked(key));
  return {
    kind: "disk",
    async put(key, data) {
      await fs.mkdir(root, { recursive: true });
      const tmp = `${file(key)}.part`;
      await fs.writeFile(tmp, data);
      await fs.rename(tmp, file(key)); // all or nothing: a half-written file never has the real name
    },
    async get(key) {
      try {
        return new Uint8Array(await fs.readFile(file(key)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async remove(key) {
      await fs.rm(file(key), { force: true });
    },
  };
}

export type S3Settings = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string };

export function s3Storage(s: S3Settings): FileStorage {
  const aws = new AwsClient({ accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey, region: s.region || "auto", service: "s3" });
  // path-style addresses (endpoint/bucket/key) work with every S3-compatible service
  const url = (key: string) => `${s.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(s.bucket)}/${checked(key)}`;
  const fail = async (what: string, r: Response) => new Error(`File storage ${what} failed (${r.status}): ${(await r.text().catch(() => "")).slice(0, 200)}`);
  return {
    kind: "s3",
    async put(key, data, mime) {
      const r = await aws.fetch(url(key), { method: "PUT", body: data, headers: { "Content-Type": mime } });
      if (!r.ok) throw await fail("upload", r);
    },
    async get(key) {
      const r = await aws.fetch(url(key));
      if (r.status === 404) return null;
      if (!r.ok) throw await fail("download", r);
      return new Uint8Array(await r.arrayBuffer());
    },
    async remove(key) {
      const r = await aws.fetch(url(key), { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw await fail("delete", r);
    },
  };
}

/** The storage for these settings; null = keep files inside the database. */
export function fileStorageFrom(c: { kind: "database" | "disk" | "s3"; dir: string; s3: S3Settings }): FileStorage | null {
  if (c.kind === "disk") return diskStorage(c.dir);
  if (c.kind === "s3") return s3Storage(c.s3);
  return null;
}
