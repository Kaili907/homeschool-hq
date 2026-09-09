import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../../..");
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

const compilerArgs = [tsc, "-p", resolve(here, "tsconfig.json")];
const externalNodeModules = process.env.NODE_PATH?.split(delimiter).find(Boolean);
if (externalNodeModules) {
  compilerArgs.push("--typeRoots", resolve(externalNodeModules, "@types"));
}
run(process.execPath, compilerArgs);
run(process.execPath, [
  "--test",
  resolve(here, ".dist/adversarial/v4/resource-abuse/resource-abuse.test.js"),
]);
