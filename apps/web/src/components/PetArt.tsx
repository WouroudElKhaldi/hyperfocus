import { type ReactNode, useId } from "react";
import type { Outfit } from "../types.ts";
import { C, INK, mix, scaleAbout, starPath } from "./petKit.ts";
import Clothes from "./PetClothes.tsx";
import { LookBehind, LookFront, NewExtra, NewFace, NewHead, NewNeck } from "./PetItems.tsx";
export { mix };

// The companion pet, drawn in SVG so any species, color, outfit, pattern and age combination works.
// stage (age): 0 egg, 1 newborn, 2 baby, 3 toddler, 4 little kid, 5 kid, 6 tween, 7 teen, 8 young adult, 9 grown-up.
// mood: egg | happy | content | sleepy.
// Everything is drawn around the same body (an ellipse centred at 100,122), so clothes fit every species and age.

const PINK = "#ff9fb8";
// How each age looks. Babies are small and round with huge eyes; older pets get taller features, tails, ears and wings.
//            age:    0     1     2     3     4     5     6     7     8     9
const SCALE =       [1, 0.64, 0.70, 0.76, 0.82, 0.88, 0.92, 0.96, 1.00, 1.00];
const EYE_SCALE =   [1, 1.40, 1.32, 1.24, 1.16, 1.08, 1.00, 0.96, 0.92, 0.90];
const EYE_Y =       [0, 121, 119, 117, 114, 112, 110, 109, 108, 108];
const EAR_SCALE =   [1, 0.60, 0.66, 0.73, 0.80, 0.87, 0.93, 0.97, 1.00, 1.00];
const TAIL_SCALE =  [0, 0, 0, 0.60, 0.70, 0.80, 0.90, 1.00, 1.03, 1.06];
const SQUASH =      [1, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1.00, 1.01, 1.02]; // babies are rounder, adults a little taller
// hats that cover the head, so the ears tuck underneath
const HIDES_EARS = new Set(["beanie", "cap", "party", "wizard", "tophat", "chef", "sunhat", "flatcap", "fedora", "cowboy", "hardhat", "viking", "snapback"]);
const FACIAL_HAIR = new Set(["beard", "goatee", "mustache", "stubble", "sideburns"]);
// the value for an age from the tables above (age is always 0..9, so the fallback is never used)
const byAge = (list: number[], age: number) => list[age] ?? 1;

function Sparkle({ x, y, s = 1, d = 0, fill = "#ffd54a" }: { x: number; y: number; s?: number; d?: number; fill?: string }) {
  return (
    <path className="pet-sparkle" style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }} fill={fill}
      d={`M${x} ${y - 8 * s} L${x + 2 * s} ${y - 2 * s} L${x + 8 * s} ${y} L${x + 2 * s} ${y + 2 * s} L${x} ${y + 8 * s} L${x - 2 * s} ${y + 2 * s} L${x - 8 * s} ${y} L${x - 2 * s} ${y - 2 * s} Z`} />
  );
}
// ---------- egg ----------
function Egg({ color, progress, animate, gid }: { color: string; progress: number; animate: boolean; gid: string }) {
  const dark = mix(color, "#000000", 0.25), light = mix(color, "#ffffff", 0.62);
  const path = "M100 30 C 150 30 168 100 160 138 C 154 168 128 178 100 178 C 72 178 46 168 40 138 C 32 100 50 30 100 30 Z";
  return (
    <g className={animate ? (progress > 0.5 ? "pet-wobble" : "pet-bob") : ""} style={{ transformOrigin: "100px 178px" }}>
      <defs>
        <radialGradient id={`${gid}egg`} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor={mix(color, "#ffffff", 0.45)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={mix(color, "#000000", 0.14)} /></radialGradient>
      </defs>
      <path d={path} fill={`url(#${gid}egg)`} stroke={dark} strokeWidth="3" strokeOpacity=".35" />
      {([[78, 58, 9], [128, 92, 11], [66, 118, 10], [116, 146, 12], [90, 92, 6], [146, 130, 7], [56, 152, 7]] as [number, number, number][]).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={light} opacity=".8" />)}
      <ellipse cx="76" cy="70" rx="9" ry="20" transform="rotate(-20 76 70)" fill="#fff" opacity=".35" />
      {progress > 0.3 && <path d="M98 44 l-9 14 l11 9 l-9 15" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
      {progress > 0.65 && <path d="M132 92 l-13 9 l9 10 l-11 9" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
      {progress > 0.85 && <path d="M70 100 l12 8 l-8 10 l10 8" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
    </g>
  );
}

// ---------- species ----------
// Each returns layers: back (tail, wings), ears (hidden under big hats), gills (always), under (drawn before the face), face (nose, whiskers).
/** The layers a species adds around the shared body. */
type SpeciesLayers = { back?: ReactNode; ears?: ReactNode; gills?: ReactNode; under?: ReactNode; face?: ReactNode };
function species(sp: string, { color, dark, age, male }: { color: string; dark: string; light?: string; age: number; male: boolean }): SpeciesLayers {
  const ear = byAge(EAR_SCALE, age), tail = byAge(TAIL_SCALE, age);
  const edge = mix(color, "#000000", 0.32);
  const innerEar = male ? mix(color, "#000000", 0.24) : "#ffb3c7";
  const nose = male ? "#a06a82" : "#ff8fa8";
  const earStroke = { stroke: edge, strokeWidth: 2.2, strokeLinejoin: "round", strokeOpacity: 0.5 } as const;

  if (sp === "cat") {
    return {
      back: tail > 0 && (
        <g className="pet-tail" transform={scaleAbout(148, 154, tail)}>
          <path d="M148 154 C 188 150, 194 108, 168 98" fill="none" stroke={edge} strokeOpacity=".35" strokeWidth="17" strokeLinecap="round" />
          <path d="M148 154 C 188 150, 194 108, 168 98" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
          <circle cx="168" cy="98" r="7.500" fill={dark} />
        </g>
      ),
      ears: (
        <g transform={scaleAbout(100, 90, ear)}>
          <path d="M55 100 C 50 74, 55 54, 65 46 C 80 52, 94 64, 102 80 Z" fill={color} {...earStroke} />
          <path d="M63 92 C 60 76, 63 64, 68 58 C 77 62, 85 70, 90 80 Z" fill={innerEar} />
          <path d="M145 100 C 150 74, 145 54, 135 46 C 120 52, 106 64, 98 80 Z" fill={color} {...earStroke} />
          <path d="M137 92 C 140 76, 137 64, 132 58 C 123 62, 115 70, 110 80 Z" fill={innerEar} />
        </g>
      ),
      face: (
        <g>
          <path d="M96.500 118 h7 q0 4 -3.500 5 q-3.500 -1 -3.500 -5 z" fill={nose} />
          <path d="M60 122 L36 117 M60 129 L38 133 M140 122 L164 117 M140 129 L162 133" stroke={dark} strokeWidth="2" strokeLinecap="round" opacity=".6" />
          {age >= 5 && <path d="M94 78 v9 M100 75 v12 M106 78 v9" stroke={dark} strokeWidth="3" strokeLinecap="round" opacity=".7" />}
        </g>
      ),
    };
  }
  if (sp === "fox") {
    const white = "#fffaf3";
    return {
      back: tail > 0 && (
        <g className="pet-tail" transform={scaleAbout(146, 152, tail)}>
          <path d="M146 152 C 194 164, 202 100, 172 84 C 170 112, 160 132, 144 140 Z" fill={color} stroke={edge} strokeOpacity=".5" strokeWidth="2.200" strokeLinejoin="round" />
          <path d="M172 84 C 192 96, 196 120, 187 138 C 178 127, 174 106, 172 84 Z" fill={white} />
        </g>
      ),
      ears: (
        <g transform={scaleAbout(100, 90, ear)}>
          <path d="M53 100 C 46 72, 50 52, 57 40 C 74 48, 90 62, 102 80 Z" fill={color} {...earStroke} />
          <path d="M61 92 C 58 74, 60 60, 63 52 C 72 58, 82 68, 90 80 Z" fill={dark} />
          <path d="M147 100 C 154 72, 150 52, 143 40 C 126 48, 110 62, 98 80 Z" fill={color} {...earStroke} />
          <path d="M139 92 C 142 74, 140 60, 137 52 C 128 58, 118 68, 110 80 Z" fill={dark} />
        </g>
      ),
      under: (
        <g fill={white}>
          <path d="M50 131 Q58 123 70 125 Q61 133 50 131 Z" /><path d="M52 139 Q60 133 71 135 Q63 142 52 139 Z" />
          <path d="M150 131 Q142 123 130 125 Q139 133 150 131 Z" /><path d="M148 139 Q140 133 129 135 Q137 142 148 139 Z" />
          <ellipse cx="100" cy="126" rx="14" ry="8.500" opacity=".92" />
        </g>
      ),
      face: <ellipse cx="100" cy="118.500" rx="4.500" ry="3.500" fill={INK} />,
    };
  }
  if (sp === "bunny") {
    return {
      back: tail > 0 && <circle cx="150" cy="154" r={13 * tail} fill="#fff" stroke="#e4dcee" strokeWidth="1.500" />,
      ears: (
        <g transform={scaleAbout(100, 92, ear)}>
          <g transform="rotate(-10 78 58)"><ellipse cx="78" cy="58" rx="14" ry="37" fill={color} {...earStroke} /><ellipse cx="78" cy="60" rx="7" ry="26" fill={innerEar} /></g>
          <g transform="rotate(10 122 58)"><ellipse cx="122" cy="58" rx="14" ry="37" fill={color} {...earStroke} /><ellipse cx="122" cy="60" rx="7" ry="26" fill={innerEar} /></g>
        </g>
      ),
      face: (
        <g>
          <path d="M96.500 118 h7 q0 4 -3.500 5 q-3.500 -1 -3.500 -5 z" fill={nose} />
          {age >= 3 && <rect x="95.500" y="127.500" width="9" height="8" rx="2" fill="#fff" stroke={dark} strokeWidth="1.500" />}
        </g>
      ),
    };
  }
  if (sp === "dragon") {
    const wing = age >= 6 ? Math.min(0.95, 0.5 + (age - 5) * 0.11) : 0;
    const wingFill = mix(color, "#000000", 0.12);
    return {
      back: (
        <g>
          {wing > 0 && (
            <g transform={scaleAbout(100, 124, wing)}>
              <path className="pet-wing-l" d="M58 122 C 20 82, 10 132, 26 160 C 40 148, 50 144, 62 148 Z" fill={wingFill} stroke={edge} strokeOpacity=".6" strokeWidth="2.400" strokeLinejoin="round" />
              <path className="pet-wing-r" d="M142 122 C 180 82, 190 132, 174 160 C 160 148, 150 144, 138 148 Z" fill={wingFill} stroke={edge} strokeOpacity=".6" strokeWidth="2.400" strokeLinejoin="round" />
              <path d="M40 112 C 34 128, 32 140, 34 150 M160 112 C 166 128, 168 140, 166 150" fill="none" stroke={edge} strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          {tail > 0 && (
            <g className="pet-tail" transform={scaleAbout(148, 154, tail)}>
              <path d="M148 154 C 184 152, 192 116, 174 106" fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" />
              <path d="M170 98 C 180 92, 190 96, 192 104 C 186 106, 180 112, 176 118 Z" fill={dark} stroke={edge} strokeOpacity=".4" strokeWidth="1.500" strokeLinejoin="round" />
            </g>
          )}
        </g>
      ),
      ears: (
        <g transform={scaleAbout(100, 88, 0.72 + age * 0.03)}>
          <path d="M70 84 C 62 70, 62 56, 66 46 C 78 54, 88 64, 92 76 Z" fill="#ffe3a3" stroke="#e0b860" strokeWidth="2" strokeLinejoin="round" />
          <path d="M130 84 C 138 70, 138 56, 134 46 C 122 54, 112 64, 108 76 Z" fill="#ffe3a3" stroke="#e0b860" strokeWidth="2" strokeLinejoin="round" />
          {age >= 3 && <path d="M92 76 C 94 66, 97 60, 100 56 C 103 60, 106 66, 108 76 Z" fill={dark} />}
        </g>
      ),
      face: <g fill={INK}><ellipse cx="95.500" cy="119" rx="2.200" ry="1.600" /><ellipse cx="104.500" cy="119" rx="2.200" ry="1.600" /></g>,
    };
  }
  // blob: an axolotl-like friend with frilly gills
  const gill = "#ff8fb8", gillEdge = "#e0679a";
  const g = 0.78 + age * 0.03;
  return {
    back: tail > 0 && <path className="pet-tail" d="M148 156 q34 -2 28 -32 q-22 10 -28 32 z" fill={dark} stroke={edge} strokeOpacity=".4" strokeWidth="1.500" transform={scaleAbout(148, 156, tail)} />,
    gills: (
      <g transform={scaleAbout(100, 104, g)}>
        {([[54, 82, -35], [44, 103, -12], [52, 124, 14]] as [number, number, number][]).map(([x, y, r], i) => <ellipse key={`l${i}`} cx={x} cy={y} rx="17" ry="6.500" transform={`rotate(${r} ${x} ${y})`} fill={gill} stroke={gillEdge} strokeWidth="1.500" />)}
        {([[146, 82, 35], [156, 103, 12], [148, 124, -14]] as [number, number, number][]).map(([x, y, r], i) => <ellipse key={`r${i}`} cx={x} cy={y} rx="17" ry="6.500" transform={`rotate(${r} ${x} ${y})`} fill={gill} stroke={gillEdge} strokeWidth="1.500" />)}
      </g>
    ),
    face: null,
  };
}

// ---------- face ----------
function Face({ mood, age, color, gender }: { mood: string; age: number; color: string; dark?: string; gender: string }) {
  const male = gender === "boy", female = gender === "girl";
  const k = byAge(EYE_SCALE, age) * (male ? 0.95 : female ? 1.04 : 1), ey = byAge(EYE_Y, age);
  const brow = mix(color, "#000000", 0.55);
  const iris = mix(color, "#000000", 0.45);
  const eye = (cx: number) => (
    mood === "sleepy" ? (
      <path d={`M${cx - 9 * k} ${ey + 1} q${9 * k} ${8 * k} ${18 * k} 0`} fill="none" stroke={INK} strokeWidth="3.200" strokeLinecap="round" />
    ) : (
      <g className="pet-eye">
        <ellipse cx={cx} cy={ey} rx={9.500 * k} ry={11.500 * k} fill={INK} />
        <ellipse cx={cx} cy={ey + 1.500 * k} rx={7 * k} ry={9 * k} fill={iris} opacity=".9" />
        <ellipse cx={cx} cy={ey + 3 * k} rx={5 * k} ry={5.500 * k} fill={mix(iris, "#ffffff", 0.18)} opacity=".6" />
        <circle cx={cx - 3.200 * k} cy={ey - 4.200 * k} r={4 * k} fill="#fff" />
        <circle cx={cx + 3.400 * k} cy={ey + 4.200 * k} r={1.900 * k} fill="#fff" opacity=".9" />
      </g>
    )
  );
  const my = ey + 14; // the mouth sits under the eyes
  return (
    <g>
      {eye(79)}{eye(121)}
      {male && age >= 3 && mood !== "sleepy" && <g fill="none" stroke={brow} strokeLinecap="round" strokeWidth={age >= 6 ? 4.800 : 4}><path d={`M66 ${ey - 15 * k} Q79 ${ey - 21 * k} 92 ${ey - 15 * k}`} /><path d={`M108 ${ey - 15 * k} Q121 ${ey - 21 * k} 134 ${ey - 15 * k}`} /></g>}
      {female && age >= 2 && mood !== "sleepy" && <g fill="none" stroke={INK} strokeLinecap="round" strokeWidth="2.200"><path d={`M${79 - 9 * k} ${ey - 6 * k} l-5 -4 M${79 - 10 * k} ${ey - 1 * k} l-6 -1.500`} /><path d={`M${121 + 9 * k} ${ey - 6 * k} l5 -4 M${121 + 10 * k} ${ey - 1 * k} l6 -1.500`} /></g>}
      <ellipse cx="64" cy={ey + 15} rx={(male ? 5.600 : female ? 8.200 : 7.500) + (age <= 3 ? 1.500 : 0)} ry={male ? 4 : 5.200} fill={male ? "#d98aa0" : "#ff7fa3"} opacity={male ? 0.38 : female ? 0.8 : 0.7} />
      <ellipse cx="136" cy={ey + 15} rx={(male ? 5.600 : female ? 8.200 : 7.500) + (age <= 3 ? 1.500 : 0)} ry={male ? 4 : 5.200} fill={male ? "#d98aa0" : "#ff7fa3"} opacity={male ? 0.38 : female ? 0.8 : 0.7} />
      {mood === "happy" && (
        <g>
          <path d={`M93 ${my} q7 10 14 0 z`} fill="#c2415f" stroke={INK} strokeWidth="2.400" strokeLinejoin="round" />
          <path d={`M97 ${my + 3.500} q3 3 6 0`} fill="#ff8fa8" />
        </g>
      )}
      {mood === "content" && <path d={`M93.500 ${my} q3.250 4 6.500 0 q3.250 4 6.500 0`} fill="none" stroke={INK} strokeWidth="2.800" strokeLinecap="round" strokeLinejoin="round" />}
      {mood === "sleepy" && <path d={`M96 ${my + 1} h8`} stroke={INK} strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
}

// ---------- patterns (drawn on the body, clipped to it) ----------
function Pattern({ id, color }: { id: string; color: string }) {
  const d = mix(color, "#000000", 0.18);
  const star = (x: number, y: number, s: number) => <polygon key={`${x}${y}`} points={starPath(x, y, 6 * s, 2.600 * s)} fill="#fff6b0" opacity=".9" />;
  const heart = (x: number, y: number, s: number) => <path key={`${x}${y}`} d={`M${x} ${y + 5 * s} C ${x - 8 * s} ${y - 1 * s}, ${x - 4 * s} ${y - 7 * s}, ${x} ${y - 2 * s} C ${x + 4 * s} ${y - 7 * s}, ${x + 8 * s} ${y - 1 * s}, ${x} ${y + 5 * s} Z`} fill="#ff9fb8" opacity=".85" />;
  switch (id) {
    case "freckles": return <g fill={d} opacity=".55">{([[88, 122], [94, 126], [83, 127], [112, 122], [106, 126], [117, 127], [72, 120], [128, 120]] as [number, number][]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.600" />)}</g>;
    case "spots": return <g fill={d} opacity=".4">{([[70, 92, 6], [128, 88, 7], [150, 120, 5], [56, 130, 6], [84, 158, 7], [120, 160, 6], [100, 82, 4]] as [number, number, number][]).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
    case "stripes": return <g stroke={d} strokeWidth="6" strokeLinecap="round" fill="none" opacity=".4"><path d="M58 104 q-4 14 2 28" /><path d="M66 92 q-6 14 0 26" /><path d="M142 104 q4 14 -2 28" /><path d="M134 92 q6 14 0 26" /><path d="M82 160 q18 6 36 0" /></g>;
    case "hearts": return <g>{([[66, 96, 1], [136, 100, 0.9], [90, 160, 1], [118, 156, 0.8], [56, 136, 0.8]] as [number, number, number][]).map(([x, y, s]) => heart(x, y, s))}</g>;
    case "stars": return <g>{([[68, 94, 1], [134, 98, 0.9], [92, 160, 1], [116, 158, 0.8], [54, 134, 0.8], [148, 134, 0.8]] as [number, number, number][]).map(([x, y, s]) => star(x, y, s))}</g>;
    default: return null;
  }
}

// ---------- wardrobe ----------
// things that sit behind the body
const CapeBack = () => (
  <g>
    <path d="M58 130 Q34 168 28 188 Q100 200 172 188 Q166 168 142 130 Z" fill={C.red} stroke={mix(C.red, "#000000", 0.25)} strokeWidth="2" strokeLinejoin="round" />
    <path d="M70 140 Q60 172 54 188 M130 140 Q140 172 146 188" stroke={mix(C.red, "#000000", 0.2)} strokeWidth="2" fill="none" opacity=".5" />
  </g>
);
const FairyWings = () => (
  <g opacity=".92">
    <path d="M70 120 C 34 84, 12 100, 22 130 C 28 150, 52 146, 70 132 Z" fill="#dff3ff" stroke="#9ed2f2" strokeWidth="2" strokeLinejoin="round" />
    <path d="M70 132 C 44 136, 30 154, 44 166 C 58 174, 70 152, 74 140 Z" fill="#ecdcff" stroke="#c4a8ee" strokeWidth="2" strokeLinejoin="round" />
    <path d="M130 120 C 166 84, 188 100, 178 130 C 172 150, 148 146, 130 132 Z" fill="#dff3ff" stroke="#9ed2f2" strokeWidth="2" strokeLinejoin="round" />
    <path d="M130 132 C 156 136, 170 154, 156 166 C 142 174, 130 152, 126 140 Z" fill="#ecdcff" stroke="#c4a8ee" strokeWidth="2" strokeLinejoin="round" />
    <g fill="#fff" opacity=".7"><circle cx="36" cy="112" r="3" /><circle cx="164" cy="112" r="3" /><circle cx="46" cy="156" r="2.400" /><circle cx="154" cy="156" r="2.400" /></g>
  </g>
);
const Backpack = () => (
  <g>
    <rect x="132" y="112" width="40" height="58" rx="14" fill="#ff9a5c" stroke="#d9743a" strokeWidth="2.500" />
    <rect x="140" y="140" width="24" height="18" rx="6" fill="#ffb98a" stroke="#d9743a" strokeWidth="2" />
    <path d="M152 112 v-6" stroke="#d9743a" strokeWidth="4" strokeLinecap="round" />
  </g>
);

function NeckItem({ id }: { id: string }) {
  switch (id) {
    case "scarf":
      return (
        <g>
          <path d="M56 146 Q100 170 144 146 L147 161 Q100 185 53 161 Z" fill="#ff6b6b" stroke="#d94444" strokeWidth="2" strokeLinejoin="round" />
          <path d="M122 163 l10 28 l-15 3 l-5 -26 z" fill="#e64848" stroke="#d94444" strokeWidth="2" strokeLinejoin="round" />
          <path d="M70 153 l-2 12 M90 160 l-1 12 M110 160 l1 12" stroke="#fff" strokeWidth="3" opacity=".55" fill="none" />
        </g>
      );
    case "bowtie":
      return <g><path d="M100 154 L80 144 L80 164 Z" fill={C.red} stroke="#b72f48" strokeWidth="1.500" strokeLinejoin="round" /><path d="M100 154 L120 144 L120 164 Z" fill={C.red} stroke="#b72f48" strokeWidth="1.500" strokeLinejoin="round" /><circle cx="100" cy="154" r="5.500" fill="#b72f48" /></g>;
    case "necktie":
      return <g><path d="M94 145 h12 l3 8 l-7 26 l-7 -26 z" fill="#3aa58a" stroke="#27806a" strokeWidth="1.600" strokeLinejoin="round" /><path d="M93 145 h14 l-2 7 h-10 z" fill="#2e8f77" stroke="#27806a" strokeWidth="1.600" strokeLinejoin="round" /><path d="M98 160 l4 4 M97 168 l6 4" stroke="#fff" strokeWidth="1.800" opacity=".5" /></g>;
    case "bandana":
      return (
        <g>
          <path d="M60 141 Q100 160 140 141 L100 186 Z" fill={C.red} stroke="#b72f48" strokeWidth="2" strokeLinejoin="round" />
          <g fill="#fff" opacity=".85"><circle cx="88" cy="152" r="2.400" /><circle cx="112" cy="152" r="2.400" /><circle cx="100" cy="164" r="2.400" /><circle cx="100" cy="150" r="2" /><circle cx="94" cy="174" r="2" /><circle cx="106" cy="174" r="2" /></g>
        </g>
      );
    case "lei":
      return <g>{Array.from({ length: 9 }, (_, i) => { const t = i / 8; const x = 60 + 80 * t; const y = 140 + 28 * Math.sin(Math.PI * t); const cols = ["#ff8fb8", "#ffd54a", "#ff9a5c", "#fff"]; return <g key={i}><circle cx={x} cy={y} r="7" fill={cols[i % 4]} stroke="#fff" strokeWidth="1" strokeOpacity=".5" /><circle cx={x} cy={y} r="2.400" fill="#fff3c0" /></g>; })}</g>;
    case "pearls":
      return <g>{Array.from({ length: 9 }, (_, i) => { const t = i / 8; const x = 62 + 76 * t; const y = 140 + 26 * Math.sin(Math.PI * t); return <circle key={i} cx={x} cy={y} r="4.800" fill="#fffaf2" stroke="#d8cfc0" strokeWidth="1.200" />; })}</g>;
    case "chain":
      return <g><path d="M64 140 Q100 176 136 140" fill="none" stroke={C.gold} strokeWidth="3.500" strokeLinecap="round" strokeDasharray="6 2" /><circle cx="100" cy="162" r="6" fill={C.gold} stroke={C.goldDk} strokeWidth="1.500" /><circle cx="100" cy="162" r="2.500" fill={C.goldDk} /></g>;
    case "pendant":
      return <g><path d="M66 140 Q100 170 134 140" fill="none" stroke="#e8e3f3" strokeWidth="2.500" /><path d="M100 174 C 88 166, 92 156, 100 162 C 108 156, 112 166, 100 174 Z" fill="#ff5d8f" stroke="#d63c70" strokeWidth="1.500" strokeLinejoin="round" /></g>;
    case "diamond":
      return (
        <g>
          <path d="M64 140 Q100 174 136 140" fill="none" stroke={C.silver} strokeWidth="2.600" />
          {([[76, 151], [88, 160], [112, 160], [124, 151]] as [number, number][]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.800" fill="#bfe6ff" stroke="#8cc4ea" strokeWidth="1" />)}
          <polygon points="100,158 109,165 100,178 91,165" fill="#bfe6ff" stroke="#6fb4e4" strokeWidth="1.800" strokeLinejoin="round" /><path d="M91 165 h18 M100 158 l-4 7 l4 13 M100 158 l4 7 l-4 13" stroke="#fff" strokeWidth="1" opacity=".8" fill="none" />
        </g>
      );
    case "medal":
      return (
        <g>
          <path d="M84 142 L100 168 L116 142 L108 140 L100 154 L92 140 Z" fill={C.red} stroke="#b72f48" strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M92 140 L100 154 L108 140" fill="none" stroke="#3e64c9" strokeWidth="3" />
          <circle cx="100" cy="172" r="11" fill={C.gold} stroke={C.goldDk} strokeWidth="2" /><polygon points={starPath(100, 172, 6.500, 2.800)} fill="#fff3a8" stroke={C.goldDk} strokeWidth="1" strokeLinejoin="round" />
        </g>
      );
    default: return null;
  }
}

function FaceItem({ id, ey, k }: { id: string; ey: number; k: number }) {
  const r = 14 * Math.max(k, 0.95);
  switch (id) {
    case "glasses":
      return <g fill="rgba(255,255,255,.28)" stroke="#2a1f45" strokeWidth="3"><circle cx="79" cy={ey} r={r} /><circle cx="121" cy={ey} r={r} /><path d={`M${79 + r} ${ey} h${42 - 2 * r}`} fill="none" /><path d={`M${79 - r} ${ey} l-8 -3 M${121 + r} ${ey} l8 -3`} fill="none" /></g>;
    case "sunglasses":
      return (
        <g>
          <rect x={79 - r - 1} y={ey - r * 0.75} width={2 * r + 2} height={r * 1.5} rx="7" fill="#231a3d" />
          <rect x={121 - r - 1} y={ey - r * 0.75} width={2 * r + 2} height={r * 1.5} rx="7" fill="#231a3d" />
          <path d={`M${79 + r + 1} ${ey - 2} h${40 - 2 * r - 2}`} stroke="#231a3d" strokeWidth="3" />
          <path d={`M${79 - r + 4} ${ey - 4} l6 -3 M${121 - r + 4} ${ey - 4} l6 -3`} stroke="#fff" strokeWidth="2.500" strokeLinecap="round" opacity=".6" />
        </g>
      );
    case "starshades":
      return <g>{[79, 121].map((cx) => <polygon key={cx} points={starPath(cx, ey, 15.500, 7.500)} fill="#ff6fb0" stroke="#d6438a" strokeWidth="2" strokeLinejoin="round" opacity=".92" />)}<path d={`M93 ${ey} h14`} stroke="#d6438a" strokeWidth="3" /></g>;
    case "heartshades": {
      const heart = (cx: number) => <path key={cx} d={`M${cx} ${ey + 13} C ${cx - 19} ${ey + 2}, ${cx - 14} ${ey - 13}, ${cx} ${ey - 5} C ${cx + 14} ${ey - 13}, ${cx + 19} ${ey + 2}, ${cx} ${ey + 13} Z`} fill="#ff5d8f" stroke="#d63c70" strokeWidth="2" strokeLinejoin="round" opacity=".9" />;
      return <g>{heart(79)}{heart(121)}<path d={`M93 ${ey - 3} h14`} stroke="#d63c70" strokeWidth="3" /><path d={`M68 ${ey - 4} l4 -3 M110 ${ey - 4} l4 -3`} stroke="#fff" strokeWidth="2.400" strokeLinecap="round" opacity=".7" /></g>;
    }
    case "monocle":
      return <g><circle cx="121" cy={ey} r={r + 1} fill="rgba(255,255,255,.25)" stroke={C.goldDk} strokeWidth="3.200" /><path d={`M${121 + r * 0.7} ${ey + r * 0.8} Q 150 ${ey + 34} 146 158`} fill="none" stroke={C.gold} strokeWidth="1.800" /><circle cx="146" cy="159" r="2.600" fill={C.gold} /></g>;
    default: return null;
  }
}

function HeadItem({ id }: { id: string }) {
  switch (id) {
    case "bow": return <g transform="translate(134 78)"><path d="M0 0 L-18 -12 L-18 12 Z" fill="#ff5d8f" stroke="#d63c70" strokeWidth="1.500" strokeLinejoin="round" /><path d="M0 0 L18 -12 L18 12 Z" fill="#ff5d8f" stroke="#d63c70" strokeWidth="1.500" strokeLinejoin="round" /><circle r="6.500" fill="#e0336f" /></g>;
    case "flower":
      return <g transform="translate(138 78)">{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 9.500} cy={Math.sin((a * Math.PI) / 180) * 9.500} r="7.500" fill="#ff9ecb" stroke="#ef72b0" strokeWidth="1.200" />)}<circle r="6.500" fill="#ffd54a" stroke="#e0a800" strokeWidth="1.200" /></g>;
    case "beanie":
      return (
        <g>
          <path d="M57 94 C 54 48, 146 48, 143 94 Z" fill="#ff7b9c" stroke="#d65678" strokeWidth="2" strokeLinejoin="round" />
          <rect x="53" y="86" width="94" height="14" rx="7" fill="#ffb3c7" stroke="#d65678" strokeWidth="2" />
          <path d="M66 86 v14 M80 86 v14 M94 86 v14 M108 86 v14 M122 86 v14 M136 86 v14" stroke="#ff7b9c" strokeWidth="2" opacity=".6" />
          <circle cx="100" cy="52" r="10" fill="#fff" stroke="#e7dff0" strokeWidth="1.500" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M60 92 C 56 52, 144 52, 140 92 Z" fill={C.red} stroke="#b72f48" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 52 V92 M80 58 C 76 70, 76 82, 78 92 M120 58 C 124 70, 124 82, 122 92" fill="none" stroke="#b72f48" strokeWidth="1.600" opacity=".5" />
          <path d="M104 88 Q 148 82 172 96 Q 140 102 104 98 Z" fill="#c93750" stroke="#b72f48" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="100" cy="54" r="4" fill="#b72f48" />
          <path d="M62 94 Q100 100 138 94" fill="none" stroke="#b72f48" strokeWidth="3" />
        </g>
      );
    case "party":
      return (
        <g>
          <path d="M82 92 L100 30 L118 92 Z" fill="#ff8fc7" stroke="#e0609f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M88 72 L112 72 M84 84 L116 84" stroke="#fff3a8" strokeWidth="4" strokeLinecap="round" />
          <g fill="#6cb8ff"><circle cx="97" cy="56" r="3" /><circle cx="105" cy="62" r="3" /><circle cx="100" cy="46" r="2.600" /></g>
          <circle cx="100" cy="28" r="7" fill="#ffd54a" stroke="#e0a800" strokeWidth="1.500" />
          <path d="M74 88 Q100 98 126 88" fill="none" stroke="#e0609f" strokeWidth="2" />
        </g>
      );
    case "halo":
      return <g><ellipse cx="100" cy="58" rx="27" ry="8" fill="none" stroke="#ffe27a" strokeWidth="7" opacity=".5" /><ellipse cx="100" cy="58" rx="27" ry="8" fill="none" stroke={C.gold} strokeWidth="4.500" /><ellipse cx="92" cy="55" rx="8" ry="1.500" fill="#fff" opacity=".6" /></g>;
    case "chef":
      return (
        <g>
          <g fill="#fffdf8" stroke="#dcd3c6" strokeWidth="1.800">
            <circle cx="78" cy="58" r="15" /><circle cx="122" cy="58" r="15" /><circle cx="100" cy="48" r="17" /><circle cx="88" cy="68" r="13" /><circle cx="112" cy="68" r="13" />
          </g>
          <rect x="72" y="74" width="56" height="18" rx="5" fill="#fffdf8" stroke="#dcd3c6" strokeWidth="1.800" />
          <path d="M82 74 v18 M100 74 v18 M118 74 v18" stroke="#ece4d6" strokeWidth="1.600" />
        </g>
      );
    case "tophat":
      return (
        <g>
          <rect x="76" y="32" width="48" height="50" rx="5" fill="#2b2547" stroke="#16122b" strokeWidth="2" />
          <ellipse cx="100" cy="84" rx="38" ry="9" fill="#2b2547" stroke="#16122b" strokeWidth="2" />
          <rect x="76" y="66" width="48" height="11" fill={C.red} stroke="#b72f48" strokeWidth="1.400" />
          <path d="M82 38 v36" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".18" />
        </g>
      );
    case "sunhat":
      return (
        <g>
          <ellipse cx="100" cy="86" rx="56" ry="13" fill="#f3d48a" stroke="#d9b25a" strokeWidth="2" />
          <path d="M72 86 C 70 50, 130 50, 128 86 Z" fill="#f7dc99" stroke="#d9b25a" strokeWidth="2" strokeLinejoin="round" />
          <path d="M72 80 Q100 88 128 80 L128 86 Q100 94 72 86 Z" fill={C.pink} />
          <g transform="translate(122 76)">{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 6} cy={Math.sin((a * Math.PI) / 180) * 6} r="4.600" fill="#fff" stroke="#ffd0e2" strokeWidth="1" />)}<circle r="3.600" fill="#ffd54a" /></g>
          <path d="M60 84 Q100 90 140 84" fill="none" stroke="#d9b25a" strokeWidth="1.400" strokeDasharray="4 3" opacity=".7" />
        </g>
      );
    case "headphones":
      return <g><path d="M54 108 C 48 44, 152 44, 146 108" fill="none" stroke="#3a3358" strokeWidth="8" strokeLinecap="round" /><ellipse cx="52" cy="112" rx="10" ry="16" fill="#6d5cff" stroke="#4a3bd0" strokeWidth="2" /><ellipse cx="148" cy="112" rx="10" ry="16" fill="#6d5cff" stroke="#4a3bd0" strokeWidth="2" /></g>;
    case "wizard":
      return (
        <g>
          <polygon points="72,88 102,14 130,88" fill="#5b3fc4" stroke="#432e9c" strokeWidth="2" strokeLinejoin="round" />
          <path d="M102 14 q10 -2 16 6 q-8 -2 -10 4 z" fill="#5b3fc4" />
          <ellipse cx="101" cy="90" rx="42" ry="9" fill="#4a31a8" stroke="#432e9c" strokeWidth="2" />
          <path d="M78 80 Q101 88 124 80" fill="none" stroke="#ffd54a" strokeWidth="4" />
          <polygon points={starPath(100, 56, 8, 3.400)} fill="#ffd54a" />
          <circle cx="90" cy="70" r="1.800" fill="#fff" /><circle cx="114" cy="66" r="1.800" fill="#fff" /><circle cx="108" cy="42" r="1.500" fill="#fff" />
        </g>
      );
    case "crown":
      return <g><path d="M72 76 l8 -26 l20 16 l20 -16 l8 26 z" fill="#ffd54a" stroke="#d99f00" strokeWidth="2.500" strokeLinejoin="round" /><circle cx="100" cy="62" r="4" fill="#ff5d8f" /><circle cx="82" cy="66" r="3" fill="#6d5cff" /><circle cx="118" cy="66" r="3" fill="#6d5cff" /><path d="M76 72 h48" stroke="#d99f00" strokeWidth="2" /></g>;
    default: return null;
  }
}

function ExtraItem({ id }: { id: string }) {
  switch (id) {
    case "earrings":
      return <g><circle cx="50" cy="108" r="3.600" fill={C.gold} stroke={C.goldDk} strokeWidth="1.400" /><path d="M50 111.600 v6" stroke={C.goldDk} strokeWidth="1.400" /><circle cx="50" cy="121" r="4.200" fill="#ff7aa8" stroke={C.goldDk} strokeWidth="1.400" /><circle cx="150" cy="108" r="3.600" fill={C.gold} stroke={C.goldDk} strokeWidth="1.400" /><path d="M150 111.600 v6" stroke={C.goldDk} strokeWidth="1.400" /><circle cx="150" cy="121" r="4.200" fill="#ff7aa8" stroke={C.goldDk} strokeWidth="1.400" /></g>;
    case "bracelet":
      return <g><ellipse cx="157" cy="146" rx="12" ry="4.600" transform="rotate(-18 157 146)" fill="none" stroke="#ff7aa8" strokeWidth="4.600" /><ellipse cx="157" cy="146" rx="12" ry="4.600" transform="rotate(-18 157 146)" fill="none" stroke="#fff" strokeWidth="1.400" strokeDasharray="3 4" opacity=".7" /><circle cx="163" cy="150" r="3.600" fill={C.gold} stroke={C.goldDk} strokeWidth="1.200" /></g>;
    case "wand":
      return (
        <g>
          <path d="M156 146 L184 102" stroke="#b9845a" strokeWidth="4.500" strokeLinecap="round" />
          <polygon points={starPath(188, 94, 11, 4.600)} fill="#ffd54a" stroke="#e0a800" strokeWidth="1.500" strokeLinejoin="round" />
          <circle cx="172" cy="104" r="2" fill="#fff" /><circle cx="196" cy="116" r="1.800" fill="#fff" />
        </g>
      );
    case "coffee":
      return (
        <g>
          <path d="M148 138 h22 l-2 20 q-1 5 -6 5 h-6 q-5 0 -6 -5 z" fill="#fff" stroke="#cfc6d8" strokeWidth="2" strokeLinejoin="round" />
          <path d="M170 142 q8 0 8 7 q0 7 -8 7" fill="none" stroke="#cfc6d8" strokeWidth="3" />
          <path d="M148 143 h22" stroke="#b9845a" strokeWidth="4" /><path d="M154 132 q-3 -6 0 -10 M162 132 q-3 -6 0 -10" stroke="#bdb4cc" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    case "balloon":
      return (
        <g>
          <path d="M156 142 Q 174 118 178 84" fill="none" stroke="#9a92ad" strokeWidth="1.600" />
          <ellipse cx="178" cy="66" rx="17" ry="21" fill="#ff6f9c" stroke="#e04a7c" strokeWidth="2" /><path d="M178 87 l-4 6 h8 z" fill="#e04a7c" />
          <ellipse cx="171" cy="58" rx="4" ry="7" transform="rotate(20 171 58)" fill="#fff" opacity=".5" />
        </g>
      );
    case "book":
      return (
        <g>
          <path d="M74 152 L100 158 L126 152 L126 176 L100 182 L74 176 Z" fill="#fff" stroke="#cfc6d8" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 158 V182" stroke="#cfc6d8" strokeWidth="2" /><path d="M80 160 L96 164 M80 166 L96 170 M104 164 L120 160 M104 170 L120 166" stroke="#b8aecb" strokeWidth="1.600" strokeLinecap="round" />
          <path d="M74 176 L100 182 L126 176 L126 179 L100 185 L74 179 Z" fill="#7b5ff0" />
        </g>
      );
    case "laptop":
      return (
        <g>
          <path d="M72 150 h56 a3 3 0 0 1 3 3 v20 a3 3 0 0 1 -3 3 h-56 a3 3 0 0 1 -3 -3 v-20 a3 3 0 0 1 3 -3 z" fill={C.silver} stroke="#9aa4b8" strokeWidth="2" />
          <polygon points={starPath(100, 163, 6, 2.600)} fill="#fff" opacity=".9" />
          <path d="M64 178 h72 l-3 5 h-66 z" fill="#b8c1d3" stroke="#9aa4b8" strokeWidth="1.600" strokeLinejoin="round" />
        </g>
      );
    case "umbrella":
      return (
        <g>
          <path d="M157 146 L176 92" stroke="#7b5a3c" strokeWidth="4" strokeLinecap="round" />
          <path d="M140 92 C 140 62, 196 56, 204 92 C 196 86, 190 90, 184 94 C 178 88, 168 88, 164 94 C 158 88, 148 88, 140 92 Z" fill="#7fb5ff" stroke="#4f86d6" strokeWidth="2" strokeLinejoin="round" />
          <path d="M172 62 L176 92 M156 70 L168 92 M190 70 L182 92" stroke="#4f86d6" strokeWidth="1.600" opacity=".6" />
        </g>
      );
    default: return null;
  }
}

// ---------- aura ----------
function Aura({ id, gid }: { id: string; gid: string }) {
  if (id === "glow") return <g><defs><radialGradient id={`${gid}glow`}><stop offset="0" stopColor="#ffe58a" stopOpacity=".95" /><stop offset="1" stopColor="#ffe58a" stopOpacity="0" /></radialGradient></defs><circle cx="100" cy="116" r="96" fill={`url(#${gid}glow)`} opacity=".6" /></g>;
  if (id === "rainbow") {
    const cols = ["#ff6b6b", "#ffa94d", "#ffe066", "#69db7c", "#4dabf7", "#b197fc"];
    return <g fill="none" strokeLinecap="round" opacity=".75">{cols.map((c, i) => <path key={c} d={`M${18 + i * 5} 150 A ${82 - i * 5} ${82 - i * 5} 0 0 1 ${182 - i * 5} 150`} stroke={c} strokeWidth="5" />)}</g>;
  }
  if (id === "sparkles") return <g><Sparkle x={26} y={70} s={1.3} /><Sparkle x={174} y={60} s={1.1} d={0.5} fill="#ffb3e6" /><Sparkle x={166} y={142} s={0.9} d={1} /><Sparkle x={30} y={140} s={1} d={1.5} fill="#b3e9ff" /><Sparkle x={100} y={22} s={1.1} d={0.8} fill="#fff3a8" /></g>;
  return null;
}

/** How to draw a pet. Everything is optional; the defaults draw a purple cat egg. */
export type PetArtProps = {
  species?: string; gender?: string; color?: string; stage?: number; mood?: string; outfit?: Outfit; pattern?: string; aura?: string;
  legend?: boolean; eggProgress?: number; size?: number; animate?: boolean; className?: string;
};

export default function PetArt({
  species: sp = "cat", gender = "neutral", color = "#9b7bff", stage = 0, mood = "happy", outfit = {}, pattern = "none", aura = "none",
  legend = false, eggProgress = 0, size = 220, animate = true, className = "",
}: PetArtProps) {
  const gid = "pa" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const age = Math.max(0, Math.min(9, stage));
  const light = mix(color, "#ffffff", 0.55), dark = mix(color, "#000000", 0.22);
  const edge = mix(color, "#000000", 0.32);
  const S = byAge(SCALE, age);
  const sq = byAge(SQUASH, age);
  const male = gender === "boy";
  const bw = male ? 57 : 55; // boys are built a little broader
  const f = age >= 1 ? species(sp, { color, dark, light, age, male }) : null;
  const o: Outfit = outfit || {};
  const ey = byAge(EYE_Y, age) || 110;
  const auraId = legend && aura === "none" ? "glow" : aura;
  const hat = !!o.head;
  const showEars = f && f.ears && !HIDES_EARS.has(o.head ?? "");

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={"pet-svg " + className} role="img" aria-label={age === 0 ? "A pet egg" : `A ${gender === "boy" ? "male " : gender === "girl" ? "female " : ""}${sp}`}>
      <Aura id={auraId} gid={gid} />
      <ellipse cx="100" cy="181" rx={50 * S} ry="6" fill="#000" opacity=".14" />

      {age === 0 ? (
        <Egg color={color} progress={eggProgress} animate={animate} gid={gid} />
      ) : (
        <g className={animate ? (mood === "sleepy" ? "pet-breathe" : "pet-bob") : ""} style={{ transformOrigin: "100px 178px" }}>
          <defs>
            <radialGradient id={`${gid}b`} cx="40%" cy="28%" r="85%"><stop offset="0" stopColor={mix(color, "#ffffff", 0.42)} /><stop offset=".5" stopColor={color} /><stop offset="1" stopColor={mix(color, "#000000", 0.16)} /></radialGradient>
            <radialGradient id={`${gid}l`} cx="50%" cy="30%" r="80%"><stop offset="0" stopColor={mix(color, "#ffffff", 0.8)} /><stop offset="1" stopColor={light} /></radialGradient>
            <clipPath id={`${gid}c`}><ellipse cx="100" cy="122" rx={bw} ry={51 * sq} /></clipPath>
          </defs>
          <g transform={`translate(100 178) scale(${S}) translate(-100 -178)`}>
            {/* behind the body */}
            {o.body === "cape" && <CapeBack />}
            {o.extra === "fairywings" && <FairyWings />}
            {o.extra === "backpack" && <Backpack />}
            {f?.back}
            {f?.gills}
            {showEars && f?.ears}
            {/* paws with toe beans */}
            <g><ellipse cx={male ? 73 : 74} cy="173" rx={male ? 19 : 17} ry="8.500" fill={dark} /><ellipse cx={male ? 127 : 126} cy="173" rx={male ? 19 : 17} ry="8.500" fill={dark} />
              <g fill={PINK} opacity=".85"><circle cx="69" cy="174" r="2" /><circle cx="74" cy="172" r="2" /><circle cx="79" cy="174" r="2" /><circle cx="121" cy="174" r="2" /><circle cx="126" cy="172" r="2" /><circle cx="131" cy="174" r="2" /></g></g>
            {/* body */}
            <ellipse cx="100" cy="122" rx={bw} ry={51 * sq} fill={`url(#${gid}b)`} stroke={edge} strokeWidth="2.500" strokeOpacity=".45" />
            <ellipse cx="100" cy="141" rx={male ? 38 : 35} ry={30 * sq} fill={`url(#${gid}l)`} opacity={male ? 0.8 : 0.9} />
            <g clipPath={`url(#${gid}c)`}><Pattern id={pattern} color={color} /></g>
            <ellipse cx={male ? 45 : 46} cy="137" rx={male ? 11 : 9.500} ry={male ? 15 : 14} transform="rotate(18 46 137)" fill={color} stroke={edge} strokeWidth="2" strokeOpacity=".45" />
            <ellipse cx={male ? 155 : 154} cy="137" rx={male ? 11 : 9.500} ry={male ? 15 : 14} transform="rotate(-18 154 137)" fill={color} stroke={edge} strokeWidth="2" strokeOpacity=".45" />
            <path d="M74 80 q10 -8 22 -8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".45" />
            {/* clothes */}
            {o.body && o.body !== "cape" && <Clothes id={o.body} gid={gid} />}
            {o.body === "cape" && <g><path d="M72 140 Q100 152 128 140" fill="none" stroke={mix(C.red, "#ffffff", 0.2)} strokeWidth="6" strokeLinecap="round" /><circle cx="100" cy="146" r="5" fill={C.gold} stroke={C.goldDk} strokeWidth="1.500" /></g>}
            {f?.under}
            {age === 1 && !hat && <path d="M66 80 l7 -12 l8 11 l9 -14 l9 13 l9 -12 l8 12 l8 -10 l7 12 z" fill="#fff7ea" stroke="#e8dcc6" strokeWidth="2" strokeLinejoin="round" />}
            {(age === 2 || age === 3) && !hat && <path d="M98 74 q-8 -14 2 -18 q6 -2 6 6 q-4 -4 -6 2 q0 6 4 10 z" fill={dark} />}
            {o.look && FACIAL_HAIR.has(o.look) && age >= 4 && <LookBehind id={o.look} ey={ey} />}
            <Face mood={mood} age={age} color={color} dark={dark} gender={gender} />
            {f?.face}
            {o.look && (!FACIAL_HAIR.has(o.look) || age >= 4) && <LookFront id={o.look} ey={ey} k={byAge(EYE_SCALE, age)} />}
            {age >= 8 && !hat && <polygon points={starPath(100, 88, 5, 2.200)} fill="#ffd54a" stroke="#e0a800" strokeWidth="0.800" strokeLinejoin="round" />}
            {o.neck && <g transform={`translate(0 ${-12 + (ey - 108)})`}><NeckItem id={o.neck} /><NewNeck id={o.neck} gid={gid} /></g>}
            {o.face && <><FaceItem id={o.face} ey={ey} k={byAge(EYE_SCALE, age)} /><NewFace id={o.face} gid={gid} ey={ey} k={byAge(EYE_SCALE, age)} /></>}
            {o.head && <><HeadItem id={o.head} /><NewHead id={o.head} gid={gid} ey={ey} /></>}
            {o.extra && o.extra !== "backpack" && o.extra !== "fairywings" && <><ExtraItem id={o.extra} /><NewExtra id={o.extra} gid={gid} /></>}
            {mood === "sleepy" && <g className="pet-zzz" fill={INK} opacity=".55"><text x="138" y="84" fontSize="20" fontWeight="700">z</text><text x="150" y="68" fontSize="14" fontWeight="700">z</text></g>}
          </g>
          {age >= 8 && <><Sparkle x={34} y={62} s={1.2} /><Sparkle x={168} y={58} s={1} d={0.6} /></>}
          {age >= 9 && <Sparkle x={158} y={150} s={0.9} d={1.2} />}
        </g>
      )}
    </svg>
  );
}
