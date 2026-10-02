import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SECURITY_HEADERS } from "./security-headers.mjs";

// WEB_PORT and API_PORT let a second copy of the app run next to the real one (used for testing with sample data).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/…" is src/ (the shadcn/ui convention, see components.json)
  // scan every page up front: otherwise the first visit to a lazily loaded page can find new dependencies, make Vite
  // re-optimise and reload mid-session (it once crashed the dev server during the browser tests, P3-04)
  optimizeDeps: { entries: ["index.html", "src/**/*.tsx"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: { "/api": `http://localhost:${process.env.API_PORT || 4000}` },
    headers: SECURITY_HEADERS,
  },
  // the browser tests run against a build (pnpm build:e2e + preview:e2e), on the same ports and API as the dev server
  preview: {
    port: Number(process.env.WEB_PORT) || 4173,
    strictPort: true,
    proxy: { "/api": `http://localhost:${process.env.API_PORT || 4000}` },
    headers: SECURITY_HEADERS,
  },
});
