async function req(method, url, body) {
  let res;
  try {
    res = await fetch("/api" + url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Is `npm run dev` running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `Request failed (${res.status})`);
    e.code = data.error;
    throw e;
  }
  // anything that changed data may have earned your pet some XP, so tell the pet widget to look again
  if (method !== "GET") window.dispatchEvent(new Event("data-changed"));
  return data;
}

export const api = {
  get: (u) => req("GET", u),
  post: (u, b) => req("POST", u, b ?? {}),
  put: (u, b) => req("PUT", u, b ?? {}),
  patch: (u, b) => req("PATCH", u, b),
  del: (u) => req("DELETE", u),
};

export const KINDS = {
  thought: "💭 Thought",
  note: "📝 Note",
  post_idea: "✨ Post idea",
  project_idea: "🚀 Project idea",
};

// Study time excludes breaks. A running session counts up to now, or to the moment it was paused.
const studyEnd = (s, now) => (s.endedAt ? new Date(s.endedAt).getTime() : s.pausedAt ? new Date(s.pausedAt).getTime() : now);
export const studySecs = (s, now = Date.now()) =>
  Math.max(0, Math.floor((studyEnd(s, now) - new Date(s.startedAt).getTime() - (s.breakMs || 0)) / 1000));
export const studyMins = (s, now = Date.now()) => Math.round(studySecs(s, now) / 60);
