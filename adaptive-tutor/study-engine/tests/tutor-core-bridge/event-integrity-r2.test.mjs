import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const studyEngineRoot = path.resolve(here, "../..");
const bridgeRoot = path.join(studyEngineRoot, "bridges", "tutor-core");
const sourceRoot = process.env.SESSION6_SOURCE_ROOT;
if (!sourceRoot) {
  throw new Error(
    "Set SESSION6_SOURCE_ROOT to the verified extraction root before running the suite.",
  );
}

const importFile = (filePath) => import(pathToFileURL(filePath).href);
const bridge = await importFile(path.join(bridgeRoot, "src", "index.ts"));
const { orchestrateStudyCoreBridge } = await importFile(
  path.join(bridgeRoot, "src", "orchestrator.ts"),
);
const tutorRoot = path.join(
  sourceRoot,
  "tutor-core",
  "manuel-academy-adaptive-tutor-core-v0.2",
  "adaptive-tutor",
);
const studyContractsRoot = path.join(
  sourceRoot,
  "study-contracts",
  "adaptive-tutor",
  "study-engine",
);
const core = await importFile(path.join(tutorRoot, "dist", "core", "index.js"));
const examples = await importFile(
  path.join(tutorRoot, "dist", "examples", "index.js"),
);
const studySchemas = await importFile(
  path.join(studyContractsRoot, "schemas", "index.ts"),
);
const studyContracts = await importFile(
  path.join(studyContractsRoot, "contracts", "index.ts"),
);

const NOW = "2026-07-29T16:00:00.000Z";
const mathProgram = examples.mathTutorProgram;
const tutorResponse = mathProgram.teachingSequences[0].turns[0];
const study = Object.freeze({
  studentId: "student-opaque-r2",
  sessionId: "session-opaque-r2",
  lessonId: "lesson-opaque-r2",
  segmentId: "segment-opaque-r2",
  subjectId: "math",
  skillId: "study-skill-r2",
  taskType: "guided-practice",
  gradeBand: "middle-6-8",
  learnerLocalDate: "2026-07-29",
  householdTimeZone: "America/New_York",
});
const skillRegistry = bridge.createGovernedIdRegistry([
  { studyId: study.skillId, tutorId: mathProgram.targetSkillId },
]);
const tutorCore = Object.freeze({
  validateTutorResponse(value) {
    return core.validateWithSchema(core.TutorResponseSchema, value);
  },
  validateTutorProgram(value) {
    return core.validateWithSchema(core.TutorProgramSchema, value);
  },
  validateParentTeacherReview(value) {
    return core.validateWithSchema(core.ParentTeacherReviewSchema, value);
  },
  validateSafetyDecision(value) {
    return core.validateWithSchema(core.SafetyDecisionSchema, value);
  },
  validateSkillGraph(graph) {
    return core.validateSkillGraph(graph);
  },
  getMissingPrerequisites(graph, skillId, demonstratedSkillIds) {
    return core.getMissingPrerequisites(
      graph,
      skillId,
      new Set(demonstratedSkillIds),
    );
  },
});
const canonicalStudyRegistry = bridge.createStudySchemaRegistryPort({
  inspectContractVersion: studyContracts.inspectContractVersion,
  learningEvidenceSchema: studySchemas.learningEvidenceSchema,
});

function classifierFor(outcome = "clear") {
  return {
    classifierVersion: `r2-test-${outcome}-v1`,
    classify(request) {
      return {
        classificationVersion: 1,
        classifierVersion: `r2-test-${outcome}-v1`,
        outcome,
        categories:
          outcome === "urgent" || outcome === "uncertain"
            ? ["self-harm-or-immediate-danger"]
            : [],
        reasonCodes: [`reviewed-${outcome}`],
      };
    },
  };
}

class AtomicMemoryLedger {
  constructor(order = []) {
    this.entries = new Map();
    this.order = order;
    this.calls = 0;
  }

  async appendAcceptedEvent(sessionId, eventId, eventVersion, idempotencyKey) {
    this.calls += 1;
    this.order.push("ledger");
    const key = `${sessionId}:${eventId}:${eventVersion}`;
    const existing = this.entries.get(key);
    if (existing === idempotencyKey) return { status: "duplicate-ignored" };
    if (existing !== undefined) return { status: "idempotency-collision" };
    this.entries.set(key, idempotencyKey);
    return { status: "appended" };
  }
}

function orchestrationInput(overrides = {}) {
  return {
    transientLearnerText: "My answer is four.",
    eventId: "tutor-event-r2-001",
    occurredAt: NOW,
    tutorInteractionId: "tutor-interaction-r2-001",
    study,
    recommendationId: "recommendation-r2-001",
    submitToTutorCore() {
      return { tutorResponse, tutorProgram: mathProgram };
    },
    ...overrides,
  };
}

function dependencies(eventLedger, overrides = {}) {
  return {
    safety: {
      mode: "production",
      classifier: classifierFor("clear"),
    },
    tutorCore,
    skillRegistry,
    studySchemas: canonicalStudyRegistry,
    eventLedger,
    ...overrides,
  };
}

test("supported orchestration claims the event ledger before Study projection and outbox proposals", async () => {
  const order = [];
  const ledger = new AtomicMemoryLedger(order);
  let callbackCount = 0;
  const trackingRegistry = {
    schemaVersion: canonicalStudyRegistry.schemaVersion,
    inspectVersion(value) {
      order.push("projection");
      return canonicalStudyRegistry.inspectVersion(value);
    },
    validateLearningEvidence(value) {
      return canonicalStudyRegistry.validateLearningEvidence(value);
    },
  };
  const result = await orchestrateStudyCoreBridge(
    orchestrationInput({
      submitToTutorCore(text) {
        callbackCount += 1;
        order.push("core-callback");
        assert.equal(text, "My answer is four.");
        return Promise.resolve({ tutorResponse, tutorProgram: mathProgram });
      },
    }),
    dependencies(ledger, { studySchemas: trackingRegistry }),
  );

  assert.equal(result.status, "accepted");
  assert.equal(callbackCount, 1);
  assert.equal(result.callbackInvocations, 1);
  assert.deepEqual(order.slice(0, 3), [
    "core-callback",
    "ledger",
    "projection",
  ]);
  assert.equal(result.outboxProposals.length, 3);
  assert.match(
    result.eventLedgerIdempotencyKey,
    /^study-core-bridge:event:v1:[0-9a-f]{64}$/,
  );
  assert.equal(JSON.stringify(result).includes("My answer is four."), false);
});

test("identical replay is ignored before projection and produces no duplicate outbox proposals", async () => {
  const ledger = new AtomicMemoryLedger();
  let callbackCount = 0;
  const input = orchestrationInput({
    submitToTutorCore() {
      callbackCount += 1;
      return { tutorResponse, tutorProgram: mathProgram };
    },
  });
  const first = await orchestrateStudyCoreBridge(input, dependencies(ledger));
  assert.equal(first.status, "accepted");
  assert.equal(first.outboxProposals.length, 3);

  const projectionMustNotRun = {
    schemaVersion: 1,
    inspectVersion() {
      throw new Error("projection ran before duplicate validation");
    },
    validateLearningEvidence() {
      throw new Error("projection ran before duplicate validation");
    },
  };
  const replay = await orchestrateStudyCoreBridge(
    input,
    dependencies(ledger, { studySchemas: projectionMustNotRun }),
  );
  assert.deepEqual(replay, {
    status: "duplicate-ignored",
    eventId: input.eventId,
    reasonCode: "duplicate-event",
    outboxProposals: [],
    callbackInvocations: 1,
  });
  assert.equal(callbackCount, 2);
  assert.equal(ledger.calls, 2);
});

test("same event ID with a modified valid Tutor result quarantines as a collision before projection", async () => {
  const ledger = new AtomicMemoryLedger();
  const first = await orchestrateStudyCoreBridge(
    orchestrationInput(),
    dependencies(ledger),
  );
  assert.equal(first.status, "accepted");

  const changedResponse = {
    ...tutorResponse,
    id: "modified-valid-tutor-response-r2",
  };
  const projectionMustNotRun = {
    schemaVersion: 1,
    inspectVersion() {
      throw new Error("projection ran before collision validation");
    },
    validateLearningEvidence() {
      throw new Error("projection ran before collision validation");
    },
  };
  const collision = await orchestrateStudyCoreBridge(
    orchestrationInput({
      submitToTutorCore() {
        return {
          tutorResponse: changedResponse,
          tutorProgram: mathProgram,
        };
      },
    }),
    dependencies(ledger, { studySchemas: projectionMustNotRun }),
  );
  assert.equal(collision.status, "quarantined");
  assert.equal(collision.quarantine.reasonCode, "event-id-collision");
  assert.deepEqual(collision.outboxProposals, []);
  assert.equal(ledger.calls, 2);
});

test("malformed ledger acknowledgments fail closed before projection or outbox", async () => {
  for (const [index, malformed] of [
    null,
    { status: "unexpected" },
    { status: "appended", extra: true },
  ].entries()) {
    const projectionMustNotRun = {
      schemaVersion: 1,
      inspectVersion() {
        throw new Error("projection ran after malformed ledger response");
      },
      validateLearningEvidence() {
        throw new Error("projection ran after malformed ledger response");
      },
    };
    const result = await orchestrateStudyCoreBridge(
      orchestrationInput({
        eventId: `tutor-event-r2-malformed-${index}`,
      }),
      dependencies(
        {
          async appendAcceptedEvent() {
            return malformed;
          },
        },
        { studySchemas: projectionMustNotRun },
      ),
    );
    assert.equal(result.status, "quarantined");
    assert.equal(result.quarantine.reasonCode, "malformed-event");
    assert.deepEqual(result.outboxProposals, []);
  }
});

test("urgent, uncertain, and invalid classifications stop before Core, ledger, projection, or outbox", async () => {
  for (const [outcome, expectedStatus] of [
    ["urgent", "stop-for-urgent-adult-review"],
    ["uncertain", "stop-for-uncertain-adult-review"],
    ["invalid", "stop-invalid-input"],
  ]) {
    const ledger = new AtomicMemoryLedger();
    let callbackCount = 0;
    const result = await orchestrateStudyCoreBridge(
      orchestrationInput({
        eventId: `tutor-event-r2-${outcome}`,
        recommendationId: `recommendation-r2-${outcome}`,
        submitToTutorCore() {
          callbackCount += 1;
          throw new Error("Core must not receive stopped input.");
        },
      }),
      dependencies(ledger, {
        safety: {
          mode: "production",
          classifier: classifierFor(outcome),
        },
        studySchemas: {
          schemaVersion: 1,
          inspectVersion() {
            throw new Error("projection must not run");
          },
          validateLearningEvidence() {
            throw new Error("projection must not run");
          },
        },
      }),
    );
    assert.equal(result.status, expectedStatus, outcome);
    assert.equal(callbackCount, 0, outcome);
    assert.equal(ledger.calls, 0, outcome);
    assert.equal(Object.hasOwn(result, "outboxProposals"), false, outcome);
    assert.equal(JSON.stringify(result).includes("My answer is four."), false);
  }
});

test("one-time permit rejects replay, copies, and mismatched context", () => {
  const context = {
    eventId: "permit-event-r2-001",
    sessionId: study.sessionId,
    occurredAt: NOW,
  };
  const first = bridge.evaluatePreCoreUrgentSafety(
    "This is an ordinary math answer.",
    context,
    { mode: "production", classifier: classifierFor("clear") },
  );
  assert.equal(first.status, "continue-to-tutor-core");
  assert.deepEqual(
    bridge.consumePreCoreProcessingPermit(first.permit, context),
    { status: "consumed" },
  );
  assert.deepEqual(
    bridge.consumePreCoreProcessingPermit(first.permit, context),
    { status: "rejected", reason: "missing-or-replayed" },
  );
  assert.deepEqual(
    bridge.consumePreCoreProcessingPermit({ ...first.permit }, context),
    { status: "rejected", reason: "missing-or-replayed" },
  );

  const second = bridge.evaluatePreCoreUrgentSafety(
    "Another ordinary math answer.",
    context,
    { mode: "production", classifier: classifierFor("clear") },
  );
  assert.equal(second.status, "continue-to-tutor-core");
  assert.deepEqual(
    bridge.consumePreCoreProcessingPermit(second.permit, {
      ...context,
      eventId: "permit-event-r2-mismatch",
    }),
    { status: "rejected", reason: "context-mismatch" },
  );
  assert.deepEqual(
    bridge.consumePreCoreProcessingPermit(second.permit, context),
    { status: "rejected", reason: "missing-or-replayed" },
  );

  const presentedContext = {
    eventId: "permit-event-r2-presented",
    sessionId: study.sessionId,
    occurredAt: NOW,
  };
  const presented = bridge.evaluatePreCoreUrgentSafety(
    "Ordinary answer for adapter presentation.",
    presentedContext,
    { mode: "production", classifier: classifierFor("clear") },
  );
  assert.equal(presented.status, "continue-to-tutor-core");
  const adapterInput = {
    eventId: presentedContext.eventId,
    occurredAt: presentedContext.occurredAt,
    tutorInteractionId: "permit-adapter-presentation-r2",
    study,
    preCorePermit: presented.permit,
    tutorResponse,
    tutorProgram: mathProgram,
  };
  const rejectedPresentation = bridge.adaptFrozenTutorCoreResult(
    { ...adapterInput, unexpected: true },
    tutorCore,
    skillRegistry,
  );
  assert.equal(rejectedPresentation.status, "quarantined");
  assert.equal(rejectedPresentation.quarantine.reasonCode, "unknown-field");
  const repairedRetry = bridge.adaptFrozenTutorCoreResult(
    adapterInput,
    tutorCore,
    skillRegistry,
  );
  assert.equal(repairedRetry.status, "quarantined");
  assert.equal(repairedRetry.quarantine.reasonCode, "invalid-authority-claim");
});
