import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/external-assignment-capture/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    sequence: {
      concurrent: false,
    },
  },
});
