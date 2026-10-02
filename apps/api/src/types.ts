import type { PrismaClient } from "@hyperfocus/db";
import type { Request, RequestHandler, Response } from "express";

// Types shared by the API's modules.

/** The database client every module receives. */
export type Db = PrismaClient;

/** Wraps an async route so a thrown HttpError becomes a JSON error response (see index.ts). */
export type Wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => RequestHandler;

// TODO(types): JSON from outside services (the AI in P2-05, the book search sites in P2-11) gets checked with Zod schemas.
// Until then it is loosely typed, on purpose, in this one place, so the code that reads it keeps behaving exactly as before.
// biome-ignore lint/suspicious/noExplicitAny: unchecked outside JSON, see the TODO above
export type UncheckedJson = Record<string, any>;

/** An Error that carries an HTTP status. The route wrapper (index.ts) answers with it as `{ error }`. */
export type HttpError = Error & { status?: number };

export const httpError = (status: number, message: string): HttpError => Object.assign(new Error(message), { status });

/** Reads `.status` and `.message` from anything thrown, without assuming it is an Error. */
export const errorInfo = (e: unknown): { status?: number; message: string; code?: string; name?: string } =>
  e && typeof e === "object" ? (e as { status?: number; message: string; code?: string; name?: string }) : { message: String(e) };

/** A study session's active milliseconds (its length minus breaks). Dates are subtracted by their time value. */
export const activeMs = (s: { startedAt: Date; endedAt: Date | null; breakMs: number }): number =>
  (s.endedAt ? s.endedAt.getTime() : 0) - s.startedAt.getTime() - s.breakMs;
