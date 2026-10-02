import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "../../../../security-headers.mjs";
import { SCALES, SPIN_SHAPES } from "./engine.ts";
import { SONGS, YT_ID } from "./songs.ts";
import { GENRES, LAYERS, TRACKS } from "./tracks.ts";

// P3-16: the music library's rules. (That every generated track really makes sound is checked in a browser:
// e2e/pages.spec.js "every generated track plays".)

const sounds = TRACKS.filter((t) => t.kind !== "song");
const songs = TRACKS.filter((t) => t.kind === "song");

describe("the generated tracks", () => {
  it("are 80 or more, each with its own id, in a genre that exists", () => {
    expect(sounds.length).toBeGreaterThanOrEqual(80);
    const ids = TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const genres = new Set(GENRES.map((g) => g.id));
    for (const t of TRACKS) expect(genres.has(t.genre), `${t.id}: genre ${t.genre}`).toBe(true);
  });

  it("only use scales and 8D paths the engine knows", () => {
    const shapes = new Set(SPIN_SHAPES.map(([id]) => id));
    for (const t of sounds) {
      if (t.kind === "music") expect(Object.keys(SCALES), `${t.id}: scale`).toContain(t.scale);
      if (t.shape) expect(shapes.has(t.shape), `${t.id}: shape ${t.shape}`).toBe(true);
    }
    for (const l of LAYERS) expect(["noise", "beats"]).toContain(l.def.kind);
  });
});

describe("the songs allowlist", () => {
  it("is the only source of songs, and every entry is a plain YouTube video id", () => {
    expect(songs.length).toBe(SONGS.length);
    for (const s of SONGS) expect(s.yt, `${s.artist} – ${s.title}`).toMatch(YT_ID);
    expect(new Set(SONGS.map((s) => s.yt)).size).toBe(SONGS.length);
  });

  it("rejects anything that isn't an id (a link, a path, a script)", () => {
    for (const bad of ["https://youtu.be/abc", "../../etc/pass", "<script>x</sc", "dQw4w9WgXcQ?autoplay=1", ""]) expect(bad).not.toMatch(YT_ID);
  });
});

describe("the page's security headers", () => {
  const csp = SECURITY_HEADERS["Content-Security-Policy"];
  it("allow frames only from YouTube's privacy-friendly player, and scripts only from this site", () => {
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com;");
    expect(csp).not.toMatch(/frame-src[^;]*youtube\.com(?!-)/);
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
    expect(csp).toContain("object-src 'none'");
  });
});
