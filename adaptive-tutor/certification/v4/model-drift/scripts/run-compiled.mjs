import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const policyRoot = resolve(here, "..");
const dist = resolve(policyRoot, ".dist");
const require = createRequire(resolve(policyRoot, "package.json"));
const typescriptPackage = require.resolve("typescript/package.json");
const dependencyNodeModules = dirname(dirname(typescriptPackage));
const tsc = resolve(dirname(typescriptPackage), "bin", "tsc");
const typeRoots = resolve(dependencyNodeModules, "@types");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: policyRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`Command failed with status ${result.status ?? 1}`);
}

rmSync(dist, { recursive: true, force: true });
try {
  run(process.execPath, [
    tsc,
    "-p",
    "tsconfig.json",
    "--typeRoots",
    typeRoots,
    "--noEmit",
    "false",
    "--outDir",
    ".dist",
  ]);
  run(process.execPath, ["--test", ".dist/tests/*.test.js"]);
} finally {
  rmSync(dist, { recursive: true, force: true });
}
