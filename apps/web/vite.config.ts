import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SECURITY_HEADERS } from "./security-headers.mjs";

// WEB_PORT and API_PORT let a second copy of the app run next to the real one (used for testing with sample data).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/…" is src/ (the shadcn/ui convention, see components.json)
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: { "/api": `http://localhost:${process.env.API_PORT || 4000}` },
    headers: SECURITY_HEADERS,
  },
  preview: { headers: SECURITY_HEADERS },
});
