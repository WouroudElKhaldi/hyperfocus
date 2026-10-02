// Feature boundaries (P3-05): code outside a feature may only use what the feature offers in its index.ts. The one
// exception is the router (src/router.tsx), which opens feature pages directly so each page still loads on its own.
// Runs with `pnpm lint`; exits 1 and names the file and line of every import that reaches into another feature.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts")).map((f) => path.join(SRC, f));
const exists = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
const resolve = (from, spec) => {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null; // a package
  return ["", ".ts", ".tsx", "/index.ts"].map((e) => base + e).find(exists) ?? null;
};
const featureOf = (file) => {
  const rel = path.relative(path.join(SRC, "features"), file);
  return rel.startsWith("..") ? null : rel.split(path.sep)[0];
};

const problems = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [, spec] of line.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)) {
      const target = resolve(file, spec);
      const feature = target && featureOf(target);
      if (!feature || featureOf(file) === feature) continue;
      const inside = path.relative(path.join(SRC, "features", feature), target).split(path.sep).join("/");
      const isRouterOpeningAPage = path.relative(SRC, file) === "router.tsx" && inside.startsWith("pages/");
      if (inside !== "index.ts" && !isRouterOpeningAPage) {
        problems.push(`${path.relative(SRC, file)}:${i + 1} uses "${spec}", inside the ${feature} feature. Import it from features/${feature}/index.ts (export it there if it should be shared).`);
      }
    }
  });
}
if (problems.length) {
  console.error(`Feature boundaries: ${problems.length} import(s) reach into another feature:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Feature boundaries: OK (${files.length} files checked).`);
