import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  test: {
    environment: "node",
    globals: true,
    include: ["tests/final-assembly/**/*.test.ts"],
    exclude: ["tests/final-assembly/browser/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
