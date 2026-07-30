import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  await access(resolve("dist/scripts/validate-package.js"));
} catch {
  run("node", ["scripts/build.mjs"]);
}
run("node", ["dist/scripts/validate-package.js"]);
