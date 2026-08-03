import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Portable invocation (A3-C): resolve the TypeScript CLI through Node and let
// node --test expand the glob itself (Node >= 21) instead of relying on bash,
// so the suite runs identically on Windows and POSIX hosts.
const require = createRequire(import.meta.url);
const tscCli = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

await rm(resolve(".test-dist"), { recursive: true, force: true });
run(process.execPath, [tscCli, "-p", "tsconfig.test.json"]);
run(process.execPath, ["--test", ".test-dist/tests/*.test.js"]);
