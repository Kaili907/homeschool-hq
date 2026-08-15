import { decideCertification } from "./certification.ts";
import { runDeterministicFixtures } from "./runner.ts";
import {
  DETERMINISTIC_FIXTURES,
  MOCK_PROVENANCE,
} from "../fixtures/certification-fixtures.ts";

const { run, adapter } = await runDeterministicFixtures({
  runId: "deterministic-commercial-fixtures-r1",
  harnessRevision: "tutor-v2-eval-harness:v3-r1",
  provenance: MOCK_PROVENANCE,
  fixtures: DETERMINISTIC_FIXTURES,
});
const decision = decideCertification(run);

process.stdout.write(`${JSON.stringify({
  runId: run.runId,
  mode: run.mode,
  cases: run.cases.length,
  attempts: run.attempts.length,
  mockProviderCalls: adapter.requests.length,
  containmentPassed: decision.containmentPassed,
  commercialClassification: decision.classification,
  reasonCodes: decision.reasonCodes,
  productionAuthorized: decision.productionAuthorized,
}, null, 2)}\n`);
