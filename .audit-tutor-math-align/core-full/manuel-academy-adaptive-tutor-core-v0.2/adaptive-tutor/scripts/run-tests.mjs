import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(resolve(".test-dist"), { recursive: true, force: true });
run("tsc", ["-p", "tsconfig.test.json"]);
run("bash", ["-lc", "node --test .test-dist/tests/*.test.js"]);
