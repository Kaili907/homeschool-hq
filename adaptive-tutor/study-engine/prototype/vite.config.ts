import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@study-ui": path.resolve(projectRoot, "../ui"),
      "@prototype": path.resolve(projectRoot, "src"),
      react: path.resolve(projectRoot, "node_modules/react"),
      "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(projectRoot, "..")],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["../tests/ui/unit/**/*.test.{ts,tsx}"],
    css: true,
    restoreMocks: true,
  },
});
