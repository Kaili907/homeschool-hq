import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { TutorRequest } from "../../core/v2/contracts/index.js";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  TutorProviderPort,
} from "../../core/v2/providers/ports/index.js";
import {
  authorizeReviewedProviderContext,
  createInMemoryReviewedTutorContentAuthority,
  orchestrateTutorV2Bridge,
  reviewedTutorContentDigest,
  type ReviewedTutorContentApprovalRequest,
  type ReviewedTutorContentAuthorityPort,
  type TutorV2BridgeResult,
} from "../../study-engine/bridges/tutor-v2/index.js";
import { minimizeProviderContext } from "../../study-engine/tutor-v2/privacy/index.js";
import {
  ITEM_DIGEST,
  defaultReviewedApprovals,
  harness,
  invocationFixture,
  proposalFixture,
  successResult,
} from "./fixtures.js";

const APPROVAL_DECISION_STRUCTURAL_VALIDATION = "HARD_NON_COMPENSABLE";

function requestOf(input: { request: unknown }): TutorRequest {
  return input.request as TutorRequest;
}

function exactApprovedDecision(): unknown {
  return { status: "approved", approvalRef: "approval:structural-gate" };
}

function exactRejectedDecision(): unknown {
  return { status: "rejected", code: "CONTENT_NOT_APPROVED" };
}

function authorityReturning(
  decision: () => unknown | Promise<unknown>,
): ReviewedTutorContentAuthorityPort {
  return { review: decision };
}

function authorityTargeting(
  purpose: ReviewedTutorContentApprovalRequest["purpose"],
  decision: () => unknown,
  onTarget?: () => void,
): ReviewedTutorContentAuthorityPort {
  return {
    review(request) {
      if (request.purpose !== purpose) return exactApprovedDecision();
      onTarget?.();
      return decision();
    },
  };
}

function accessorApprovedDecision(options: {
  readonly status?: "getter" | "setter";
  readonly approvalRef?: "getter" | "setter";
  readonly onAccess?: () => void;
  readonly throwOnAccess?: boolean;
}): object {
  const candidate: Record<string, unknown> = {};
  const descriptor = (value: string, mode: "getter" | "setter" | undefined): PropertyDescriptor => {
    if (mode === "getter") {
      return {
        enumerable: true,
        configurable: true,
        get() {
          options.onAccess?.();
          if (options.throwOnAccess === true) throw new Error("approval accessor must not run");
          return value;
        },
      };
    }
    if (mode === "setter") {
      return {
        enumerable: true,
        configurable: true,
        set() { options.onAccess?.(); },
      };
    }
    return { enumerable: true, configurable: true, writable: true, value };
  };
  Object.defineProperty(candidate, "status", descriptor("approved", options.status));
  Object.defineProperty(
    candidate,
    "approvalRef",
    descriptor("approval:accessor-attack", options.approvalRef),
  );
  return candidate;
}

function accessorRejectedDecision(field: "status" | "code"): object {
  const candidate: Record<string, unknown> = {
    status: "rejected",
    code: "CONTENT_NOT_APPROVED",
  };
  Object.defineProperty(candidate, field, {
    enumerable: true,
    configurable: true,
    get() {
      return field === "status" ? "rejected" : "CONTENT_NOT_APPROVED";
    },
  });
  return candidate;
}

function customPrototypeApproval(): object {
  return Object.assign(Object.create({ authorityKind: "custom" }) as object, {
    status: "approved",
    approvalRef: "approval:custom-prototype",
  });
}

function hiddenExtraApproval(): object {
  const candidate = exactApprovedDecision() as object;
  Object.defineProperty(candidate, "hidden", {
    value: "authority-hidden-marker",
    enumerable: false,
  });
  return candidate;
}

function symbolKeyApproval(): object {
  return Object.assign(exactApprovedDecision() as object, {
    [Symbol("authority-hidden-marker")]: true,
  });
}

async function firstProviderInputDecision(authority: ReviewedTutorContentAuthorityPort) {
  const invocation = invocationFixture();
  const request = requestOf(invocation);
  const minimized = minimizeProviderContext({
    studyAuthorityContext: request.studyAuthorityContext,
    disclosurePolicy: invocation.disclosurePolicy,
  });
  assert.equal(minimized.status, "accepted");
  if (minimized.status !== "accepted") throw new Error("fixture minimization failed");
  return authorizeReviewedProviderContext(minimized.value, invocation.memoryAccess, authority);
}

async function assertAuthorityFailure(decision: () => unknown): Promise<void> {
  assert.deepEqual(
    await firstProviderInputDecision(authorityReturning(decision)),
    {
      status: "rejected",
      code: "APPROVAL_AUTHORITY_FAILURE",
      purpose: "provider-input-learner-safe-item",
      sourceRef: "item:fraction-parts",
      contentDigest: ITEM_DIGEST,
      actionKind: null,
    },
  );
}

function assertFallback(
  result: TutorV2BridgeResult,
  reason: Extract<TutorV2BridgeResult, { status: "fallback" }>["reasonCode"] = "POLICY_REJECTION",
): asserts result is Extract<TutorV2BridgeResult, { status: "fallback" }> {
  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  assert.equal(result.reasonCode, reason);
  assert.equal(result.studyMutationAllowed, false);
  assert.equal(result.fallback?.action.kind, "return-to-lesson");
}

function setProposalText(content: string) {
  const proposal = proposalFixture("explain");
  if (proposal.action.kind !== "explain") throw new Error("explain fixture changed shape");
  proposal.action.content = content;
  return proposal;
}

function assertMinimizedPersistence(
  result: TutorV2BridgeResult,
  state: { readonly memory: { read(input: unknown): unknown }; readonly ledger: { entries: Map<string, string> }; readonly input: { memoryAccess: unknown } },
  forbidden: readonly string[],
): void {
  const serialized = [
    JSON.stringify(result),
    JSON.stringify(state.memory.read(state.input.memoryAccess)),
    JSON.stringify([...state.ledger.entries]),
  ].join("\n");
  for (const value of forbidden) assert.equal(serialized.includes(value), false, value);
}

test("B4 root invariant: raw decision is parsed before normalization or property access", () => {
  assert.equal(APPROVAL_DECISION_STRUCTURAL_VALIDATION, "HARD_NON_COMPENSABLE");
  const source = readFileSync("study-engine/bridges/tutor-v2/reviewed-content.ts", "utf8");
  assert.match(source, /const rawDecision = await authority\.review\(structuredClone\(request\)\);\s*const decision = parseRawApprovalDecision\(rawDecision\)/s);
  assert.doesNotMatch(source, /structuredClone\(rawDecision\)|rawDecision\.(?:status|approvalRef|code)/);
  assert.match(source, /Object\.getPrototypeOf\(candidate\) !== Object\.prototype/);
  assert.match(source, /Reflect\.ownKeys\(candidate\)/);
  assert.match(source, /Object\.getOwnPropertyDescriptors\(candidate\)/);
  assert.match(source, /Object\.freeze\(\{ status: "approved", approvalRef: value \}\)/);
});

for (const [name, factory] of [
  ["status getter", () => accessorApprovedDecision({ status: "getter" })],
  ["approvalRef getter", () => accessorApprovedDecision({ approvalRef: "getter" })],
  ["status and approvalRef getters", () => accessorApprovedDecision({ status: "getter", approvalRef: "getter" })],
  ["status setter", () => accessorApprovedDecision({ status: "setter" })],
  ["approvalRef setter", () => accessorApprovedDecision({ approvalRef: "setter" })],
  ["rejected status accessor", () => accessorRejectedDecision("status")],
  ["rejected code accessor", () => accessorRejectedDecision("code")],
] as const) {
  test(`B4 accessor attack: ${name} fails closed`, async () => {
    await assertAuthorityFailure(factory);
  });
}

test("B4 accessor attack: getter side-effect count remains zero", async () => {
  let getterCalls = 0;
  await assertAuthorityFailure(() => accessorApprovedDecision({
    status: "getter",
    onAccess: () => { getterCalls += 1; },
  }));
  assert.equal(getterCalls, 0);
});

test("B4 accessor attack: throwing getter fails closed without invocation", async () => {
  let getterCalls = 0;
  await assertAuthorityFailure(() => accessorApprovedDecision({
    approvalRef: "getter",
    onAccess: () => { getterCalls += 1; },
    throwOnAccess: true,
  }));
  assert.equal(getterCalls, 0);
});

test("B4 accessor attack: decision fields are never read through a property get trap", async () => {
  const readKeys: string[] = [];
  const decision = new Proxy(
    { status: "approved", approvalRef: "approval:proxy-data-descriptors" },
    {
      get(target, key, receiver) {
        readKeys.push(String(key));
        return Reflect.get(target, key, receiver);
      },
    },
  );
  assert.deepEqual(
    await firstProviderInputDecision(authorityReturning(() => decision)),
    { status: "accepted" },
  );
  // Validation reads descriptors, never properties. Only the language-level
  // thenable probe performed by `await` may touch the raw authority result.
  assert.deepEqual([...new Set(readKeys)], ["then"]);
  for (const field of ["status", "approvalRef", "code"]) {
    assert.equal(readKeys.includes(field), false, field);
  }
});

test("B4 hostile thenable: a resolved malformed decision still fails closed", async () => {
  let thenCalls = 0;
  await assertAuthorityFailure(() => ({
    then(resolve: (value: unknown) => void) {
      thenCalls += 1;
      resolve(accessorApprovedDecision({ status: "getter" }));
    },
  }));
  assert.equal(thenCalls, 1);
});

test("B4 hostile thenable: a throwing then fails closed", async () => {
  let thenCalls = 0;
  await assertAuthorityFailure(() => ({
    then() {
      thenCalls += 1;
      throw new Error("thenable trap");
    },
  }));
  assert.equal(thenCalls, 1);
});

for (const [name, factory] of [
  ["custom prototype", customPrototypeApproval],
  ["class instance", () => new (class ApprovalDecision {
    readonly status = "approved";
    readonly approvalRef = "approval:class-instance";
  })()],
  ["null prototype", () => Object.assign(Object.create(null) as object, {
    status: "approved",
    approvalRef: "approval:null-prototype",
  })],
  ["inherited status and approvalRef", () => Object.create({
    status: "approved",
    approvalRef: "approval:inherited",
  }) as object],
  ["inherited rejected code", () => Object.create({
    status: "rejected",
    code: "CONTENT_NOT_APPROVED",
  }) as object],
  ["built-in object masquerading as decision", () => Object.assign(new Date(0), {
    status: "approved",
    approvalRef: "approval:date-masquerade",
  })],
] as const) {
  test(`B4 prototype attack: ${name} fails closed`, async () => {
    await assertAuthorityFailure(factory);
  });
}

for (const [name, factory] of [
  ["non-enumerable extra property", hiddenExtraApproval],
  ["Symbol key", symbolKeyApproval],
  ["hidden approval metadata", () => {
    const candidate = exactApprovedDecision() as object;
    Object.defineProperty(candidate, "approvalMetadata", { value: { source: "untrusted" } });
    return candidate;
  }],
  ["hidden rejection metadata", () => {
    const candidate = exactRejectedDecision() as object;
    Object.defineProperty(candidate, "rejectionMetadata", { value: "untrusted" });
    return candidate;
  }],
  ["visible extra own string key", () => ({
    status: "approved",
    approvalRef: "approval:extra-string",
    extra: true,
  })],
] as const) {
  test(`B4 hidden-key attack: ${name} fails closed`, async () => {
    await assertAuthorityFailure(factory);
  });
}

for (const [name, hostile] of [
  ["getPrototypeOf", new Proxy({}, { getPrototypeOf() { throw new Error("prototype trap"); } })],
  ["ownKeys", new Proxy({}, { ownKeys() { throw new Error("ownKeys trap"); } })],
  ["getOwnPropertyDescriptor", new Proxy(
    { status: "approved", approvalRef: "approval:descriptor-trap" },
    { getOwnPropertyDescriptor() { throw new Error("descriptor trap"); } },
  )],
] as const) {
  test(`B4 hostile reflection: ${name} exception fails closed`, async () => {
    await assertAuthorityFailure(() => hostile);
  });
}

for (const [name, malformed] of [
  ["undefined", undefined],
  ["null", null],
  ["boolean", true],
  ["number", 1],
  ["string", "approved"],
  ["array", ["approved"]],
  ["Date", new Date(0)],
  ["Map", new Map([["status", "approved"]])],
  ["Set", new Set(["approved"])],
  ["function", () => exactApprovedDecision()],
] as const) {
  test(`B4 malformed primitive or container: ${name} fails closed`, async () => {
    await assertAuthorityFailure(() => malformed);
  });
}

for (const [name, malformed] of [
  ["wrong status", { status: "allow", approvalRef: "approval:wrong-status" }],
  ["invalid approvalRef", { status: "approved", approvalRef: "" }],
  ["rejected wrong code", { status: "rejected", code: "ALLOW" }],
  ["approved with code", { status: "approved", approvalRef: "approval:extra-code", code: "CONTENT_NOT_APPROVED" }],
  ["rejected with approvalRef", { status: "rejected", code: "CONTENT_NOT_APPROVED", approvalRef: "approval:extra-ref" }],
] as const) {
  test(`B4 malformed decision shape: ${name} fails closed`, async () => {
    await assertAuthorityFailure(() => malformed);
  });
}

for (const [name, authority] of [
  ["synchronous approval", authorityReturning(exactApprovedDecision)],
  ["asynchronous approval", authorityReturning(async () => exactApprovedDecision())],
  ["frozen approval", authorityReturning(() => Object.freeze({
    status: "approved",
    approvalRef: "approval:frozen",
  }))],
] as const) {
  test(`B4 legitimate decision regression: ${name} passes`, async () => {
    assert.deepEqual(await firstProviderInputDecision(authority), { status: "accepted" });
  });
}

for (const [name, authority] of [
  ["synchronous rejection", authorityReturning(exactRejectedDecision)],
  ["asynchronous rejection", authorityReturning(async () => exactRejectedDecision())],
  ["frozen rejection", authorityReturning(() => Object.freeze({
    status: "rejected",
    code: "CONTENT_NOT_APPROVED",
  }))],
] as const) {
  test(`B4 legitimate decision regression: ${name} rejects normally`, async () => {
    const result = await firstProviderInputDecision(authority);
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") assert.equal(result.code, "CONTENT_NOT_APPROVED");
  });
}

const inputAttacks = [
  ["getter-backed", () => accessorApprovedDecision({ status: "getter" })],
  ["custom-prototype", customPrototypeApproval],
  ["hidden-extra-key", hiddenExtraApproval],
  ["Symbol-key", symbolKeyApproval],
] as const;

for (const [name, factory] of inputAttacks) {
  test(`B4 W1-10R4 historical provider-input learner-safe ${name} approval prevents execution`, async () => {
    let attackCalls = 0;
    const h = harness(undefined, {
      reviewedContent: authorityTargeting(
        "provider-input-learner-safe-item",
        factory,
        () => { attackCalls += 1; },
      ),
    });
    const novel = `Unapproved learner-safe item for ${name}.`;
    const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
    assert.notEqual(item, null);
    if (item !== null) item.learnerSafeContent = novel;
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(attackCalls, 1);
    assert.equal(h.provider.callCount, 0);
    assertMinimizedPersistence(result, h, [novel]);
  });

  test(`B4 provider-input grounding ${name} approval prevents execution`, async () => {
    let attackCalls = 0;
    const h = harness(undefined, {
      reviewedContent: authorityTargeting(
        "provider-input-grounding-content",
        factory,
        () => { attackCalls += 1; },
      ),
    });
    const novel = `Unapproved grounding content for ${name}.`;
    const grounding = requestOf(h.input).studyAuthorityContext.instructionContext.groundingReferences[0]!;
    grounding.learnerSafeContent = novel;
    grounding.contentDigest = await reviewedTutorContentDigest(novel);
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(attackCalls, 1);
    assert.equal(h.provider.callCount, 0);
    assertMinimizedPersistence(result, h, [novel]);
  });
}

for (const [name, factory] of inputAttacks) {
  test(`B4 W1-10R4 historical provider-output ${name} approval withholds prose`, async () => {
    let attackCalls = 0;
    const novel = `Novel provider prose for ${name}; never learner-facing.`;
    const h = harness([successResult(setProposalText(novel))], {
      reviewedContent: authorityTargeting(
        "learner-facing-action-content",
        factory,
        () => { attackCalls += 1; },
      ),
    });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result);
    assert.equal(h.provider.callCount, 1);
    assert.equal(attackCalls, 1);
    assertMinimizedPersistence(result, h, [novel]);
  });
}

test("B4 composition: malformed approval cannot bypass active-assessment anti-answer", async () => {
  const novel = "Use a semantically disguised final response.";
  const h = harness([successResult(setProposalText(novel))], {
    reviewedContent: authorityTargeting(
      "learner-facing-action-content",
      () => accessorApprovedDecision({ status: "getter" }),
    ),
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result);
  assert.equal(h.provider.callCount, 1);
  assertMinimizedPersistence(result, h, [novel]);
});

test("B4 composition: valid privacy approval cannot bypass active-assessment anti-answer", async () => {
  const h = harness();
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(h.provider.callCount, 1);
});

test("B4 composition: malformed approval and provider mutation cannot alter Study authority", async () => {
  const h = harness(undefined, {
    reviewedContent: authorityTargeting(
      "learner-facing-action-content",
      () => accessorApprovedDecision({ approvalRef: "getter" }),
    ),
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  const trustedSnapshot = structuredClone(requestOf(h.input).studyAuthorityContext);
  class MutatingProvider implements TutorProviderPort {
    callCount = 0;
    async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
      this.callCount += 1;
      try {
        request.context.instruction.assessmentPhase = "instruction-or-practice";
      } catch {
        // A frozen provider projection is the expected B1 boundary.
      }
      return successResult(setProposalText("Mutation-assisted novel provider prose.")) as ProviderExecutionResult;
    }
  }
  const provider = new MutatingProvider();
  Object.assign(h.dependencies, { provider });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies));
  assert.equal(provider.callCount, 1);
  assert.deepEqual(requestOf(h.input).studyAuthorityContext, trustedSnapshot);
});

test("B4 composition: malformed approval cannot rescue a cross-child approval replay", async () => {
  let rescueAttempts = 0;
  const siblingAuthority = createInMemoryReviewedTutorContentAuthority(
    defaultReviewedApprovals().map((approval) => ({
      ...approval,
      scope: { ...approval.scope, learnerScopeRef: "learner-scope:sibling-b" },
    })),
  );
  const h = harness(undefined, {
    reviewedContent: {
      review(request) {
        const decision = siblingAuthority.review(request) as { readonly status: string };
        if (decision.status === "approved") return decision;
        rescueAttempts += 1;
        return accessorApprovedDecision({ status: "getter", approvalRef: "getter" });
      },
    },
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result);
  assert.ok(rescueAttempts > 0);
  assert.equal(h.provider.callCount, 0);
});

test("B4 composition: valid privacy approval cannot override a Study safety hold", async () => {
  const h = harness();
  Object.assign(h.dependencies, {
    safety: {
      consume: () => ({
        status: "rejected",
        code: "SAFETY_CLEARANCE_REJECTED",
        adultReviewRequired: true,
      }),
    },
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "safety-stop");
  if (result.status !== "safety-stop") return;
  assert.equal(result.reasonCode, "SAFETY_CLEARANCE_REJECTED");
  assert.equal(result.providerCallCount, 0);
  assert.equal(result.studyMutationAllowed, false);
  assert.equal(h.provider.callCount, 0);
});

test("B4 composition: valid privacy approval cannot override Study allowedActions", async () => {
  const h = harness();
  requestOf(h.input).studyAuthorityContext.instructionContext.allowedActions = ["return-to-lesson"];
  h.input.invocationPermission.allowedActions = ["return-to-lesson"];
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "UNSUPPORTED_ACTION");
  assert.equal(h.provider.callCount, 1);
});

test("B4 failure-data minimization: malformed authority secrets are never persisted", async () => {
  const secret = "credential:raw-malformed-authority-secret";
  const providerProse = "Novel provider text that must not enter failure evidence.";
  const candidate = accessorApprovedDecision({ status: "getter", throwOnAccess: true });
  Object.defineProperty(candidate, "authoritySecret", { value: secret, enumerable: false });
  const h = harness([successResult(setProposalText(providerProse))], {
    reviewedContent: authorityTargeting("learner-facing-action-content", () => candidate),
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result);
  assertMinimizedPersistence(result, h, [secret, providerProse, "rawDecision", "authoritySecret"]);
});
