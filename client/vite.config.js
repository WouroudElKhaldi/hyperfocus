import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { SECURITY_HEADERS } from "./security-headers.mjs";

// WEB_PORT and API_PORT let a second copy of the app run next to the real one (used for testing with sample data).
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: { "/api": `http://localhost:${process.env.API_PORT || 4000}` },
    headers: SECURITY_HEADERS,
  },
  preview: { headers: SECURITY_HEADERS },
});
