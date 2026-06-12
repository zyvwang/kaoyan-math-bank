import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    },
    proxy: {
      "/api": "http://127.0.0.1:5174",
      "/assets": "http://127.0.0.1:5174",
      "/exports": "http://127.0.0.1:5174",
      "/tmp": "http://127.0.0.1:5174"
    }
  }
});
