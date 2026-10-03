// People for cloud-mode tests (P5): a tiny browser that keeps its cookies, and signing someone up through the real flow
// (sign up → confirmation email in the log → open the link → signed in).

export const PUBLIC = "http://localhost:5999";
export const CLOUD = { APP_MODE: "cloud", BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-1234567890", PUBLIC_URL: PUBLIC, MAIL_DRY_RUN: "1" };

export function browser(base) {
  const jar = new Map();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const remember = (r) => {
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const v = pair.slice(i + 1);
      if (v) jar.set(pair.slice(0, i), v);
      else jar.delete(pair.slice(0, i));
    }
    return r;
  };
  const call = async (method, path, body, raw) =>
    remember(await fetch(`${base()}${path}`, {
      method, redirect: "manual",
      headers: { Origin: PUBLIC, Cookie: cookie(), ...(body !== undefined ? { "Content-Type": raw ? "application/octet-stream" : "application/json" } : {}) },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    }));
  const json = async (method, path, body) => {
    const r = await call(method, path, body);
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return { call, json, open: (url) => call("GET", url.replace(/^https?:\/\/[^/]+/, "")), jar };
}

/** Signs a person up and in (confirming the email from the log). */
export async function signUp(api, email, name) {
  const b = browser(() => api.url);
  await b.json("POST", "/api/auth/sign-up/email", { email, password: `pass-${name}-12345`, name });
  let link;
  for (const end = Date.now() + 10000; Date.now() < end && !link; ) {
    const line = api.log().split("\n").reverse().find((l) => l.startsWith(`[auth mail] to=${email} `) && l.includes("Confirm"));
    link = line && JSON.parse(line.slice(line.indexOf("text=") + 5)).match(/https?:\/\/\S+/)?.[0];
    if (!link) await new Promise((r) => setTimeout(r, 100));
  }
  if (!link) throw new Error(`No confirmation email for ${email}`);
  await b.open(link);
  return b;
}
