import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_CC_MUSIC_BRIDGE_URL ?? "http://127.0.0.1:8787",
        changeOrigin: true,
        headers: {
          "X-Local-Token": "dev-token",
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            // Same-origin requests through the Vite dev server do not carry an
            // Origin header, but the Python backend requires one for security.
            // Inject a valid localhost origin when none is present.
            if (!proxyReq.getHeader("origin")) {
              proxyReq.setHeader("Origin", "http://localhost:5173");
            }
          });
        },
      },
      "/ws": {
        target: process.env.VITE_CC_MUSIC_BRIDGE_URL ?? "ws://127.0.0.1:8787",
        ws: true,
        changeOrigin: false
      }
    }
  }
});
