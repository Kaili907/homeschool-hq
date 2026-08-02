import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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

const importFile = (filePath) => import(pathToFileURL(filePath).href);
const bridge = await importFile(path.join(bridgeRoot, "src", "index.ts"));
const verifier = await importFile(
  path.join(bridgeRoot, "scripts", "verify-sources.mjs"),
);
const core = await importFile(path.join(tutorRoot, "dist", "core", "index.js"));
const examples = await importFile(
  path.join(tutorRoot, "dist", "examples", "index.js"),
);
const narration = await importFile(
  path.join(tutorRoot, "dist", "examples", "narration.fixture.js"),
);
const studySchemas = await importFile(
  path.join(studyContractsRoot, "schemas", "index.ts"),
);
const studyContracts = await importFile(
  path.join(studyContractsRoot, "contracts", "index.ts"),
);

const NOW = "2026-07-29T16:00:00.000Z";
const LOCAL_DATE = "2026-07-29";
const mathProgram = examples.mathTutorProgram;
const tutorResponse = mathProgram.teachingSequences[0].turns[0];
const studyContext = Object.freeze({
  studentId: "student-opaque-001",
  sessionId: "session-opaque-001",
  lessonId: "lesson-opaque-001",
  segmentId: "segment-opaque-001",
  subjectId: "math",
  skillId: "study-skill-001",
  taskType: "guided-practice",
  gradeBand: "middle-6-8",
  learnerLocalDate: LOCAL_DATE,
  householdTimeZone: "America/New_York",
});
const skillRegistry = bridge.createGovernedIdRegistry([
  {
    studyId: studyContext.skillId,
    tutorId: mathProgram.targetSkillId,
  },
]);

const frozenCorePort = Object.freeze({
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
    const demonstrated = new Set(demonstratedSkillIds);
    return core.getMissingPrerequisites(graph, skillId, demonstrated);
  },
});

const canonicalStudyRegistry = bridge.createStudySchemaRegistryPort({
  inspectContractVersion: studyContracts.inspectContractVersion,
  learningEvidenceSchema: studySchemas.learningEvidenceSchema,
});

function adapt(overrides = {}) {
  const input = {
    eventId: "tutor-event-001",
    occurredAt: NOW,
    tutorInteractionId: "tutor-interaction-001",
    study: studyContext,
    tutorResponse,
    tutorProgram: mathProgram,
    ...overrides,
  };
  if (!Object.hasOwn(input, "preCorePermit")) {
    const gateway = bridge.evaluatePreCoreUrgentSafety(
      "My answer is four.",
      {
        eventId: input.eventId,
        sessionId: input.study.sessionId,
        occurredAt: input.occurredAt,
      },
    );
    assert.equal(gateway.status, "continue-to-tutor-core");
    input.preCorePermit = gateway.permit;
  }
  return bridge.adaptFrozenTutorCoreResult(
    input,
    frozenCorePort,
    skillRegistry,
  );
}

function acceptedProjection() {
  const adapted = adapt();
  assert.equal(adapted.status, "accepted");
  assert.equal(bridge.isVerifiedTutorEvent(adapted.value), true);
  const projected = bridge.projectTutorEventToStudy(adapted.value, {
    receivedAt: NOW,
    schemaRegistry: canonicalStudyRegistry,
  });
  assert.equal(projected.status, "accepted");
  return { adapted, projected: projected.value };
}

function checkpointFixture() {
  return {
    contract: "study-core-bridge.recovery-checkpoint.v1",
    contractVersion: 1,
    checkpointId: "checkpoint-001",
    revision: 7,
    createdAt: "2026-07-29T15:00:00.000Z",
    updatedAt: "2026-07-29T15:59:00.000Z",
    sessionId: studyContext.sessionId,
    lessonId: studyContext.lessonId,
    segmentId: studyContext.segmentId,
    safeInstructionalCursor: {
      tutorPhase: "guided-practice",
      cycleNumber: 2,
      currentItemId: "math-guided-one",
      currentItemIndex: 0,
      teachingTurnIndex: 1,
    },
    completedSegmentIds: ["segment-opaque-000"],
    perSegmentActiveTime: [
      { segmentId: "segment-opaque-000", activeSeconds: 600 },
      { segmentId: studyContext.segmentId, activeSeconds: 125 },
    ],
    pausedSeconds: 25,
    breakSeconds: 60,
    protectedDraftRef: "draft:response-opaque-001",
    protectedTutorStateRef: "tutor-state:interaction-opaque-001",
    lastAcceptedEventId: "tutor-event-001",
    eventVersion: 1,
    tutorInteractionRef: "tutor-interaction-001",
    technicalInterruption: {
      status: "recovering",
      interruptionId: "interruption-001",
      category: "application-restart",
      startedAt: "2026-07-29T15:58:00.000Z",
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  };
}

function checkpointContext(checkpoint = checkpointFixture()) {
  return {
    expectedSessionId: checkpoint.sessionId,
    expectedLessonId: checkpoint.lessonId,
    expectedSegmentId: checkpoint.segmentId,
    expectedTutorInteractionRef: checkpoint.tutorInteractionRef,
    expectedSafeInstructionalCursor: checkpoint.safeInstructionalCursor,
    knownSegmentIds: ["segment-opaque-000", checkpoint.segmentId],
    expectedRevision: checkpoint.revision,
    expectedLastAcceptedEventId: checkpoint.lastAcceptedEventId,
    expectedProtectedTutorStateRef: checkpoint.protectedTutorStateRef,
    now: NOW,
  };
}

test("source verifier pins all four checksums and validates every frozen Core manifest entry", async () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(verifier.EXPECTED_ARTIFACTS).map(([kind, value]) => [
        kind,
        value.sha256,
      ]),
    ),
    {
      "tutor-core":
        "38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276",
      "study-contracts":
        "79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41",
      "study-engine":
        "979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770",
      reconciliation:
        "39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41",
    },
  );
  const result = await verifier.verifyTutorManifest(tutorRoot);
  assert.equal(result.result, "PASS");
  assert.equal(result.declaredFileCount, 248);
  assert.equal(result.verifiedFileCount, 248);
  assert.equal(result.missingOrMismatchedCount, 0);
  assert.equal(result.unlistedCount, 0);
});

test("all configured authoritative archives pass exact SHA-256 verification", async (t) => {
  const configured = {
    "tutor-core": process.env.SESSION6_TUTOR_ZIP,
    "study-contracts": process.env.SESSION6_STUDY_CONTRACTS_ZIP,
    "study-engine": process.env.SESSION6_STUDY_ENGINE_ZIP,
    reconciliation: process.env.SESSION6_RECONCILIATION_ZIP,
  };
  if (Object.values(configured).some((value) => !value)) {
    t.skip("set the four SESSION6_*_ZIP variables for archive verification");
    return;
  }
  for (const [kind, filePath] of Object.entries(configured)) {
    const result = await verifier.verifyArtifact(kind, filePath);
    assert.equal(result.fileNameAccepted, true, kind);
    assert.equal(result.checksumResult, "PASS", kind);
    assert.equal(result.calculatedSha256, result.expectedSha256, kind);
  }
});

test("actual frozen Core schemas and runtime graph functions grant a branded event", () => {
  assert.equal(
    core.validateWithSchema(core.TutorProgramSchema, mathProgram).ok,
    true,
  );
  assert.equal(
    core.validateWithSchema(core.TutorResponseSchema, tutorResponse).ok,
    true,
  );
  assert.equal(core.validateSkillGraph(mathProgram.skillGraph).valid, true);
  const adapted = adapt();
  assert.equal(adapted.status, "accepted");
  assert.equal(bridge.isVerifiedTutorEvent(adapted.value), true);
  assert.deepEqual(adapted.value.provenance, {
    tutorResponseSchemaValidated: true,
    tutorProgramSchemaValidated: true,
    parentTeacherReviewSchemaValidated: false,
    safetyDecisionSchemaValidated: false,
    prerequisiteGraphRuntimeValidated: true,
    prerequisiteResultEnvelopeValidated: false,
    packageVersionPinned: "0.2.0",
  });
  assert.equal(Object.isFrozen(adapted.value), true);
  assert.equal(Object.isFrozen(adapted.value.event), true);
  assert.equal(Object.isFrozen(adapted.value.event.tutor), true);
  assert.equal(adapted.value.learnerMedia.transcriptIncluded, false);
  assert.ok(adapted.value.learnerMedia.boardCommands.length >= 1);
  assert.equal(bridge.isVerifiedTutorEvent({ ...adapted.value }), false);

  const callerConstructedPrerequisite = adapt({
    prerequisiteEvidence: {
      sourceAuthority: "tutor-core",
      sourceEventId: "tutor-event-001",
      demonstratedTutorSkillIds: mathProgram.skillGraph.nodes.map(
        (node) => node.id,
      ),
      evidenceIds: ["tutor-evidence-001"],
    },
  });
  assert.equal(callerConstructedPrerequisite.status, "quarantined");
  assert.equal(callerConstructedPrerequisite.quarantine.reasonCode, "unknown-field");
  assert.equal(
    adapted.value.event.tutor.prerequisite.status,
    "insufficient-evidence",
  );
  assert.equal(adapted.value.event.tutor.prerequisite.nextAction, "collect-more-evidence");
});

test("malformed Core contracts and unsupported package/event versions quarantine without guessing", () => {
  const malformed = adapt({
    tutorResponse: { ...tutorResponse, phase: "invented-phase" },
  });
  assert.equal(malformed.status, "quarantined");
  assert.equal(malformed.quarantine.reasonCode, "malformed-event");

  const { adapted } = acceptedProjection();
  const unsupported = bridge.validateTutorBridgeEvent(
    { ...adapted.value.event, packageVersion: "0.3.0" },
    { receivedAt: NOW },
  );
  assert.equal(unsupported.status, "quarantined");
  assert.equal(unsupported.quarantine.reasonCode, "unsupported-package-version");

  const unsupportedEventVersion = bridge.validateTutorBridgeEvent(
    { ...adapted.value.event, eventVersion: 2 },
    { receivedAt: NOW },
  );
  assert.equal(unsupportedEventVersion.status, "quarantined");
  assert.equal(
    unsupportedEventVersion.quarantine.reasonCode,
    "unsupported-event-version",
  );

  const unknownEventKind = bridge.validateTutorBridgeEvent(
    { ...adapted.value.event, kind: "invented-event-kind" },
    { receivedAt: NOW },
  );
  assert.equal(unknownEventKind.status, "quarantined");
  assert.equal(
    unknownEventKind.quarantine.reasonCode,
    "unsupported-event-kind",
  );
});

test("actual Session 1 registry validates the minimized projection and preserves canonical result shape", () => {
  const { projected } = acceptedProjection();
  const canonical = studySchemas.learningEvidenceSchema.validate(
    projected.evidence,
  );
  assert.equal(canonical.ok, true, canonical.ok ? undefined : canonical.error);
  assert.equal(projected.evidence.kind, "learning-evidence");
  assert.equal(projected.evidence.schemaVersion, 1);
  assert.equal(canonicalStudyRegistry.inspectVersion(projected.evidence), "current");

  const coreFailure = core.validateWithSchema(core.TutorResponseSchema, {
    raw: "secret answer learner@example.com",
  });
  const adaptedFailure = bridge.adaptTutorCoreValidationResult(coreFailure);
  assert.equal(adaptedFailure.ok, false);
  assert.doesNotMatch(JSON.stringify(adaptedFailure), /secret answer|example\.com/);
});

test("forged low-level DTOs cannot acquire Tutor authority or establish mastery", () => {
  const { adapted } = acceptedProjection();
  const forged = {
    ...adapted.value.event,
    tutor: {
      ...adapted.value.event.tutor,
      phase: "advance",
      assessment: {
        source: "independent-attempt",
        outcome: "correct",
        correctCount: 1,
        attemptedCount: 1,
        meanScore: 1,
        independentResponseCount: 1,
        distinctContextCount: 1,
        evidenceIds: ["forged-evidence-001"],
      },
    },
  };
  assert.equal(
    bridge.validateTutorBridgeEvent(forged, { receivedAt: NOW }).status,
    "accepted",
    "low-level DTO validation remains structural only",
  );
  const projected = bridge.projectTutorEventToStudy(forged, {
    receivedAt: NOW,
    schemaRegistry: canonicalStudyRegistry,
  });
  assert.equal(projected.status, "quarantined");
  assert.equal(projected.quarantine.reasonCode, "invalid-authority-claim");
  assert.equal(mathProgram.independentMastery.singleAnswerCanEstablishMastery, false);
  assert.ok(mathProgram.independentMastery.minimumEvidenceCount >= 3);
  assert.ok(mathProgram.independentMastery.minimumDistinctContexts >= 2);
});

test("program semantic guard rejects one-answer mastery and keeps pacing outside mastery authority", () => {
  const probe = structuredClone(mathProgram);
  probe.independentMastery.minimumEvidenceCount = 1;
  probe.independentMastery.minimumDistinctContexts = 1;
  probe.independentMastery.singleAnswerCanEstablishMastery = true;
  const semantic = bridge.validateTutorProgramSemantics(probe);
  assert.equal(semantic.ok, false);
  assert.ok(semantic.reasonCodes.includes("one-answer-mastery-risk"));
  assert.ok(semantic.reasonCodes.includes("insufficient-context-requirement"));

  const { projected } = acceptedProjection();
  const recommendation = bridge.recommendStudyAction(projected, {
    recommendationId: "recommendation-001",
    learnerLocalDate: LOCAL_DATE,
    householdTimeZone: "America/New_York",
  });
  assert.equal(recommendation.masteryDecisionMade, false);
  assert.equal(recommendation.pacingDecisionMade, false);
  assert.equal(
    projected.evidence.masteryOutcome.status,
    "insufficient-evidence",
  );
  assert.equal(projected.evidence.engagementSupport.status, "insufficient-evidence");
  assert.deepEqual(projected.evidence.engagementSupport.supportingSignals, []);
});

test("urgent pre-Core gateway covers both declared gaps, stops instruction, and emits no raw text", () => {
  assert.deepEqual(
    [...bridge.getBridgeUrgentCategoryCoverage()].sort(),
    [
      "abuse-or-neglect-disclosure",
      "self-harm-or-immediate-danger",
    ],
  );
  for (const text of [
    "I am going to hurt myself",
    "An adult hurts me",
  ]) {
    const result = bridge.evaluatePreCoreUrgentSafety(text, {
      eventId: "urgent-event-001",
      sessionId: studyContext.sessionId,
      occurredAt: NOW,
    });
    assert.equal(result.status, "stop-for-urgent-adult-review");
    assert.equal(result.continueToTutorCore, false);
    assert.equal(result.mustStopAcademicFlow, true);
    assert.equal(result.rawTextStored, false);
    assert.equal(result.matchedTextStored, false);
    assert.equal(result.diagnosisMade, false);
    assert.equal(result.adultHook.rawTextIncluded, false);
    assert.doesNotMatch(JSON.stringify(result), /going to hurt myself|adult hurts/i);
  }
  const bypass = bridge.adaptFrozenTutorCoreResult(
    {
      eventId: "tutor-event-bypass",
      occurredAt: NOW,
      tutorInteractionId: "tutor-interaction-bypass",
      study: studyContext,
      tutorResponse,
      tutorProgram: mathProgram,
    },
    frozenCorePort,
    skillRegistry,
  );
  assert.equal(bypass.status, "quarantined");
  assert.equal(bypass.quarantine.reasonCode, "invalid-authority-claim");

  let submitCount = 0;
  const stoppedCycle = bridge.executeLocalDemoStudyCoreBridgeCycle(
    {
      transientLearnerText: "I am ending my life",
      eventId: "urgent-cycle-001",
      occurredAt: NOW,
      tutorInteractionId: "tutor-interaction-urgent-cycle",
      study: studyContext,
      submitToTutorCore() {
        submitCount += 1;
        return { tutorResponse, tutorProgram: mathProgram };
      },
    },
    frozenCorePort,
    skillRegistry,
  );
  assert.equal(stoppedCycle.status, "stop-for-urgent-adult-review");
  assert.equal(submitCount, 0);
  const permittedCycle = bridge.executeLocalDemoStudyCoreBridgeCycle(
    {
      transientLearnerText: "My answer is four.",
      eventId: "safe-cycle-001",
      occurredAt: NOW,
      tutorInteractionId: "tutor-interaction-safe-cycle",
      study: studyContext,
      submitToTutorCore(text) {
        submitCount += 1;
        assert.equal(text, "My answer is four.");
        return { tutorResponse, tutorProgram: mathProgram };
      },
    },
    frozenCorePort,
    skillRegistry,
  );
  assert.equal(permittedCycle.status, "accepted");
  assert.equal(submitCount, 1);

  const multiTrigger = adapt({
    safetyDecision: {
      allowed: true,
      triggers: [
        {
          id: "safety-trigger-redirect",
          category: "academic-integrity",
          severity: "redirect",
          matchedText: "graded work request",
          learnerSafeMessage: "I can help you understand the next step.",
          parentTeacherMessage: "Academic integrity redirect applied.",
          continueTutoringAllowed: true,
        },
        {
          id: "safety-trigger-escalate",
          category: "high-stakes-placement",
          severity: "escalate",
          matchedText: "placement request",
          learnerSafeMessage: "An adult should review that decision.",
          parentTeacherMessage: "Placement decision needs adult review.",
          continueTutoringAllowed: true,
        },
      ],
      redactedInput: "review requested",
      responseRuleIds: ["rule-redirect", "rule-escalate"],
      mustEscalateToAdult: true,
      mustStopAcademicFlow: false,
    },
  });
  assert.equal(multiTrigger.status, "accepted");
  assert.equal(
    multiTrigger.value.event.tutor.safety.category,
    "high-stakes-placement",
  );
  assert.equal(multiTrigger.value.event.tutor.safety.severity, "escalate");
});

test("privacy boundary strips identifiers and rejects credentials, diagnosis, raw fields, and adult-private data", () => {
  const safe = bridge.sanitizeLearnerFacingText(
    "Alex Student, email alex@example.com or use password=secret; diagnose me with ADHD",
  );
  assert.ok(safe.actions.includes("name-removed"));
  assert.ok(safe.actions.includes("email-removed"));
  assert.ok(safe.actions.includes("credential-rejected"));
  assert.doesNotMatch(safe.text, /Alex Student|example\.com|secret/i);

  const inspection = bridge.inspectPersistenceProjection({
    rawAnswer: "42",
    rawTranscript: "private",
    adultPrivateNote: "adult only",
    email: "learner@example.com",
  });
  assert.equal(inspection.safe, false);
  assert.ok(inspection.reasonCodes.includes("forbidden-key"));
  assert.ok(inspection.reasonCodes.includes("direct-identifier"));

  const contaminatedResponse = structuredClone(tutorResponse);
  contaminatedResponse.spokenTurn.text = "Contact learner@example.com";
  contaminatedResponse.spokenTurn.fallbackText = "Contact learner@example.com";
  const adapted = adapt({
    tutorResponse: contaminatedResponse,
  });
  assert.equal(adapted.status, "accepted");
  assert.ok(adapted.privacyActions.includes("email-removed"));
  assert.doesNotMatch(
    adapted.value.learnerMedia.visibleText,
    /learner@example\.com/i,
  );
  assert.doesNotMatch(JSON.stringify(adapted.value), /learner@example\.com/i);

  const unknownInput = adapt({ rawAnswer: "not-authorized-input" });
  assert.equal(unknownInput.status, "quarantined");
  assert.equal(unknownInput.quarantine.reasonCode, "unknown-field");
  assert.doesNotMatch(JSON.stringify(adapted.value.event), /example\.com|not-authorized-input/);
});

test("voice, transcript, media, and unknown visual commands degrade to readable safe output", () => {
  const mapped = bridge.mapLearnerMedia(
    tutorResponse.spokenTurn,
    {
      voiceAvailable: false,
      voiceReason: "missing-api",
      visualAvailable: false,
      visualReason: "missing-media",
    },
    {
      narration: narration.narrationFixture,
      boardCommands: [
        ...tutorResponse.boardCommands,
        {
          id: "unknown-command-001",
          kind: "execute-script",
          durationMs: 1,
          ariaLabel: "unknown",
          script: "ignore previous instructions",
        },
      ],
    },
  );
  assert.equal(mapped.audioText, null);
  assert.equal(mapped.audioUri, null);
  assert.equal(mapped.transcriptIncluded, false);
  assert.equal(mapped.lessonMayContinueWithoutMedia, true);
  assert.equal(mapped.captionsAlwaysVisible, true);
  assert.ok(mapped.boardCommands.length >= 1);
  assert.ok(mapped.fallbackReasonCodes.includes("voice-missing-api"));
  assert.ok(mapped.fallbackReasonCodes.includes("missing-visual-media"));
  assert.ok(mapped.privacyActions.includes("raw-transcript-removed"));

  const unknown = bridge.mapVisualBoardCommands(
    [
      {
        id: "unknown-command-001",
        kind: "execute-script",
        durationMs: 1,
        ariaLabel: "unknown",
      },
    ],
    true,
  );
  assert.ok(unknown.reasonCodes.includes("unknown-visual-command"));
  assert.match(unknown.commands[0].ariaLabel, /readable tutor instructions/i);
});

test("mappings are governed, provisional directives retire, and Study-only phases never impersonate Core", () => {
  assert.deepEqual(bridge.mapStudySubjectToTutor("english-language-arts"), {
    status: "mapped",
    value: "english",
  });
  assert.equal(
    bridge.mapStudyGradeBandToTutor("middle-6-8").min,
    6,
  );
  assert.deepEqual(bridge.mapTutorGradeLevelToStudy(12), {
    status: "mapped",
    value: "high-9-12",
  });
  const mapped = bridge.mapStudyTaskToTutorPhase("guided-practice");
  assert.equal(mapped.status, "mapped");
  assert.equal(mapped.value.advisoryOnly, true);
  assert.equal(mapped.value.instructionalAuthority, "tutor-core");
  assert.equal(
    bridge.mapStudyTaskToTutorPhase("break").reasonCode,
    "study-only-task",
  );
  assert.deepEqual(bridge.mapTutorPhaseToRetiringSession2Directive("advance"), {
    status: "mapped",
    directive: "correct",
    canonicalReplacement: "advance",
    sourceAuthority: "tutor-core",
    retirementRequired: true,
  });
  assert.equal(
    bridge.mapTutorPhaseToRetiringSession2Directive("guided-practice").status,
    "unsupported",
  );
});

test("exact checkpoint accepts only matching revision/cursor/event and excludes raw answers and transcripts", () => {
  const checkpoint = checkpointFixture();
  const context = checkpointContext(checkpoint);
  const accepted = bridge.validateRecoveryCheckpoint(checkpoint, context);
  assert.equal(accepted.status, "accepted");
  assert.equal(checkpoint.rawAnswerIncluded, false);
  assert.equal(checkpoint.transcriptIncluded, false);
  assert.equal(Object.hasOwn(checkpoint, "rawAnswer"), false);
  assert.equal(Object.hasOwn(checkpoint, "transcript"), false);

  for (const changedContext of [
    { ...context, expectedRevision: 6 },
    { ...context, expectedLastAcceptedEventId: "tutor-event-000" },
  ]) {
    const result = bridge.validateRecoveryCheckpoint(
      checkpoint,
      changedContext,
    );
    assert.equal(result.status, "quarantined");
    assert.equal(result.quarantine.reasonCode, "stale-checkpoint");
  }
  for (const changedContext of [
    { ...context, expectedSegmentId: "segment-opaque-999" },
    { ...context, expectedTutorInteractionRef: "tutor-interaction-999" },
    {
      ...context,
      expectedProtectedTutorStateRef: "tutor-state:interaction-opaque-999",
    },
    {
      ...context,
      expectedSafeInstructionalCursor: {
        ...context.expectedSafeInstructionalCursor,
        currentItemIndex: 9,
      },
    },
  ]) {
    const result = bridge.validateRecoveryCheckpoint(
      checkpoint,
      changedContext,
    );
    assert.equal(result.status, "quarantined");
    assert.equal(result.quarantine.reasonCode, "checkpoint-session-mismatch");
  }
});

test("accepted-event ledger is idempotent and quarantines event-ID collisions", () => {
  const { adapted } = acceptedProjection();
  const first = bridge.acceptEventOnce(
    adapted.value.event,
    bridge.emptyAcceptedEventLedger(),
    NOW,
  );
  assert.equal(first.status, "accepted");
  const duplicate = bridge.acceptEventOnce(
    adapted.value.event,
    first.ledger,
    NOW,
  );
  assert.equal(duplicate.status, "duplicate-ignored");
  assert.equal(duplicate.reasonCode, "duplicate-event");
  const collision = bridge.acceptEventOnce(
    {
      ...adapted.value.event,
      tutor: {
        ...adapted.value.event.tutor,
        tutorInteractionId: "tutor-interaction-collision",
      },
    },
    first.ledger,
    NOW,
  );
  assert.equal(collision.status, "quarantined");
  assert.equal(collision.quarantine.reasonCode, "event-id-collision");
});

test("completion and durable hook events preserve dates, timezone, idempotency, retries, and parent provenance", () => {
  const { projected } = acceptedProjection();
  const completion = bridge.mapStudyCompletionToTutorReview({
    eventId: "completion-event-001",
    eventVersion: 1,
    sessionId: studyContext.sessionId,
    lessonId: studyContext.lessonId,
    segmentId: studyContext.segmentId,
    tutorInteractionId: "tutor-interaction-001",
    completedAt: NOW,
    completed: true,
    approvedBreakOccurred: true,
    technicalInterruptionOccurred: false,
    evidenceIds: [projected.evidence.id],
  });
  assert.equal(completion.approvedBreakOccurred, true);
  assert.equal(completion.rawAnswerIncluded, false);
  assert.equal(completion.transcriptIncluded, false);

  const recommendation = bridge.recommendStudyAction(projected, {
    recommendationId: "recommendation-001",
    learnerLocalDate: LOCAL_DATE,
    householdTimeZone: "America/New_York",
  });
  const events = bridge.buildOutboxEvents(projected, recommendation, {
    occurredAt: NOW,
    sessionId: studyContext.sessionId,
    lessonId: studyContext.lessonId,
    segmentId: studyContext.segmentId,
    parentOverrideProvenance: {
      decisionId: "decision-001",
      controlSetId: "controls-001",
      controlRevision: 2,
      actorRef: "adult-opaque-001",
      decision: "accepted",
      decidedAt: NOW,
    },
  });
  assert.deepEqual(
    events.map((event) => event.route),
    [
      "review-queue",
      "calendar-placement",
      "parent-control-enforcement",
    ],
  );
  assert.equal(new Set(events.map((event) => event.eventId)).size, 3);
  assert.equal(new Set(events.map((event) => event.idempotencyKey)).size, 3);
  for (const event of events) {
    assert.equal(event.eventVersion, 1);
    assert.equal(event.learnerLocalDate, LOCAL_DATE);
    assert.equal(event.householdTimeZone, "America/New_York");
    assert.equal(event.retry.terminalBehavior, "quarantine");
    assert.equal(event.quarantineOn, "retry-exhausted");
    assert.equal(event.payload.rawAnswerIncluded, false);
    assert.equal(event.payload.transcriptIncluded, false);
    assert.equal(event.payload.directIdentifiersIncluded, false);
    assert.equal(event.payload.adultPrivateNoteIncluded, false);
    assert.equal(
      event.payload.parentOverrideProvenance.controlRevision,
      2,
    );
  }
});

test("all 16 required traces are complete, unique, privacy-safe, and byte-deterministic", async () => {
  const tracePath = path.join(bridgeRoot, "traces", "sample-traces.json");
  const firstBytes = await readFile(tracePath);
  const secondBytes = await readFile(tracePath);
  assert.equal(
    createHash("sha256").update(firstBytes).digest("hex"),
    createHash("sha256").update(secondBytes).digest("hex"),
  );
  const document = JSON.parse(firstBytes.toString("utf8"));
  assert.equal(document.contract, "study-core-bridge.sample-traces.v1");
  assert.equal(document.contractVersion, 1);
  assert.equal(document.traces.length, 16);
  assert.equal(new Set(document.traces.map((trace) => trace.id)).size, 16);
  assert.deepEqual(
    document.traces.map((trace) => trace.id),
    Array.from(
      { length: 16 },
      (_, index) => `trace-${String(index + 1).padStart(2, "0")}`,
    ).map((prefix, index) => {
      const actual = document.traces[index].id;
      assert.ok(actual.startsWith(`${prefix}-`));
      return actual;
    }),
  );
  for (const trace of document.traces) {
    assert.ok(trace.steps.length >= 1, trace.id);
    assert.ok(trace.assertions.length >= 1, trace.id);
    assert.equal(bridge.inspectPersistenceProjection(trace).safe, true, trace.id);
  }
  const serialized = JSON.stringify(document);
  assert.doesNotMatch(
    serialized,
    /learner@example\.com|raw answer text|raw transcript text|password=|adult private note body/i,
  );
});
