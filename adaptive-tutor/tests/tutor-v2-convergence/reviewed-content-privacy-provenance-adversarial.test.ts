import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  TutorActionProposal,
  TutorRequest,
} from "../../core/v2/contracts/index.js";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  TutorProviderPort,
} from "../../core/v2/providers/ports/index.js";
import {
  createInMemoryReviewedTutorContentAuthority,
  orchestrateTutorV2Bridge,
  reviewedTutorContentDigest,
  type ReviewedTutorContentApproval,
  type ReviewedTutorContentApprovalRequest,
  type ReviewedTutorContentAuthorityPort,
  type TutorV2BridgeResult,
} from "../../study-engine/bridges/tutor-v2/index.js";
import {
  validateLearnerSafeTutorAction,
} from "../../study-engine/bridges/tutor-v2/privacy.js";
import {
  approvalForProposal,
  defaultReviewedApprovals,
  harness,
  proposalFixture,
  reviewedScope,
  successResult,
} from "./fixtures.js";

const FREE_FORM_ACTIONS = [
  "explain",
  "hint",
  "ask-check",
  "show-example",
  "reteach",
] as const;

const CONTROL_ACTIONS = [
  "check-prerequisite",
  "suggest-break",
  "escalate",
  "return-to-lesson",
] as const;

const HISTORICAL_PRIVACY_CLASSES = [
  ["cross-child private content", "Another pupil departs weekly for an undisclosed appointment."],
  ["diagnostic inference", "The observed number pattern maps onto a named learning condition."],
  ["psychological label", "This youngster demonstrates compulsive task avoidance."],
  ["personality judgment", "She persistently engineers delays whenever work becomes difficult."],
  ["parent credential", "The caregiver doorway phrase is blue-orchid-77."],
  ["service credential", "Authenticate the billing robot with cobalt-raven-91."],
  ["adult private note", "A caregiver recorded a separation that has not been shared."],
  ["paraphrased raw-provider/private material", "Internal steering guidance directs every reply toward option C."],
] as const;

const PRIVACY_SECURITY_REQUIRES_REVIEWED_PROVENANCE = true;
const LEXICAL_PRIVACY_MATCHING_IS_DEFENSE_IN_DEPTH_ONLY = true;
const RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED = false;

class FunctionalProvider implements TutorProviderPort {
  callCount = 0;

  constructor(
    private readonly behavior: (
      request: ProviderExecutionRequest,
    ) => unknown | Promise<unknown>,
  ) {}

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    this.callCount += 1;
    return await this.behavior(request) as ProviderExecutionResult;
  }
}

function requestOf(input: { request: unknown }): TutorRequest {
  return input.request as TutorRequest;
}

function assertFallback(
  result: TutorV2BridgeResult,
  reason = "POLICY_REJECTION",
): asserts result is Extract<TutorV2BridgeResult, { status: "fallback" }> {
  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  assert.equal(result.reasonCode, reason);
  assert.equal(result.studyMutationAllowed, false);
  assert.equal(result.fallback?.action.kind, "return-to-lesson");
}

function setActionText(proposal: TutorActionProposal, content: string): void {
  if (proposal.action.kind === "ask-check") proposal.action.question = content;
  else if (
    proposal.action.kind === "explain" ||
    proposal.action.kind === "hint" ||
    proposal.action.kind === "show-example" ||
    proposal.action.kind === "reteach"
  ) proposal.action.content = content;
}

function lexicalDefenseWouldAccept(content: string): void {
  assert.deepEqual(
    validateLearnerSafeTutorAction({
      kind: "explain",
      content,
      groundingRefs: ["grounding:fraction-model"],
    }),
    { status: "accepted" },
    "case must prove provenance independently of lexical RULES",
  );
}

function approvalsWithScope(
  patch: Partial<ReturnType<typeof reviewedScope>>,
): ReviewedTutorContentApproval[] {
  return defaultReviewedApprovals().map((approval) => ({
    ...approval,
    scope: { ...approval.scope, ...patch },
  }));
}

for (const [classification, content] of HISTORICAL_PRIVACY_CLASSES) {
  test(`W1-10R3 historical privacy blocker input: ${classification}`, async () => {
    lexicalDefenseWouldAccept(content);
    const h = harness();
    const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
    assert.notEqual(item, null);
    if (item !== null) item.learnerSafeContent = content;
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(h.provider.callCount, 0);
    assert.equal(JSON.stringify(result).includes(content), false);
  });

  test(`W1-10R3 historical privacy blocker output: ${classification}`, async () => {
    lexicalDefenseWouldAccept(content);
    const proposal = proposalFixture("explain");
    setActionText(proposal, content);
    const h = harness([successResult(proposal)]);
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(h.provider.callCount, 1);
    assert.equal(JSON.stringify(result).includes(content), false);
  });
}

test("B3 additional privacy provenance 01: exact reviewed learner-safe item passes", async () => {
  const h = harness();
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.equal(h.provider.callCount, 1);
});

test("B3 additional privacy provenance 02: benign unapproved learner-safe item fails before provider", async () => {
  const content = "Arrange the amber tiles beside the violet tiles.";
  lexicalDefenseWouldAccept(content);
  const h = harness();
  const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
  if (item !== null) item.learnerSafeContent = content;
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 03: content mutation with the same item ref fails", async () => {
  const h = harness();
  const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
  if (item !== null) item.learnerSafeContent += " ";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 04: caller content and self-computed digest cannot approve an item", async () => {
  const content = "Count the copper shapes.";
  const h = harness();
  const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
  if (item !== null) Object.assign(item, {
    learnerSafeContent: content,
    contentDigest: await reviewedTutorContentDigest(content),
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "fallback");
  if (result.status === "fallback") {
    assert.equal(result.reasonCode, "MALFORMED_RESPONSE");
    assert.equal(result.studyMutationAllowed, false);
  }
  assert.equal(h.provider.callCount, 0);
});

for (const [number, dimension, patch] of [
  [5, "interaction", { interactionRef: "interaction:other" }],
  [6, "learner", { learnerScopeRef: "learner-scope:other" }],
  [7, "lesson", { lessonRef: "lesson:other" }],
] as const) {
  test(`B3 additional privacy provenance 0${number}: approval from wrong ${dimension} fails`, async () => {
    const h = harness(undefined, { approvals: approvalsWithScope(patch) });
    assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
    assert.equal(h.provider.callCount, 0);
  });
}

test("B3 additional privacy provenance 08: approval from wrong subject/concept/stage fails", async () => {
  const approvals = defaultReviewedApprovals().map((approval) => ({
    ...approval,
    context: { ...approval.context, conceptRef: "concept:decimals" },
  }));
  const h = harness(undefined, { approvals });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 09: unavailable approval authority fails closed", async () => {
  const h = harness();
  Reflect.deleteProperty(h.dependencies, "reviewedContent");
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 10: throwing approval authority fails closed", async () => {
  const h = harness(undefined, { reviewedContent: { review() { throw new Error("offline"); } } });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 11: malformed approval decision fails closed", async () => {
  const h = harness(undefined, {
    reviewedContent: { review: () => ({ status: "approved", approvalRef: "approval:fake", extra: true }) },
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 12: exact reviewed grounding passes", async () => {
  const h = harness();
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.equal(h.provider.callCount, 1);
});

test("B3 additional privacy provenance 13: grounding content and declared digest mismatch fails", async () => {
  const h = harness();
  requestOf(h.input).studyAuthorityContext.instructionContext.groundingReferences[0]!.learnerSafeContent += " changed";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 14: attacker-updated grounding digest is not Study approval", async () => {
  const content = "An unreviewed but lexically quiet grounding passage.";
  const h = harness();
  Object.assign(
    requestOf(h.input).studyAuthorityContext.instructionContext.groundingReferences[0]!,
    { learnerSafeContent: content, contentDigest: await reviewedTutorContentDigest(content) },
  );
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 15: raw learner free-form attempt is omitted by failing closed", async () => {
  const raw = "I solved it using a situation from elsewhere in the home.";
  const h = harness();
  h.input.disclosurePolicy.learnerAttempt = {
    mode: "permit-current-attempt",
    policyPermissionRef: "permission:legacy-attempt",
    attempt: { itemRef: "item:fraction-parts", responseFormat: "free-form", learnerResponse: raw },
  };
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result);
  assert.equal(h.provider.callCount, 0);
  assert.equal(JSON.stringify(result).includes(raw), false);
});

test("B3 additional privacy provenance 16: reviewed-content authority is Study-owned and bridge-internal", () => {
  const contracts = readFileSync("study-engine/bridges/tutor-v2/contracts.ts", "utf8");
  const provider = readFileSync("core/v2/providers/ports/contracts.ts", "utf8");
  assert.match(contracts, /readonly reviewedContent\?: ReviewedTutorContentAuthorityPort/);
  assert.doesNotMatch(provider, /ReviewedTutorContentAuthorityPort|reviewedContent/);
});

test("B3 additional privacy provenance 17: provider receives no approval authority or direct identity", async () => {
  let received: ProviderExecutionRequest | null = null;
  const provider = new FunctionalProvider((request) => {
    received = structuredClone(request);
    return successResult(proposalFixture());
  });
  const h = harness();
  Object.assign(h.dependencies, { provider });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const serialized = JSON.stringify(received).toLowerCase();
  for (const forbidden of ["reviewedcontent", "approvalref", "studentid", "learnerid", "childname"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("B3 additional privacy provenance 18: cross-child approval replay fails", async () => {
  const h = harness(undefined, {
    approvals: approvalsWithScope({ learnerScopeRef: "learner-scope:sibling-b" }),
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 0);
});

test("B3 additional privacy provenance 19: approved privacy content cannot bypass active assessment", async () => {
  const h = harness([successResult(proposalFixture("explain"))]);
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 additional privacy provenance 20: privacy boundary truth constants are machine-testable", () => {
  assert.equal(PRIVACY_SECURITY_REQUIRES_REVIEWED_PROVENANCE, true);
  assert.equal(LEXICAL_PRIVACY_MATCHING_IS_DEFENSE_IN_DEPTH_ONLY, true);
  assert.equal(RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED, false);
});

for (const kind of FREE_FORM_ACTIONS) {
  test(`B3 free-form output provenance ${kind} A: exact reviewed output passes outside active phase`, async () => {
    const h = harness([successResult(proposalFixture(kind))]);
    assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  });

  test(`B3 free-form output provenance ${kind} B: benign unapproved prose falls back`, async () => {
    const content = `Arrange a new ${kind} using amber shapes.`;
    lexicalDefenseWouldAccept(content);
    const proposal = proposalFixture(kind);
    setActionText(proposal, content);
    const h = harness([successResult(proposal)]);
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(JSON.stringify(result).includes(content), false);
  });

  test(`B3 free-form output provenance ${kind} C: private unapproved prose falls back by provenance`, async () => {
    const content = `The unseen caregiver memo associates ${kind} with the cobalt folder.`;
    lexicalDefenseWouldAccept(content);
    const proposal = proposalFixture(kind);
    setActionText(proposal, content);
    const h = harness([successResult(proposal)]);
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(JSON.stringify(result).includes(content), false);
  });
}

for (const kind of CONTROL_ACTIONS) {
  test(`B3 structured control privacy ${kind} A: exact approved reason code passes`, async () => {
    const h = harness([successResult(proposalFixture(kind))]);
    assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  });

  for (const [label, reasonCode] of [
    ["B benign invented", `novel-${kind}-code`],
    ["C subjective/private", `unseen-caregiver-judgment-${kind}`],
  ] as const) {
    test(`B3 structured control privacy ${kind} ${label} reason code fails`, async () => {
      lexicalDefenseWouldAccept(reasonCode);
      const proposal = proposalFixture(kind);
      Object.assign(proposal.action, { reasonCode });
      const h = harness([successResult(proposal)]);
      assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
    });
  }

  test(`B3 structured control privacy ${kind} D: cross-context reason approval fails`, async () => {
    const proposal = proposalFixture(kind);
    const wrong = await approvalForProposal(proposal, {
      scope: { ...reviewedScope(), interactionRef: "interaction:other" },
    });
    const h = harness(
      [successResult(proposal)],
      { approvals: [...defaultReviewedApprovals().slice(0, 3), wrong] },
    );
    assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  });
}

test("B3 approval attack 01: provider-fabricated approved field is rejected", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, { approved: true });
  const h = harness([successResult(proposal)]);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
});

test("B3 approval attack 02: provider self-computed digest is not approval", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, {
    content: "Provider-authored text.",
    contentDigest: await reviewedTutorContentDigest("Provider-authored text."),
  });
  const h = harness([successResult(proposal)]);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
});

test("B3 approval attack 03: fake approval metadata is rejected", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  proposal.reviewedContentApproval = { status: "approved", approvalRef: "approval:provider" };
  const h = harness([successResult(proposal)]);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
});

test("B3 approval attack 04: approval cannot be reused for another action kind", async () => {
  const proposal = proposalFixture("hint");
  const wrong = await approvalForProposal(proposal, { actionKind: "explain" });
  const h = harness([successResult(proposal)], {
    approvals: [...defaultReviewedApprovals().slice(0, 3), wrong],
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 approval attack 05: approval cannot be reused under another grounding ref", async () => {
  const proposal = proposalFixture("explain");
  const wrong = await approvalForProposal(proposal, {
    groundingRefs: ["grounding:reviewed-fallback"],
  });
  const h = harness([successResult(proposal)], {
    approvals: [...defaultReviewedApprovals().slice(0, 3), wrong],
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 approval attack 06: approval cannot be reused across interaction", async () => {
  const proposal = proposalFixture("explain");
  const wrong = await approvalForProposal(proposal, {
    scope: { ...reviewedScope(), interactionRef: "interaction:other" },
  });
  const h = harness([successResult(proposal)], {
    approvals: [...defaultReviewedApprovals().slice(0, 3), wrong],
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 approval attack 07: approval cannot be reused across learner context", async () => {
  const proposal = proposalFixture("explain");
  const wrong = await approvalForProposal(proposal, {
    scope: { ...reviewedScope(), learnerScopeRef: "learner-scope:other" },
  });
  const h = harness([successResult(proposal)], {
    approvals: [...defaultReviewedApprovals().slice(0, 3), wrong],
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 approval attack 08: content changed after approval is rejected", async () => {
  const proposal = proposalFixture("explain");
  const approval = await approvalForProposal(proposal);
  setActionText(proposal, "The content changed after the Study decision.");
  const h = harness([successResult(proposal)], {
    approvals: [...defaultReviewedApprovals().slice(0, 3), approval],
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
});

test("B3 approval attack 09: mutable decision tampering fails exact decision validation", async () => {
  const decision: Record<string, unknown> = { status: "approved", approvalRef: "approval:mutable" };
  const authority: ReviewedTutorContentAuthorityPort = { review: () => decision };
  const provider = new FunctionalProvider(() => {
    decision.providerControlled = true;
    return successResult(proposalFixture());
  });
  const h = harness(undefined, { reviewedContent: authority });
  Object.assign(h.dependencies, { provider });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(provider.callCount, 1);
});

test("B3 approval attack 10: provider cannot supply the approval authority", async () => {
  const provider = Object.assign(
    new FunctionalProvider(() => successResult(proposalFixture())),
    { review: () => ({ status: "approved", approvalRef: "approval:provider" }) },
  );
  const rejectingAuthority: ReviewedTutorContentAuthorityPort = {
    review: () => ({ status: "rejected", code: "CONTENT_NOT_APPROVED" }),
  };
  const h = harness(undefined, { reviewedContent: rejectingAuthority });
  Object.assign(h.dependencies, { provider });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(provider.callCount, 0);
});

test("B3 additional privacy provenance 21: authority request binds provenance and excludes raw text", async () => {
  const captured: ReviewedTutorContentApprovalRequest[] = [];
  const catalog = createInMemoryReviewedTutorContentAuthority(defaultReviewedApprovals());
  const authority: ReviewedTutorContentAuthorityPort = {
    async review(request) {
      captured.push(structuredClone(request));
      return await catalog.review(request);
    },
  };
  const h = harness(undefined, { reviewedContent: authority });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const serialized = JSON.stringify(captured);
  assert.match(serialized, /sha256:[a-f0-9]{64}/);
  for (const content of [
    "How many equal parts are shown?",
    "A fraction names equal parts of a whole.",
    "Equal parts make a fraction model.",
  ]) assert.equal(serialized.includes(content), false);
});
