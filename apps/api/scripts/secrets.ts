// pnpm secrets:new-key → prints a new key for SECRETS_KEYS.
// pnpm secrets:rotate  → seals every stored token again with the first key in SECRETS_KEYS (P5-07, key rotation).
//
// Rotating the key: 1) make a key  2) put it FIRST in SECRETS_KEYS, keeping the old one after it ("new:…,old:…")
// 3) restart the app (new tokens use the new key, old ones still open)  4) pnpm secrets:rotate  5) remove the old key.
import { fileURLToPath } from "node:url";
import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { rotateSecrets } from "../src/integrations.ts";
import { keyRing, localKeyRing, newKey } from "../src/secrets.ts";
import { tenancy } from "../src/tenancy.ts";
import type { Db } from "../src/types.ts";

const command = process.argv[2];
if (command === "new-key") {
  console.log(newKey());
} else if (command === "rotate") {
  const { config } = await import("../src/config.ts");
  const ring = config.secretsKeys ? keyRing(config.secretsKeys) : localKeyRing(fileURLToPath(new URL("../secrets.key", import.meta.url)));
  const db = new PrismaClient({ datasourceUrl: config.databaseUrl, omit: OWNER_OMIT }).$extends(tenancy) as unknown as Db;
  const n = await rotateSecrets(db, ring);
  console.log(`Sealed ${n} token${n === 1 ? "" : "s"} again with the key "${ring.current}". You can now remove the older keys from SECRETS_KEYS.`);
  await db.$disconnect();
} else {
  console.log("Use: pnpm secrets:new-key | pnpm secrets:rotate");
  process.exitCode = 1;
}
