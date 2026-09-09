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
  orchestrateTutorV2Bridge,
  type TutorV2BridgeResult,
} from "../../study-engine/bridges/tutor-v2/index.js";
import {
  OTHER_DIGEST,
  harness,
  proposalFixture,
  successResult,
} from "./fixtures.js";

class FunctionalProvider implements TutorProviderPort {
  constructor(
    private readonly behavior: (
      request: ProviderExecutionRequest,
    ) => unknown | Promise<unknown>,
  ) {}

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    return await this.behavior(request) as ProviderExecutionResult;
  }
}

function requestOf(input: { request: unknown }): TutorRequest {
  return input.request as TutorRequest;
}

function useProvider(
  behavior: (request: ProviderExecutionRequest) => unknown | Promise<unknown>,
) {
  const h = harness();
  Object.assign(h.dependencies, { provider: new FunctionalProvider(behavior) });
  return h;
}

function assertFallback(result: TutorV2BridgeResult, reason: string): void {
  assert.equal(result.status, "fallback");
  if (result.status === "fallback") {
    assert.equal(result.reasonCode, reason);
    assert.equal(result.studyMutationAllowed, false);
  }
}

function ignoreMutationFailure(mutation: () => void): void {
  try {
    mutation();
  } catch {
    // A malicious provider may catch the deep-freeze exception and continue.
  }
}

function recursiveKeys(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(recursiveKeys);
  const record = value as Record<string, unknown>;
  return Object.keys(record).flatMap((key) => [key, ...recursiveKeys(record[key])]);
}

test("W1-09R2 adversarial 01: provider port structurally excludes StudyAuthorityContext", async () => {
  const source = readFileSync("core/v2/providers/ports/contracts.ts", "utf8");
  assert.match(source, /execute\(request: ProviderExecutionRequest\): Promise<ProviderExecutionResult>/);
  assert.doesNotMatch(source, /execute\(request: (?:TutorRequest|StudyAuthorityContext)/);

  let received: ProviderExecutionRequest | null = null;
  const h = useProvider((request) => {
    received = request;
    return successResult(proposalFixture());
  });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.notEqual(received, null);
  const envelope = received as ProviderExecutionRequest | null;
  assert.ok(envelope);
  assert.equal(Object.hasOwn(envelope, "studyAuthorityContext"), false);
});

test("W1-09R2 adversarial 02: recursive provider input contains no Study authority or credentials", async () => {
  let received: ProviderExecutionRequest | null = null;
  const h = useProvider((request) => {
    received = request;
    return successResult(proposalFixture());
  });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.ok(received);
  const keys = recursiveKeys(received).map((key) => key.toLowerCase());
  for (const forbidden of [
    "studyauthoritycontext",
    "authorizationref",
    "authorizationrevision",
    "invocationbindingref",
    "safetyclearanceref",
    "answerpolicyref",
    "authoritypolicyref",
    "assessmentpolicyref",
    "guardianauthority",
    "guardian",
    "credential",
    "credentials",
    "password",
    "token",
    "secret",
    "apikey",
  ]) assert.equal(keys.includes(forbidden), false, forbidden);
});

test("W1-09R2 adversarial 03: local allowed-actions replacement cannot authorize explain", async () => {
  const h = useProvider((request) => {
    const local = structuredClone(request);
    local.context.instruction.allowedActions = ["explain"];
    return successResult(proposalFixture("explain"));
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.allowedActions = ["return-to-lesson"];
  h.input.invocationPermission.allowedActions = ["return-to-lesson"];
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "UNSUPPORTED_ACTION");
  assert.deepEqual(
    requestOf(h.input).studyAuthorityContext.instructionContext.allowedActions,
    ["return-to-lesson"],
  );
});

test("W1-09R2 adversarial 04: in-place allowed-actions mutation is detached", async () => {
  const h = useProvider((request) => {
    ignoreMutationFailure(() => request.context.instruction.allowedActions.push("explain"));
    return successResult(proposalFixture("explain"));
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.allowedActions = ["return-to-lesson"];
  h.input.invocationPermission.allowedActions = ["return-to-lesson"];
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "UNSUPPORTED_ACTION");
  assert.deepEqual(
    requestOf(h.input).studyAuthorityContext.instructionContext.allowedActions,
    ["return-to-lesson"],
  );
});

test("W1-09R2 adversarial 05: grounding replacement cannot invent authority", async () => {
  const h = useProvider((request) => {
    const local = structuredClone(request);
    local.context.instruction.groundingReferences = [{
      groundingRef: "grounding:invented-r2",
      kind: "curriculum-excerpt",
      contentDigest: OTHER_DIGEST,
      learnerSafeContent: "Invented provider grounding.",
    }];
    const proposal = proposalFixture();
    proposal.action = {
      kind: "explain",
      content: "Use invented provider grounding.",
      groundingRefs: ["grounding:invented-r2"],
    };
    proposal.groundingClaims = [{
      groundingRef: "grounding:invented-r2",
      contentDigest: OTHER_DIGEST,
      claimKind: "direct-support",
    }];
    return successResult(proposal);
  });
  assertFallback(
    await orchestrateTutorV2Bridge(h.input, h.dependencies),
    "INSUFFICIENT_GROUNDED_CONTEXT",
  );
});

test("W1-09R2 adversarial 06: nested grounding mutation leaves trusted Study grounding intact", async () => {
  const h = useProvider((request) => {
    ignoreMutationFailure(() => {
      const grounding = request.context.instruction.groundingReferences[0];
      if (grounding) {
        grounding.groundingRef = "grounding:invented-r2";
        grounding.contentDigest = OTHER_DIGEST;
      }
    });
    const proposal = proposalFixture();
    proposal.action = {
      kind: "explain",
      content: "Use invented nested grounding.",
      groundingRefs: ["grounding:invented-r2"],
    };
    proposal.groundingClaims = [{
      groundingRef: "grounding:invented-r2",
      contentDigest: OTHER_DIGEST,
      claimKind: "direct-support",
    }];
    return successResult(proposal);
  });
  assertFallback(
    await orchestrateTutorV2Bridge(h.input, h.dependencies),
    "INSUFFICIENT_GROUNDED_CONTEXT",
  );
  assert.equal(
    requestOf(h.input).studyAuthorityContext.instructionContext.groundingReferences[0]?.groundingRef,
    "grounding:fraction-model",
  );
});

test("W1-09R2 adversarial 07: local phase downgrade cannot replace authoritative Study phase", async () => {
  const h = useProvider((request) => {
    const local = structuredClone(request);
    local.context.instruction.assessmentPhase = "instruction-or-practice";
    const proposal = proposalFixture();
    Object.assign(proposal.action, { content: "The correct answer is four." });
    return successResult(proposal);
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(
    requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase,
    "active-graded-or-mastery-check",
  );
});

test("W1-09R2 adversarial 08: exact direct-answer phase-downgrade exploit is never accepted", async () => {
  const h = useProvider((request) => {
    const local = structuredClone(request);
    local.context.instruction.assessmentPhase = "instruction-or-practice";
    const proposal = proposalFixture();
    Object.assign(proposal.action, { content: "The correct answer is 4." });
    return successResult(proposal);
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase =
    "active-graded-or-mastery-check";
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "POLICY_REJECTION");
  assert.doesNotMatch(JSON.stringify(result), /The correct answer is 4/);
});

test("W1-09R2 adversarial 09: local hint-ceiling raise cannot replace Study ceiling", async () => {
  const h = useProvider((request) => {
    const local = structuredClone(request);
    local.context.instruction.hintCeiling = "guided-step";
    const proposal = proposalFixture("hint");
    proposal.hintLevel = "guided-step";
    if (proposal.action.kind === "hint") proposal.action.hintLevel = "guided-step";
    return successResult(proposal);
  });
  requestOf(h.input).studyAuthorityContext.instructionContext.hintCeiling = "none";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(requestOf(h.input).studyAuthorityContext.instructionContext.hintCeiling, "none");
});

test("W1-09R2 adversarial 10: authority-relevant Study request remains deeply equal", async () => {
  const h = useProvider((request) => {
    ignoreMutationFailure(() => request.context.instruction.allowedActions.splice(0, 9, "explain"));
    ignoreMutationFailure(() => request.context.instruction.groundingReferences.splice(0));
    ignoreMutationFailure(() => {
      request.context.instruction.assessmentPhase = "instruction-or-practice";
      request.context.instruction.hintCeiling = "guided-step";
      request.context.instruction.safetyConstraints.disallowedContentCodes.splice(0);
      Object.assign(request, { studyAuthorityContext: { authorizationRef: "provider:forged" } });
    });
    return successResult(proposalFixture());
  });
  const before = structuredClone(requestOf(h.input).studyAuthorityContext);
  await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.deepEqual(requestOf(h.input).studyAuthorityContext, before);
});

test("W1-09R2 adversarial 11: forged response interaction binding fails", async () => {
  const h = useProvider(() => {
    const proposal = proposalFixture();
    proposal.interactionRef = "interaction:provider-forged-r2";
    return successResult(proposal);
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
});

test("W1-09R2 adversarial 12: provider mutation throw becomes safe static fallback", async () => {
  const h = useProvider((request) => {
    request.context.instruction.allowedActions.push("explain");
    return successResult(proposalFixture());
  });
  const before = structuredClone(h.input);
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "PROVIDER_UNAVAILABLE");
  if (result.status === "fallback") {
    assert.equal(result.providerDetail?.reason, "TRANSPORT_EXCEPTION");
    assert.equal(result.fallback?.action.kind, "return-to-lesson");
  }
  assert.deepEqual(h.input, before);
});

test("W1-09R2 adversarial 13: legitimate minimized provider remains functional", async () => {
  let received: ProviderExecutionRequest | null = null;
  const h = useProvider((request) => {
    received = request;
    return successResult(proposalFixture("ask-check"));
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "accepted");
  if (result.status === "accepted") assert.equal(result.proposal.action.kind, "ask-check");
  assert.ok(received);
  assert.deepEqual(Object.keys(received), [
    "contractVersion",
    "actionSchemaVersion",
    "compatibilityId",
    "actionCompatibilityId",
    "envelope",
    "requestRef",
    "context",
    "shortTermState",
    "budgetRoutingContext",
  ]);
});
