import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../../..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

function run(command, args, cwd = tutorRoot) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [tsc, "-p", resolve(here, "tsconfig.json")]);
run(process.execPath, [
  "--test",
  resolve(here, ".dist/tests/wave4-repairs/commercial-integrity/commercial-integrity.test.js"),
]);
