// Builds the website once for the browser tests, then serves that build twice (P5-04): the local-mode site, and the
// cloud-mode one (its own port, talking to the cloud-mode test API). Playwright stops this when the tests end.
// On this Windows computer a preview server sometimes dies at start with a native crash (0xC0000409, not our code):
// it is started again (up to 3 times, said in the log) instead of failing every test after it.
import { execSync, spawn } from "node:child_process";

execSync("pnpm --filter ./apps/web build:e2e", { stdio: "inherit" });
let stopping = false;
const running = new Set();
function serve(web, api, tries = 0) {
  const child = spawn("pnpm", ["--filter", "./apps/web", "preview:e2e"], { stdio: "inherit", shell: true, env: { ...process.env, WEB_PORT: web, API_PORT: api } });
  running.add(child);
  child.on("exit", (code) => {
    running.delete(child);
    if (stopping || code === 0) return;
    if (tries >= 3) { console.error(`[start-web] the preview on port ${web} keeps stopping (exit ${code}); giving up`); return; }
    console.error(`[start-web] the preview on port ${web} stopped (exit ${code}); starting it again`);
    serve(web, api, tries + 1);
  });
}
serve(process.env.WEB_PORT, process.env.API_PORT);
serve(process.env.CLOUD_WEB_PORT, process.env.CLOUD_API_PORT);
const stop = () => {
  stopping = true;
  for (const s of running) s.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
