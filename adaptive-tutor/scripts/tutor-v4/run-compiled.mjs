import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: tutorRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [tsc, "-p", "scripts/tutor-v4/tsconfig.json"]);
const [target, ...args] = process.argv.slice(2);
const compiledRoot = "scripts/tutor-v4/.dist";
if (target === "test") {
  run(process.execPath, ["--test", `${compiledRoot}/tests/wave4-gates/*.test.js`, ...args]);
} else if (target === "closure") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/run-blocker-closure.js`, ...args]);
} else if (target === "gate") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/run-hard-gates.js`, ...args]);
} else if (target === "negative") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/run-negative-controls.js`, ...args]);
} else if (target === "supply-chain") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/certify-supply-chain.js`, ...args]);
} else if (target === "schema") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/generate-schemas.js`, ...args]);
} else if (target === "release") {
  run(process.execPath, [`${compiledRoot}/scripts/tutor-v4/generate-release.js`, ...args]);
} else {
  process.stderr.write("Expected target: test, closure, gate, negative, supply-chain, schema, or release.\n");
  process.exitCode = 2;
}
