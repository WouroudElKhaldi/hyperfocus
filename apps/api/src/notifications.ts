import { inQuietHours } from "./clock.ts";
import { getSettings, type Settings } from "./notify.ts";
import type { OutboxNote, Send } from "./outbox.ts";
import { asUser } from "./tenancy.ts";
import type { Db } from "./types.ts";

// Where a notification goes (P5-11). Every one lands in the person's in-app list (the bell at the top), always, even in
// quiet hours. Outside quiet hours it also pops up on the channels they switched on: a desktop pop-up on this computer
// (local mode only: in the cloud the server is not your computer) and web push on their devices (part 3). The daily
// email digest (part 4) is built from the in-app list.

export type Channel = (note: OutboxNote, settings: Settings) => Promise<{ ok: boolean; error?: string }>;
export type Channels = { desktop?: Channel | null; push?: Channel | null };

/** The outbox's sender: one message, for the person it belongs to, to each of their channels. */
export function deliverTo(prisma: Db, channels: Channels, now = () => new Date()): Send {
  return (note) =>
    asUser(note.userId, async () => {
      // the in-app copy: once per message (a retry never makes a second one)
      await prisma.notification.createMany({ data: [{ key: note.key, title: note.title, body: note.body }], skipDuplicates: true });
      const settings = await getSettings(prisma);
      if (inQuietHours(settings.quietFrom, settings.quietTo, settings.timeZone, now())) return { ok: true };
      const errors: string[] = [];
      for (const [name, channel] of Object.entries(channels)) {
        if (!channel) continue;
        if (name === "desktop" && !settings.desktop) continue;
        if (name === "push" && !settings.push) continue;
        const r = await channel(note, settings).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
        if (!r.ok) errors.push(`${name}: ${r.error ?? "failed"}`);
      }
      // a channel that failed is tried again later (the in-app copy is already there and won't be doubled)
      return errors.length ? { ok: false, error: errors.join("; ") } : { ok: true };
    });
}
