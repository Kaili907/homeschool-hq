import { fileURLToPath } from "node:url";

const studyEngineRoot = fileURLToPath(new URL("../..", import.meta.url));
const prototypeModules = fileURLToPath(
  new URL("../../prototype/node_modules/", import.meta.url),
);

export default {
  root: studyEngineRoot,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      react: `${prototypeModules}react`,
      "react-dom": `${prototypeModules}react-dom`,
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/engine/**/*.test.ts",
      "tests/integrations/**/*.{test,spec}.{ts,tsx}",
    ],
    restoreMocks: true,
  },
};
