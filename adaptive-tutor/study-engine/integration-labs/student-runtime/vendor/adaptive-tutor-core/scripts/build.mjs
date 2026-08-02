import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(resolve("dist"), { recursive: true, force: true });
run("tsc", ["-p", "tsconfig.build.json"]);
await mkdir(resolve("dist/prototype"), { recursive: true });
await cp(resolve("index.html"), resolve("dist/index.html"));
await cp(resolve("prototype/styles.css"), resolve("dist/prototype/styles.css"));
run("node", ["dist/scripts/export-json-schemas.js"]);
await mkdir(resolve("dist/json-schema"), { recursive: true });
await cp(resolve("json-schema"), resolve("dist/json-schema"), { recursive: true });
console.log("Built static browser prototype and TypeScript declarations in dist/.");
