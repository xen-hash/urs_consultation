import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev proxy — only active during `npm run dev` on localhost
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:5000", ws: false, changeOrigin: true }
    }
  },
  build: { outDir: "dist", sourcemap: false }
});

