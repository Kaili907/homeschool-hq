import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const output = resolve(root, ".build-dist");
const outputRelative = relative(root, output);
if (
  outputRelative === "" ||
  isAbsolute(outputRelative) ||
  outputRelative === ".." ||
  outputRelative.startsWith(`..${sep}`) ||
  basename(output) !== ".build-dist"
) {
  throw new Error("Refusing to clean an unexpected build path.");
}
await rm(output, { recursive: true, force: true });

const tsc = resolve(root, "node_modules/typescript/bin/tsc");
const compilation = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

const builtIndex = resolve(output, "subjects/english/src/index.js");
const {
  decodingMultisyllableWordsModule,
  clearParagraphRevisionModule,
  englishModules,
} = await import(
  `${pathToFileURL(builtIndex).href}?v=${Date.now()}`
);

function serializable(module, classification) {
  return {
    lessonId: module.lessonId,
    completedModuleName: module.completedModuleName,
    category: module.category,
    classification,
    program: module.coreProgram,
    extension: module.coreV02Extension,
  };
}

const payload = {
  coreContractVersion: "0.2.0",
  generatedFromValidatedTypeScript: true,
  reading: serializable(decodingMultisyllableWordsModule, "PASS_DIRECT_CORE_V0_2"),
  writing: serializable(clearParagraphRevisionModule, "PASS_PROVISIONAL_ADAPTER"),
};
await writeFile(
  resolve(root, "demo/programs.generated.js"),
  `window.ENGLISH_DEMO_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8",
);
await writeFile(
  resolve(root, "demo/manifest.generated.json"),
  `${JSON.stringify({
    coreContractVersion: payload.coreContractVersion,
    interventions: {
      reading: payload.reading.lessonId,
      writing: payload.writing.lessonId,
    },
    source: "Validated English TypeScript module objects",
  }, null, 2)}\n`,
  "utf8",
);
await mkdir(resolve(root, "assets/captions"), { recursive: true });
await mkdir(resolve(root, "assets/narration"), { recursive: true });
for (const module of englishModules) {
  await writeFile(
    resolve(root, `assets/captions/${module.lessonId}.vtt`),
    module.coreV02Extension.webVtt,
    "utf8",
  );
  await writeFile(
    resolve(root, `assets/narration/${module.lessonId}.json`),
    `${JSON.stringify(module.coreV02Extension.narration, null, 2)}\n`,
    "utf8",
  );
}
await rm(output, { recursive: true, force: true });
console.log("Built standalone browser demonstrations plus narration, transcript, and WebVTT assets.");
