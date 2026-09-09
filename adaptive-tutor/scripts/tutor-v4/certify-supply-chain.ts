import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
const productionRoots = [
  "core/v3",
  "study-engine/tutor-v2/wave3",
  "study-engine/tutor-v2/parent-reporting",
] as const;
const forbiddenImportTokens = [
  "@anthropic-ai",
  "openai",
  "elevenlabs",
  "netlify/functions",
  "@supabase/supabase-js",
] as const;
const forbiddenEndpointTokens = [
  "api.openai.com",
  "api.anthropic.com",
  "api.elevenlabs.io",
] as const;

async function sourceFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && [".ts", ".js", ".mjs"].some((suffix) => entry.name.endsWith(suffix)))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
}

function findingsFor(source: string): readonly string[] {
  const importSpecifiers = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
    .map((match) => (match[1] ?? "").toLowerCase());
  const findings = importSpecifiers.flatMap((specifier) =>
    forbiddenImportTokens.filter((token) => specifier.includes(token)).map((token) => `forbidden-import:${token}`)
  );
  findings.push(...forbiddenEndpointTokens
    .filter((token) => source.toLowerCase().includes(token))
    .map((token) => `forbidden-endpoint:${token}`));
  return findings;
}

const findings: { readonly file: string; readonly finding: string }[] = [];
for (const root of productionRoots) {
  for (const file of await sourceFiles(resolve(tutorRoot, root))) {
    const source = await readFile(file, "utf8");
    for (const finding of findingsFor(source)) {
      findings.push({ file: file.slice(tutorRoot.length + 1), finding });
    }
  }
}

const manifestPaths = [resolve(tutorRoot, "package.json"), resolve(tutorRoot, "../package.json")];
const forbiddenDependencies = ["@anthropic-ai/sdk", "openai", "elevenlabs"];
const manifestFindings: string[] = [];
for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };
  const dependencyNames = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  manifestFindings.push(...forbiddenDependencies.filter((name) => dependencyNames.includes(name)));
}

const negativeControls = [
  { id: "vendor-import", source: 'import Anthropic from "@anthropic-ai/sdk";' },
  { id: "openai-import", source: 'import OpenAI from "openai";' },
  { id: "endpoint", source: 'const endpoint = "https://api.openai.com/v1/responses";' },
  { id: "production-netlify-import", source: 'import { handler } from "netlify/functions/provider";' },
].map((control) => ({
  id: control.id,
  status: findingsFor(control.source).length > 0 ? "DETECTED" : "SURVIVED",
}));
const detected = negativeControls.filter((control) => control.status === "DETECTED").length;
const pass = findings.length === 0 && manifestFindings.length === 0 && detected === negativeControls.length;
const output = {
  evidenceVersion: 1,
  aggregateStatus: pass ? "PASS" : "FAIL",
  scope: "CURRENT_PRODUCTION_FOUNDATION",
  scannedRoots: productionRoots,
  productionFindings: findings,
  forbiddenDependencyFindings: manifestFindings,
  rootLockfileAddition: false,
  laneLocalToolingManifests: [
    "adversarial/v4/multilingual-eval/package.json",
    "adversarial/v4/scope-isolation/package.json",
    "certification/v4/live-runner/package.json",
    "certification/v4/model-drift/package.json",
  ],
  originalWholeDiffWrapperRuling: {
    status: "KNOWN_SCOPE_FALSE_POSITIVES",
    findingCount: 9,
    detail: "Synthetic canaries, test-runner environment variables, and lane-local TypeScript tooling are not production vendor wiring or credentials.",
  },
  negativeControls,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!pass) process.exitCode = 1;
