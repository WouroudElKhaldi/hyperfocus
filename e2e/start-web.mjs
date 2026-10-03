// Builds the website once for the browser tests, then serves that build twice (P5-04): the local-mode site, and the
// cloud-mode one (its own port, talking to the cloud-mode test API). Playwright stops this when the tests end.
import { execSync, spawn } from "node:child_process";

execSync("pnpm --filter ./apps/web build:e2e", { stdio: "inherit" });
const serve = (web, api) =>
  spawn("pnpm", ["--filter", "./apps/web", "preview:e2e"], { stdio: "inherit", shell: true, env: { ...process.env, WEB_PORT: web, API_PORT: api } });
const servers = [serve(process.env.WEB_PORT, process.env.API_PORT), serve(process.env.CLOUD_WEB_PORT, process.env.CLOUD_API_PORT)];
const stop = () => { for (const s of servers) s.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
