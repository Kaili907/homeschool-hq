import { readdir, rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const output = resolve(root, ".test-dist");
const outputRelative = relative(root, output);
if (
  outputRelative === "" ||
  isAbsolute(outputRelative) ||
  outputRelative === ".." ||
  outputRelative.startsWith(`..${sep}`) ||
  basename(output) !== ".test-dist"
) {
  throw new Error("Refusing to clean an unexpected test path.");
}
await rm(output, { recursive: true, force: true });
const tsc = resolve(root, "node_modules/typescript/bin/tsc");
const compilation = spawnSync(process.execPath, [tsc, "-p", "tsconfig.test.json"], {
  cwd: root,
  stdio: "inherit",
});
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

const testDirectory = resolve(output, "subjects/english/tests");
const tests = (await readdir(testDirectory))
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => resolve(testDirectory, file));
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit",
});
await rm(output, { recursive: true, force: true });
if (result.status !== 0) process.exit(result.status ?? 1);
