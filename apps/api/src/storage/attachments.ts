import { type FileStorage, newKey } from "./files.ts";

// Where an email attachment's bytes are (P4-07): in the row itself (`data`, the database mode and every file from before),
// or in the file storage under `storageKey`. Routes only use these three, so they never care which.

type Stored = { data: Uint8Array | null; storageKey: string };
/** What goes in a new row (the bytes as Prisma stores them: on a plain ArrayBuffer). */
type ToStore = { data: Uint8Array<ArrayBuffer> | null; storageKey: string };

export function attachmentFiles(storage: FileStorage | null) {
  return {
    /** Saves the bytes; returns what to put in the row. */
    async save(bytes: Uint8Array, mime: string): Promise<ToStore> {
      if (!storage) return { data: new Uint8Array(bytes), storageKey: "" };
      const key = newKey();
      await storage.put(key, bytes, mime);
      return { data: null, storageKey: key };
    },
    /** The bytes, wherever they are; null if the file storage has lost them. */
    async read(row: Stored): Promise<Uint8Array | null> {
      if (!row.storageKey) return row.data;
      if (!storage) throw new Error("This file is in the file storage, but FILE_STORAGE is now set to database. Set it back to read the file.");
      return storage.get(row.storageKey);
    },
    /** Removes the bytes of rows being deleted (bytes inside the row go with the row). */
    async remove(rows: { storageKey: string }[]): Promise<void> {
      const keys = rows.map((r) => r.storageKey).filter(Boolean);
      if (!keys.length) return;
      if (!storage) return; // stored elsewhere, and this app can't reach it now: leave it rather than fail the delete
      await Promise.all(keys.map((k) => storage.remove(k).catch((e: unknown) => console.error(`Couldn't remove stored file ${k}:`, e))));
    },
  };
}
export type AttachmentFiles = ReturnType<typeof attachmentFiles>;
