import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const evalRoot = resolve(here, "..");
const tutorRoot = resolve(evalRoot, "../..");
const dist = resolve(evalRoot, ".dist");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: evalRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`Command failed with status ${result.status ?? 1}`);
}

const [target, ...args] = process.argv.slice(2);
rmSync(dist, { recursive: true, force: true });
try {
  run(process.execPath, [
    tsc,
    "-p",
    "tsconfig.json",
    "--noEmit",
    "false",
    "--outDir",
    ".dist",
  ]);
  if (target === "test") {
    run(process.execPath, ["--test", ".dist/adaptive-tutor/evals/v3/tests/*.test.js", ...args]);
  } else if (target === "evaluate") {
    run(process.execPath, [".dist/adaptive-tutor/evals/v3/src/cli.js", ...args]);
  } else {
    process.stderr.write("Expected target: test or evaluate.\n");
    process.exitCode = 2;
  }
} finally {
  rmSync(dist, { recursive: true, force: true });
}
