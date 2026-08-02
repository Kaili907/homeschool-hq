import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vitest = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const generationTest = path.resolve(
  projectRoot,
  "../../tests/student-runtime/unit/traceGeneration.agent.test.ts",
);
const result = spawnSync(
  process.execPath,
  [
    vitest,
    "run",
    "--configLoader",
    "runner",
    generationTest,
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, STUDENT_RUNTIME_WRITE_TRACES: "1" },
    encoding: "utf8",
  },
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.status !== 0) process.exit(result.status ?? 1);
