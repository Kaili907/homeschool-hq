import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureGitDependencySnapshot,
  captureWorkingDependencySnapshot,
  DEFAULT_BASELINE,
  SCAN_ROOTS,
  scanRepository,
} from "./scanner.mjs";

const NEGATIVE_CONTROLS = Object.freeze([
  {
    name: "vendor import",
    expectedCode: "vendor-sdk-import",
    encodedSource: "aW1wb3J0IE9wZW5BSSBmcm9tICJvcGVuYWkiOwpleHBvcnQgY29uc3QgY2xpZW50ID0gbmV3IE9wZW5BSSgpOwo=",
  },
  {
    name: "credential reference",
    expectedCode: "credential-environment-access",
    encodedSource: "ZXhwb3J0IGNvbnN0IGNyZWRlbnRpYWwgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWTsK",
  },
  {
    name: "network endpoint",
    expectedCode: "hard-coded-network-endpoint",
    encodedSource: "ZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0gImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvcmVzcG9uc2VzIjsK",
  },
  {
    name: "production Netlify import",
    expectedCode: "production-netlify-import",
    encodedSource: "aW1wb3J0IGhhbmRsZXIgZnJvbSAiLi4vLi4vLi4vLi4vbmV0bGlmeS9mdW5jdGlvbnMvYWktY2hhdC5qcyI7CmV4cG9ydCB7IGhhbmRsZXIgfTsK",
  },
]);

function copyCertificationScope(sourceRoot, targetRoot) {
  for (const path of SCAN_ROOTS) {
    const source = resolve(sourceRoot, path);
    if (!existsSync(source)) continue;
    const target = resolve(targetRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

function runNegativeControl(root, control, index) {
  const copy = mkdtempSync(resolve(tmpdir(), `tutor-supply-chain-${index}-`));
  try {
    copyCertificationScope(root, copy);
    const baselineSnapshot = captureWorkingDependencySnapshot(copy);
    const injectedPath = resolve(copy, "adaptive-tutor/core/v3/w4-supply-chain-negative-control.ts");
    writeFileSync(injectedPath, Buffer.from(control.encodedSource, "base64"));
    const report = scanRepository(copy, { baselineSnapshot });
    const matchingFindings = report.findings.filter((finding) => (
      finding.code === control.expectedCode
      && finding.path === "adaptive-tutor/core/v3/w4-supply-chain-negative-control.ts"
    ));
    return {
      name: control.name,
      expectedCode: control.expectedCode,
      detected: matchingFindings.length > 0,
      scannerFindingCount: report.findingCount,
      matchingFindingCount: matchingFindings.length,
    };
  } finally {
    rmSync(copy, { force: true, recursive: true });
  }
}

function parseArguments(argv) {
  const options = { baseline: DEFAULT_BASELINE, json: false, root: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--root") options.root = argv[++index];
    else if (argument === "--baseline") options.baseline = argv[++index];
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

function certify(options) {
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const root = resolve(options.root ?? defaultRoot);
  const baselineSnapshot = captureGitDependencySnapshot(root, options.baseline);
  const scan = scanRepository(root, { baseline: options.baseline, baselineSnapshot });
  const negativeControls = NEGATIVE_CONTROLS.map((control, index) => (
    runNegativeControl(root, control, index + 1)
  ));
  const controlsPassed = negativeControls.every((control) => control.detected);
  const status = scan.findingCount > 0
    ? "W4_SUPPLY_CHAIN_BLOCKER_FOUND"
    : controlsPassed
      ? "W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE"
      : "W4_SUPPLY_CHAIN_INCOMPLETE";
  return { status, scan, negativeControls };
}

function printHuman(report) {
  console.log(`Tutor supply-chain certification: ${report.status}`);
  console.log(`Baseline: ${report.scan.baseline}`);
  console.log(`Scanned files: ${report.scan.scannedFiles}`);
  console.log(`Baseline findings: ${report.scan.findingCount}`);
  for (const finding of report.scan.findings) {
    console.log(`[${finding.code}] ${finding.path}:${finding.line} ${finding.message}`);
  }
  for (const control of report.negativeControls) {
    console.log(`[${control.detected ? "PASS" : "FAIL"}] negative control: ${control.name} -> ${control.expectedCode}`);
  }
  console.log(report.status);
}

try {
  const options = parseArguments(process.argv.slice(2));
  const report = certify(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exitCode = report.status === "W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE" ? 0
    : report.status === "W4_SUPPLY_CHAIN_BLOCKER_FOUND" ? 1
      : 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("VALIDATION_INCONCLUSIVE");
  process.exitCode = 2;
}
