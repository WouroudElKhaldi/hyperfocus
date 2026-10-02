import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Engine, SPIN_SHAPES } from "../audio/engine.ts";
import { SONGS, YT_ID } from "../audio/songs.ts";
import { GENRES, LAYERS, type SongTrack, type SoundTrack, TRACKS, type Track, genreById, trackById } from "../audio/tracks.ts";
import Icon from "../../../components/Icon.tsx";

// One engine for the whole app, so the music keeps playing while you move between pages.
const engine = new Engine<SoundTrack>();
const PREFS = "music-prefs";
/** What the player remembers in this browser. */
type Prefs = { last?: string; favs?: string[]; spin?: boolean; shape?: string; period?: number; volume?: number; layerVolume?: number };
const load = (): Prefs => { try { return JSON.parse(localStorage.getItem(PREFS) ?? "null") || {}; } catch { return {}; } };
const save = (p: Prefs) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* storage may be unavailable */ } };

function useEngine() {
  const [s, setS] = useState(engine.snapshot());
  useEffect(() => engine.on(setS), []);
  return s;
}

// ---- songs (YouTube) ----
// Safety rules: only the exact video IDs in songs.ts can ever be played; the frame is sandboxed, uses the privacy-friendly
// youtube-nocookie.com address, and loads nothing until a song is chosen. We never load YouTube's script into this page: the
// player is controlled with plain messages, and we only listen to messages that really come from that frame.
const PAGE = 60;
const SONG_ARTISTS = [...new Set(TRACKS.filter((t) => t.genre === "songs").flatMap((t) => (t.artist ? [t.artist] : [])))].sort((a, b) => a.localeCompare(b));
const YT_ORIGIN = "https://www.youtube-nocookie.com";
const KNOWN = new Set(SONGS.map((s) => s.yt));
const embedUrl = (id: string) => `${YT_ORIGIN}/embed/${id}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;

// Every track gets its own little cover, made from its name, so you can find your favorites by sight.
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function artStyle(t: Track) {
  const base = genreById(t.genre)?.hue ?? 262, h = hash(t.id);
  const a = (base + (h % 50) - 25 + 360) % 360, b = (a + 35 + ((h >> 5) % 60)) % 360;
  const x1 = 15 + (h % 55), y1 = 12 + ((h >> 3) % 50), x2 = 40 + ((h >> 7) % 55), y2 = 45 + ((h >> 9) % 50);
  return {
    background: `radial-gradient(circle at ${x1}% ${y1}%, hsl(${a} 85% 72% / .95), transparent 58%), radial-gradient(circle at ${x2}% ${y2}%, hsl(${b} 80% 58% / .9), transparent 62%), linear-gradient(150deg, hsl(${a} 55% 30%), hsl(${b} 60% 18%))`,
  };
}
function Art({ t, size = 44, className = "" }: { t: Track; size?: number; className?: string }) {
  const g = genreById(t.genre);
  return <span className={"mp-art " + className} style={{ ...artStyle(t), width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true"><i>{t.spin || t.eightD ? "🌀" : g?.icon}</i></span>;
}

export default function MusicPlayer() {
  const st = useEngine();
  const prefs0 = useMemo(load, []);
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useState(() => trackById(prefs0.last)?.genre || "simple");
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState(prefs0.favs || []);
  const [spin, setSpin] = useState(!!prefs0.spin);
  const [shape, setShape] = useState(prefs0.shape || "circle");
  const [period, setPeriod] = useState(prefs0.period || 12);
  const [sleep, setSleep] = useState(0);
  const [vol, setVol] = useState(prefs0.volume ?? 0.7);
  const [lvol, setLvol] = useState(prefs0.layerVolume ?? 0.5);
  const [beepNote, setBeepNote] = useState("");
  const [artist, setArtist] = useState(""); // filter inside the Songs tab
  const [limit, setLimit] = useState(PAGE); // long lists show a page at a time, so the panel stays quick
  const [song, setSong] = useState<SongTrack | null>(null); // the song being played, if any
  const [songState, setSongState] = useState("idle"); // idle | loading | playing | paused | error
  const viz = useRef<HTMLCanvasElement>(null);
  const radar = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const nextRef = useRef(() => {});
  const songTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { engine.volume = vol; }, []);
  useEffect(() => setLimit(PAGE), [genre, query, artist]);
  useEffect(() => { save({ ...load(), volume: vol, layerVolume: lvol, spin, shape, period, favs }); }, [vol, lvol, spin, shape, period, favs]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cur = st.track;
  const now: Track | null = song || cur; // what is playing, from either source
  const going = song ? songState === "playing" : st.playing && !!cur;
  const spinning = !song && st.spatial && !!cur && cur.kind !== "beats";

  // ---- talking to the YouTube frame ----
  const yt = (func: string, args: unknown[] = []) => { try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN); } catch { /* the frame may not be ready yet */ } };
  const onFrameLoad = () => {
    try { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YT_ORIGIN); } catch { /* ignore */ }
    yt("setVolume", [Math.round(vol * 100)]);
  };
  useEffect(() => {
    if (!song) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== frame.current?.contentWindow) return; // only the real player frame
      let d = e.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      if (!d || typeof d !== "object") return;
      const state = d.event === "onStateChange" ? d.info : d.event === "infoDelivery" && d.info && typeof d.info.playerState === "number" ? d.info.playerState : null;
      if (state === 1) setSongState("playing");
      else if (state === 2) setSongState("paused");
      else if (state === 0) { setSongState("paused"); nextRef.current(); } // finished: go to the next song
      if (d.event === "onError") setSongState("error");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [song]);

  // the visualizer and the 8D radar are drawn from the live sound, only while the panel is open
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const trail: [number, number, number][] = [];
    const css = () => getComputedStyle(document.documentElement);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = viz.current;
      if (cv) {
        const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext("2d");
        if (!c) return; // (a canvas always has a 2D context)
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
        const live = going && !song; // a YouTube song's sound is not available to draw
        const bins = new Uint8Array(engine.analyser?.frequencyBinCount || 64);
        if (engine.analyser && live) engine.analyser.getByteFrequencyData(bins);
        const n = 32, gap = 3, bw = (w - gap * (n - 1)) / n, t = performance.now() / 1000;
        for (let i = 0; i < n; i++) {
          const v = live ? Math.pow((bins[Math.min(bins.length - 1, Math.floor(Math.pow(i / n, 1.5) * bins.length * 0.8))] ?? 0) / 255, 1.2) : going ? 0.12 + 0.1 * (1 + Math.sin(t * 2 + i * 0.5)) : 0.04;
          const bh = Math.max(3, v * h);
          c.fillStyle = "rgba(255,255,255," + (0.35 + v * 0.6) + ")";
          c.beginPath(); if (c.roundRect) c.roundRect(i * (bw + gap), h - bh, bw, bh, Math.min(bw / 2, 3)); else c.rect(i * (bw + gap), h - bh, bw, bh); c.fill();
        }
      }
      const rd = radar.current;
      if (rd) {
        const dpr = window.devicePixelRatio || 1, S = rd.clientWidth;
        if (rd.width !== Math.round(S * dpr)) { rd.width = Math.round(S * dpr); rd.height = Math.round(S * dpr); }
        const c = rd.getContext("2d");
        if (!c) return;
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
        const ink = css().getPropertyValue("--muted").trim() || "#888", accent = css().getPropertyValue("--accent").trim() || "#7447e6", mid = S / 2, R = S * 0.4;
        c.strokeStyle = ink; c.globalAlpha = 0.35; c.lineWidth = 1;
        for (const k of [1, 0.55]) { c.beginPath(); c.arc(mid, mid, R * k, 0, 7); c.stroke(); }
        c.globalAlpha = 0.9; c.fillStyle = ink; c.beginPath(); c.arc(mid, mid, 5, 0, 7); c.fill(); // you, seen from above
        c.beginPath(); c.moveTo(mid, mid - 11); c.lineTo(mid - 4, mid - 5); c.lineTo(mid + 4, mid - 5); c.closePath(); c.fill();
        const p = engine.spinPos();
        if (p && going) {
          trail.push([mid + p.x * R * 1.05, mid - p.z * R * 1.05, p.y]); if (trail.length > 26) trail.shift();
          trail.forEach(([x, y], i) => { c.globalAlpha = (i / trail.length) * 0.5; c.fillStyle = accent; c.beginPath(); c.arc(x, y, 3 + i * 0.12, 0, 7); c.fill(); });
          const [x, y, up] = trail.at(-1) ?? [mid, mid, 0]; c.globalAlpha = 1; c.fillStyle = accent; c.beginPath(); c.arc(x, y, 7 + up * 5, 0, 7); c.fill(); // (the trail is never empty here)
        }
        c.globalAlpha = 1;
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [open, going, spinning, song]);

  if (!engine.supported) return null;

  const q = query.trim().toLowerCase();
  const list = q
    ? TRACKS.filter((t) => (t.name + " " + t.desc + " " + (genreById(t.genre)?.name || "")).toLowerCase().includes(q))
    : genre === "favs" ? TRACKS.filter((t) => favs.includes(t.id)) : TRACKS.filter((t) => t.genre === genre && (!artist || genre !== "songs" || t.artist === artist));
  const shown = list.slice(0, limit);
  const countOf = (id: string) => TRACKS.filter((t) => t.genre === id).length;

  const play = (t: Track) => {
    if (t.kind === "song") {
      if (!YT_ID.test(t.yt) || !KNOWN.has(t.yt)) return; // never play anything that is not on the list
      engine.stop();
      setSong(t); setSongState("loading");
      save({ ...load(), last: t.id });
      return;
    }
    setSong(null); setSongState("idle");
    if (t.spin) engine.setSpatial(true, t.spin, t.shape || "circle"); else engine.setSpatial(spin, period, shape);
    engine.play(t);
    if (t.spin) { setPeriod(t.spin); setShape(t.shape || "circle"); }
    save({ ...load(), last: t.id });
  };
  const step = (d: number) => {
    const pool = now ? TRACKS.filter((t) => t.genre === now.genre) : list;
    if (!pool.length) return;
    const i = Math.max(0, pool.findIndex((t) => t.id === now?.id));
    const t = pool[(i + d + pool.length) % pool.length];
    if (t) play(t);
  };
  nextRef.current = () => step(1);
  const surprise = () => { const pool = list.length ? list : TRACKS; const t = pool[Math.floor(Math.random() * pool.length)]; if (t) play(t); };
  const main = () => {
    if (song) { yt(songState === "playing" ? "pauseVideo" : "playVideo"); return; }
    if (cur) { engine.toggle(); return; }
    const first = trackById(prefs0.last) || list[0] || TRACKS[0];
    if (first) play(first);
  };
  const stopAll = () => { engine.stop(); setSong(null); setSongState("idle"); clearTimeout(songTimer.current); };
  const toggleFav = (id: string) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const onVol = (v: number) => { setVol(v); engine.setVolume(v); if (song) yt("setVolume", [Math.round(v * 100)]); };
  const onLvol = (v: number) => { setLvol(v); engine.setLayerVolume(v); };
  const onSpin = (on: boolean) => { setSpin(on); engine.setSpatial(on, period, shape); };
  const onShape = (s: string) => { setShape(s); engine.setSpatial(true, period, s); setSpin(true); };
  const onPeriod = (p: number) => { setPeriod(p); engine.setSpatial(st.spatial || spin, p, shape); };
  const onLayer = (id: string) => engine.setLayer(id || null, LAYERS.find((l) => l.id === id)?.def);
  const onSleep = (m: number) => {
    setSleep(m); engine.setSleep(m);
    clearTimeout(songTimer.current);
    if (m > 0) songTimer.current = setTimeout(() => { yt("pauseVideo"); setSleep(0); }, m * 60000); // the same timer also pauses a song
  };
  const beep = async () => {
    const state = await engine.beep();
    setBeepNote(state === "running" ? "You should have heard two soft notes. If you didn't, check that this browser tab isn't muted (right-click the tab), the computer volume is up, and the right speakers or headphones are selected." : "Your browser is blocking sound. Click the button again, and allow sound for this site in the address bar if it asks.");
  };
  const blocked = going && !song && st.ctxState !== "running";
  const canSpin = !song && (cur ? cur.kind !== "beats" : true);
  const g = now && genreById(now.genre);
  const showPanel = open || !!song; // a playing song keeps its (small) player on screen, as YouTube requires

  const ui = (
    <>
      <button className={"music-fab" + (going ? " playing" : "")} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={going ? `Music: playing ${now?.name}` : "Open music player"} title="Focus music" style={going && now ? artStyle(now) : undefined}>
        {going ? <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span> : <Icon name="music" size={22} />}
      </button>

      {showPanel && (
        <section className={"music-panel" + (open ? "" : " mini")} role="dialog" aria-label="Focus music">
          <header className="mp-hero" style={now ? artStyle(now) : undefined}>
            <div className="mp-hero-top">
              {now ? <Art t={now} size={64} className="mp-cover" /> : <span className="mp-art mp-cover mp-idle" style={{ width: 64, height: 64 }}><Icon name="music" size={28} /></span>}
              <div className="mp-now">
                <b>{now ? now.name : "Focus music"}</b>
                <span>{now ? (song ? `${song.desc}${song.eightD ? "" : " · on YouTube"}` : `${g?.name}${spinning && now.genre !== "spin" ? " · 8D" : ""}${now.headphones ? " · headphones best" : ""}`) : "Pick something, then press play"}</span>
              </div>
              <button className="mp-x" onClick={() => (open ? setOpen(false) : stopAll())} aria-label={open ? "Close music player" : "Stop the song"}><Icon name="close" size={18} /></button>
            </div>
            {song && YT_ID.test(song.yt) && (
              <div className="mp-embed">
                <iframe ref={frame} key={song.yt} title={`${song.name} by ${song.desc} (YouTube)`} src={embedUrl(song.yt)} onLoad={onFrameLoad}
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="eager" />
              </div>
            )}
            <canvas className="mp-viz" ref={viz} aria-hidden="true" />
            <div className="mp-controls">
              <button className="mp-btn" onClick={() => step(-1)} aria-label="Previous track" disabled={!now}><Icon name="prev" size={18} /></button>
              <button className="mp-play" onClick={main} aria-label={going ? "Pause" : "Play"}><Icon name={going ? "pause" : "play"} size={22} /></button>
              <button className="mp-btn" onClick={() => step(1)} aria-label="Next track" disabled={!now}><Icon name="next" size={18} /></button>
              <label className="mp-vol"><span className="sr-only">Volume</span><input type="range" min="0" max="1" step="0.01" value={vol} onChange={(e) => onVol(+e.target.value)} aria-label="Volume" /></label>
              {now && <button className="mp-btn mp-stop" onClick={stopAll}>Stop</button>}
            </div>
          </header>

          {open && (
            <>
              {going && vol < 0.03 && <p className="mp-warn" role="alert">The volume slider is at zero. Slide it to the right to hear the music.</p>}
              {blocked && <p className="mp-warn" role="alert">The browser is holding the sound back. Press the play button once more. If it still stays silent, allow sound for this site in the address bar.</p>}
              {song && songState === "error" && <p className="mp-warn" role="alert">YouTube would not play this one here. <a href={`https://www.youtube.com/watch?v=${song.yt}`} target="_blank" rel="noopener noreferrer">Open it on YouTube</a> or press next.</p>}
              <div className="mp-body">
                <input type="search" className="mp-search" placeholder={`Search ${TRACKS.length} tracks and songs…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tracks" />

                {!q && (
                  <div className="mp-genres" role="tablist" aria-label="Music styles">
                    {favs.length > 0 && <button role="tab" aria-selected={genre === "favs"} className={"mp-genre fav" + (genre === "favs" ? " on" : "")} onClick={() => setGenre("favs")}><i>★</i><b>Favorites</b><small>{favs.length}</small></button>}
                    {GENRES.map((x) => (
                      <button key={x.id} role="tab" aria-selected={genre === x.id} className={"mp-genre" + (genre === x.id ? " on" : "")} style={{ "--gh": x.hue } as CSSProperties} onClick={() => setGenre(x.id)}>
                        <i>{x.icon}</i><b>{x.name}</b><small>{countOf(x.id)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {!q && genre === "songs" && (
                  <label className="mp-row">Artist
                    <select value={artist} onChange={(e) => setArtist(e.target.value)} aria-label="Filter songs by artist">
                      <option value="">All artists ({SONG_ARTISTS.length})</option>
                      {SONG_ARTISTS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                )}
                <div className="mp-listhead">
                  <span className="muted tiny">{q ? `${list.length} found` : genre === "favs" ? "Your starred tracks." : genreById(genre)?.blurb}</span>
                  <button className="ghost tiny-btn" onClick={surprise}>Surprise me</button>
                </div>

                <ul className="mp-list">
                  {shown.map((t) => (
                    <li key={t.id} className={now?.id === t.id ? "on" : ""}>
                      <button className="mp-track" onClick={() => play(t)} aria-label={`Play ${t.name}${t.kind === "song" ? " by " + t.desc : ""}`}>
                        <Art t={t} size={42} />
                        <span className="mp-text"><b>{t.name}{t.spin || t.eightD ? <em>8D</em> : null}</b><span className="muted tiny">{t.desc}{t.headphones && !t.spin ? " · 🎧" : ""}</span></span>
                        <span className="mp-state">{now?.id === t.id && going ? <span className="eq mini" aria-hidden="true"><i /><i /><i /></span> : <Icon name="play" size={14} />}</span>
                      </button>
                      <button className={"ghost icon-btn star" + (favs.includes(t.id) ? " on" : "")} onClick={() => toggleFav(t.id)} aria-pressed={favs.includes(t.id)} aria-label={`Favorite ${t.name}`}><Icon name="star" size={16} /></button>
                    </li>
                  ))}
                  {!list.length && <li className="empty">{q ? "Nothing matches that." : "Star a track to find it here."}</li>}
                </ul>
                {list.length > shown.length && <button className="ghost" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, list.length - shown.length)} more ({list.length - shown.length} left)</button>}

                <section className="mp-box mp-8d">
                  <div className="mp-box-head">
                    <label className="check-row">
                      <input type="checkbox" checked={st.spatial && canSpin} disabled={!canSpin} onChange={(e) => onSpin(e.target.checked)} />
                      <span><b>8D spin</b> <span className="muted tiny">headphones</span></span>
                    </label>
                    {!canSpin && <span className="muted tiny">{song ? "Not for songs" : "Not for beat tracks"}</span>}
                  </div>
                  {canSpin && (
                    <div className="mp-8d-body">
                      <canvas ref={radar} className="mp-radar" aria-label="Where the sound is, seen from above" role="img" />
                      <div className="mp-8d-controls">
                        <div className="mp-chips" role="radiogroup" aria-label="Path">
                          {SPIN_SHAPES.map(([id, label]) => <button key={id} role="radio" aria-checked={st.shape === id} className={"mp-chip" + (st.shape === id ? " on" : "")} onClick={() => onShape(id)}>{label}</button>)}
                        </div>
                        <label className="mp-row">Speed
                          <input type="range" min="5" max="30" step="1" value={35 - (st.period || period)} onChange={(e) => onPeriod(35 - +e.target.value)} aria-label="Spin speed" />
                        </label>
                        <span className="muted tiny">One lap every {st.period || period} seconds</span>
                      </div>
                    </div>
                  )}
                </section>

                <section className="mp-box">
                  <label className="mp-row">Add a sound
                    <select value={st.layerId || ""} onChange={(e) => onLayer(e.target.value)}>
                      <option value="">None</option>
                      {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>
                  {st.layerId && <label className="mp-row">Its volume<input type="range" min="0" max="1" step="0.01" value={lvol} onChange={(e) => onLvol(+e.target.value)} aria-label="Added sound volume" /></label>}
                  <label className="mp-row">Sleep timer
                    <select value={sleep} onChange={(e) => onSleep(+e.target.value)}>
                      <option value={0}>Off</option>{[15, 25, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select>
                  </label>
                </section>
                <section className="mp-box">
                  <div className="mp-row">No sound? <button className="ghost" onClick={beep}>Play a test beep</button></div>
                  {beepNote && <p className="muted tiny">{beepNote}</p>}
                  <p className="muted tiny">Audio is {st.ctxState === "none" ? "not started yet" : st.ctxState}.</p>
                </section>
                <p className="muted tiny">The music is made live in your browser as it plays: nothing is downloaded and it works offline. Songs play in YouTube's own player (the privacy-friendly version), and nothing from YouTube loads until you press play on a song.</p>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
  return createPortal(ui, document.body);
}
