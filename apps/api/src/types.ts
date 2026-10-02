import type { PrismaClient } from "@hyperfocus/db";

// Types shared by the API's modules.

/** The database client every module receives. */
export type Db = PrismaClient;


// TODO(types): JSON from outside services (the AI in P2-05, the book search sites in P2-11) gets checked with Zod schemas.
// Until then it is loosely typed, on purpose, in this one place, so the code that reads it keeps behaving exactly as before.
// biome-ignore lint/suspicious/noExplicitAny: unchecked outside JSON, see the TODO above
export type UncheckedJson = Record<string, any>;

/** An Error that carries an HTTP status. The API answers with it as a problem (http/problem.ts). */
export type HttpError = Error & { status?: number };

export const httpError = (status: number, message: string): HttpError => Object.assign(new Error(message), { status });

/** Reads `.status` and `.message` from anything thrown, without assuming it is an Error. */
export const errorInfo = (e: unknown): { status?: number; message: string; code?: string; name?: string } =>
  e && typeof e === "object" ? (e as { status?: number; message: string; code?: string; name?: string }) : { message: String(e) };

/** A study session's active milliseconds (its length minus breaks). Dates are subtracted by their time value. */
export const activeMs = (s: { startedAt: Date; endedAt: Date | null; breakMs: number }): number =>
  (s.endedAt ? s.endedAt.getTime() : 0) - s.startedAt.getTime() - s.breakMs;

/** Runs a Prisma call that targets one record and gives null when that record doesn't exist (Prisma error P2025). */
export async function orNull<T>(query: Promise<T>): Promise<T | null> {
  try {
    return await query;
  } catch (e) {
    if (errorInfo(e).code === "P2025") return null;
    throw e;
  }
}

/** Drops the fields that are undefined (not sent), so a partial update only touches the fields it was given. */
export const compact = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };

/** A date from a request (an ISO string or a timestamp), or null when it isn't a real date. */
export const parseDate = (v: string | number | Date) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
