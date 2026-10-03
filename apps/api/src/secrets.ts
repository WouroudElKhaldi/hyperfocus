import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Secrets at rest (P5-07): each person's tokens for Gmail, LinkedIn … are sealed with AES-256-GCM before they reach the
// database, so a copy of the database (a backup, a leaked dump) shows no token. The key never goes into the database.
//
// SECRETS_KEYS is a key ring: "id:key,id:key,…" with 32-byte keys in base64. The FIRST key seals new secrets; the
// others can still open older ones. To rotate: put a new key first, keep the old one after it, run `pnpm secrets:rotate`
// (every secret is sealed again with the new key), then remove the old key. Make a key: `pnpm secrets:new-key`.
// Local mode without SECRETS_KEYS: a key is made once and kept in a file next to the settings (never in the database).

export type KeyRing = { current: string; keys: Map<string, Buffer> };
export class SecretError extends Error {}

const ID = /^[a-z0-9_-]{1,32}$/i;

/** Reads "id:base64,id:base64" (first = the one that seals). Throws a clear message when it is wrong. */
export function keyRing(spec: string): KeyRing {
  const keys = new Map<string, Buffer>();
  let current = "";
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(":");
    const id = part.slice(0, i);
    const key = Buffer.from(part.slice(i + 1), "base64");
    if (i < 1 || !ID.test(id)) throw new SecretError(`SECRETS_KEYS: "${part.slice(0, 12)}…" should be id:key (the id is letters, digits, - or _)`);
    if (key.length !== 32) throw new SecretError(`SECRETS_KEYS: the key "${id}" must be 32 bytes in base64 (make one with pnpm secrets:new-key)`);
    if (keys.has(id)) throw new SecretError(`SECRETS_KEYS: the id "${id}" is used twice`);
    keys.set(id, key);
    current ||= id;
  }
  if (!current) throw new SecretError("SECRETS_KEYS is empty");
  return { current, keys };
}

/** A new key ring entry: "id:base64 of 32 random bytes". */
export const newKey = (id = `k${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`) => `${id}:${randomBytes(32).toString("base64")}`;

/** Local mode: the key in `file`, made the first time. */
export function localKeyRing(file: string): KeyRing {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, newKey("local"), { mode: 0o600, flag: "wx" });
  }
  return keyRing(fs.readFileSync(file, "utf8"));
}

/** Seals text: "v1.<key id>.<iv>.<tag>.<ciphertext>" (base64url). `context` (like "gmail") must match to open it. */
export function seal(ring: KeyRing, text: string, context: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", ring.keys.get(ring.current) as Buffer, iv);
  c.setAAD(Buffer.from(context));
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", ring.current, iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Opens what `seal` made. Throws when the key is missing, or the value or its context was changed. */
export function unseal(ring: KeyRing, sealed: string, context: string): string {
  const [v, id, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !id || !iv || !tag || body === undefined) throw new SecretError("This isn't a sealed secret.");
  const key = ring.keys.get(id);
  if (!key) throw new SecretError(`The key "${id}" that sealed this secret isn't in SECRETS_KEYS.`);
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(context));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new SecretError("This secret couldn't be opened: it was changed, or sealed for something else.");
  }
}

/** The id of the key that sealed this value. */
export const sealedWith = (sealed: string) => sealed.split(".")[1] ?? "";
