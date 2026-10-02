import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { diskStorage, fileStorageFrom, newKey, s3Storage } from "../../src/storage/files.ts";
import { attachmentFiles } from "../../src/storage/attachments.ts";
import { startFakeS3 } from "../support/fake-s3.js";

// P4-07: the file storage port. Both adapters keep bytes exactly, say "no such file" with null, and only ever use the
// app's own unguessable names (a path or a URL trick in a key is refused before anything is touched).

const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
const contract = (make) => {
  it("keeps the bytes exactly, and forgets them on remove (removing twice is fine)", async () => {
    const s = await make();
    const key = newKey();
    await s.put(key, bytes, "application/octet-stream");
    expect([...(await s.get(key))]).toEqual([...bytes]);
    await s.remove(key);
    await s.remove(key);
    expect(await s.get(key)).toBeNull();
  });
  it("refuses names that aren't its own (no path or URL tricks)", async () => {
    const s = await make();
    for (const bad of ["../../etc/passwd", "a/b", "x?y=1", "", "..%2f"]) {
      await expect(s.get(bad)).rejects.toThrow(/Not a file key/);
      await expect(s.put(bad, bytes, "text/plain")).rejects.toThrow(/Not a file key/);
    }
  });
};

describe("disk storage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-files-"));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  contract(() => diskStorage(dir));
  it("never leaves a half-written file under the real name", async () => {
    const s = diskStorage(dir);
    const key = newKey();
    await s.put(key, bytes, "x/y");
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".part"))).toEqual([]);
  });
});

describe("S3-compatible storage", () => {
  let s3;
  beforeAll(async () => { s3 = await startFakeS3(); });
  afterAll(() => s3.close());
  const make = () => s3Storage({ endpoint: s3.url, bucket: "hf-files", accessKeyId: "test-key", secretAccessKey: "secret", region: "auto" });
  contract(make);
  it("signs every request (AWS Signature V4) and uses path-style addresses in its bucket", async () => {
    await make().put(newKey(), bytes, "image/png");
    expect(s3.requests.length).toBeGreaterThan(0);
    expect(s3.requests.every((r) => r.signed)).toBe(true);
    expect(s3.requests.every((r) => r.path.startsWith("/hf-files/"))).toBe(true);
  });
  it("says why when the service refuses (wrong key)", async () => {
    const wrong = s3Storage({ endpoint: s3.url, bucket: "hf-files", accessKeyId: "nope", secretAccessKey: "x", region: "auto" });
    await expect(wrong.put(newKey(), bytes, "x/y")).rejects.toThrow(/upload failed \(403\)/);
  });
});

describe("attachments over the storage", () => {
  it("database mode keeps the bytes in the row; other modes keep only a key", async () => {
    expect(await attachmentFiles(null).save(bytes, "x/y")).toEqual({ data: bytes, storageKey: "" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-att-"));
    const store = attachmentFiles(fileStorageFrom({ kind: "disk", dir, s3: {} }));
    const row = await store.save(bytes, "x/y");
    expect(row.data).toBeNull();
    expect(row.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect([...(await store.read(row))]).toEqual([...bytes]);
    // a file saved in the database before the switch is still read from its row
    expect([...(await store.read({ data: bytes, storageKey: "" }))]).toEqual([...bytes]);
    await store.remove([row]);
    expect(await store.read(row)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
