import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/calendar-parent-runtime/**/*.test.ts"],
    reporters: ["default"],
    sequence: {
      concurrent: false,
    },
  },
});
