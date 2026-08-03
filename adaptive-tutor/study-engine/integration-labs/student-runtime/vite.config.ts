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
      "@study-contracts": path.resolve(projectRoot, "vendor/study-engine/contracts/index.ts"),
      "@study-schemas": path.resolve(projectRoot, "vendor/study-engine/schemas/index.ts"),
      "@study-engine": path.resolve(projectRoot, "vendor/study-engine/engine/index.ts"),
      "@study-prompts": path.resolve(projectRoot, "vendor/study-engine/prompts/index.ts"),
      "@study-ui": path.resolve(projectRoot, "vendor/study-engine/ui"),
      "@study-content": path.resolve(projectRoot, "vendor/study-engine/prototype/src/content.ts"),
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
    noDiscovery: true,
    include: [],
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
