import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASELINE = "a2fdf1858cd50c998f5da53970d36ee6c90ff31a";

export const SCAN_ROOTS = Object.freeze([
  "adaptive-tutor/core/v3",
  "adaptive-tutor/adversarial/v4",
  "adaptive-tutor/certification/v4",
  "adaptive-tutor/evals/v3",
]);

const SOURCE_EXTENSIONS = new Set([
  ".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx",
]);
const CONFIG_EXTENSIONS = new Set([".env", ".json", ".toml", ".yaml", ".yml"]);
const DEPENDENCY_FIELDS = Object.freeze([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const LOCKFILE_NAMES = new Set([
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const WALK_EXCLUSIONS = new Set([
  ".git", ".turbo", ".vite", "coverage", "dist", "node_modules",
]);

const VENDOR_PACKAGES = new Set([
  "@anthropic-ai/sdk",
  "@azure/openai",
  "@google/generative-ai",
  "@google/genai",
  "@mistralai/mistralai",
  "@supabase/supabase-js",
  "ai",
  "anthropic",
  "cohere-ai",
  "elevenlabs",
  "groq-sdk",
  "mistralai",
  "openai",
  "replicate",
  "supabase-js",
]);
const VENDOR_PREFIXES = Object.freeze(["@ai-sdk/", "@aws-sdk/client-bedrock"]);
const UI_PACKAGES = Object.freeze([
  "@angular/", "@emotion/", "@mui/", "@radix-ui/", "next", "preact",
  "react", "react-dom", "solid-js", "svelte", "vue",
]);
const NETWORK_NODE_MODULES = new Set([
  "node:dgram", "node:dns", "node:http", "node:http2", "node:https",
  "node:net", "node:tls",
]);

function toPosix(path) {
  return path.split(sep).join("/");
}

function relativePath(root, path) {
  return toPosix(relative(root, path));
}

function walkFiles(root, start = root) {
  if (!existsSync(start)) return [];
  const files = [];
  for (const entry of readdirSync(start, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || WALK_EXCLUSIONS.has(entry.name)) continue;
    const path = resolve(start, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function isTestFile(path) {
  return /(?:^|\/)(?:fixtures?|tests?)(?:\/|$)|\.(?:spec|test)\.[^.]+$/u.test(path);
}

function isFoundationRuntime(path) {
  return path.startsWith("adaptive-tutor/core/v3/") && !isTestFile(path);
}

function packageRoot(specifier) {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

function isExternalSpecifier(specifier) {
  return !specifier.startsWith(".")
    && !specifier.startsWith("/")
    && !specifier.startsWith("#")
    && !specifier.startsWith("node:");
}

function isVendorSpecifier(specifier) {
  const root = packageRoot(specifier);
  return VENDOR_PACKAGES.has(root)
    || VENDOR_PREFIXES.some((prefix) => specifier.startsWith(prefix))
    || /(?:^|[-/])(?:bedrock|gemini|huggingface|ollama|vertexai)(?:[-/]|$)/iu.test(specifier);
}

function isUiSpecifier(specifier) {
  const root = packageRoot(specifier);
  return UI_PACKAGES.some((candidate) => (
    candidate.endsWith("/") ? specifier.startsWith(candidate) : root === candidate
  ));
}

function resolvedImport(root, file, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  return resolve(root, dirname(file), specifier);
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    { kind: "static", pattern: /\b(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gu },
    { kind: "require", pattern: /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu },
    { kind: "dynamic", pattern: /\bimport\s*\(\s*["']([^"']+)["'](?:\s*,[^)]*)?\s*\)/gu },
  ];
  for (const { kind, pattern } of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.push({ kind, specifier: match[1], index: match.index });
    }
  }
  return imports;
}

function sourceFindings(root, file) {
  const path = relativePath(root, file);
  const extension = extname(file);
  const isConfigSource = CONFIG_EXTENSIONS.has(extension) || path.split("/").at(-1).startsWith(".env");
  if (!SOURCE_EXTENSIONS.has(extension) && !isConfigSource) return [];
  const source = readFileSync(file, "utf8");
  const findings = [];
  const seen = new Set();
  const add = (code, message, index = 0) => {
    const finding = { code, path, line: lineNumber(source, index), message };
    const key = `${code}:${path}:${finding.line}:${message}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push(finding);
    }
  };

  if (SOURCE_EXTENSIONS.has(extension)) {
    for (const imported of extractImports(source)) {
      const { kind, specifier, index } = imported;
      const target = resolvedImport(root, path, specifier);
      if (isVendorSpecifier(specifier)) {
        add(kind === "dynamic" ? "dynamic-vendor-import" : "vendor-sdk-import",
          `${kind} import crosses into vendor package ${specifier}`, index);
      }
      if (specifier.startsWith("@supabase/")
        || (target && target.startsWith(resolve(root, "supabase") + sep))) {
        add("hosted-supabase-import", `import crosses into hosted Supabase seam ${specifier}`, index);
      }
      if (specifier === "netlify" || specifier.startsWith("@netlify/")
        || /(?:^|\/)netlify\/functions(?:\/|$)/u.test(specifier)
        || (target && target.startsWith(resolve(root, "netlify") + sep))) {
        add("production-netlify-import", `import crosses into production Netlify seam ${specifier}`, index);
      }
      if ((target && target.startsWith(resolve(root, "src") + sep))
        || specifier === "src" || /^(?:@|~)?\/src(?:\/|$)|^(?:@|~)\//u.test(specifier)) {
        add("prohibited-production-src-import", `import crosses into prohibited production src seam ${specifier}`, index);
      }
      if (isUiSpecifier(specifier)) {
        add("production-ui-dependency", `Tutor certification scope imports UI package ${specifier}`, index);
      }
      if (isExternalSpecifier(specifier)) {
        add("unexpected-external-import", `Tutor certification scope imports external package ${specifier}`, index);
      }
      if (isFoundationRuntime(path) && specifier.startsWith("node:child_process")) {
        add("foundation-child-process", "Tutor foundation imports child-process execution", index);
      }
      if (isFoundationRuntime(path)
        && [...NETWORK_NODE_MODULES].some((networkModule) => specifier === networkModule || specifier.startsWith(`${networkModule}/`))) {
        add("foundation-network", `Tutor foundation imports network module ${specifier}`, index);
      }
      if (isFoundationRuntime(path) && (specifier === "node:fs" || specifier.startsWith("node:fs/"))) {
        add("foundation-filesystem-persistence", `Tutor foundation imports filesystem module ${specifier}`, index);
      }
    }

    for (const match of source.matchAll(/\bimport\s*\(([^)]*)\)/gu)) {
      if (!/^\s*["'][^"']+["'](?:\s*,[\s\S]*)?\s*$/u.test(match[1])) {
        add("dynamic-nonliteral-import", "non-literal dynamic import can evade static provider review", match.index);
      }
    }
    for (const match of source.matchAll(/\brequire\s*\(([^)]*)\)/gu)) {
      if (!/^\s*["'][^"']+["']\s*$/u.test(match[1])) {
        add("dynamic-nonliteral-import", "non-literal require can evade static provider review", match.index);
      }
    }
  }

  const credentialAccessPatterns = [
    /\bprocess\s*(?:\.\s*env\b|\[\s*["']env["']\s*\])/gu,
    /\bimport\s*\.\s*meta\s*(?:\.\s*env\b|\[\s*["']env["']\s*\])/gu,
    /\b(?:Bun|Deno)\s*(?:\.\s*env\b|\[\s*["']env["']\s*\])/gu,
  ];
  for (const pattern of credentialAccessPatterns) {
    for (const match of source.matchAll(pattern)) {
      add("credential-environment-access", "credential or environment access is forbidden in Tutor certification scope", match.index);
    }
  }

  for (const match of source.matchAll(/https?:\/\/[^\s"'`<>\\]+/gu)) {
    try {
      const url = new URL(match[0]);
      const reserved = url.hostname === "invalid"
        || url.hostname === "example.com"
        || url.hostname.endsWith(".example")
        || url.hostname.endsWith(".test");
      if (!reserved) add("hard-coded-network-endpoint", `hard-coded routable endpoint ${url.origin}`, match.index);
    } catch {
      add("hard-coded-network-endpoint", "malformed hard-coded network endpoint", match.index);
    }
  }

  const keyMaterialPatterns = [
    /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/gu,
    /\bAKIA[0-9A-Z]{16}\b/gu,
    /\bAIza[0-9A-Za-z_-]{35}\b/gu,
    /\bgh[oprsu]_[0-9A-Za-z]{30,}\b/gu,
    /\bsk-(?:ant-)?[0-9A-Za-z_-]{20,}\b/gu,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu,
    /\b(?:api[_-]?key|client[_-]?secret|credential|password|token)\s*[:=]\s*["'][0-9A-Za-z_./+=-]{16,}["']/giu,
  ];
  for (const pattern of keyMaterialPatterns) {
    for (const match of source.matchAll(pattern)) {
      add("embedded-api-key-material", "embedded API-key-like material is forbidden", match.index);
    }
  }

  const unsafeTokens = [
    ["NODE", "TLS", "REJECT", "UNAUTHORIZED"].join("_"),
    ["NODE", "OPTIONS"].join("_"),
  ];
  for (const token of unsafeTokens) {
    const index = source.indexOf(token);
    if (index >= 0) add("unsafe-configuration", `unsafe runtime configuration ${token}`, index);
  }
  for (const match of source.matchAll(/\b(?:rejectUnauthorized|strictSSL)\s*:\s*false\b/gu)) {
    add("unsafe-configuration", "TLS verification is explicitly disabled", match.index);
  }

  if (isFoundationRuntime(path)) {
    const networkPatterns = [
      /\bfetch\s*\(/gu,
      /\bnew\s+(?:EventSource|WebSocket|XMLHttpRequest)\b/gu,
      /\bnavigator\s*\.\s*sendBeacon\s*\(/gu,
      /\b(?:axios|got)\s*\./gu,
    ];
    for (const pattern of networkPatterns) {
      for (const match of source.matchAll(pattern)) {
        add("foundation-network", "Tutor foundation performs network execution", match.index);
      }
    }
    const persistencePatterns = [
      /\b(?:appendFile|copyFile|createWriteStream|mkdir|open|rename|rm|truncate|unlink|writeFile)(?:Sync)?\s*\(/gu,
      /\b(?:indexedDB|localStorage|sessionStorage)\b/gu,
    ];
    for (const pattern of persistencePatterns) {
      for (const match of source.matchAll(pattern)) {
        add("foundation-filesystem-persistence", "Tutor foundation performs filesystem or browser persistence", match.index);
      }
    }
  }

  return findings;
}

function isPackageManifest(path) {
  return path === "package.json" || path.endsWith("/package.json");
}

function isLockfile(path) {
  return LOCKFILE_NAMES.has(path.split("/").at(-1));
}

function workingDependencySnapshot(root) {
  const manifests = new Map();
  const lockfiles = new Map();
  for (const file of walkFiles(root)) {
    const path = relativePath(root, file);
    if (isPackageManifest(path)) manifests.set(path, readFileSync(file, "utf8"));
    if (isLockfile(path)) lockfiles.set(path, readFileSync(file, "utf8"));
  }
  return { manifests, lockfiles };
}

export function captureWorkingDependencySnapshot(root) {
  return workingDependencySnapshot(resolve(root));
}

export function captureGitDependencySnapshot(root, ref = DEFAULT_BASELINE) {
  const repository = resolve(root);
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", ref], {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).split("\n").filter(Boolean);
  const manifests = new Map();
  const lockfiles = new Map();
  for (const path of names) {
    if (!isPackageManifest(path) && !isLockfile(path)) continue;
    const content = execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: repository,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (isPackageManifest(path)) manifests.set(path, content);
    if (isLockfile(path)) lockfiles.set(path, content);
  }
  return { manifests, lockfiles };
}

function dependencyMap(content, path, findings, enforceCurrentPolicy = false) {
  let manifest;
  try {
    manifest = JSON.parse(content);
  } catch {
    findings.push({ code: "invalid-package-manifest", path, line: 1, message: "package manifest is not valid JSON" });
    return new Map();
  }
  const dependencies = new Map();
  for (const field of DEPENDENCY_FIELDS) {
    const entries = manifest[field];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
    for (const [name, version] of Object.entries(entries)) {
      dependencies.set(`${field}:${name}`, String(version));
      const isScannedPackage = SCAN_ROOTS.some((scanRoot) => (
        path === `${scanRoot}/package.json` || path.startsWith(`${scanRoot}/`)
      ));
      if (enforceCurrentPolicy && isScannedPackage && isUiSpecifier(name) && field === "dependencies") {
        findings.push({
          code: "production-ui-dependency",
          path,
          line: 1,
          message: `Tutor package declares production UI dependency ${name}`,
        });
      }
    }
  }
  return dependencies;
}

function dependencyFindings(root, baselineSnapshot) {
  if (!baselineSnapshot) return [];
  const current = workingDependencySnapshot(root);
  const findings = [];
  const lockPaths = new Set([...baselineSnapshot.lockfiles.keys(), ...current.lockfiles.keys()]);
  for (const path of [...lockPaths].sort()) {
    if (baselineSnapshot.lockfiles.get(path) !== current.lockfiles.get(path)) {
      findings.push({
        code: "lockfile-change",
        path,
        line: 1,
        message: baselineSnapshot.lockfiles.has(path) && current.lockfiles.has(path)
          ? "lockfile content differs from the certified baseline"
          : "lockfile was added or removed relative to the certified baseline",
      });
    }
  }

  const manifestPaths = new Set([...baselineSnapshot.manifests.keys(), ...current.manifests.keys()]);
  for (const path of [...manifestPaths].sort()) {
    const before = baselineSnapshot.manifests.has(path)
      ? dependencyMap(baselineSnapshot.manifests.get(path), path, findings)
      : new Map();
    const after = current.manifests.has(path)
      ? dependencyMap(current.manifests.get(path), path, findings, true)
      : new Map();
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of [...keys].sort()) {
      if (before.get(key) === after.get(key)) continue;
      const [field, name] = key.split(":");
      const change = !before.has(key) ? "added"
        : !after.has(key) ? "removed"
          : "changed version for";
      findings.push({
        code: "dependency-manifest-change",
        path,
        line: 1,
        message: `${change} ${field} dependency ${name} relative to the certified baseline`,
      });
    }
  }
  return findings;
}

export function scanRepository(root, options = {}) {
  const repository = resolve(root);
  const availableRoots = SCAN_ROOTS.filter((path) => existsSync(resolve(repository, path)));
  const files = availableRoots.flatMap((path) => walkFiles(repository, resolve(repository, path)));
  const findings = files.flatMap((file) => sourceFindings(repository, file));
  findings.push(...dependencyFindings(repository, options.baselineSnapshot));
  findings.sort((left, right) => (
    left.path.localeCompare(right.path) || left.line - right.line || left.code.localeCompare(right.code)
  ));
  return {
    baseline: options.baseline ?? null,
    scannedRoots: availableRoots,
    scannedFiles: files.length,
    findingCount: findings.length,
    findings,
  };
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

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const root = resolve(options.root ?? defaultRoot);
  const baselineSnapshot = captureGitDependencySnapshot(root, options.baseline);
  const report = scanRepository(root, { baseline: options.baseline, baselineSnapshot });
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Tutor supply-chain scan: ${report.findingCount === 0 ? "PASS" : "FAIL"}`);
    console.log(`Baseline: ${options.baseline}`);
    console.log(`Scope: ${report.scannedRoots.join(", ")}`);
    console.log(`Files scanned: ${report.scannedFiles}`);
    for (const finding of report.findings) {
      console.log(`[${finding.code}] ${finding.path}:${finding.line} ${finding.message}`);
    }
    console.log(report.findingCount === 0
      ? "W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE"
      : "W4_SUPPLY_CHAIN_BLOCKER_FOUND");
  }
  if (report.findingCount > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("VALIDATION_INCONCLUSIVE");
    process.exitCode = 2;
  }
}
