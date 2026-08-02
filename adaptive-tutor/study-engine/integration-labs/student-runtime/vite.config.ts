import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const portableTsconfigRaw = JSON.stringify({
  compilerOptions: {
    useDefineForClassFields: true
  }
});

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@runtime": path.resolve(projectRoot, "src"),
      "@study-contracts": path.resolve(projectRoot, "../../contracts/index.ts"),
      "@study-schemas": path.resolve(projectRoot, "../../schemas/index.ts"),
      "@study-engine": path.resolve(projectRoot, "../../engine/index.ts"),
      "@study-prompts": path.resolve(projectRoot, "../../prompts/index.ts"),
      "@study-ui": path.resolve(projectRoot, "../../ui"),
      "@study-content": path.resolve(projectRoot, "../../prototype/src/content.ts"),
      react: path.resolve(projectRoot, "node_modules/react"),
      "react-dom": path.resolve(projectRoot, "node_modules/react-dom")
    }
  },
  server: {
    fs: {
      allow: [path.resolve(projectRoot, "../..")]
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // The dev dependency optimizer otherwise searches parent directories
      // and can inherit a tsconfig that does not belong to this package.
      tsconfigRaw: portableTsconfigRaw
    }
  },
  esbuild: {
    // The source ZIP is intentionally self-contained. Do not let Vite walk
    // above the extracted package and inherit an unrelated ancestor tsconfig.
    tsconfigRaw: portableTsconfigRaw
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "node",
    include: ["../../tests/student-runtime/unit/**/*.test.ts"],
    restoreMocks: true,
    testTimeout: 10_000
  }
});
