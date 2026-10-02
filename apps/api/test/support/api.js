import { inject } from "vitest";

const base = () => inject("apiUrl");

// Calls the API and returns { status, body, headers }. JSON bodies are parsed; anything else comes back as text.
export async function api(method, path, body, { headers = {}, raw } = {}) {
  const init = { method, headers: { ...headers } };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base() + path, init);
  const text = await res.text();
  let parsed = text;
  // any JSON type: application/json, and application/problem+json for errors from the Hono routes
  if (/[/+]json\b/.test(res.headers.get("content-type") || "")) parsed = text ? JSON.parse(text) : null;
  return { status: res.status, body: parsed, headers: res.headers };
}

export const get = (p) => api("GET", p);
export const post = (p, b) => api("POST", p, b);
export const patch = (p, b) => api("PATCH", p, b);
export const put = (p, b) => api("PUT", p, b);
export const del = (p) => api("DELETE", p);

// Talks to a fake outside service (see fakes.js).
async function control(which, action, body) {
  const url = inject(which === "ai" ? "aiUrl" : "n8nUrl");
  const r = await fetch(`${url}/__control/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
export const fake = {
  requests: (which) => control(which, "requests"),
  reset: (which) => control(which, "reset"),
  failWith: (which, status) => control(which, "status", { status }),
};

// Expects a 2xx-style success with the given status and returns the body.
export async function ok(promise, status = 200) {
  const r = await promise;
  if (r.status !== status) throw new Error(`Expected ${status}, got ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

export const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
