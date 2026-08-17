import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../../..");
const configPath = join(
  repositoryRoot,
  "adaptive-tutor/adversarial/v4/replay-crash/tsconfig.json",
);
const emittedRoot = join(
  repositoryRoot,
  "adaptive-tutor/adversarial/v4/replay-crash/.test-dist",
);
const tscPath = join(repositoryRoot, "node_modules/.bin/tsc");

const compiled = spawnSync(tscPath, ["-p", configPath, "--pretty", "false"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
if (compiled.status !== 0) {
  process.stderr.write(compiled.stdout);
  process.stderr.write(compiled.stderr);
  throw new Error("current W4-04 detector did not compile before negative control");
}

const disposableRoot = mkdtempSync(join(tmpdir(), "w4-r7-dispatch-guard-"));
try {
  const disposableDist = join(disposableRoot, "dist");
  cpSync(emittedRoot, disposableDist, { recursive: true });
  const guardPath = join(
    disposableDist,
    "core/v3/commercial-operation/execution-integrity.js",
  );
  const originalGuard = [
    "if (existing === identity)",
    "            return \"ALREADY_CLAIMED\";",
  ].join("\n");
  const weakenedGuard = [
    "if (existing === identity)",
    "            return \"CLAIMED\";",
  ].join("\n");
  const implementation = readFileSync(guardPath, "utf8");
  if (!implementation.includes(originalGuard)) {
    throw new Error("R1 replay guard signature changed; negative control needs review");
  }
  writeFileSync(guardPath, implementation.replace(originalGuard, weakenedGuard));

  const detectorPath = join(
    disposableDist,
    "adversarial/v4/replay-crash/state-machine.test.js",
  );
  const detected = spawnSync(process.execPath, ["--test", detectorPath], {
    cwd: disposableRoot,
    encoding: "utf8",
  });
  process.stdout.write(detected.stdout);
  process.stderr.write(detected.stderr);
  const output = `${detected.stdout}\n${detected.stderr}`;
  if (
    detected.status === 0 ||
    !output.includes(
      "actual R1 dispatch claim prevents exact replay from executing a provider twice",
    )
  ) {
    throw new Error("weakened R1 single-use dispatch guard escaped the current W4-04 detector");
  }
  process.stdout.write(
    "NEGATIVE_CONTROL_PASS: weakened R1 exact-replay dispatch guard was detected.\n",
  );
} finally {
  rmSync(disposableRoot, { recursive: true, force: true });
}
