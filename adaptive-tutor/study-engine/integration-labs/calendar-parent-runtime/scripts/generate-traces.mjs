import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const labDirectory = resolve(scriptsDirectory, "..");
const traceDirectory = join(labDirectory, "traces");
const tracePath = join(traceDirectory, "deterministic-traces.json");
const parentPrecedenceTracePath = join(
  traceDirectory,
  "parent-precedence-traces.json",
);

const server = await createServer({
  root: labDirectory,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const runtime = await server.ssrLoadModule("/demo-scenarios.ts");
  const first = runtime.deterministicScenarioTrace();
  const second = runtime.deterministicScenarioTrace();
  const firstJson = JSON.stringify(first);
  const secondJson = JSON.stringify(second);

  if (firstJson !== secondJson) {
    throw new Error("Repeated deterministic scenario traces did not match.");
  }

  const document = {
    artifact: "manuel-academy.calendar-parent-runtime.deterministic-traces",
    version: 1,
    generatedOn: "2026-07-29",
    scenarios: first,
  };
  const serialized = `${JSON.stringify(document, null, 2)}\n`;

  const buildParentPrecedenceTrace = () =>
    runtime.RUNTIME_SCENARIOS.filter(
      ({ id }) => id === "parent-rejects" || id === "accommodation",
    ).map(
      ({
        id,
        title,
        summary,
        metrics,
        flow,
        evidence,
        controls,
        traces,
      }) => ({
        scenario: id,
        title,
        summary,
        metrics,
        flow,
        evidence,
        controls,
        traces,
      }),
    );
  const firstParentPrecedenceTrace = buildParentPrecedenceTrace();
  const secondParentPrecedenceTrace = buildParentPrecedenceTrace();
  const firstParentJson = JSON.stringify(firstParentPrecedenceTrace);
  const secondParentJson = JSON.stringify(secondParentPrecedenceTrace);

  if (firstParentJson !== secondParentJson) {
    throw new Error("Repeated parent-precedence traces did not match.");
  }

  const parentPrecedenceDocument = {
    artifact:
      "manuel-academy.calendar-parent-runtime.parent-precedence-traces",
    version: 1,
    generatedOn: "2026-07-29",
    card5Decision: "DEC-012",
    policyId: "card5.resolve-duration-policy.v1",
    scenarios: firstParentPrecedenceTrace,
  };
  const parentPrecedenceSerialized = `${JSON.stringify(
    parentPrecedenceDocument,
    null,
    2,
  )}\n`;

  await mkdir(traceDirectory, { recursive: true });
  await writeFile(tracePath, serialized, "utf8");
  await writeFile(
    parentPrecedenceTracePath,
    parentPrecedenceSerialized,
    "utf8",
  );

  const digest = createHash("sha256")
    .update(serialized)
    .digest("hex")
    .toUpperCase();
  const parentPrecedenceDigest = createHash("sha256")
    .update(parentPrecedenceSerialized)
    .digest("hex")
    .toUpperCase();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: "PASS",
        traces: [
          { tracePath, sha256: digest },
          {
            tracePath: parentPrecedenceTracePath,
            sha256: parentPrecedenceDigest,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await server.close();
}
