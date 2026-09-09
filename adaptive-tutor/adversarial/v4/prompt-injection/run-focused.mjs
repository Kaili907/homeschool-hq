import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../../..");
const require = createRequire(resolve(tutorRoot, "package.json"));

function resolveTsc() {
  if (process.env.TUTOR_W4_TSC) return resolve(process.env.TUTOR_W4_TSC);
  try {
    return resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  } catch {
    process.stderr.write(
      "TypeScript is unavailable. Install adaptive-tutor devDependencies or set TUTOR_W4_TSC.\n",
    );
    process.exit(2);
  }
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: tutorRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const typeRoots = process.env.TUTOR_W4_TYPE_ROOTS
  ? ["--typeRoots", resolve(process.env.TUTOR_W4_TYPE_ROOTS)]
  : [];
const config = resolve(here, "tsconfig.json");
const target = process.argv[2] ?? "test";
if (target !== "test" && target !== "typecheck") {
  process.stderr.write("Expected target: test or typecheck.\n");
  process.exit(2);
}
run([resolveTsc(), "-p", config, ...typeRoots, ...(target === "typecheck" ? ["--noEmit"] : [])]);
if (target === "test") {
  run(["--test", resolve(here, ".dist/adversarial/v4/prompt-injection/prompt-injection.test.js")]);
}
