// The music library. Every track is a small "recipe" that the engine plays live (see engine.js), so there are no
// audio files. Tonic numbers are MIDI notes: 60 = C, 62 = D, 64 = E, 65 = F, 67 = G, 69 = A, 70 = B flat.
// `spin` makes a track an 8D track (the number is seconds per lap) and `shape` is its path (see SPIN_SHAPES).

import { SONGS } from "./songs.js";

export const GENRES = [
  { id: "simple", name: "Simple and calm", icon: "🎹", hue: 262, blurb: "Gentle piano, harp and music box. Easy to ignore, easy to like." },
  { id: "songs", name: "Songs", icon: "🎤", hue: 330, blurb: "Real songs by Adele, Billie Eilish and more, played through YouTube's own player. It only loads when you press play." },
  { id: "lofi", name: "Lo-fi chill", icon: "☕", hue: 28, blurb: "Warm keys, a lazy beat and a little vinyl crackle." },
  { id: "ambient", name: "Dreamy ambient", icon: "☁️", hue: 205, blurb: "Slow, soft pads and voices that fill the room without any beat." },
  { id: "nature", name: "Nature and noise", icon: "🌧️", hue: 150, blurb: "Steady sound that covers distractions. Brown and pink noise help many people with ADHD." },
  { id: "beats", name: "Focus beats", icon: "🎧", hue: 300, blurb: "Binaural tones. Headphones needed; some people find them helpful, the research is mixed." },
  { id: "spin", name: "8D spin", icon: "🌀", hue: 190, blurb: "The sound travels around your head. Put headphones on and close your eyes for a moment." },
  { id: "dark", name: "Dark and driven", icon: "🌃", hue: 340, blurb: "Synthwave and cinematic drive for getting stuff done." },
];

const music = (genre, id, name, desc, r) => ({ kind: "music", genre, id, name, desc, ...r });
const noise = (genre, id, name, desc, n, extra = {}) => ({ kind: "noise", genre, id, name, desc, noise: n, ...extra });
const beats = (id, name, desc, hzBeat, carrier, extra = {}) => ({ kind: "beats", genre: "beats", id, name, desc, beat: hzBeat, carrier, headphones: true, ...extra });

export const TRACKS = [
  // ---- simple and calm ----
  music("simple", "quiet-library", "Quiet Library", "Soft piano chords, very slow", { tonic: 60, scale: "major", bpm: 62, prog: [1, 5, 6, 4], lead: { type: "pluck", pattern: "rolled", level: 0.75, oct: 4, bright: 0.8 }, pad: { level: 0.022, cutoff: 700, oct: 3 }, rev: 0.6 }),
  music("simple", "morning-light", "Morning Light", "Bright, gentle arpeggios", { tonic: 67, scale: "major", bpm: 72, prog: [1, 4, 5, 1], lead: { type: "pluck", pattern: "arp", level: 0.7, oct: 4, density: 0.8 }, pad: { level: 0.02, cutoff: 800, oct: 3 }, rev: 0.5 }),
  music("simple", "soft-snowfall", "Soft Snowfall", "A music box in a quiet room", { tonic: 69, scale: "minor", bpm: 56, prog: [1, 6, 3, 7], lead: { type: "bell", pattern: "sparse", level: 0.8, oct: 5 }, pad: { level: 0.028, cutoff: 600, oct: 3 }, rev: 0.75 }),
  music("simple", "paper-boats", "Paper Boats", "Playful and light, never in the way", { tonic: 65, scale: "lydian", bpm: 68, prog: [1, 2, 5, 1], lead: { type: "pluck", pattern: "arp", level: 0.65, oct: 4, updown: true, density: 0.7, bright: 1.3 }, pad: { level: 0.018, cutoff: 900, oct: 3 }, rev: 0.55 }),
  music("simple", "tea-time", "Tea Time", "A slow waltz in three", { tonic: 62, scale: "major", bpm: 84, beats: 3, prog: [1, 5, 4, 1], lead: { type: "pluck", pattern: "arp", level: 0.7, oct: 4, density: 0.85 }, pad: { level: 0.02, cutoff: 750, oct: 3 }, rev: 0.5 }),
  music("simple", "still-water", "Still Water", "Sparse notes, lots of silence", { tonic: 64, scale: "minor", bpm: 50, prog: [1, 4, 1, 5], lead: { type: "pluck", pattern: "sparse", level: 0.7, oct: 4, bright: 0.7 }, pad: { level: 0.03, cutoff: 560, oct: 3 }, bed: "rain", rev: 0.8 }),
  music("simple", "golden-hour", "Golden Hour", "A harp running down warm chords", { tonic: 65, scale: "major", bpm: 66, prog: [1, 5, 6, 4], lead: { type: "harp", pattern: "cascade", level: 0.7, oct: 4, density: 0.9 }, pad: { level: 0.024, cutoff: 800, oct: 3 }, rev: 0.7 }),
  music("simple", "wishing-well", "Wishing Well", "Tiny bright notes, like thumb piano", { tonic: 67, scale: "lydian", bpm: 60, prog: [1, 2, 1, 4], lead: { type: "kalimba", pattern: "arp", level: 0.75, oct: 5, density: 0.6 }, pad: { level: 0.02, cutoff: 800, oct: 3 }, rev: 0.6 }),
  music("simple", "lantern-light", "Lantern Light", "Rolled harp chords, soft and glowing", { tonic: 62, scale: "dorian", bpm: 58, prog: [1, 4, 1, 7], lead: { type: "harp", pattern: "rolled", level: 0.6, oct: 4 }, pad: { level: 0.026, cutoff: 650, oct: 3 }, rev: 0.75 }),
  music("simple", "moonlit-piano", "Moonlit Piano", "Slow piano with a faint string bed", { tonic: 69, scale: "minor", bpm: 52, prog: [1, 6, 4, 5], lead: { type: "pluck", pattern: "rolled", level: 0.7, oct: 4, bright: 0.6 }, pad: { level: 0.03, cutoff: 600, oct: 3 }, rev: 0.8 }),

  // ---- lo-fi chill ----
  music("lofi", "rainy-cafe", "Rainy Cafe", "Warm keys with rain on the window", { tonic: 62, scale: "dorian", bpm: 78, sev: true, prog: [2, 5, 1, 6], lead: { type: "keys", pattern: "melody", level: 0.8, oct: 4, density: 0.6 }, pad: { level: 0.02, cutoff: 600, oct: 3 }, bass: { style: "walk", level: 0.55 }, drums: { style: "lofi", level: 0.5, swing: 0.2 }, bed: "rain", rev: 0.4 }),
  music("lofi", "sunday-cassette", "Sunday Cassette", "Mellow and a little dusty", { tonic: 60, scale: "major", bpm: 84, sev: true, prog: [2, 5, 1, 6], lead: { type: "keys", pattern: "melody", level: 0.8, oct: 4, density: 0.7 }, pad: { level: 0.02, cutoff: 650, oct: 3 }, bass: { style: "walk", level: 0.55 }, drums: { style: "lofi", level: 0.5, swing: 0.18 }, bed: "vinyl", rev: 0.35 }),
  music("lofi", "late-night-bus", "Late Night Bus", "Moody, slow and cozy", { tonic: 69, scale: "minor", bpm: 72, sev: true, prog: [1, 4, 7, 3], lead: { type: "keys", pattern: "arp", level: 0.7, oct: 4, density: 0.7 }, pad: { level: 0.024, cutoff: 560, oct: 3 }, bass: { style: "walk", level: 0.6 }, drums: { style: "lofi", level: 0.55, swing: 0.2 }, bed: "vinyl", rev: 0.45 }),
  music("lofi", "warm-blanket", "Warm Blanket", "Soft rolled chords, relaxed beat", { tonic: 65, scale: "major", bpm: 70, sev: true, ninth: true, prog: [1, 6, 2, 5], lead: { type: "keys", pattern: "rolled", level: 0.75, oct: 4 }, pad: { level: 0.024, cutoff: 600, oct: 3 }, bass: { style: "walk", level: 0.55 }, drums: { style: "lofi", level: 0.4, swing: 0.15 }, bed: "vinyl", rev: 0.4 }),
  music("lofi", "window-seat", "Window Seat", "Easygoing and a bit jazzy", { tonic: 70, scale: "mixolydian", bpm: 80, sev: true, prog: [1, 7, 4, 1], lead: { type: "keys", pattern: "melody", level: 0.75, oct: 4, density: 0.65 }, pad: { level: 0.02, cutoff: 650, oct: 3 }, bass: { style: "walk", level: 0.55 }, drums: { style: "lofi", level: 0.5, swing: 0.22 }, bed: "vinyl", rev: 0.4 }),
  music("lofi", "cloud-nine", "Cloud Nine", "Floaty, dreamy lo-fi", { tonic: 64, scale: "lydian", bpm: 76, sev: true, prog: [1, 2, 3, 2], lead: { type: "keys", pattern: "arp", level: 0.65, oct: 4, density: 0.65 }, pad: { level: 0.03, cutoff: 800, oct: 3 }, bass: { style: "walk", level: 0.5 }, drums: { style: "lofi", level: 0.4, swing: 0.2 }, bed: "vinyl", rev: 0.55 }),
  music("lofi", "polaroid", "Polaroid", "Sunny memories, soft kalimba", { tonic: 65, scale: "major", bpm: 82, sev: true, prog: [1, 5, 6, 4], lead: { type: "kalimba", pattern: "melody", level: 0.8, oct: 5, density: 0.65 }, pad: { level: 0.022, cutoff: 700, oct: 3 }, bass: { style: "walk", level: 0.5 }, drums: { style: "lofi", level: 0.45, swing: 0.18 }, bed: "vinyl", rev: 0.4 }),
  music("lofi", "city-rain", "City Rain", "Night streets, wet and glowing", { tonic: 64, scale: "dorian", bpm: 74, sev: true, prog: [1, 4, 7, 4], lead: { type: "keys", pattern: "arp", level: 0.7, oct: 4, density: 0.65 }, pad: { level: 0.024, cutoff: 600, oct: 3 }, bass: { style: "walk", level: 0.6 }, drums: { style: "lofi", level: 0.5, swing: 0.2 }, bed: "rain", rev: 0.5 }),
  music("lofi", "slow-coffee", "Slow Coffee", "Hardly a beat, mostly warmth", { tonic: 67, scale: "major", bpm: 68, sev: true, ninth: true, prog: [2, 5, 1, 1], lead: { type: "keys", pattern: "rolled", level: 0.7, oct: 4 }, pad: { level: 0.026, cutoff: 600, oct: 3 }, bass: { style: "walk", level: 0.5 }, drums: { style: "lofi", level: 0.3, swing: 0.15 }, bed: "vinyl", rev: 0.45 }),
  music("lofi", "midnight-snack", "Midnight Snack", "Sleepy, minor and sweet", { tonic: 61, scale: "minor", bpm: 78, sev: true, prog: [1, 6, 3, 7], lead: { type: "harp", pattern: "arp", level: 0.65, oct: 4, density: 0.6 }, pad: { level: 0.026, cutoff: 560, oct: 3 }, bass: { style: "walk", level: 0.55 }, drums: { style: "lofi", level: 0.45, swing: 0.2 }, bed: "vinyl", rev: 0.5 }),

  // ---- dreamy ambient ----
  music("ambient", "soft-clouds", "Soft Clouds", "Slow, bright and weightless", { tonic: 60, scale: "lydian", bpm: 40, prog: [1, 4, 1, 5], pad: { level: 0.042, cutoff: 1100, oct: 3, hold: 1.3 }, lead: { type: "bell", pattern: "sparse", level: 0.45, oct: 5 }, rev: 0.85 }),
  music("ambient", "aurora", "Aurora", "Shimmering and wide", { tonic: 62, scale: "lydian", bpm: 36, prog: [1, 2, 1, 4], pad: { level: 0.042, cutoff: 1300, oct: 3, hold: 1.3, wave: "sawtooth" }, lead: { type: "bell", pattern: "sparse", level: 0.4, oct: 5 }, rev: 0.9 }),
  music("ambient", "deep-sea-drift", "Deep Sea Drift", "Low, slow and calming", { tonic: 57, scale: "minor", bpm: 34, prog: [1, 6, 4, 1], pad: { level: 0.05, cutoff: 520, oct: 2, hold: 1.4 }, rev: 0.9, bed: "wind" }),
  music("ambient", "lavender-hours", "Lavender Hours", "Soft, hopeful pads", { tonic: 66, scale: "major", bpm: 38, prog: [1, 3, 6, 4], pad: { level: 0.042, cutoff: 1000, oct: 3, hold: 1.3 }, lead: { type: "pluck", pattern: "sparse", level: 0.4, oct: 5, bright: 0.6 }, rev: 0.85 }),
  music("ambient", "starfield", "Starfield", "Quiet space with distant bells", { tonic: 64, scale: "dorian", bpm: 36, prog: [1, 4, 7, 1], pad: { level: 0.04, cutoff: 900, oct: 3, hold: 1.3 }, lead: { type: "bell", pattern: "sparse", level: 0.5, oct: 5 }, rev: 0.95 }),
  music("ambient", "slow-tides", "Slow Tides", "Breathing pads with a breeze", { tonic: 67, scale: "mixolydian", bpm: 34, prog: [1, 7, 4, 1], pad: { level: 0.045, cutoff: 800, oct: 3, hold: 1.4 }, bed: "wind", rev: 0.85 }),
  music("ambient", "silk-clouds", "Silk Clouds", "Voices like a distant choir", { tonic: 69, scale: "lydian", bpm: 34, prog: [1, 4, 5, 1], pad: { level: 0.03, cutoff: 900, oct: 3, hold: 1.3 }, lead: { type: "choir", pattern: "sparse", level: 0.7, oct: 4 }, rev: 0.92 }),
  music("ambient", "lullaby-sky", "Lullaby Sky", "Warm choir over a slow glow", { tonic: 64, scale: "major", bpm: 32, prog: [1, 5, 6, 4], pad: { level: 0.03, cutoff: 800, oct: 3, hold: 1.3 }, lead: { type: "choir", pattern: "sparse", level: 0.75, oct: 4 }, rev: 0.92 }),
  music("ambient", "glass-ocean", "Glass Ocean", "A harp over a still sea", { tonic: 66, scale: "minor", bpm: 38, prog: [1, 6, 3, 7], pad: { level: 0.034, cutoff: 700, oct: 3, hold: 1.3 }, lead: { type: "harp", pattern: "sparse", level: 0.7, oct: 4 }, bed: "wind", rev: 0.9 }),
  music("ambient", "dawn-chorus", "Dawn Chorus", "Slow strings rising with the light", { tonic: 62, scale: "major", bpm: 36, prog: [1, 4, 6, 5], pad: { level: 0.03, cutoff: 900, oct: 3, hold: 1.3 }, lead: { type: "strings", pattern: "sparse", level: 0.8, oct: 4 }, bed: "wind", rev: 0.88 }),

  // ---- nature and noise ----
  noise("nature", "brown-noise", "Brown Noise", "Deep and smooth. A favorite for ADHD focus", "brown"),
  noise("nature", "pink-noise", "Pink Noise", "Even and soft, like steady rain far away", "pink"),
  noise("nature", "white-noise", "White Noise", "Bright static that covers everything", "white"),
  noise("nature", "fan-hum", "Fan Hum", "A calm room fan", "fan"),
  noise("nature", "rain-on-glass", "Rain on Glass", "Steady rain with little drops", "rain"),
  noise("nature", "ocean-waves", "Ocean Waves", "Slow waves rolling in", "ocean"),
  noise("nature", "forest-morning", "Forest Morning", "Wind in the trees and birds", "forest"),
  noise("nature", "gentle-fire", "Gentle Fire", "A crackling fireplace", "fire"),
  noise("nature", "distant-thunder", "Distant Thunder", "Rain with slow thunder far away", "storm"),
  noise("nature", "mountain-stream", "Mountain Stream", "Water running over stones", "stream"),
  noise("nature", "waterfall", "Waterfall", "A wide, soft rush of water", "waterfall"),
  noise("nature", "summer-night", "Summer Night", "Crickets and a warm breeze", "night"),
  noise("nature", "downpour", "Downpour", "Heavy rain, loud and cozy", "downpour"),
  music("nature", "wind-chimes", "Wind Chimes", "Bells in the breeze", { tonic: 62, scale: "major", bpm: 40, prog: [1, 5, 6, 4], lead: { type: "bell", pattern: "sparse", level: 0.8, oct: 5 }, bed: "wind", rev: 0.8 }),

  // ---- focus beats (binaural) ----
  beats("alpha-calm", "Alpha: Calm Focus", "10 Hz. Relaxed, steady attention", 10, 200, { drone: 45 }),
  beats("beta-alert", "Beta: Alert", "16 Hz. Awake and active", 16, 210, { drone: 47, bed: "brown" }),
  beats("theta-flow", "Theta: Creative Flow", "6 Hz. Dreamy, good for ideas", 6, 190, { drone: 43 }),
  beats("gamma-spark", "Gamma: Spark", "40 Hz. Bright and energetic", 40, 220, { drone: 48, bed: "brown" }),
  beats("delta-wind-down", "Delta: Wind Down", "3 Hz. Slow, for evenings", 3, 170, { drone: 41, bed: "rain" }),
  beats("alpha-rain", "Alpha with Rain", "10 Hz under soft rain", 10, 200, { drone: 45, bed: "rain" }),
  beats("theta-ocean", "Theta with Ocean", "6 Hz under slow waves", 6, 190, { drone: 43, bed: "ocean" }),
  beats("beta-forest", "Beta in the Forest", "15 Hz with wind and birds", 15, 205, { drone: 46, bed: "forest" }),

  // ---- 8D spin ----
  music("spin", "orbit", "Orbit", "Dreamy pads circling around you", { spin: 12, tonic: 62, scale: "lydian", bpm: 38, prog: [1, 4, 1, 5], pad: { level: 0.042, cutoff: 1100, oct: 3, hold: 1.3 }, lead: { type: "bell", pattern: "sparse", level: 0.45, oct: 5 }, rev: 0.7, headphones: true }),
  music("spin", "carousel", "Carousel", "A music box going round and round", { spin: 9, tonic: 67, scale: "major", bpm: 76, prog: [1, 5, 6, 4], lead: { type: "bell", pattern: "arp", level: 0.7, oct: 5, density: 0.75 }, pad: { level: 0.02, cutoff: 800, oct: 3 }, rev: 0.6, headphones: true }),
  music("spin", "halo", "Halo", "Soft piano drifting around your head", { spin: 14, tonic: 60, scale: "major", bpm: 58, prog: [1, 6, 4, 5], lead: { type: "pluck", pattern: "rolled", level: 0.62, oct: 4, bright: 0.9 }, pad: { level: 0.025, cutoff: 700, oct: 3 }, rev: 0.65, headphones: true }),
  noise("spin", "rain-around-you", "Rain Around You", "Rain falling in a circle", "rain", { spin: 16, headphones: true }),
  noise("spin", "ocean-circle", "Ocean Circle", "Waves washing around you", "ocean", { spin: 18, headphones: true }),
  music("spin", "satellite", "Satellite", "Lo-fi keys orbiting slowly", { spin: 11, tonic: 62, scale: "dorian", bpm: 74, sev: true, prog: [2, 5, 1, 6], lead: { type: "keys", pattern: "melody", level: 0.75, oct: 4, density: 0.6 }, pad: { level: 0.02, cutoff: 600, oct: 3 }, bass: { style: "walk", level: 0.5 }, drums: { style: "lofi", level: 0.35, swing: 0.18 }, bed: "vinyl", rev: 0.5, headphones: true }),
  music("spin", "moonlit-orbit", "Moonlit Orbit", "A harp falling around you in the dark", { spin: 13, tonic: 69, scale: "minor", bpm: 54, prog: [1, 6, 4, 5], lead: { type: "harp", pattern: "cascade", level: 0.75, oct: 4, density: 0.9 }, pad: { level: 0.03, cutoff: 700, oct: 3 }, rev: 0.8, headphones: true }),
  music("spin", "spiral-stairs", "Spiral Stairs", "Harp arpeggios rising and floating", { spin: 11, shape: "bob", tonic: 62, scale: "lydian", bpm: 70, prog: [1, 2, 5, 1], lead: { type: "harp", pattern: "arp", level: 0.7, oct: 4, tones: 5, updown: true, density: 0.8 }, pad: { level: 0.024, cutoff: 800, oct: 3 }, rev: 0.7, headphones: true }),
  music("spin", "cloud-carousel", "Cloud Carousel", "Thumb piano drifting wide and slow", { spin: 8, shape: "wide", tonic: 67, scale: "major", bpm: 80, prog: [1, 5, 6, 4], lead: { type: "kalimba", pattern: "arp", level: 0.8, oct: 5, density: 0.7 }, pad: { level: 0.02, cutoff: 800, oct: 3 }, rev: 0.6, headphones: true }),
  music("spin", "whisper-waltz", "Whisper Waltz", "A tiny waltz in three, turning", { spin: 10, tonic: 64, scale: "major", bpm: 78, beats: 3, prog: [1, 5, 4, 1], lead: { type: "pluck", pattern: "rolled", level: 0.75, oct: 4 }, pad: { level: 0.02, cutoff: 700, oct: 3 }, rev: 0.6, headphones: true }),
  music("spin", "northern-lights-360", "Northern Lights 360", "Strings swirling in a huge space", { spin: 20, shape: "wide", tonic: 60, scale: "lydian", bpm: 36, prog: [1, 4, 5, 1], pad: { level: 0.034, cutoff: 1000, oct: 3, hold: 1.3 }, lead: { type: "strings", pattern: "sparse", level: 0.85, oct: 4 }, rev: 0.9, headphones: true }),
  music("spin", "choir-of-clouds", "Choir of Clouds", "Soft voices floating up and around", { spin: 15, shape: "bob", tonic: 64, scale: "major", bpm: 34, prog: [1, 5, 6, 4], pad: { level: 0.028, cutoff: 800, oct: 3, hold: 1.3 }, lead: { type: "choir", pattern: "sparse", level: 0.8, oct: 4 }, rev: 0.92, headphones: true }),
  music("spin", "deep-blue", "Deep Blue", "Slow tones sweeping ear to ear", { spin: 18, shape: "sweep", tonic: 57, scale: "minor", bpm: 34, prog: [1, 6, 4, 1], pad: { level: 0.05, cutoff: 560, oct: 2, hold: 1.4 }, lead: { type: "bell", pattern: "sparse", level: 0.4, oct: 4 }, bed: "wind", rev: 0.9, headphones: true }),
  music("spin", "zen-garden", "Zen Garden", "Kalimba and bells tracing a figure 8", { spin: 12, shape: "eight", tonic: 62, scale: "major", bpm: 56, prog: [1, 4, 1, 5], lead: { type: "kalimba", pattern: "sparse", level: 0.85, oct: 5 }, pad: { level: 0.02, cutoff: 700, oct: 3 }, bed: "rain", rev: 0.75, headphones: true }),
  noise("spin", "slow-cyclone", "Slow Cyclone", "Storm winds circling wide", "storm", { spin: 14, shape: "wide", headphones: true }),
  noise("spin", "forest-circle", "Forest Circle", "Birds and leaves all around", "forest", { spin: 20, headphones: true }),
  noise("spin", "stream-around-you", "Stream Around You", "Water running from ear to ear", "stream", { spin: 14, shape: "sweep", headphones: true }),
  noise("spin", "fireside-orbit", "Fireside Orbit", "Crackling embers circling you", "fire", { spin: 16, shape: "bob", headphones: true }),
  music("spin", "synth-halo", "Synth Halo", "Dark synth arps orbiting fast", { spin: 9, tonic: 57, scale: "minor", bpm: 92, prog: [1, 6, 3, 7], lead: { type: "saw", pattern: "arp", level: 0.7, oct: 4, fast: true, density: 0.85 }, pad: { level: 0.028, cutoff: 1100, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.5 }, drums: { style: "synth", level: 0.35 }, rev: 0.45, headphones: true }),

  // ---- dark and driven ----
  music("dark", "neon-highway", "Neon Highway", "Synthwave drive, steady pulse", { tonic: 57, scale: "minor", bpm: 100, prog: [1, 6, 3, 7], lead: { type: "saw", pattern: "arp", level: 0.8, oct: 4, fast: true, density: 0.9 }, pad: { level: 0.03, cutoff: 1200, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.6 }, drums: { style: "synth", level: 0.5 }, rev: 0.4 }),
  music("dark", "night-drive", "Night Drive", "Moody and cinematic", { tonic: 64, scale: "minor", bpm: 90, prog: [1, 7, 6, 7], lead: { type: "saw", pattern: "melody", level: 0.8, oct: 4, density: 0.6 }, pad: { level: 0.035, cutoff: 1000, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.55 }, drums: { style: "synth", level: 0.45 }, rev: 0.5 }),
  music("dark", "steel-city", "Steel City", "Dark, heavy and focused", { tonic: 62, scale: "phrygian", bpm: 84, prog: [1, 2, 1, 7], lead: { type: "saw", pattern: "arp", level: 0.7, oct: 3, updown: true, density: 0.85 }, pad: { level: 0.035, cutoff: 800, oct: 2, wave: "sawtooth" }, bass: { style: "pulse", level: 0.65 }, drums: { style: "synth", level: 0.5 }, rev: 0.35 }),
  music("dark", "midnight-code", "Midnight Code", "Fast, glowing arpeggios", { tonic: 66, scale: "minor", bpm: 110, prog: [1, 4, 1, 5], lead: { type: "saw", pattern: "arp", level: 0.7, oct: 4, fast: true, updown: true, density: 0.8 }, pad: { level: 0.025, cutoff: 1400, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.55 }, drums: { style: "synth", level: 0.4 }, rev: 0.4 }),
  music("dark", "iron-focus", "Iron Focus", "Slow, deep and cinematic", { tonic: 50, scale: "minor", bpm: 58, prog: [1, 6, 4, 5], pad: { level: 0.05, cutoff: 650, oct: 3, hold: 1.3, wave: "sawtooth" }, lead: { type: "bell", pattern: "sparse", level: 0.45, oct: 4 }, bass: { style: "walk", level: 0.7, oct: 3 }, rev: 0.7 }),
  music("dark", "afterburn", "Afterburn", "Racing arps over a hard pulse", { tonic: 59, scale: "minor", bpm: 98, prog: [1, 3, 6, 7], lead: { type: "saw", pattern: "arp", level: 0.75, oct: 4, fast: true, density: 0.9 }, pad: { level: 0.03, cutoff: 1300, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.6 }, drums: { style: "synth", level: 0.5 }, rev: 0.4 }),
  music("dark", "concrete-jungle", "Concrete Jungle", "Gritty and tense, great for deep work", { tonic: 55, scale: "phrygian", bpm: 80, prog: [1, 2, 1, 7], lead: { type: "saw", pattern: "melody", level: 0.75, oct: 4, density: 0.6 }, pad: { level: 0.034, cutoff: 900, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.65, oct: 3 }, drums: { style: "synth", level: 0.45 }, rev: 0.4 }),
  music("dark", "red-line", "Red Line", "Fast, bright minor, with a choir on top", { tonic: 64, scale: "minor", bpm: 104, prog: [1, 6, 4, 5], lead: { type: "choir", pattern: "sparse", level: 0.7, oct: 4 }, pad: { level: 0.03, cutoff: 1200, oct: 3, wave: "sawtooth" }, bass: { style: "pulse", level: 0.55 }, drums: { style: "synth", level: 0.45 }, rev: 0.5 }),
  music("dark", "iron-cathedral", "Iron Cathedral", "Huge, slow and cinematic", { tonic: 48, scale: "minor", bpm: 52, prog: [1, 6, 3, 7], pad: { level: 0.05, cutoff: 700, oct: 3, hold: 1.3, wave: "sawtooth" }, lead: { type: "choir", pattern: "sparse", level: 0.8, oct: 3 }, bass: { style: "walk", level: 0.7, oct: 3 }, rev: 0.9 }),
];

// real songs: the video is played in YouTube's own embedded player (see MusicPlayer.jsx)
// 8D versions (from the "8D Tunes" channel) are listed under 8D spin; everything else under Songs
TRACKS.push(...SONGS.map((s) => ({ kind: "song", genre: s.eightD ? "spin" : "songs", eightD: !!s.eightD, id: `song-${s.yt}`, name: s.title, artist: s.artist, desc: s.eightD ? `${s.artist} · 8D Tunes` : s.artist, yt: s.yt })));

// things you can play underneath any track
export const LAYERS = [
  { id: "rain", name: "Rain", def: { kind: "noise", noise: "rain" } },
  { id: "ocean", name: "Ocean", def: { kind: "noise", noise: "ocean" } },
  { id: "forest", name: "Forest", def: { kind: "noise", noise: "forest" } },
  { id: "stream", name: "Stream", def: { kind: "noise", noise: "stream" } },
  { id: "night", name: "Crickets at night", def: { kind: "noise", noise: "night" } },
  { id: "wind", name: "Wind", def: { kind: "noise", noise: "wind" } },
  { id: "fire", name: "Fireplace", def: { kind: "noise", noise: "fire" } },
  { id: "brown", name: "Brown noise", def: { kind: "noise", noise: "brown" } },
  { id: "pink", name: "Pink noise", def: { kind: "noise", noise: "pink" } },
  { id: "alpha", name: "Alpha beats (headphones)", def: { kind: "beats", beat: 10, carrier: 200, drone: 45 } },
];

export const trackById = (id) => TRACKS.find((t) => t.id === id);
export const genreById = (id) => GENRES.find((g) => g.id === id);
