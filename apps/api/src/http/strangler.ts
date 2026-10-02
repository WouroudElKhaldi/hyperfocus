import { Readable } from "node:stream";
import type { RequestHandler } from "express";
import type { Env, Hono } from "hono";
import { RegExpRouter } from "hono/router/reg-exp-router";

// The strangler (ADR-001): the new Hono app answers the routes it has, and Express answers everything else, so routes
// can move over one module at a time behind the same /api paths. This runs as the first Express middleware after CORS.
//
// Which requests go to Hono is decided from Hono's own route table *before* touching the request body. That matters:
// a request Express answers must reach Express's JSON parser with its body still unread.

/** Says whether the Hono app has a route (not just middleware) for a method and path. HEAD counts as GET. */
export function routeOwner<E extends Env>(app: Hono<E>) {
  const owned = new RegExpRouter<true>();
  for (const r of app.routes) if (r.method !== "ALL") owned.add(r.method, r.path, true);
  return (method: string, path: string) => owned.match(method === "HEAD" ? "GET" : method, path)[0].length > 0;
}

/** Express middleware: hands the request to Hono when Hono has a route for it, otherwise passes it on to Express. */
export function honoFirst<E extends Env>(app: Hono<E>): RequestHandler {
  const owns = routeOwner(app);
  return (req, res, next) => {
    if (!owns(req.method, req.path)) return next();
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) headers.append(k, x);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(`http://${req.headers.host ?? "localhost"}${req.originalUrl}`, {
      method: req.method,
      headers,
      ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" as const } : {}),
    });
    Promise.resolve(app.fetch(request))
      .then((response: Response) => {
        res.status(response.status);
        response.headers.forEach((value, key) => { if (key !== "set-cookie") res.setHeader(key, value); });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) res.setHeader("set-cookie", cookies);
        if (!response.body || req.method === "HEAD") return void res.end();
        Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
      })
      .catch(next);
  };
}
