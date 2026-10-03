import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../api.ts";
import { keyOf } from "../../api/query.ts";

// Accounts on the website (P5-04). /api/me says how this copy runs and who is signed in; the sign-in calls go to Better
// Auth (/api/auth/*, P5-01), which isn't part of the typed API, so they are plain requests here.

const ME = keyOf("/me");

/** How this copy runs (local: nobody signs in) and who is signed in. Refreshed when any request says "please sign in". */
export function useMe() {
  const client = useQueryClient();
  useEffect(() => {
    const again = () => void client.invalidateQueries({ queryKey: ME });
    window.addEventListener("signed-out", again);
    return () => window.removeEventListener("signed-out", again);
  }, [client]);
  return useQuery({ queryKey: ME, queryFn: () => api.get("/me"), staleTime: 60_000, meta: { silent: true } });
}

/** A plain request to Better Auth. Throws its message ("Invalid email or password" …) when it says no. */
export async function authCall<T = unknown>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || data.error || `That didn't work (${r.status}).`), { status: r.status, code: data.code });
  return data as T;
}

/** Signs out and shows the sign-in page. */
export async function signOut(client: ReturnType<typeof useQueryClient>) {
  await authCall("/sign-out", {});
  // nothing of the person who left stays in this browser's memory; then "who is signed in" is asked again (nobody)
  client.removeQueries({ predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(ME) });
  await client.refetchQueries({ queryKey: ME });
}
