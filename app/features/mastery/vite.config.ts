import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "app/features/mastery/prototype",
  publicDir: false,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
  },
  build: {
    outDir: "../.preview-dist",
    emptyOutDir: true,
  },
});

