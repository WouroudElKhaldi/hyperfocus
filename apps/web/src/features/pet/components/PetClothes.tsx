import type { ReactNode } from "react";
import { C, mix, starPath } from "./petKit.ts";

// Garments. Each one is built the same way so it looks like cloth worn on the body, not a sticker:
//   sleeves (a thick rounded tube with a highlight and a cuff), then the body of the garment (a gradient fill, a darker
//   outline and a few soft folds), then its own details (stripes, pockets, buttons) clipped to its shape, then the collar.
// The pet's body is an ellipse centred at 100,122; the garment shell sits a hair outside it so it reads as a layer of fabric.
const SHELL = "M42.5 128 Q100 174 157.5 128 A58 54 0 1 1 42.5 128 Z"; // from shoulder to shoulder, with a scooped neckline
type Sleeve = { short: string; long: string; endShort: [number, number]; endLong: [number, number] };
const SLEEVES: Record<"l" | "r", Sleeve> = {
  l: { short: "M58 133 Q50 136 46 144", long: "M58 133 Q47 138 41 152", endShort: [46, 144], endLong: [41, 152] },
  r: { short: "M142 133 Q150 136 154 144", long: "M142 133 Q153 138 159 152", endShort: [154, 144], endLong: [159, 152] },
};

function Sleeves({ fill, dark, long, cuff, stripe }: { fill: string; dark: string; long: boolean; cuff: string | undefined; stripe: string | undefined }) {
  return (["l", "r"] as const).map((side) => {
    const sl = SLEEVES[side], d = long ? sl.long : sl.short, [ex, ey] = long ? sl.endLong : sl.endShort;
    return (
      <g key={side}>
        <path d={d} fill="none" stroke={dark} strokeWidth="19.500" strokeLinecap="round" />
        <path d={d} fill="none" stroke={fill} strokeWidth="16" strokeLinecap="round" />
        <path d={d} fill="none" stroke={mix(fill, "#ffffff", 0.34)} strokeWidth="4" strokeLinecap="round" opacity=".5" transform={`translate(${side === "l" ? -2 : 2} -2.500)`} />
        {stripe && <path d={d} fill="none" stroke={stripe} strokeWidth="16" strokeLinecap="butt" strokeDasharray="2.600 8" opacity=".9" />}
        {cuff && <circle cx={ex} cy={ey} r="7.800" fill="none" stroke={cuff} strokeWidth="3.600" />}
        {cuff && <circle cx={ex} cy={ey} r="9.600" fill="none" stroke={dark} strokeWidth="1.200" opacity=".5" />}
      </g>
    );
  });
}

type ClothProps = {
  gid: string; id: string; fill: string; dark?: string; sleeve?: "short" | "long" | "none"; sleeveFill?: string; cuff?: string; stripe?: string;
  folds?: boolean; shine?: number; children?: ReactNode; over?: ReactNode; under?: ReactNode;
};
function Cloth({ gid, id, fill, dark = mix(fill, "#000000", 0.32), sleeve = "short", sleeveFill = fill, cuff, stripe, folds = true, shine = 0.16, children, over, under }: ClothProps) {
  const g = `${gid}${id}`;
  return (
    <g>
      <defs>
        <linearGradient id={`${g}g`} x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor={mix(fill, "#ffffff", 0.26)} /><stop offset=".55" stopColor={fill} /><stop offset="1" stopColor={mix(fill, "#000000", 0.2)} /></linearGradient>
        <clipPath id={`${g}k`}><path d={SHELL} /></clipPath>
      </defs>
      {under}
      {sleeve !== "none" && <Sleeves fill={sleeveFill} dark={dark} long={sleeve === "long"} cuff={cuff} stripe={stripe} />}
      <path d={SHELL} fill={`url(#${g}g)`} stroke={dark} strokeWidth="2" strokeLinejoin="round" />
      <g clipPath={`url(#${g}k)`}>
        {folds && <g fill="none" stroke={dark} strokeOpacity=".2" strokeWidth="2" strokeLinecap="round"><path d="M64 158 q7 8 4 18" /><path d="M136 158 q-7 8 -4 18" /><path d="M100 153 q3 12 0 26" opacity=".7" /></g>}
        <path d="M52 148 Q60 166 58 182" stroke="#ffffff" strokeOpacity={shine} strokeWidth="7" fill="none" strokeLinecap="round" />
        {children}
      </g>
      {over}
    </g>
  );
}

// y is one height for every button, or one height per button
const buttons = (xs: number[], y: number | number[], fill = "#fff", stroke?: string) => xs.map((x, i) => <circle key={i} cx={x} cy={typeof y === "number" ? y : y[i]} r="2.100" fill={fill} stroke={stroke} strokeWidth=".8" />);
const dotsAt = (pts: number[][], r: number | string, fill: string, op = 1) => <g fill={fill} opacity={op}>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
const crewRib = (fill: string) => <path d="M66 141 Q100 160 134 141" fill="none" stroke={mix(fill, "#ffffff", 0.5)} strokeWidth="4.800" strokeLinecap="round" />;

export default function Clothes({ id, gid }: { id: string; gid: string }) {
  const p = { gid, id };
  switch (id) {
    case "tee": {
      const f = C.blue;
      return <Cloth {...p} fill={f} dark="#2d5d94" sleeve="short" over={crewRib(f)}>
        <g stroke="#fff" strokeOpacity=".55" strokeWidth="3.600"><path d="M40 160 H160 M40 171 H160" /></g>
      </Cloth>;
    }
    case "polo": {
      const f = "#2f4b8f";
      return <Cloth {...p} fill={f} dark="#1d3166" sleeve="short" cuff="#f3f6ff"
        over={<g>
          <path d="M70 139 L98 154 L92 162 L62 146 Z" fill="#f3f6ff" stroke="#c6cfe6" strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M130 139 L102 154 L108 162 L138 146 Z" fill="#f3f6ff" stroke="#c6cfe6" strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M100 154 V176" stroke="#1d3166" strokeWidth="1.600" />{buttons([100, 100], [160, 168], "#f3f6ff", "#1d3166")}
        </g>} />;
    }
    case "hoodie": {
      const f = C.lilac, d = "#5d4fc0";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff={mix(f, "#000000", 0.18)}
        over={<g>
          <path d="M57 141 Q100 180 143 141 Q137 155 100 161 Q63 155 57 141 Z" fill={mix(f, "#000000", 0.16)} stroke={d} strokeWidth="1.800" strokeLinejoin="round" />
          <path d="M92 156 v17 M108 156 v17" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" /><circle cx="92" cy="174" r="2" fill="#fff" /><circle cx="108" cy="174" r="2" fill="#fff" />
        </g>}>
        <path d="M68 168 Q100 160 132 168 L126 184 H74 Z" fill={mix(f, "#000000", 0.1)} stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
        <path d="M70 170 Q100 163 130 170" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.600" />
      </Cloth>;
    }
    case "cardigan": {
      const f = "#ebcfa6", d = "#b28f60";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff={mix(f, "#000000", 0.1)}
        over={<g>
          <path d="M100 150 V184" stroke={d} strokeWidth="1.800" />{[158, 167, 176].map((y) => <circle key={y} cx="100" cy={y} r="2.300" fill="#fffaf0" stroke={d} strokeWidth="1" />)}
          <path d="M66 141 Q100 158 134 141" fill="none" stroke={mix(f, "#000000", 0.08)} strokeWidth="5" strokeLinecap="round" />
        </g>}>
        <path d="M84 140 L100 168 L116 140 Z" fill="#ff8fb4" />
        <g stroke={d} strokeOpacity=".35" strokeWidth="1.400"><path d="M44 178 H156 M44 183 H156" /><path d="M60 150 v28 M72 152 v26 M128 152 v26 M140 150 v28" strokeOpacity=".18" /></g>
      </Cloth>;
    }
    case "sweater": {
      const f = C.peach, d = "#d98d63";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff={mix(f, "#ffffff", 0.3)}
        over={<path d="M64 140 Q100 162 136 140 L136 148 Q100 170 64 148 Z" fill={mix(f, "#ffffff", 0.32)} stroke={d} strokeWidth="1.600" strokeLinejoin="round" />}>
        <g stroke={mix(f, "#000000", 0.16)} strokeWidth="2.600" fill="none" strokeLinecap="round" opacity=".65">
          {[70, 84, 98, 112, 126].map((x, i) => <path key={x} d={`M${x} 154 q${i % 2 ? 5 : -5} 6 0 12 q${i % 2 ? 5 : -5} 6 0 12`} />)}
        </g>
        <path d="M40 182 H160" stroke={mix(f, "#000000", 0.16)} strokeWidth="9" />
        <path d="M44 179 H156" stroke="#fff" strokeOpacity=".25" strokeWidth="1.600" strokeDasharray="3 3" />
      </Cloth>;
    }
    case "flannel": {
      const f = "#c8423f", d = "#7d1f22";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#8e2a2c"
        over={<g>
          <path d="M68 140 L98 153 L90 163 L60 147 Z" fill="#b53a38" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M132 140 L102 153 L110 163 L140 147 Z" fill="#b53a38" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M100 154 V184" stroke={d} strokeWidth="1.600" />{buttons([100, 100, 100], [162, 171, 180], "#f6e9d0", d)}
        </g>}>
        <g stroke="#1c1214" strokeOpacity=".42" strokeWidth="3.200">{[54, 70, 86, 102, 118, 134, 150].map((x) => <path key={x} d={`M${x} 140 V192`} />)}{[152, 166, 180].map((y) => <path key={y} d={`M40 ${y} H160`} />)}</g>
        <g stroke="#f2d8b0" strokeOpacity=".5" strokeWidth="1.200">{[62, 94, 126, 142].map((x) => <path key={x} d={`M${x} 140 V192`} />)}{[159, 173].map((y) => <path key={y} d={`M40 ${y} H160`} />)}</g>
      </Cloth>;
    }
    case "hawaiian": {
      const f = "#27b3a4", d = "#157c72";
      const flower = (x: number, y: number, c: string, s = 1) => <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 4.600} cy={Math.sin((a * Math.PI) / 180) * 4.600} r="3.800" fill={c} />)}<circle r="2.300" fill="#ffe27a" /></g>;
      return <Cloth {...p} fill={f} dark={d} sleeve="short"
        over={<g>
          <path d="M66 140 L96 152 L92 166 L58 148 Z" fill="#1f9d90" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M134 140 L104 152 L108 166 L142 148 Z" fill="#1f9d90" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
        </g>}>
        {([[64, 160, "#ff9ec9", 1], [136, 162, "#fff", 1.1], [86, 176, "#ffd54a", 1], [116, 178, "#ff8f6b", 1.1], [54, 176, "#fff", 0.9], [148, 148, "#ff9ec9", 0.9]] as [number, number, string, number][]).map(([x, y, c, s]) => flower(x, y, c, s))}
        <g fill="#0f6d62" opacity=".45"><path d="M72 170 q5 -9 10 0 q-5 4 -10 0z" /><path d="M128 168 q5 -9 10 0 q-5 4 -10 0z" /><path d="M98 186 q5 -8 10 0 q-5 4 -10 0z" /></g>
      </Cloth>;
    }
    case "jersey": {
      const f = "#2f9e63", d = "#1b6a41";
      return <Cloth {...p} fill={f} dark={d} sleeve="short" cuff="#fff"
        over={<path d="M78 141 L100 162 L122 141" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}>
        <path d="M43 150 V190 M157 150 V190" stroke="#fff" strokeWidth="8" strokeOpacity=".9" />
        <path d="M49 150 V190 M151 150 V190" stroke={d} strokeWidth="2" strokeOpacity=".6" />
        <text x="100" y="178" textAnchor="middle" fontSize="23" fontWeight="800" fill="#fff" stroke={d} strokeWidth="1.200" fontFamily="Arial Black, Arial, sans-serif">7</text>
      </Cloth>;
    }
    case "leather": {
      const f = "#2e2e38", d = "#101016";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#5b5b6a" shine={0.26}
        over={<g>
          <path d="M66 140 L97 154 L86 172 L56 148 Z" fill="#3d3d4b" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M134 140 L103 154 L114 172 L144 148 Z" fill="#3d3d4b" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M100 156 L100 188" stroke="#c9cddb" strokeWidth="2.600" strokeDasharray="2.200 1.800" />
          <circle cx="76" cy="150" r="1.600" fill="#d9dce8" /><circle cx="124" cy="150" r="1.600" fill="#d9dce8" />
        </g>}>
        <path d="M82 166 L94 188 M118 166 L106 188" stroke="#c9cddb" strokeWidth="1.600" strokeOpacity=".7" />
        <path d="M60 156 Q72 152 84 156" stroke="#fff" strokeOpacity=".22" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M40 180 H160" stroke="#1d1d25" strokeWidth="7" />
      </Cloth>;
    }
    case "suit": {
      const f = "#3b4152", d = "#1b1e29";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#fff"
        over={<g>
          <path d="M70 143 L98 180 L84 183 L60 150 Z" fill="#4a5168" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M130 143 L102 180 L116 183 L140 150 Z" fill="#4a5168" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <circle cx="100" cy="176" r="2.400" fill="#c9cddb" /><path d="M72 160 h9 l1 4 h-9 z" fill="#fff" />
        </g>}>
        <path d="M86 141 L100 180 L114 141 Z" fill="#fbfbff" />
        <path d="M100 150 V180" stroke="#dfe2ee" strokeWidth="1.200" />
      </Cloth>;
    }
    case "tuxedo": {
      const f = "#25223c", d = "#0d0b1d";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#fff"
        over={<g>
          <path d="M68 143 L98 182 L82 185 L58 150 Z" fill="#3a355e" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M132 143 L102 182 L118 185 L142 150 Z" fill="#3a355e" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
        </g>}>
        <path d="M86 141 L100 184 L114 141 Z" fill="#fbfbff" />
        <g fill="#cfd3e6">{[154, 163, 172].map((y) => <circle key={y} cx="100" cy={y} r="1.800" />)}</g>
        <path d="M44 177 H156 V190 H44 Z" fill="#8f2b4a" opacity=".92" />
      </Cloth>;
    }
    case "blazer": {
      const f = C.navy, d = "#171d3d";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff={mix(f, "#ffffff", 0.18)}
        over={<g>
          <path d="M70 143 L98 180 L84 183 L60 150 Z" fill={mix(f, "#ffffff", 0.14)} stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M130 143 L102 180 L116 183 L140 150 Z" fill={mix(f, "#ffffff", 0.14)} stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
          <circle cx="100" cy="170" r="2.800" fill={C.gold} stroke={C.goldDk} strokeWidth="1" /><circle cx="100" cy="180" r="2.800" fill={C.gold} stroke={C.goldDk} strokeWidth="1" />
          <path d="M120 164 h12 v10 h-12 z" fill={mix(f, "#000000", 0.12)} stroke={d} strokeWidth="1.200" /><path d="M72 158 l5 -4 l5 4 z" fill="#fff" />
        </g>}>
        <path d="M86 141 L100 178 L114 141 Z" fill="#f4f6ff" />
      </Cloth>;
    }
    case "labcoat": {
      const f = "#fbfcff", d = "#9fa9c0";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#e7ebf6" shine={0.08}
        over={<g>
          <path d="M68 140 L97 154 L88 176 L56 148 Z" fill="#fff" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M132 140 L103 154 L112 176 L144 148 Z" fill="#fff" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M72 164 h18 v14 h-18 z" fill="#f1f4fb" stroke={d} strokeWidth="1.300" /><path d="M78 164 v-6 M83 164 v-8" stroke="#e0436a" strokeWidth="2.200" strokeLinecap="round" /><path d="M87 164 v-5" stroke="#3a6fe0" strokeWidth="2.200" strokeLinecap="round" />
          {buttons([100, 100], [168, 178], "#dfe4f2", d)}
        </g>}>
        <path d="M88 141 L100 164 L112 141 Z" fill="#7fb5ff" />
      </Cloth>;
    }
    case "raincoat": {
      const f = C.yellow, d = "#d9a800";
      return <Cloth {...p} fill={f} dark={d} sleeve="long" cuff="#f2bf22"
        over={<g>
          <path d="M58 141 Q100 178 142 141 Q136 154 100 158 Q64 154 58 141 Z" fill="#f2bf22" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M100 158 V190" stroke={d} strokeWidth="2.200" />{buttons([100, 100, 100], [166, 175, 184], d)}
        </g>}>
        <rect x="64" y="166" width="24" height="15" rx="4" fill="#ffe27a" stroke={d} strokeWidth="1.400" /><rect x="112" y="166" width="24" height="15" rx="4" fill="#ffe27a" stroke={d} strokeWidth="1.400" />
      </Cloth>;
    }
    case "sailor": {
      const f = C.white, d = "#cfc6b8";
      return <Cloth {...p} fill={f} dark={d} sleeve="short" cuff={C.navy} stripe={C.navy} shine={0.1}
        over={<g>
          <path d="M56 140 Q100 156 144 140 L126 166 Q100 152 74 166 Z" fill={C.navy} stroke="#1a2247" strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M66 146 Q100 160 134 146 M72 153 Q100 165 128 153" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M100 156 L91 174 L100 169 L109 174 Z" fill={C.red} stroke="#b72f48" strokeWidth="1" strokeLinejoin="round" /><circle cx="100" cy="158" r="3.200" fill="#b72f48" />
        </g>} />;
    }
    case "overalls": {
      const f = C.denim, d = "#35629d";
      return <Cloth {...p} fill="#fbfbff" dark="#c9cde0" sleeve="short" shine={0.08}
        under={null}
        over={<g>
          <path d="M44 154 Q100 164 156 154 L156 184 Q100 196 44 184 Z" fill={f} stroke={d} strokeWidth="2" strokeLinejoin="round" />
          <path d="M74 142 L70 124 L84 122 L86 150 Z" fill={f} stroke={d} strokeWidth="1.600" strokeLinejoin="round" /><path d="M126 142 L130 124 L116 122 L114 150 Z" fill={f} stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <rect x="76" y="148" width="48" height="30" rx="8" fill={mix(f, "#ffffff", 0.08)} stroke={d} strokeWidth="1.800" />
          <rect x="88" y="160" width="24" height="13" rx="4" fill={mix(f, "#ffffff", 0.16)} stroke={d} strokeWidth="1.200" /><path d="M88 160 h24" stroke="#ffd54a" strokeWidth="1.400" strokeDasharray="3 2" />
          <circle cx="78" cy="127" r="3" fill={C.gold} stroke={C.goldDk} strokeWidth="1" /><circle cx="122" cy="127" r="3" fill={C.gold} stroke={C.goldDk} strokeWidth="1" />
          <path d="M50 160 Q60 166 70 164 M130 164 Q140 166 150 160" fill="none" stroke={d} strokeOpacity=".5" strokeWidth="1.400" strokeDasharray="3 2" />
        </g>}>
        <path d="M66 141 Q100 158 134 141" fill="none" stroke="#e9ebf6" strokeWidth="4.600" strokeLinecap="round" />
      </Cloth>;
    }
    case "armor": {
      const f = "#aeb7c6", d = "#59627a";
      const pauldron = (x: number, sgn: number) => (
        <g>
          <ellipse cx={x} cy="131" rx="17" ry="12" fill="#c4ccdb" stroke={d} strokeWidth="2" transform={`rotate(${-22 * sgn} ${x} 131)`} />
          <path d={`M${x - 14} 128 Q${x} 120 ${x + 14} 128`} fill="none" stroke={C.gold} strokeWidth="2.600" strokeLinecap="round" transform={`rotate(${-22 * sgn} ${x} 131)`} />
          <circle cx={x} cy="133" r="2.200" fill={C.goldDk} />
        </g>
      );
      return <Cloth {...p} fill={f} dark={d} sleeve="short" sleeveFill="#9ba5b8" cuff={C.gold} shine={0.32} folds={false}
        over={<g>
          <path d="M60 141 Q100 155 140 141 L138 150 Q100 162 62 150 Z" fill="#8892a8" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          {pauldron(54, 1)}{pauldron(146, -1)}
        </g>}>
        <path d="M100 150 V190" stroke={d} strokeWidth="2" strokeOpacity=".6" />
        <path d="M46 163 Q100 172 154 163 M44 176 Q100 186 156 176" fill="none" stroke={d} strokeWidth="2.200" strokeOpacity=".65" />
        <path d="M78 150 Q100 158 122 150 L120 160 Q100 168 80 160 Z" fill="#c9d1e0" stroke={d} strokeWidth="1.400" strokeLinejoin="round" />
        {dotsAt([[58, 168], [142, 168], [66, 181], [134, 181], [100, 183]], 1.800, C.gold)}
        <path d="M60 154 Q70 150 82 154" stroke="#fff" strokeOpacity=".5" strokeWidth="3" fill="none" strokeLinecap="round" />
      </Cloth>;
    }
    case "dress": {
      const f = "#ff9ec9", d = "#e0609f";
      return (
        <g>
          <path d="M60 140 L140 140 L164 184 Q100 198 36 184 Z" fill={f} stroke={d} strokeWidth="2" strokeLinejoin="round" />
          <path d="M36 184 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 6 12 -2" fill="#ffc4e0" stroke={d} strokeWidth="1.200" strokeLinejoin="round" />
          <path d="M70 156 Q80 176 76 190 M130 156 Q120 176 124 190 M100 160 V192" stroke={d} strokeOpacity=".22" strokeWidth="2.200" fill="none" strokeLinecap="round" />
          {dotsAt([[76, 160], [100, 168], [124, 160], [84, 178], [116, 178], [60, 176], [140, 176]], 3, "#fff", 0.75)}
          <path d="M62 141 Q100 160 138 141 L138 150 Q100 168 62 150 Z" fill="#ffc4e0" stroke={d} strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M66 138 L72 124 M134 138 L128 124" stroke={d} strokeWidth="3.500" strokeLinecap="round" />
          <g transform="translate(100 166)"><path d="M0 0 L-12 -7 L-12 7 Z M0 0 L12 -7 L12 7 Z" fill="#fff" stroke={d} strokeWidth="1.300" strokeLinejoin="round" /><circle r="3.400" fill={d} /></g>
        </g>
      );
    }
    case "sundress": {
      const f = "#ffd45a", d = "#d99f00";
      return (
        <g>
          <path d="M60 140 L140 140 L164 184 Q100 198 36 184 Z" fill={f} stroke={d} strokeWidth="2" strokeLinejoin="round" />
          <path d="M36 184 Q100 198 164 184" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeDasharray="6 4" />
          {[[74, 162], [100, 172], [126, 162], [86, 182], [114, 182], [58, 178], [142, 178]].map(([x, y]) => <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.200} cy={Math.sin((a * Math.PI) / 180) * 3.200} r="2.400" fill="#ff9ec9" />)}<circle r="1.400" fill="#fff" /></g>)}
          <path d="M70 156 Q80 176 76 190 M130 156 Q120 176 124 190" stroke={d} strokeOpacity=".22" strokeWidth="2.200" fill="none" strokeLinecap="round" />
          <path d="M64 141 Q100 154 136 141" fill="none" stroke={d} strokeWidth="2.600" strokeLinecap="round" />
          <path d="M72 140 L74 120 M128 140 L126 120" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><path d="M72 140 L74 120 M128 140 L126 120" stroke={d} strokeWidth="1.400" strokeLinecap="round" opacity=".5" />
        </g>
      );
    }
    case "tutu": {
      return (
        <g>
          <path d="M34 178 Q100 150 166 178 Q150 196 100 197 Q50 196 34 178 Z" fill="#ffc6e6" stroke="#e66fa6" strokeWidth="1.600" strokeLinejoin="round" opacity=".92" />
          <path d="M42 174 Q100 152 158 174 Q146 190 100 191 Q54 190 42 174 Z" fill="#ffa6d6" stroke="#e66fa6" strokeWidth="1.400" strokeLinejoin="round" opacity=".92" />
          <path d="M52 170 Q100 154 148 170 Q138 184 100 185 Q62 184 52 170 Z" fill="#ff8bc6" stroke="#e66fa6" strokeWidth="1.400" strokeLinejoin="round" />
          <path d="M40 182 q6 5 12 0 M60 190 q6 5 12 0 M86 194 q6 5 12 0 M112 194 q6 5 12 0 M136 190 q6 5 12 0 M150 182 q6 5 12 0" fill="none" stroke="#e66fa6" strokeWidth="1.200" opacity=".7" />
          {dotsAt([[56, 180], [84, 186], [116, 186], [144, 180], [100, 176]], 1.800, "#fff", 0.9)}
          <path d="M60 140 Q100 150 140 140 L134 164 Q100 174 66 164 Z" fill="#ff9ec9" stroke="#e66fa6" strokeWidth="1.800" strokeLinejoin="round" />
          <path d="M66 142 Q100 156 134 142" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
          <path d="M70 140 L72 124 M130 140 L128 124" stroke="#ff9ec9" strokeWidth="4" strokeLinecap="round" />
          <polygon points={starPath(100, 156, 6, 2.600)} fill="#fff6b0" stroke="#e0a800" strokeWidth=".8" strokeLinejoin="round" />
        </g>
      );
    }
    default: return null;
  }
}
