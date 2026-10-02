import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { type ApiConfig, configErrorMessage, parseApiConfig } from "@hyperfocus/shared/config";
import dotenv from "dotenv";

// The one place the API reads its settings. Every module imports `config` from here instead of reading process.env.
//
// Where settings come from, strongest first:
//   1. real environment variables (the test harness, the demo script, a hosting provider)
//   2. the .env file at the project root (the one file to edit)
//   3. apps/api/.env, only if it still exists: settings lived there before P1-10, so it is still read for now
// An empty value never hides a filled one further down the list.
const ROOT_ENV = fileURLToPath(new URL("../../../.env", import.meta.url));
const OLD_ENV = fileURLToPath(new URL("../.env", import.meta.url));

for (const file of [ROOT_ENV, OLD_ENV]) {
  if (!fs.existsSync(file)) continue;
  for (const [k, v] of Object.entries(dotenv.parse(fs.readFileSync(file)))) if (v && !process.env[k]) process.env[k] = v;
}
if (fs.existsSync(OLD_ENV)) {
  console.warn("Note: apps/api/.env is no longer needed. Settings now live in the .env file at the project root (apps/api/.env is still read for now).");
}

const result = parseApiConfig(process.env);
if (!result.ok) {
  // refuse to start, and say exactly what to fix
  console.error(configErrorMessage(result.problems, "the .env file at the project root (or your environment variables)"));
  process.exit(1);
}

export const config: ApiConfig = result.config;
