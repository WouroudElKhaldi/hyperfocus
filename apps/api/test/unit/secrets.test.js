import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SecretError, keyRing, localKeyRing, newKey, seal, sealedWith, unseal } from "../../src/secrets.ts";

// P5-07: tokens sealed with AES-256-GCM, a key ring for rotation, a key file in local mode.

const OLD = `old:${Buffer.alloc(32, 1).toString("base64")}`;
const NEW = `new:${Buffer.alloc(32, 2).toString("base64")}`;

describe("sealing secrets", () => {
  it("opens what it sealed; the stored text shows nothing of the secret, and is different every time", () => {
    const ring = keyRing(OLD);
    const a = seal(ring, "ya29.secret-token", "integration:gmail");
    expect(a).not.toContain("secret-token");
    expect(seal(ring, "ya29.secret-token", "integration:gmail")).not.toBe(a);
    expect(unseal(ring, a, "integration:gmail")).toBe("ya29.secret-token");
    expect(sealedWith(a)).toBe("old");
  });

  it("refuses a changed value, another provider's context, an unknown key, or junk", () => {
    const ring = keyRing(OLD);
    const a = seal(ring, "token", "integration:gmail");
    const parts = a.split(".");
    parts[4] = Buffer.from("tampered").toString("base64url");
    expect(() => unseal(ring, parts.join("."), "integration:gmail")).toThrow(SecretError);
    expect(() => unseal(ring, a, "integration:linkedin")).toThrow(SecretError);
    expect(() => unseal(keyRing(NEW), a, "integration:gmail")).toThrow(/isn't in SECRETS_KEYS/);
    expect(() => unseal(ring, "plain text", "integration:gmail")).toThrow(SecretError);
  });

  it("rotation: the first key seals, older ones still open", () => {
    const old = seal(keyRing(OLD), "token", "c");
    const both = keyRing(`${NEW},${OLD}`);
    expect(both.current).toBe("new");
    expect(unseal(both, old, "c")).toBe("token");
    expect(sealedWith(seal(both, "token", "c"))).toBe("new");
  });

  it("explains a wrong SECRETS_KEYS", () => {
    expect(() => keyRing("")).toThrow(/empty/);
    expect(() => keyRing("nokey")).toThrow(/id:key/);
    expect(() => keyRing(`a:${Buffer.alloc(16).toString("base64")}`)).toThrow(/32 bytes/);
    expect(() => keyRing(`${OLD},${OLD}`)).toThrow(/twice/);
    expect(keyRing(newKey("fresh")).current).toBe("fresh");
  });

  it("local mode: a key file is made once and used from then on", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hf-key-")), "secrets.key");
    const sealed = seal(localKeyRing(file), "token", "c");
    expect(unseal(localKeyRing(file), sealed, "c")).toBe("token");
    expect(fs.readFileSync(file, "utf8")).toMatch(/^local:/);
  });
});
