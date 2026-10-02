import { C, HAIR, INK, mix, starPath } from "./petKit.js";

// Hats, glasses, necklaces, things to hold, and "looks" (facial hair, makeup, little details). Each component returns
// null for ids it doesn't know, so PetArt can try them one after another. Faces are drawn around the eyes:
// ey is the eye line, k the eye size for the pet's age.
const grad = (id, a, b, vertical = true) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
);

export function NewHead({ id, gid, ey }) {
  switch (id) {
    case "snapback":
      return (
        <g transform="translate(0 -9)">
          <defs>{grad(`${gid}snap`, "#5a8af0", "#2f55b8")}</defs>
          <path d="M57 96 C 54 52, 146 52, 143 96 Z" fill={`url(#${gid}snap)`} stroke="#25448f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 55 V96 M80 59 C 76 72, 76 86, 78 96 M120 59 C 124 72, 124 86, 122 96" fill="none" stroke="#25448f" strokeWidth="1.500" opacity=".45" />
          <path d="M70 84 Q100 92 130 84 L132 96 Q100 104 68 96 Z" fill="#f4f6ff" opacity=".92" />
          <polygon points={starPath(100, 80, 8, 3.400)} fill="#ffd54a" stroke="#d9a000" strokeWidth="1" strokeLinejoin="round" />
          <path d="M52 96 Q100 116 148 96 L154 104 Q100 128 46 104 Z" fill="#d6423a" stroke="#a52a24" strokeWidth="2" strokeLinejoin="round" />
          <path d="M60 99 Q100 114 140 99" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
          <circle cx="100" cy="53" r="3.600" fill="#25448f" />
        </g>
      );
    case "flatcap":
      return (
        <g>
          <path d="M54 96 C 50 62, 150 62, 146 96 Q100 104 54 96 Z" fill="#8c7b66" stroke="#5c4d3b" strokeWidth="2" strokeLinejoin="round" />
          <path d="M60 90 C 72 72, 128 72, 140 90" fill="none" stroke="#6a5a47" strokeWidth="2" opacity=".6" />
          <g fill="#5c4d3b" opacity=".35">{[[70, 84], [82, 78], [96, 76], [110, 78], [124, 84], [88, 90], [104, 90], [118, 91], [76, 92], [132, 90]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.300" />)}</g>
          <path d="M100 66 L100 76" stroke="#5c4d3b" strokeWidth="2" opacity=".6" /><circle cx="100" cy="66" r="3.600" fill="#6a5a47" stroke="#5c4d3b" strokeWidth="1.200" />
          <path d="M104 92 Q152 84 174 100 Q142 108 104 100 Z" fill="#6a5a47" stroke="#4a3d2d" strokeWidth="2" strokeLinejoin="round" />
          <path d="M112 95 Q140 91 160 98" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "fedora":
      return (
        <g>
          <defs>{grad(`${gid}fed`, "#5a6075", "#363a4b")}</defs>
          <path d="M72 92 C 68 54, 132 54, 128 92 Z" fill={`url(#${gid}fed)`} stroke="#262a39" strokeWidth="2" strokeLinejoin="round" />
          <path d="M82 58 Q100 64 118 58" fill="none" stroke="#262a39" strokeWidth="2.200" opacity=".6" strokeLinecap="round" />
          <path d="M100 56 V76" stroke="#262a39" strokeWidth="1.800" opacity=".35" />
          <ellipse cx="100" cy="92" rx="54" ry="12" fill="#424759" stroke="#262a39" strokeWidth="2" />
          <path d="M70 90 Q100 98 130 90 L130 80 Q100 88 70 80 Z" fill="#171a26" />
          <path d="M122 82 q10 -18 22 -14 q-6 4 -8 12 q-6 4 -14 2 z" fill="#e0a43a" stroke="#b27a1b" strokeWidth="1.200" strokeLinejoin="round" />
          <path d="M60 94 Q100 102 140 94" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="2" />
        </g>
      );
    case "cowboy":
      return (
        <g>
          <defs>{grad(`${gid}cow`, "#d6a869", "#a97a3e")}</defs>
          <path d="M70 90 C 68 62, 82 52, 100 60 C 118 52, 132 62, 130 90 Z" fill={`url(#${gid}cow)`} stroke="#7a5527" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 60 Q100 74 100 82" fill="none" stroke="#7a5527" strokeWidth="2" opacity=".5" />
          <path d="M36 82 Q54 72 74 88 Q100 96 126 88 Q146 72 164 82 Q154 108 100 108 Q46 108 36 82 Z" fill="#c99654" stroke="#7a5527" strokeWidth="2" strokeLinejoin="round" />
          <path d="M70 90 Q100 98 130 90 L130 82 Q100 90 70 82 Z" fill="#6d4a22" />
          <g fill="#e8edf8" stroke="#9aa3b8" strokeWidth=".8">{[78, 90, 100, 110, 122].map((x) => <circle key={x} cx={x} cy={x === 100 ? 91 : x < 100 ? 89 : 89} r="2.200" />)}</g>
          <path d="M50 92 Q100 106 150 92" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
        </g>
      );
    case "hardhat":
      return (
        <g>
          <defs>{grad(`${gid}hat`, "#ffe066", "#f2b800")}</defs>
          <path d="M56 96 C 52 50, 148 50, 144 96 Z" fill={`url(#${gid}hat)`} stroke="#c78f00" strokeWidth="2" strokeLinejoin="round" />
          <rect x="93" y="52" width="14" height="44" rx="3" fill="#ffd633" stroke="#c78f00" strokeWidth="1.600" />
          <path d="M76 60 C 70 70, 68 82, 70 96 M124 60 C 130 70, 132 82, 130 96" fill="none" stroke="#c78f00" strokeWidth="1.600" opacity=".5" />
          <path d="M48 96 Q100 108 152 96 L154 102 Q100 116 46 102 Z" fill="#f2b800" stroke="#c78f00" strokeWidth="2" strokeLinejoin="round" />
          <path d="M66 74 Q76 62 92 60" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "viking":
      return (
        <g>
          <defs>{grad(`${gid}vik`, "#d4dae8", "#8993a8")}</defs>
          {[1, -1].map((sg) => (
            <g key={sg} transform={sg === -1 ? "translate(200 0) scale(-1 1)" : undefined}>
              <path d="M64 86 C 42 86, 26 70, 28 44 C 38 58, 52 66, 68 68 Z" fill="#f6efdc" stroke="#cdbf9b" strokeWidth="2" strokeLinejoin="round" />
              <path d="M34 54 C 42 62, 52 66, 62 68" fill="none" stroke="#cdbf9b" strokeWidth="1.400" opacity=".7" />
            </g>
          ))}
          <path d="M60 94 C 56 54, 144 54, 140 94 Z" fill={`url(#${gid}vik)`} stroke="#59627a" strokeWidth="2" strokeLinejoin="round" />
          <rect x="54" y="86" width="92" height="11" rx="5" fill="#9aa4ba" stroke="#59627a" strokeWidth="2" />
          <path d="M96 97 V112 Q100 118 104 112 V97 Z" fill="#9aa4ba" stroke="#59627a" strokeWidth="1.600" strokeLinejoin="round" />
          <g fill="#f3c34a" stroke="#c99a1e" strokeWidth=".8">{[66, 80, 94, 106, 120, 134].map((x) => <circle key={x} cx={x} cy="91.500" r="2.200" />)}</g>
          <path d="M74 70 Q82 60 96 58" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "headset":
      return (
        <g>
          <path d="M54 110 C 46 40, 154 40, 146 110" fill="none" stroke="#2b2b3a" strokeWidth="8" strokeLinecap="round" />
          <path d="M60 100 C 56 56, 144 56, 140 100" fill="none" stroke="#4a4a60" strokeWidth="2" opacity=".6" />
          {[52, 148].map((x) => <g key={x}><ellipse cx={x} cy="114" rx="11" ry="17" fill="#2b2b3a" stroke="#14141f" strokeWidth="2" /><ellipse cx={x} cy="114" rx="6" ry="11" fill="none" stroke="#3fe0a6" strokeWidth="2.400" /></g>)}
          <path d={`M48 128 Q52 ${ey + 30} 84 ${ey + 24}`} fill="none" stroke="#2b2b3a" strokeWidth="3.600" strokeLinecap="round" />
          <circle cx="86" cy={ey + 24} r="4.600" fill="#2b2b3a" stroke="#14141f" strokeWidth="1.400" /><circle cx="86" cy={ey + 24} r="1.800" fill="#3fe0a6" />
        </g>
      );
    case "tiara":
      return (
        <g>
          <defs>{grad(`${gid}tia`, "#f6f8ff", "#b9c2d8")}</defs>
          <path d="M64 84 L70 64 L82 76 L92 54 L100 72 L108 54 L118 76 L130 64 L136 84 Q100 74 64 84 Z" fill={`url(#${gid}tia)`} stroke="#8e98b4" strokeWidth="2" strokeLinejoin="round" />
          <path d="M64 84 Q100 74 136 84" fill="none" stroke="#8e98b4" strokeWidth="3" />
          {[[92, 60, "#ff8fb8"], [108, 60, "#7fb5ff"], [100, 78, "#ff5d8f"]].map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 4 : 3} fill={c} stroke="#fff" strokeWidth="1" />)}
          {[[70, 70], [130, 70], [82, 78], [118, 78]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#fff" stroke="#b9c2d8" strokeWidth=".8" />)}
        </g>
      );
    default: return null;
  }
}

export function NewFace({ id, gid, ey, k }) {
  const r = 14 * Math.max(k, 0.95);
  switch (id) {
    case "aviators": {
      const tear = (cx) => `M${cx - r * 1.08} ${ey - r * 0.78} Q${cx} ${ey - r * 1.1} ${cx + r * 1.08} ${ey - r * 0.78} Q${cx + r * 1.02} ${ey + r * 0.55} ${cx} ${ey + r * 1.12} Q${cx - r * 1.02} ${ey + r * 0.55} ${cx - r * 1.08} ${ey - r * 0.78} Z`;
      return (
        <g>
          <defs><linearGradient id={`${gid}av`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2a1a" /><stop offset="1" stopColor="#a87a45" /></linearGradient></defs>
          {[79, 121].map((cx) => <path key={cx} d={tear(cx)} fill={`url(#${gid}av)`} fillOpacity=".82" stroke={C.gold} strokeWidth="2.800" strokeLinejoin="round" />)}
          <path d={`M${79 + r} ${ey - r * 0.8} Q100 ${ey - r * 1.2} ${121 - r} ${ey - r * 0.8} M${79 + r * 0.9} ${ey - r * 0.2} Q100 ${ey - r * 0.55} ${121 - r * 0.9} ${ey - r * 0.2}`} fill="none" stroke={C.gold} strokeWidth="2.200" />
          <path d={`M${79 - r - 1} ${ey - r * 0.7} l-9 -3 M${121 + r + 1} ${ey - r * 0.7} l9 -3`} stroke={C.gold} strokeWidth="2.200" strokeLinecap="round" />
          <path d={`M${79 - r * 0.6} ${ey - r * 0.55} l${r * 0.5} -3 M${121 - r * 0.6} ${ey - r * 0.55} l${r * 0.5} -3`} stroke="#fff" strokeWidth="2.600" strokeLinecap="round" opacity=".55" />
        </g>
      );
    }
    case "squareglasses":
      return (
        <g fill="rgba(255,255,255,.22)" stroke="#1f1f2b" strokeWidth="3.600" strokeLinejoin="round">
          <rect x={79 - r - 1} y={ey - r * 0.82} width={2 * r + 2} height={r * 1.64} rx="4.500" />
          <rect x={121 - r - 1} y={ey - r * 0.82} width={2 * r + 2} height={r * 1.64} rx="4.500" />
          <path d={`M${79 + r + 1} ${ey - r * 0.4} h${40 - 2 * r - 2}`} fill="none" />
          <path d={`M${79 - r - 1} ${ey - r * 0.5} l-9 -2 M${121 + r + 1} ${ey - r * 0.5} l9 -2`} fill="none" strokeLinecap="round" />
          <path d={`M${79 - r + 3} ${ey - r * 0.5} l${r * 0.7} -2`} fill="none" stroke="#fff" strokeWidth="2.400" opacity=".6" strokeLinecap="round" />
        </g>
      );
    case "catglasses": {
      const lens = (cx, d) => `M${cx - d * r} ${ey + 3} Q${cx - d * r} ${ey - r * 0.75} ${cx - d * r * 0.2} ${ey - r * 0.72} L${cx + d * (r + 4)} ${ey - r * 1.06} Q${cx + d * r} ${ey + r * 0.95} ${cx} ${ey + r * 0.95} Q${cx - d * r} ${ey + r * 0.95} ${cx - d * r} ${ey + 3} Z`;
      return (
        <g>
          {[[79, -1], [121, 1]].map(([cx, d]) => <path key={cx} d={lens(cx, d)} fill="rgba(255,255,255,.26)" stroke="#d6438a" strokeWidth="3.200" strokeLinejoin="round" />)}
          <path d={`M${79 + r} ${ey - r * 0.4} Q100 ${ey - r * 0.9} ${121 - r} ${ey - r * 0.4}`} fill="none" stroke="#d6438a" strokeWidth="2.800" />
          <circle cx={79 - r - 4} cy={ey - r * 1.06} r="2" fill="#fff" stroke="#d6438a" strokeWidth="1" /><circle cx={121 + r + 4} cy={ey - r * 1.06} r="2" fill="#fff" stroke="#d6438a" strokeWidth="1" />
        </g>
      );
    }
    case "eyepatch":
      return (
        <g>
          <path d={`M${121 - r * 0.8} ${ey - r * 0.9} L58 ${ey - 30} M${121 + r * 0.8} ${ey - r * 0.6} L146 ${ey - 24}`} stroke="#1c1830" strokeWidth="3.600" strokeLinecap="round" />
          <ellipse cx="121" cy={ey} rx={r + 1.5} ry={r * 0.95} fill="#1c1830" stroke="#0e0b1c" strokeWidth="2" transform={`rotate(-12 121 ${ey})`} />
          <path d={`M${121 - r * 0.6} ${ey - r * 0.5} Q121 ${ey - r * 0.85} ${121 + r * 0.4} ${ey - r * 0.6}`} fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "vr":
      return (
        <g>
          <defs>{grad(`${gid}vr`, "#3a3b50", "#1d1e2d")}</defs>
          <path d={`M54 ${ey - 6} L40 ${ey - 14} M146 ${ey - 6} L160 ${ey - 14}`} stroke="#2b2c3d" strokeWidth="5" strokeLinecap="round" />
          <rect x="52" y={ey - 16} width="96" height="32" rx="12" fill={`url(#${gid}vr)`} stroke="#12121c" strokeWidth="2.400" />
          <rect x="58" y={ey - 11} width="84" height="22" rx="8" fill="#4fe3ff" fillOpacity=".28" stroke="#4fe3ff" strokeOpacity=".7" strokeWidth="1.400" />
          <path d={`M64 ${ey - 8} Q80 ${ey - 12} 96 ${ey - 8}`} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.600" strokeLinecap="round" />
          <circle cx="100" cy={ey - 12} r="1.600" fill="#4fe3ff" /><path d={`M90 ${ey + 15} Q100 ${ey + 20} 110 ${ey + 15}`} fill="none" stroke="#12121c" strokeWidth="2" />
        </g>
      );
    default: return null;
  }
}

export function NewNeck({ id }) {
  switch (id) {
    case "dogtags":
      return (
        <g>
          <path d="M64 140 Q100 178 136 140" fill="none" stroke="#cfd6e4" strokeWidth="2.600" strokeLinecap="round" strokeDasharray="0.1 3.600" />
          <path d="M64 140 Q100 178 136 140" fill="none" stroke="#9aa4ba" strokeWidth="1" opacity=".6" />
          <g transform="rotate(8 102 168)"><rect x="93" y="160" width="17" height="24" rx="6" fill="#aab3c6" stroke="#6f7a93" strokeWidth="1.600" /><circle cx="101.500" cy="165" r="1.800" fill="#6f7a93" /><path d="M96 172 h11 M96 177 h8" stroke="#6f7a93" strokeWidth="1.400" strokeLinecap="round" /></g>
          <g transform="rotate(-6 98 170)"><rect x="88" y="162" width="17" height="24" rx="6" fill="#d3dae8" stroke="#7f8aa3" strokeWidth="1.600" /><circle cx="96.500" cy="167" r="1.800" fill="#7f8aa3" /><path d="M91 174 h11 M91 179 h8" stroke="#7f8aa3" strokeWidth="1.400" strokeLinecap="round" /></g>
        </g>
      );
    case "silverchain":
      return (
        <g>
          <path d="M62 140 Q100 178 138 140" fill="none" stroke="#8f99b0" strokeWidth="6.400" strokeLinecap="round" />
          <path d="M62 140 Q100 178 138 140" fill="none" stroke="#e4e9f4" strokeWidth="4.400" strokeLinecap="round" strokeDasharray="7 2.600" />
          <circle cx="100" cy="167" r="8" fill="#dfe5f2" stroke="#8f99b0" strokeWidth="2" /><path d="M100 161 v12 M94 167 h12" stroke="#8f99b0" strokeWidth="2.400" strokeLinecap="round" />
          <circle cx="97.500" cy="164.500" r="1.800" fill="#fff" opacity=".8" />
        </g>
      );
    case "lanyard":
      return (
        <g>
          <path d="M70 140 L100 176 L130 140" fill="none" stroke="#2f5fd0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M70 140 L100 176 L130 140" fill="none" stroke="#6f9bff" strokeWidth="1.600" strokeDasharray="4 5" strokeLinecap="round" opacity=".8" />
          <rect x="97" y="173" width="6" height="7" rx="1.500" fill="#b9c2d8" stroke="#7f8aa3" strokeWidth="1" />
          <rect x="86" y="179" width="28" height="22" rx="3.500" fill="#fff" stroke="#c4cadf" strokeWidth="1.600" />
          <rect x="90" y="183" width="9" height="9" rx="2" fill="#9fb3ff" /><circle cx="94.500" cy="186" r="1.800" fill="#fff" /><path d="M91 192 q3.500 -3 7 0" fill="#fff" />
          <path d="M102 185 h8 M102 189 h6 M90 196 h20" stroke="#aab3cc" strokeWidth="1.400" strokeLinecap="round" /><rect x="86" y="179" width="28" height="4" rx="2" fill="#2f5fd0" />
        </g>
      );
    case "choker":
      return (
        <g>
          <path d="M60 141 Q100 160 140 141" fill="none" stroke="#14111f" strokeWidth="6.400" strokeLinecap="round" />
          <path d="M60 141 Q100 160 140 141" fill="none" stroke="#6a6288" strokeWidth="1.200" strokeDasharray="2 3.600" strokeLinecap="round" opacity=".9" />
          <path d="M100 163 C 92 157, 94 150, 100 154 C 106 150, 108 157, 100 163 Z" fill="#ff5d8f" stroke="#d63c70" strokeWidth="1.400" strokeLinejoin="round" />
        </g>
      );
    default: return null;
  }
}

export function NewExtra({ id, gid }) {
  switch (id) {
    case "watch":
      return (
        <g transform="rotate(-18 157 146)">
          <rect x="146" y="140" width="22" height="13" rx="5" fill="#2b2b3a" stroke="#14141f" strokeWidth="1.400" />
          <rect x="150" y="136" width="14" height="21" rx="4.500" fill="#14141f" stroke="#4a4a60" strokeWidth="1.600" />
          <path d="M153 144 h8 M153 148 h5" stroke="#3fe0a6" strokeWidth="1.800" strokeLinecap="round" /><circle cx="162" cy="140.500" r="1.200" fill="#ff7aa8" />
        </g>
      );
    case "studs":
      return (
        <g>{[[52, 104], [148, 104]].map(([x, y]) => <g key={x}><polygon points={`${x},${y - 4.500} ${x + 4},${y} ${x},${y + 4.500} ${x - 4},${y}`} fill="#cfe9ff" stroke="#7fb5e4" strokeWidth="1.400" strokeLinejoin="round" /><path d={`M${x - 4} ${y} h8 M${x} ${y - 4.500} v9`} stroke="#fff" strokeWidth=".8" opacity=".8" /></g>)}
          {[[50, 113], [150, 113]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.200" fill="#dfe5f2" stroke="#8f99b0" strokeWidth="1" />)}</g>
      );
    case "briefcase":
      return (
        <g>
          <path d="M156 146 v-6 q0 -4 4 -4 h10 q4 0 4 4 v6" fill="none" stroke="#4a2f1b" strokeWidth="3.200" strokeLinecap="round" />
          <rect x="146" y="146" width="40" height="28" rx="5" fill="#8a5a35" stroke="#5c3b22" strokeWidth="2" />
          <path d="M146 158 h40" stroke="#5c3b22" strokeWidth="1.600" /><rect x="162" y="154" width="8" height="8" rx="1.500" fill={C.gold} stroke={C.goldDk} strokeWidth="1" />
          <path d="M150 150 h32 M150 170 h32" stroke="#c99a67" strokeWidth="1" strokeDasharray="3 2" opacity=".7" />
        </g>
      );
    case "controller":
      return (
        <g>
          <path d="M68 162 Q70 152 84 152 H116 Q130 152 132 162 L136 178 Q137 186 129 186 Q121 186 117 177 H83 Q79 186 71 186 Q63 186 64 178 Z" fill="#4a4f66" stroke="#262a3e" strokeWidth="2" strokeLinejoin="round" />
          <path d="M72 156 Q100 150 128 156" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2.400" strokeLinecap="round" />
          <g fill="#14161f"><rect x="76" y="162" width="5" height="15" rx="1.500" /><rect x="71" y="167" width="15" height="5" rx="1.500" /></g>
          {[[121, 163, "#ff5d6c"], [127, 168, "#4dabf7"], [121, 173, "#69db7c"], [115, 168, "#ffd54a"]].map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r="3.200" fill={c} stroke="#14161f" strokeWidth=".8" />)}
          <circle cx="92" cy="174" r="4.400" fill="#2b2e40" stroke="#14161f" strokeWidth="1" /><circle cx="108" cy="174" r="4.400" fill="#2b2e40" stroke="#14161f" strokeWidth="1" />
        </g>
      );
    case "guitar":
      return (
        <g>
          <path d="M176 146 L196 92" stroke="#6b4426" strokeWidth="5.600" strokeLinecap="round" />
          <rect x="190" y="82" width="12" height="16" rx="3" fill="#4a2f1b" transform="rotate(20 196 90)" />
          <path d="M175 150 C 160 144, 158 128, 172 128 C 184 128, 188 140, 182 146 C 196 150, 198 176, 178 182 C 160 188, 148 170, 175 150 Z" fill="#e0953f" stroke="#8a5322" strokeWidth="2.200" strokeLinejoin="round" transform="translate(0 4)" />
          <circle cx="172" cy="160" r="5" fill="#3a2414" stroke="#8a5322" strokeWidth="1.400" />
          <path d="M162 176 h20" stroke="#6b4426" strokeWidth="3" strokeLinecap="round" /><path d="M178 148 L194 96 M181 148 L196 96" stroke="#eef0f6" strokeWidth=".8" opacity=".8" />
        </g>
      );
    case "sword":
      return (
        <g transform="rotate(14 166 146)">
          <defs>{grad(`${gid}bl`, "#f4f7ff", "#aab4c8", false)}</defs>
          <path d="M162 138 V70 L166.500 56 L171 70 V138 Z" fill={`url(#${gid}bl)`} stroke="#7f8aa3" strokeWidth="1.600" strokeLinejoin="round" />
          <path d="M166.500 62 V136" stroke="#7f8aa3" strokeWidth="1" opacity=".5" />
          <rect x="154" y="138" width="25" height="6" rx="3" fill={C.gold} stroke={C.goldDk} strokeWidth="1.400" />
          <rect x="163" y="144" width="7" height="16" rx="2.500" fill="#6b3f26" stroke="#432615" strokeWidth="1.200" /><circle cx="166.500" cy="163" r="4" fill={C.gold} stroke={C.goldDk} strokeWidth="1.200" />
        </g>
      );
    case "shield":
      return (
        <g>
          <defs><radialGradient id={`${gid}sh`} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#6f9bff" /><stop offset="1" stopColor="#2a4fb8" /></radialGradient></defs>
          <circle cx="32" cy="154" r="22" fill={`url(#${gid}sh)`} stroke="#1f3a8a" strokeWidth="2.400" />
          <circle cx="32" cy="154" r="22" fill="none" stroke="#d3dae8" strokeWidth="4" strokeDasharray="2 0" opacity=".9" />
          <circle cx="32" cy="154" r="16.500" fill="none" stroke="#1f3a8a" strokeWidth="1.200" opacity=".6" />
          <polygon points={starPath(32, 154, 11, 4.600)} fill="#ffd54a" stroke="#c99a1e" strokeWidth="1.200" strokeLinejoin="round" />
          <path d="M18 142 Q26 136 36 137" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "skateboard":
      return (
        <g>
          <rect x="44" y="176" width="112" height="9" rx="4.500" fill="#ff6b3d" stroke="#c9461f" strokeWidth="2" />
          <path d="M50 179 H150" stroke="#2b2b3a" strokeWidth="2" opacity=".5" strokeDasharray="2 2" />
          <path d="M44 180 q-8 -2 -8 -6 M156 180 q8 -2 8 -6" fill="none" stroke="#c9461f" strokeWidth="2.600" strokeLinecap="round" />
          {[66, 134].map((x) => <g key={x}><circle cx={x} cy="190" r="5.200" fill="#f4f6ff" stroke="#8f99b0" strokeWidth="1.800" /><circle cx={x} cy="190" r="1.800" fill="#8f99b0" /></g>)}
        </g>
      );
    case "handbag":
      return (
        <g>
          <path d="M153 148 q10 -18 20 0" fill="none" stroke="#e0609f" strokeWidth="3" strokeLinecap="round" />
          <path d="M148 150 H178 L182 174 Q165 180 144 174 Z" fill="#ff8fb8" stroke="#e0609f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M150 158 Q164 164 180 158" fill="none" stroke="#e0609f" strokeWidth="1.600" /><circle cx="164" cy="160" r="3.200" fill={C.gold} stroke={C.goldDk} strokeWidth="1.200" />
          <path d="M152 154 q-1 8 0 16" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2.400" strokeLinecap="round" />
        </g>
      );
    default: return null;
  }
}

// facial hair that sits behind the face (so the mouth shows on top of it)
export function LookBehind({ id, ey }) {
  switch (id) {
    case "beard":
      return <g><path d={`M56 ${ey + 4} Q50 ${ey + 40} 100 ${ey + 48} Q150 ${ey + 40} 144 ${ey + 4} Q138 ${ey + 25} 100 ${ey + 27} Q62 ${ey + 25} 56 ${ey + 4} Z`} fill={HAIR} stroke={mix(HAIR, "#000000", 0.3)} strokeWidth="1.600" strokeLinejoin="round" /><path d={`M70 ${ey + 34} q6 6 12 0 M92 ${ey + 40} q6 6 12 0 M116 ${ey + 34} q6 6 12 0`} stroke={mix(HAIR, "#ffffff", 0.22)} strokeWidth="1.400" fill="none" strokeLinecap="round" opacity=".7" /></g>;
    case "goatee":
      return <path d={`M88 ${ey + 20} Q100 ${ey + 40} 112 ${ey + 20} Q100 ${ey + 25} 88 ${ey + 20} Z`} fill={HAIR} stroke={mix(HAIR, "#000000", 0.3)} strokeWidth="1.400" strokeLinejoin="round" />;
    default: return null;
  }
}

export function LookFront({ id, ey, k }) {
  switch (id) {
    case "beard":
    case "mustache": {
      const y = ey + 11;
      return <path d={`M100 ${y - 1} Q88 ${y - 7} 77 ${y + 1} Q81 ${y + 9} 90 ${y + 5} Q96 ${y + 7} 100 ${y + 5} Q104 ${y + 7} 110 ${y + 5} Q119 ${y + 9} 123 ${y + 1} Q112 ${y - 7} 100 ${y - 1} Z`} fill={HAIR} stroke={mix(HAIR, "#000000", 0.3)} strokeWidth="1.400" strokeLinejoin="round" />;
    }
    case "goatee": {
      const y = ey + 11;
      return <path d={`M92 ${y + 1} Q100 ${y - 3} 108 ${y + 1} Q104 ${y + 5} 100 ${y + 4} Q96 ${y + 5} 92 ${y + 1} Z`} fill={HAIR} />;
    }
    case "stubble": {
      const pts = [[70, 10], [78, 15], [86, 19], [94, 22], [106, 22], [114, 19], [122, 15], [130, 10], [74, 5], [82, 9], [90, 13], [110, 13], [118, 9], [126, 5], [66, 3], [134, 3], [100, 24], [96, 17], [104, 17], [88, 6], [112, 6]];
      return (
        <g>
          <path d={`M62 ${ey + 4} Q100 ${ey + 36} 138 ${ey + 4} Q100 ${ey + 18} 62 ${ey + 4} Z`} fill={HAIR} opacity=".2" />
          <g fill={HAIR} opacity=".85">{pts.map(([x, dy], i) => <circle key={i} cx={x} cy={ey + dy + 4} r="1.150" />)}</g>
        </g>
      );
    }
    case "sideburns":
      return <g fill={HAIR} stroke={mix(HAIR, "#000000", 0.3)} strokeWidth="1.200" strokeLinejoin="round"><path d={`M52 ${ey - 8} L59 ${ey - 5} L59 ${ey + 17} Q53 ${ey + 14} 51 ${ey + 3} Z`} /><path d={`M148 ${ey - 8} L141 ${ey - 5} L141 ${ey + 17} Q147 ${ey + 14} 149 ${ey + 3} Z`} /></g>;
    case "lashes":
      return (
        <g stroke={INK} strokeWidth="2.400" strokeLinecap="round" fill="none">
          {[[79, -1], [121, 1]].map(([cx, d]) => (
            <g key={cx}>
              <path d={`M${cx + d * 8 * k} ${ey - 8 * k} l${d * 8} ${-4}`} /><path d={`M${cx + d * 10 * k} ${ey - 3 * k} l${d * 9} ${-1}`} /><path d={`M${cx + d * 5 * k} ${ey - 11 * k} l${d * 4} ${-7}`} />
            </g>
          ))}
        </g>
      );
    case "glitter": {
      const spark = (x, y, s, c) => <polygon key={`${x}${y}`} points={starPath(x, y, 3.600 * s, 1.500 * s)} fill={c} />;
      return (
        <g>
          {[[62, ey + 9, 1, "#ffd54a"], [70, ey + 18, 0.8, "#ff9ec9"], [67, ey + 3, 0.7, "#8fd3ff"], [138, ey + 9, 1, "#ffd54a"], [130, ey + 18, 0.8, "#ff9ec9"], [133, ey + 3, 0.7, "#8fd3ff"]].map(([x, y, s, c]) => spark(x, y, s, c))}
          {[[74, ey + 10], [126, ey + 10], [60, ey + 16], [140, ey + 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.200" fill="#fff" opacity=".9" />)}
        </g>
      );
    }
    case "bandaid":
      return (
        <g transform={`rotate(-24 136 ${ey + 10})`}>
          <rect x="124" y={ey + 5} width="24" height="10" rx="5" fill="#f2c9a0" stroke="#d09b6c" strokeWidth="1.400" />
          <rect x="132" y={ey + 5} width="8" height="10" fill="#f8dfc2" /><g fill="#d09b6c" opacity=".7">{[[127, 1], [127, 5], [145, 1], [145, 5]].map(([x, dy], i) => <circle key={i} cx={x} cy={ey + 7 + dy} r=".8" />)}</g>
        </g>
      );
    case "warpaint":
      return (
        <g strokeLinecap="round" fill="none">
          <path d={`M66 ${ey + 8} l11 9 M62 ${ey + 14} l11 9`} stroke="#e0435f" strokeWidth="3.400" /><path d={`M134 ${ey + 8} l-11 9 M138 ${ey + 14} l-11 9`} stroke="#e0435f" strokeWidth="3.400" />
          <path d={`M68 ${ey + 6} l11 9`} stroke="#fff" strokeWidth="1.400" opacity=".8" /><path d={`M132 ${ey + 6} l-11 9`} stroke="#fff" strokeWidth="1.400" opacity=".8" />
        </g>
      );
    default: return null;
  }
}
