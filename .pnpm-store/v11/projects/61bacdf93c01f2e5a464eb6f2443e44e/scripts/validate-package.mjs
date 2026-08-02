import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const output = resolve(root, ".validation-dist");
const outputRelative = relative(root, output);
if (
  outputRelative === "" ||
  isAbsolute(outputRelative) ||
  outputRelative === ".." ||
  outputRelative.startsWith(`..${sep}`) ||
  basename(output) !== ".validation-dist"
) {
  throw new Error("Refusing to clean an unexpected validation path.");
}
await rm(output, { recursive: true, force: true });

const checks = [];
const add = (name, passed, detail) => checks.push({ name, passed, detail });
const tsc = resolve(root, "node_modules/typescript/bin/tsc");
const compilation = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json", "--outDir", output], {
  cwd: root,
  stdio: "inherit",
});
add("strict-typescript", compilation.status === 0, compilation.status === 0 ? "No errors" : `Exit ${compilation.status}`);
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

const builtIndex = resolve(output, "subjects/english/src/index.js");
const { englishModules, validateEnglishModule, integrationMatrix, coreChangeRequests } = await import(
  `${pathToFileURL(builtIndex).href}?v=${Date.now()}`
);
for (const module of englishModules) {
  for (const result of validateEnglishModule(module)) {
    add(`${module.lessonId}:${result.contract}`, result.passed, result.detail);
  }
}
add("completed-module-count", englishModules.length === 4, `${englishModules.length} modules`);
add(
  "integration-classification-complete",
  integrationMatrix.every((entry) => !["BLOCKED_CORE_CHANGE", "NOT_TESTED"].includes(entry.classification)),
  `${integrationMatrix.length} areas; ${integrationMatrix.filter((entry) => entry.classification === "PASS_DIRECT_CORE_V0_2").length} direct; ${integrationMatrix.filter((entry) => entry.classification === "PASS_PROVISIONAL_ADAPTER").length} adapter`,
);
add("core-change-requests", coreChangeRequests.length === 0, coreChangeRequests.length === 0 ? "None" : coreChangeRequests.join("; "));

const requiredFiles = [
  "README.md",
  "src/index.ts",
  "src/validation.ts",
  "src/adapters/english-core-v02-extension.ts",
  "src/modules/decoding-multisyllable-words.ts",
  "src/modules/sentence-completeness.ts",
  "src/modules/main-idea-supporting-details.ts",
  "src/modules/clear-paragraph-revision.ts",
  "demo/index.html",
  "demo/app.js",
  "demo/programs.generated.js",
  "docs/DIRECTOR-HANDOFF.md",
  "docs/CORE-V0.2-MAPPING.md",
  "docs/LIMITATIONS.md",
];
for (const file of requiredFiles) {
  try {
    await stat(resolve(root, file));
    add(`required-file:${file}`, true, "Present");
  } catch {
    add(`required-file:${file}`, false, "Missing");
  }
}

const demoDataSource = await readFile(resolve(root, "demo/programs.generated.js"), "utf8");
add("browser-demo-reading", /"reading"[\s\S]*english-decoding-multisyllable-words/.test(demoDataSource), "Reading intervention generated from the decoding program");
add("browser-demo-writing", /"writing"[\s\S]*english-organize-revise-clear-paragraph/.test(demoDataSource), "Writing intervention generated from the paragraph program");
const demoApp = await readFile(resolve(root, "demo/app.js"), "utf8");
add("browser-demo-no-camera", !/getUserMedia|mediaDevices|webcam/i.test(demoApp), "No camera API references");

const repoRoot = resolve(root, "../../..");
const coreDiff = spawnSync("git", ["diff", "--quiet", "--", "adaptive-tutor/core"], { cwd: repoRoot });
const coreCachedDiff = spawnSync("git", ["diff", "--cached", "--quiet", "--", "adaptive-tutor/core"], { cwd: repoRoot });
add("core-source-unchanged", coreDiff.status === 0 && coreCachedDiff.status === 0, "No staged or unstaged Core diff");

async function walk(directory) {
  const outputFiles = [];
  for (const entry of await readdir(directory)) {
    if (["node_modules", "releases", ".build-dist", ".test-dist", ".validation-dist"].includes(entry)) continue;
    const path = resolve(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) outputFiles.push(...await walk(path));
    else outputFiles.push(path);
  }
  return outputFiles;
}

const currentFiles = await walk(root);
const boundaryViolations = currentFiles
  .map((file) => relative(root, file).replaceAll("\\", "/"))
  .filter((file) => /^(?:\.github|supabase|netlify|database|auth|storage|progress-sync)\//i.test(file));
add("package-boundary", boundaryViolations.length === 0, boundaryViolations.length === 0 ? "English-owned files only" : boundaryViolations.join(", "));

const passed = checks.filter((check) => check.passed).length;
const failed = checks.length - passed;
const report = `# Adaptive English v0.2 — Generated Validation Report\n\n**Overall result:** ${failed === 0 ? "PASS" : "FAIL"}\n\n- Checks: ${checks.length}\n- Passed: ${passed}\n- Failed: ${failed}\n- Core baseline: Adaptive Tutor Core v0.2.0\n- Generated: ${new Date().toISOString()}\n\n| Check | Result | Detail |\n|---|---|---|\n${checks.map((check) => `| ${check.name} | ${check.passed ? "PASS" : "FAIL"} | ${String(check.detail).replaceAll("|", "\\|")} |`).join("\n")}\n\n## Integration Summary\n\n| Area | Classification | Mapping |\n|---|---|---|\n${integrationMatrix.map((entry) => `| ${entry.area} | ${entry.classification} | ${entry.mapping} |`).join("\n")}\n\n## Boundary\n\nNo GitHub, Supabase, Netlify, Lovable, database, authentication, identity, storage, or progress-synchronization integration is present. Core source has no staged or unstaged diff.\n`;
await writeFile(resolve(root, "docs/VALIDATION-REPORT.generated.md"), report, "utf8");

const manifestCandidates = (await walk(root)).filter((file) =>
  !file.endsWith("package-manifest.generated.json") &&
  !file.endsWith("FILE-INVENTORY.generated.md"),
);
const manifestFiles = [];
for (const file of manifestCandidates.sort()) {
  const bytes = await readFile(file);
  manifestFiles.push({
    path: relative(root, file).replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  resolve(root, "package-manifest.generated.json"),
  `${JSON.stringify({ package: "@manuel-academy/adaptive-english-tutor", version: "0.2.0", excludes: ["node_modules", "releases", "temporary build directories", "this manifest", "generated inventory"], files: manifestFiles }, null, 2)}\n`,
  "utf8",
);

const inventoryFiles = (await walk(root))
  .map((file) => relative(root, file).replaceAll("\\", "/"))
  .filter((file) => file !== "docs/FILE-INVENTORY.generated.md")
  .sort();
const inventory = `# Adaptive English File Inventory\n\nGenerated from the final package tree. Excludes dependency and release directories. The inventory itself is listed explicitly.\n\n- File count: ${inventoryFiles.length + 1}\n\n${[...inventoryFiles, "docs/FILE-INVENTORY.generated.md"].sort().map((file) => `- \`${file}\``).join("\n")}\n`;
await writeFile(resolve(root, "docs/FILE-INVENTORY.generated.md"), inventory, "utf8");
await rm(output, { recursive: true, force: true });
console.log(report);
if (failed > 0) process.exitCode = 1;
