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
        changeOrigin: false
      },
      "/ws": {
        target: process.env.VITE_CC_MUSIC_BRIDGE_URL ?? "ws://127.0.0.1:8787",
        ws: true,
        changeOrigin: false
      }
    }
  }
});
