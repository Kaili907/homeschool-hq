import { decideCertification } from "./certification.js";
import { runDeterministicFixtures } from "./runner.js";
import {
  DETERMINISTIC_FIXTURES,
  MOCK_PROVENANCE,
} from "../fixtures/certification-fixtures.js";

const { run, adapter, grader } = await runDeterministicFixtures({
  runId: "deterministic-commercial-fixtures-r1",
  harnessRevision: "tutor-v2-eval-harness:v3-composed-r1",
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
  graderCalls: grader.invocations.length,
  containmentPassed: decision.containmentPassed,
  commercialClassification: decision.classification,
  reasonCodes: decision.reasonCodes,
  productionAuthorized: decision.productionAuthorized,
}, null, 2)}\n`);
