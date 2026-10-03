import { createHash } from "node:crypto";
import type { Db } from "../types.ts";
import { ADAPTERS, type Http, httpJson } from "./adapters.ts";
import { processBatch, receiveBatch } from "./ingest.ts";

// Fetching from the free sources (P6-02, P6-16): the app asks each enabled source itself, no more often than its terms
// allow (each adapter's everyMinutes), a few pages at a time. What it gets goes through the same pipeline as a batch
// delivered to the ingest endpoint; the same answer twice is the same batch, so nothing changes. (n8n can deliver
// batches too, through POST /api/ingest/jobs, but isn't needed.)

const MAX_PAGES = 3;

/** Arbeitnow is on from the start; company boards (Greenhouse, Lever) are added by an admin. */
export async function ensureDefaultSources(db: Db): Promise<void> {
  await db.jobSource.upsert({ where: { key: "arbeitnow" }, create: { key: "arbeitnow", kind: "arbeitnow", name: "Arbeitnow" }, update: {} });
}

export type FetchReport = { source: string; pages: number; items: number; created: number; error?: string };

/** Fetches every enabled source that is due. `base` (tests) replaces every source's address. */
export async function fetchDue(db: Db, { now = new Date(), http = httpJson, base = "" }: { now?: Date; http?: Http; base?: string } = {}): Promise<FetchReport[]> {
  const reports: FetchReport[] = [];
  for (const source of await db.jobSource.findMany({ where: { enabled: true }, orderBy: { id: "asc" } })) {
    const adapter = ADAPTERS[source.kind];
    if (!adapter) continue;
    if (source.lastRunAt && now.getTime() - source.lastRunAt.getTime() < adapter.everyMinutes * 60_000) continue;
    await db.jobSource.update({ where: { id: source.id }, data: { lastRunAt: now } });
    const config = { ...((source.config ?? {}) as Record<string, string>), ...(base ? { base } : {}) };
    const report: FetchReport = { source: source.key, pages: 0, items: 0, created: 0 };
    try {
      let cursor: string | null = null;
      do {
        const page = await adapter.fetchPage(config, cursor, http);
        report.pages++;
        report.items += page.items.length;
        if (page.items.length) {
          // the same answer is the same batch (nothing to do twice)
          const key = `${source.key}:${createHash("sha256").update(JSON.stringify(page.items)).digest("hex").slice(0, 32)}`;
          const { batchId, replay } = await receiveBatch(db, source, page.items, key, cursor ?? "");
          if (!replay) report.created += (await processBatch(db, batchId, now))?.created ?? 0;
        }
        cursor = page.next;
      } while (cursor && report.pages < MAX_PAGES);
    } catch (e) {
      report.error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await db.jobSource.update({ where: { id: source.id }, data: { lastError: report.error } });
    }
    reports.push(report);
  }
  return reports;
}
