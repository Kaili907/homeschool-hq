import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { TSchema } from "../../core/schema/typebox.js";
import { Value } from "../../core/schema/value.js";
import {
  ProviderContextSchema,
  TutorActionProposalSchema,
  TutorRequestSchema,
  validateExact,
} from "../../core/v2/contracts/index.js";
import { ProviderExecutionRequestSchema } from "../../core/v2/providers/ports/contracts.js";
import {
  MinimizedProviderContextSchema,
  minimizeProviderContext,
} from "../../study-engine/tutor-v2/privacy/index.js";
import {
  invocationFixture,
  proposalFixture,
  providerExecutionRequestFixture,
  requestFixture,
} from "./fixtures.js";

function generated(file: string): TSchema {
  return JSON.parse(readFileSync(`json-schema/v2/${file}`, "utf8")) as TSchema;
}

function assertParity(runtime: TSchema, file: string, value: unknown, accepted: boolean): void {
  assert.equal(validateExact(runtime, value).status === "accepted", accepted, "runtime result");
  assert.equal(Value.Check(generated(file), value), accepted, "generated schema result");
}

test("valid request passes runtime and generated JSON schema", () => {
  assertParity(TutorRequestSchema, "tutor-request.schema.json", requestFixture(), true);
});

test("valid action proposal passes runtime and generated JSON schema", () => {
  assertParity(TutorActionProposalSchema, "tutor-action-proposal.schema.json", proposalFixture(), true);
});

test("unknown request fields fail closed in both validators", () => {
  assertParity(TutorRequestSchema, "tutor-request.schema.json", { ...requestFixture(), unexpected: true }, false);
});

test("contract version mismatch fails in both validators", () => {
  assertParity(TutorRequestSchema, "tutor-request.schema.json", { ...requestFixture(), contractVersion: "2.0.1" }, false);
});

test("unknown Tutor action fails in both validators", () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  proposal.action = { kind: "change-grade", officialGrade: 12 };
  assertParity(TutorActionProposalSchema, "tutor-action-proposal.schema.json", proposal, false);
});

test("authority mutation contamination fails in both validators", () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, { declareMastery: true });
  assertParity(TutorActionProposalSchema, "tutor-action-proposal.schema.json", proposal, false);
});

test("answer-authority contamination fails in both validators", () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, { correctAnswer: "4" });
  assertParity(TutorActionProposalSchema, "tutor-action-proposal.schema.json", proposal, false);
});

test("raw transcript contamination fails in both request validators", () => {
  const request = structuredClone(requestFixture()) as unknown as Record<string, unknown>;
  request.rawTranscript = [{ role: "learner", content: "private" }];
  assertParity(TutorRequestSchema, "tutor-request.schema.json", request, false);
});

test("minimized provider projection round-trips through its generated schema", () => {
  const invocation = invocationFixture();
  const request = requestFixture();
  const result = minimizeProviderContext({
    studyAuthorityContext: request.studyAuthorityContext,
    disclosurePolicy: invocation.disclosurePolicy,
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assertParity(MinimizedProviderContextSchema, "minimized-provider-context.schema.json", result.value, true);
});

test("provider context generated schema remains closed", () => {
  const request = requestFixture();
  const instruction = request.studyAuthorityContext.instructionContext;
  const context = {
    ...requestFixture(),
    contextKind: "provider",
    interactionRef: request.studyAuthorityContext.interactionRef,
    instruction: {
      subjectRef: instruction.subjectRef,
      conceptRef: instruction.conceptRef,
      learnerStageRef: instruction.learnerStageRef,
      learnerSafeItem: instruction.learnerSafeItem,
      assessmentPhase: instruction.assessmentPhase,
      approvedEvidenceSummary: instruction.approvedEvidenceSummary,
      allowedActions: instruction.allowedActions,
      hintCeiling: instruction.hintCeiling,
      safetyConstraints: instruction.safetyConstraints,
      groundingReferences: instruction.groundingReferences,
    },
  } as Record<string, unknown>;
  for (const key of ["envelope", "requestRef", "requestIntent", "studyAuthorityContext", "budgetRoutingContext", "shortTermState"]) delete context[key];
  assertParity(ProviderContextSchema, "provider-context.schema.json", context, true);
  context.rawProviderResponse = "private";
  assertParity(ProviderContextSchema, "provider-context.schema.json", context, false);
});

test("provider execution request passes runtime and generated JSON schema", () => {
  assertParity(
    ProviderExecutionRequestSchema,
    "provider-execution-request.schema.json",
    providerExecutionRequestFixture(),
    true,
  );
});

test("Study authority contamination fails in both provider-request validators", () => {
  const request = {
    ...providerExecutionRequestFixture(),
    studyAuthorityContext: requestFixture().studyAuthorityContext,
  };
  assertParity(
    ProviderExecutionRequestSchema,
    "provider-execution-request.schema.json",
    request,
    false,
  );
});

test("unknown answer-authority fields fail in both provider-request validators", () => {
  const request = structuredClone(providerExecutionRequestFixture()) as unknown as Record<string, unknown>;
  const context = request.context as Record<string, unknown>;
  const instruction = context.instruction as Record<string, unknown>;
  instruction.answerPolicyRef = "policy:forged-answer-authority";
  assertParity(
    ProviderExecutionRequestSchema,
    "provider-execution-request.schema.json",
    request,
    false,
  );
});
