import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: tutorRoot, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [tsc, "-p", "scripts/tutor-v3/tsconfig.json"]);
const [target, ...args] = process.argv.slice(2);
if (target === "schema") {
  run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/generate-schemas.js", ...args]);
} else if (target === "test") {
  run(process.execPath, ["--test", "scripts/tutor-v3/.dist/tests/tutor-v3-convergence/*.test.js", ...args]);
} else if (target === "gate") {
  run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js", ...args]);
} else if (target === "mutation") {
  run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/run-mutation-proof.js", ...args]);
} else if (target === "release") {
  run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/generate-release.js", ...args]);
} else {
  process.stderr.write("Expected target: schema, test, gate, mutation, or release.\n");
  process.exitCode = 2;
}
