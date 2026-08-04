import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@frozen/tutor-math-r1": fileURLToPath(
        new URL("../../subjects/math/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
