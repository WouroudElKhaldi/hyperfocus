// Turns a JSON value into its "shape": the same structure with every value replaced by its type.
// Snapshots of shapes stay stable when the data changes, but break when a field is added, removed,
// renamed or changes type, which is exactly what the frontend depends on.
//   { id: 3, at: "2026-10-02T10:00:00.000Z", tags: ["a"] }  ->  { at: "date", id: "number", tags: ["string"] }
// Arrays merge the shapes of all their items; a key that only some items have is marked "key?".

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function shapeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length ? [v.map(shapeOf).reduce(merge)] : [];
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])]));
  if (typeof v === "string" && ISO.test(v)) return "date";
  return typeof v;
}

const strip = (k) => k.replace(/\?$/, "");

function merge(a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return a;
  if (typeof a === "string" && typeof b === "string") return [...new Set([...a.split("|"), ...b.split("|")])].sort().join("|");
  if (Array.isArray(a) && Array.isArray(b)) return !a.length ? b : !b.length ? a : [merge(a[0], b[0])];
  if (isObj(a) && isObj(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)].map(strip))].sort();
    const out = {};
    for (const k of keys) {
      const ka = k in a ? k : `${k}?`, kb = k in b ? k : `${k}?`;
      const inA = ka in a, inB = kb in b;
      const optional = !inA || !inB || ka.endsWith("?") || kb.endsWith("?");
      out[optional ? `${k}?` : k] = inA && inB ? merge(a[ka], b[kb]) : inA ? a[ka] : b[kb];
    }
    return out;
  }
  return "mixed";
}
