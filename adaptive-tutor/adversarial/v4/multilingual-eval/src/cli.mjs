import { pathToFileURL } from "node:url";
import { loadCorpus } from "./corpus.mjs";
import { buildReferenceCandidate, scoreCandidate } from "./scorer.mjs";

function stableUnique(values) {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export async function evaluateFoundation() {
  const corpus = await loadCorpus();
  const controlResults = corpus.cases.map((testCase) =>
    scoreCandidate(testCase, buildReferenceCandidate(testCase)));
  const controlsPassed = controlResults.every((result) => result.decision === "PASS");

  const safetyCase = corpus.cases.find((testCase) => testCase.reference.safety.mustRefuse);
  const weakenedRefusal = buildReferenceCandidate(safetyCase);
  weakenedRefusal.safety = { refused: false, reasons: [], actions: [] };
  const weakenedRefusalResult = scoreCandidate(safetyCase, weakenedRefusal);

  const boundaryCase = corpus.cases.find((testCase) =>
    testCase.attackFamilies.includes("unicode_confusable"));
  const leakedAnswer = buildReferenceCandidate(boundaryCase);
  leakedAnswer.answerBoundary.responseText = boundaryCase.reference.answerBoundary.forbiddenTokens[0]
    .split("")
    .join("\u200d");
  const leakedAnswerResult = scoreCandidate(boundaryCase, leakedAnswer);

  const mutationChecks = [
    {
      mutation: "weakened_refusal_with_other_dimensions_intact",
      expected: "FAIL_HARD_GATE",
      actual: weakenedRefusalResult.decision,
      hardFailures: weakenedRefusalResult.hardFailures,
    },
    {
      mutation: "unicode_obscured_answer_leak",
      expected: "FAIL_HARD_GATE",
      actual: leakedAnswerResult.decision,
      hardFailures: leakedAnswerResult.hardFailures,
    },
  ];
  const mutationsPassed = mutationChecks.every((check) => check.actual === check.expected);

  return {
    schemaVersion: "manuel-multilingual-foundation-report/v1",
    corpusId: corpus.corpusId,
    corpusRevision: corpus.revision,
    corpusDigest: corpus.contentDigest,
    caseCount: corpus.cases.length,
    evaluationLocales: stableUnique(corpus.cases.map((testCase) => testCase.evaluationLocale)),
    languageFamilies: stableUnique(corpus.cases.map((testCase) => testCase.languageFamily)),
    writingSystems: stableUnique(corpus.cases.flatMap((testCase) => testCase.writingSystems)),
    attackFamilies: stableUnique(corpus.cases.flatMap((testCase) => testCase.attackFamilies)),
    academicShapes: stableUnique(corpus.cases.map((testCase) => testCase.academicShape)),
    curriculumSupportAssertion: corpus.curriculum.supportAssertion,
    liveModelCalls: false,
    controlsPassed,
    mutationChecks,
    status: controlsPassed && mutationsPassed
      ? "W4_MULTILINGUAL_EVAL_READY_FOR_CONVERGENCE"
      : "W4_MULTILINGUAL_EVAL_BLOCKER_FOUND",
  };
}

async function main() {
  const mode = process.argv[2] ?? "--evaluate";
  if (!["--validate", "--evaluate"].includes(mode)) {
    throw new Error("usage: node src/cli.mjs [--validate|--evaluate]");
  }
  const report = await evaluateFoundation();
  if (mode === "--validate") {
    console.log(JSON.stringify({
      corpusId: report.corpusId,
      corpusRevision: report.corpusRevision,
      corpusDigest: report.corpusDigest,
      caseCount: report.caseCount,
      status: report.status,
    }, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (report.status !== "W4_MULTILINGUAL_EVAL_READY_FOR_CONVERGENCE") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
