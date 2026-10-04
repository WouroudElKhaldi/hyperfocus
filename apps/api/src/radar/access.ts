import type { Db } from "../types.ts";

// Who may use Job Radar (the owner, 2026-10-04: "under testing"): admins, and everyone once an admin switches the
// "job-radar" feature flag on (Admin → Feature flags). Job applications stay open to everyone either way.

export const RADAR_FLAG = "job-radar";
/** Job Radar's API routes: filters, matches, status (job applications are /api/jobs). */
export const RADAR_ROUTES = /^\/api\/(job-filters|radar)(\/|$)/;

let cached = { at: 0, on: false };
/** Is Job Radar on for everyone? (read at most every 30 s; switching the flag clears it) */
export async function radarForEveryone(prisma: Pick<Db, "featureFlag">): Promise<boolean> {
  if (Date.now() - cached.at > 30_000) cached = { at: Date.now(), on: !!(await prisma.featureFlag.findUnique({ where: { key: RADAR_FLAG }, select: { enabled: true } }))?.enabled };
  return cached.on;
}
export const forgetRadarFlag = () => {
  cached = { at: 0, on: false };
};
/** May this person use Job Radar? */
export const mayUseRadar = async (prisma: Pick<Db, "featureFlag">, role: string | undefined) => role === "admin" || (await radarForEveryone(prisma));
