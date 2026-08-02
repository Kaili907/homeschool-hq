import {
  createRecoveryCheckpoint,
  validateRecoveryCheckpoint,
} from "../../runtime/src/checkpoint.ts";
import { InMemoryAcceptedEventLedger } from "../../runtime/src/ledger.ts";
import {
  consumePreCoreProcessingPermit,
  evaluatePreCoreUrgentSafety,
} from "../../runtime/src/safety.ts";

const cursor = {
  tutorPhase: "guided-practice" as const,
  cycleNumber: 2,
  currentItemId: "guided-item-2",
  currentItemIndex: 1,
  teachingTurnIndex: 1,
};

function checkpoint() {
  return createRecoveryCheckpoint({
    checkpointId: "checkpoint:session9:001",
    revision: 4,
    timestamp: "2026-07-30T09:30:00-04:00",
    sessionId: "session:session9:001",
    lessonId: "lesson:session9:001",
    segmentId: "segment:guided:002",
    safeInstructionalCursor: cursor,
    completedSegmentIds: ["segment:warmup:001"],
    perSegmentActiveTime: [
      { segmentId: "segment:warmup:001", activeSeconds: 300 },
      { segmentId: "segment:guided:002", activeSeconds: 75 },
    ],
    pausedSeconds: 30,
    breakSeconds: 180,
    protectedDraftRef: "draft:session9-guided-002",
    protectedTutorStateRef: "tutor-state:session9-guided-002",
    lastAcceptedEventId: "event:session9:003",
    tutorInteractionRef: "interaction-session9-guided-002",
  });
}

function context() {
  return {
    expectedSessionId: "session:session9:001",
    expectedLessonId: "lesson:session9:001",
    expectedSegmentId: "segment:guided:002",
    expectedTutorInteractionRef: "interaction-session9-guided-002",
    expectedSafeInstructionalCursor: cursor,
    knownSegmentIds: ["segment:warmup:001", "segment:guided:002"],
    expectedRevision: 4,
    expectedLastAcceptedEventId: "event:session9:003",
    expectedProtectedTutorStateRef: "tutor-state:session9-guided-002",
    now: "2026-07-30T09:31:00-04:00",
  } as const;
}

describe("checkpoint integrity and idempotency", () => {
  afterEach(() => vi.useRealTimers());

  test("validates an exact privacy-minimized resume checkpoint", () => {
    const value = checkpoint();
    const result = validateRecoveryCheckpoint(value, context());
    expect(result.status).toBe("accepted");
    expect(value.rawAnswerIncluded).toBe(false);
    expect(value.transcriptIncluded).toBe(false);
    expect(value).not.toHaveProperty("rawAnswer");
    expect(value).not.toHaveProperty("rawTranscript");
    expect(value).not.toHaveProperty("transcript");
  });

  test("rejects a stale checkpoint revision", () => {
    const result = validateRecoveryCheckpoint(checkpoint(), {
      ...context(),
      expectedRevision: 5,
    });
    expect(result.status).toBe("quarantined");
  });

  test("rejects a cross-session checkpoint", () => {
    const result = validateRecoveryCheckpoint(checkpoint(), {
      ...context(),
      expectedSessionId: "session:other",
    });
    expect(result.status).toBe("quarantined");
  });

  test("rejects a tampered protected Tutor state reference", () => {
    const tampered = {
      ...checkpoint(),
      protectedTutorStateRef: "tutor-state:tampered",
    };
    const result = validateRecoveryCheckpoint(tampered, context());
    expect(result.status).toBe("quarantined");
  });

  test("rejects a copied one-time permit", () => {
    const occurredAt = "2026-07-30T13:30:00.000Z";
    const gateway = evaluatePreCoreUrgentSafety(
      "A clear academic answer.",
      {
        eventId: "event-permit-copy",
        sessionId: "session-permit-copy",
        occurredAt,
      },
      { mode: "local-demo" },
    );
    expect(gateway.status).toBe("continue-to-tutor-core");
    if (gateway.status !== "continue-to-tutor-core") return;
    const copied = { ...gateway.permit };
    expect(
      consumePreCoreProcessingPermit(copied, {
        eventId: "event-permit-copy",
        sessionId: "session-permit-copy",
        occurredAt,
      }).status,
    ).toBe("rejected");
  });

  test("rejects permit replay after one successful consume", () => {
    const occurredAt = "2026-07-30T13:31:00.000Z";
    const contextValue = {
      eventId: "event-permit-replay",
      sessionId: "session-permit-replay",
      occurredAt,
    };
    const gateway = evaluatePreCoreUrgentSafety(
      "A clear academic answer.",
      contextValue,
      { mode: "local-demo" },
    );
    if (gateway.status !== "continue-to-tutor-core") {
      throw new Error("Expected a clear safety result.");
    }
    expect(
      consumePreCoreProcessingPermit(gateway.permit, contextValue),
    ).toEqual({ status: "consumed" });
    expect(
      consumePreCoreProcessingPermit(gateway.permit, contextValue),
    ).toEqual({ status: "rejected", reason: "missing-or-replayed" });
  });

  test("context mismatch revokes the permit", () => {
    const occurredAt = "2026-07-30T13:32:00.000Z";
    const gateway = evaluatePreCoreUrgentSafety(
      "A clear academic answer.",
      {
        eventId: "event-permit-context",
        sessionId: "session-permit-context",
        occurredAt,
      },
      { mode: "local-demo" },
    );
    if (gateway.status !== "continue-to-tutor-core") {
      throw new Error("Expected a clear safety result.");
    }
    expect(
      consumePreCoreProcessingPermit(gateway.permit, {
        eventId: "event-permit-context",
        sessionId: "session-wrong",
        occurredAt,
      }),
    ).toEqual({ status: "rejected", reason: "context-mismatch" });
    expect(
      consumePreCoreProcessingPermit(gateway.permit, {
        eventId: "event-permit-context",
        sessionId: "session-permit-context",
        occurredAt,
      }),
    ).toEqual({ status: "rejected", reason: "missing-or-replayed" });
  });

  test("expired permit is rejected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T13:33:00.000Z"));
    const occurredAt = "2026-07-30T13:33:00.000Z";
    const contextValue = {
      eventId: "event-permit-expired",
      sessionId: "session-permit-expired",
      occurredAt,
    };
    const gateway = evaluatePreCoreUrgentSafety(
      "A clear academic answer.",
      contextValue,
      { mode: "local-demo", permitTtlMs: 1 },
    );
    if (gateway.status !== "continue-to-tutor-core") {
      throw new Error("Expected a clear safety result.");
    }
    vi.advanceTimersByTime(2);
    expect(
      consumePreCoreProcessingPermit(gateway.permit, contextValue),
    ).toEqual({ status: "rejected", reason: "expired" });
  });

  test("ledger distinguishes duplicate replay from ID collision", async () => {
    const ledger = new InMemoryAcceptedEventLedger();
    await expect(
      ledger.appendAcceptedEvent("session-1", "event-1", 1, "digest-a"),
    ).resolves.toEqual({ status: "appended" });
    await expect(
      ledger.appendAcceptedEvent("session-1", "event-1", 1, "digest-a"),
    ).resolves.toEqual({ status: "duplicate-ignored" });
    await expect(
      ledger.appendAcceptedEvent("session-1", "event-1", 1, "digest-b"),
    ).resolves.toEqual({ status: "idempotency-collision" });
    expect(ledger.size).toBe(1);
  });
});
