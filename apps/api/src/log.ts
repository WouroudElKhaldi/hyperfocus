import { pino } from "pino";
import { config } from "./config.ts";

// Structured logs (one JSON object per line), so they can be searched and shipped to a log service later (P7-04).
// LOG_LEVEL in .env picks how much is written: silent, error, warn, info (default) or debug.
export const log = pino({ level: config.logLevel, base: { app: "hyperfocus-api" } });
