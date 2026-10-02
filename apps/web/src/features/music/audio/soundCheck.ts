import { Engine } from "./engine.ts";
import { TRACKS } from "./tracks.ts";

/**
 * Plays every generated track for a moment and listens: returns the ids of the ones that made no sound (P3-16).
 * Needs a click first (browsers only allow sound after one). Used by the /dev/sound page and its browser test.
 */
export async function checkEveryTrack(): Promise<string[]> {
  const engine = new Engine();
  const silent: string[] = [];
  for (const t of TRACKS) {
    if (t.kind === "song") continue;
    await engine.play(t);
    let heard = 0;
    for (let i = 0; i < 20 && !heard; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const bins = new Uint8Array(engine.analyser?.frequencyBinCount ?? 0);
      engine.analyser?.getByteFrequencyData(bins);
      heard = bins.reduce((a, b) => a + b, 0);
    }
    if (!heard || engine.snapshot().ctxState !== "running") silent.push(t.id);
  }
  engine.stop();
  return silent;
}
