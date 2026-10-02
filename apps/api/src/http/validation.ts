import type { Hook } from "@hono/zod-openapi";
import type { AppEnv } from "../app.ts";
import { httpError } from "../types.ts";
import { problemResponse } from "./problem.ts";

// Shared by every OpenAPIHono router: a request that doesn't match a route's schema gets a 400 problem whose message is
// the schema's own first message, so the texts the API used before ("Write something first.") stay the same.
// biome-ignore lint/suspicious/noExplicitAny: Hook's input and output types differ per route; this one hook serves them all
export const defaultHook: Hook<any, AppEnv, any, any> = (result, c) => {
  if (!result.success) return problemResponse(c, httpError(400, result.error.issues[0]?.message ?? "That request isn't valid."));
};
