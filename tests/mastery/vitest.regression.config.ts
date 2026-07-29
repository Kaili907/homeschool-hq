import { defineConfig } from "vitest/config";

/**
 * Existing-app regression entry point.
 *
 * Run from the repository root:
 *   npx vitest run --config tests/mastery/vitest.regression.config.ts
 *
 * The explicit include is important: a bare `vitest run` also discovers
 * unrelated test suites under nested worktrees in this shared workspace.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"],
  },
});
