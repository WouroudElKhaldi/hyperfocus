import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// The file storage port (P4-07): where uploaded files' bytes live. Email attachments use it.
//   database (default): inside the database, as before: included in every backup, nothing else to set up.
//   disk: a folder (FILE_STORAGE_DIR). Smaller database; back the folder up too.
// (S3-compatible storage was here until 2026-10-03; removed at the owner's request: not needed.)
// Files saved in one mode stay readable after switching to another (a row remembers where its bytes are).

export type FileStorage = {
  readonly kind: "disk";
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

/** The storage for these settings; null = keep files inside the database. */
export function fileStorageFrom(c: { kind: "database" | "disk"; dir: string }): FileStorage | null {
  return c.kind === "disk" ? diskStorage(c.dir) : null;
}
