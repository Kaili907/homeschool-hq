import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../../..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const outDir = resolve(here, ".dist");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: tutorRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(outDir, { recursive: true, force: true });
run(process.execPath, [tsc, "-p", resolve(here, "tsconfig.json")]);
run(process.execPath, [
  "--test",
  "--test-reporter=spec",
  resolve(outDir, "adversarial/v4/scope-isolation/*.test.js"),
]);
