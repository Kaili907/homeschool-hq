import { defineConfig } from "vitest/config";

/**
 * Mastery-only validation entry point.
 *
 * Run from the repository root:
 *   npx vitest run --config tests/mastery/vitest.config.ts
 *
 * Keeping the include rooted at tests/mastery prevents Vitest from collecting
 * unrelated suites in nested worktrees or session-owned directories.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/mastery/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"],
  },
});
