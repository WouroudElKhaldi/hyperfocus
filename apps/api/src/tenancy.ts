import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@hyperfocus/db";

// The tenancy guard (P5-03). Every query on a user-owned table is scoped to the person asking: reads, counts, updates and
// deletes only see their rows, and creates (nested ones too) are written as theirs. Who is asking comes from the request
// (the auth middleware runs each request inside `asUser`). It fails closed: a query on an owned table with nobody to scope
// it to throws, instead of quietly reading everyone's rows. Background jobs that must look at everyone's rows say so
// explicitly with `asSystem`.

const OWNED = new Set(
  Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "userId") && !["Session", "Account"].includes(m.name)).map((m) => m.name),
);

type Scope = { userId: string } | { system: true };
const scope = new AsyncLocalStorage<Scope>();

/** Runs `fn` as this person: every query inside sees and writes only their rows. */
export const asUser = <T>(userId: string, fn: () => T): T => scope.run({ userId }, fn);
/** Runs `fn` with access to everyone's rows. Only for background jobs (a scheduler that sends everyone's reminders …). */
export const asSystem = <T>(fn: () => T): T => scope.run({ system: true }, fn);
/** The person asking, or null outside a request. */
export const currentUserId = (): string | null => {
  const s = scope.getStore();
  return s && "userId" in s ? s.userId : null;
};

export class TenancyError extends Error {}

type Args = Record<string, unknown>;
const and = (where: unknown, userId: string) => ({ AND: [(where as object) ?? {}, { userId }] });

/** Puts the owner on a create's data, and on every nested create inside it (a task's steps, a goal's actions …). */
function own(data: unknown, userId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => own(d, userId));
  if (!data || typeof data !== "object" || data instanceof Date || data instanceof Uint8Array) return data;
  const out: Args = { ...(data as Args), userId };
  for (const [k, v] of Object.entries(out)) {
    if (!v || typeof v !== "object" || Array.isArray(v) || v instanceof Date || v instanceof Uint8Array) continue;
    const nested = v as Args;
    if ("create" in nested || "createMany" in nested || "connectOrCreate" in nested || "upsert" in nested) {
      const n: Args = { ...nested };
      if (n["create"]) n["create"] = own(n["create"], userId);
      if (n["createMany"]) n["createMany"] = { ...(n["createMany"] as Args), data: own((n["createMany"] as Args)["data"], userId) };
      if (n["connectOrCreate"]) n["connectOrCreate"] = own(n["connectOrCreate"], userId);
      out[k] = n;
    }
  }
  return out;
}

/** Runs a background job once for each person, as that person, so one person's job never sees another person's rows. */
export async function forEachUser(db: { user: { findMany(a: object): Promise<{ id: string }[]> } }, fn: () => Promise<unknown>): Promise<void> {
  const users = await db.user.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  for (const u of users) await asUser(u.id, fn);
}

/** The Prisma extension: wraps the app's client once (index.ts); every module uses it unchanged. */
export const tenancy = Prisma.defineExtension({
  name: "tenancy",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!OWNED.has(model)) return query(args);
        const s = scope.getStore();
        if (!s) throw new TenancyError(`A query on ${model} ran with nobody to scope it to (no request user, no asSystem).`);
        if ("system" in s) return query(args);
        const { userId } = s;
        const a = { ...(args as Args) };
        switch (operation) {
          case "create":
            a["data"] = own(a["data"], userId);
            break;
          case "createMany":
          case "createManyAndReturn":
            a["data"] = own(a["data"], userId);
            break;
          case "upsert":
            a["where"] = { ...(a["where"] as Args), userId };
            a["create"] = own(a["create"], userId);
            a["update"] = own(a["update"], userId);
            break;
          case "update":
            a["where"] = { ...(a["where"] as Args), userId };
            a["data"] = own(a["data"], userId); // nested creates inside an update are theirs too
            break;
          case "findUnique":
          case "findUniqueOrThrow":
          case "delete":
            a["where"] = { ...(a["where"] as Args), userId }; // (a unique where may carry extra filters)
            break;
          default: // findMany, findFirst(OrThrow), count, aggregate, groupBy, updateMany(AndReturn), deleteMany
            a["where"] = and(a["where"], userId);
        }
        return query(a as typeof args);
      },
    },
  },
});
