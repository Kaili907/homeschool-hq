import {
  canonicalSerialize,
  createResumeStore,
  getResumeStorageKey,
  ResumeStoreError,
  type ResumeIntegrityValidator,
  type ResumeStorage,
} from "@runtime/persistence/resumeStore";
import {
  STUDENT_RUNTIME_VERSION,
  type RuntimeSubjectId,
  type RuntimeWorkspaceV1,
} from "@runtime/runtimeTypes";

const BASE_TIME = Date.parse("2026-07-28T14:00:00.000Z");
const SAFE_VALIDATOR: ResumeIntegrityValidator = () => true;

function timestamp(revision = 0): string {
  return new Date(BASE_TIME + revision * 1_000).toISOString();
}

class MemoryStorage implements ResumeStorage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

interface WorkspaceOptions {
  readonly subjectId?: string;
  readonly sessionId?: string;
  readonly revision?: number;
  readonly response?: string;
  readonly completedSegments?: readonly string[];
  readonly eventLog?: readonly Record<string, unknown>[];
}

function createWorkspace(
  {
    subjectId = "math",
    sessionId = "session-math-001",
    revision = 1,
    response = "2/4",
    completedSegments = [],
    eventLog = [],
  }: WorkspaceOptions = {},
): RuntimeWorkspaceV1 {
  return {
    version: STUDENT_RUNTIME_VERSION,
    subjectId: subjectId as RuntimeSubjectId,
    plan: {},
    controls: {},
    focusProfile: {},
    parentPreferences: {},
    durationPolicy: {
      precedenceVersion: "card5.resolve-duration-policy.v1",
      status: "resolved",
      reasonCode: "policy.resolved",
      targetMinutes: 15,
      automaticTargetMinutes: 15,
      hardMaximumMinutes: 20,
      breakMinutes: 3,
      candidateSource: "grade-band-default",
      candidateMinutes: 15,
      feasibleMinimumMinutes: 1,
      feasibleMaximumMinutes: 20,
      appliedReasonCodes: ["grade-band-default"],
      provisionalUntilCard5: false,
    },
    canonicalSession: {
      id: sessionId,
      eventLog,
    },
    screen: "learning",
    currentSegment: "warm-up",
    completedSegments,
    responses: { "warm-up": response },
    reflection: {},
    feedback: {},
    feedbackReceiptRefs: {},
    timer: {},
    idempotencyRecords: [],
    evidenceRecords: [],
    reviewRecords: [],
    engineOutputs: {},
    tutorCoreReceipts: [],
    transcript: [],
    diagnostics: [],
    quarantine: [],
    technicalInterruptionCount: 0,
    resumeRevision: revision,
    lastSavedAt: timestamp(revision),
    showRecoveryNotice: false,
    transcriptOpen: false,
  } as unknown as RuntimeWorkspaceV1;
}

function createStore(
  storage: ResumeStorage,
  validateIntegrity: ResumeIntegrityValidator = SAFE_VALIDATOR,
) {
  return createResumeStore({
    storage,
    validateIntegrity,
    now: () => timestamp(100),
  });
}

function locator(workspace: RuntimeWorkspaceV1) {
  return {
    subjectId: workspace.subjectId,
    sessionId: workspace.canonicalSession.id,
  };
}

describe("resumeStore canonical persistence", () => {
  it("serializes equivalent JSON deterministically", () => {
    const left = {
      z: [3, { beta: true, alpha: "a" }],
      a: { two: 2, one: 1 },
    };
    const right = {
      a: { one: 1, two: 2 },
      z: [3, { alpha: "a", beta: true }],
    };

    expect(canonicalSerialize(left)).toBe(canonicalSerialize(right));
    expect(canonicalSerialize(left)).toBe(
      '{"a":{"one":1,"two":2},"z":[3,{"alpha":"a","beta":true}]}',
    );
  });

  it("stores a versioned SHA-256 envelope and loads the exact local draft", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const workspace = createWorkspace({
      response: "My entered work stays local.",
      completedSegments: ["warm-up"],
    });

    const saved = await store.save(workspace);
    const loaded = await store.load({
      ...locator(workspace),
      expectedRevision: 1,
    });

    expect(saved.status).toBe("saved");
    expect(saved.envelope).toMatchObject({
      version: "student-runtime.resume-envelope.v2",
      subjectId: "math",
      sessionId: "session-math-001",
      revision: 1,
      savedAt: timestamp(1),
    });
    expect(saved.envelope.integrity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(saved.envelope.payload.responses).toEqual({});
    expect(saved.envelope.payload.transcript).toEqual([]);
    expect(JSON.stringify(saved.envelope)).not.toContain(
      "My entered work stays local.",
    );
    expect(
      (
        saved.envelope.payload as RuntimeWorkspaceV1 & {
          protectedDraftReference?: string;
        }
      ).protectedDraftReference,
    ).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.workspace.responses["warm-up"]).toBe(
        "My entered work stays local.",
      );
      expect(loaded.workspace.completedSegments).toEqual(["warm-up"]);
    }
  });

  it("is idempotent for the same revision and rejects conflicting content", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const original = createWorkspace({ revision: 2, response: "first" });

    await expect(store.save(original)).resolves.toMatchObject({
      status: "saved",
    });
    await expect(store.save(original)).resolves.toMatchObject({
      status: "unchanged",
    });
    await expect(
      store.save(createWorkspace({ revision: 2, response: "different" })),
    ).rejects.toMatchObject({
      code: "revision-conflict",
      message: "A different save already exists at this revision.",
    });
  });

  it("detects payload tampering and never echoes the raw response in its error", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const secretResponse = "PRIVATE RAW RESPONSE 4/10";
    const workspace = createWorkspace({ response: secretResponse });
    await store.save(workspace);

    const key = getResumeStorageKey(locator(workspace));
    const raw = storage.getItem(key);
    expect(raw).not.toBeNull();
    const tampered = JSON.parse(raw!) as {
      payload: { responses: Record<string, string> };
    };
    tampered.payload.responses["warm-up"] = `${secretResponse} forged`;
    storage.setItem(key, JSON.stringify(tampered));

    const result = await store.load(locator(workspace));

    expect(result).toMatchObject({
      status: "rejected",
      reason: "invalid-integrity",
      quarantined: true,
    });
    if (result.status === "rejected") {
      expect(result.error).toBeInstanceOf(ResumeStoreError);
      expect(result.error.message).toBe(
        "The saved study session could not be verified.",
      );
      expect(String(result.error)).not.toContain(secretResponse);
      expect(JSON.stringify(result.error)).not.toContain(secretResponse);
    }
    expect(await store.load(locator(workspace))).toEqual({ status: "missing" });
    expect(await store.listQuarantined()).toEqual([
      expect.objectContaining({
        reason: "invalid-integrity",
        subjectId: "math",
        sessionId: "session-math-001",
      }),
    ]);
  });

  it("rejects a stale resume token without deleting the newer revision", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const newest = createWorkspace({ revision: 7, response: "current draft" });
    await store.save(newest);

    const stale = await store.load({
      ...locator(newest),
      expectedRevision: 6,
    });

    expect(stale).toMatchObject({
      status: "rejected",
      reason: "stale-revision",
      quarantined: false,
    });
    const current = await store.load({
      ...locator(newest),
      expectedRevision: 7,
    });
    expect(current.status).toBe("loaded");
  });

  it("preserves monotonic exact state through refresh-loop store instances", async () => {
    const storage = new MemoryStorage();

    for (let revision = 1; revision <= 5; revision += 1) {
      const storeAfterRefresh = createStore(storage);
      const workspace = createWorkspace({
        revision,
        response: `draft-at-refresh-${revision}`,
        completedSegments: revision >= 3 ? ["warm-up"] : [],
      });
      await storeAfterRefresh.save(workspace);
      const loaded = await createStore(storage).load({
        ...locator(workspace),
        expectedRevision: revision,
      });

      expect(loaded.status).toBe("loaded");
      if (loaded.status === "loaded") {
        expect(loaded.workspace.resumeRevision).toBe(revision);
        expect(loaded.workspace.responses["warm-up"]).toBe(
          `draft-at-refresh-${revision}`,
        );
        expect(loaded.workspace.completedSegments).toEqual(
          revision >= 3 ? ["warm-up"] : [],
        );
      }
    }
  });

  it("never lets a racing older revision overwrite a newer one", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const newer = createWorkspace({ revision: 12, response: "newest" });
    const older = createWorkspace({ revision: 11, response: "older" });

    const outcomes = await Promise.allSettled([
      store.save(newer),
      store.save(older),
    ]);

    expect(outcomes[0]).toMatchObject({
      status: "fulfilled",
      value: { status: "saved" },
    });
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ code: "stale-revision" }),
    });

    const loaded = await store.load({
      ...locator(newer),
      expectedRevision: 12,
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.workspace.responses["warm-up"]).toBe("newest");
    }
  });

  it("rejects an envelope copied under another session binding", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const original = createWorkspace({ sessionId: "session-original" });
    await store.save(original);

    const originalKey = getResumeStorageKey(locator(original));
    const copiedLocator = {
      subjectId: original.subjectId,
      sessionId: "session-other",
    };
    storage.setItem(
      getResumeStorageKey(copiedLocator),
      storage.getItem(originalKey)!,
    );

    const result = await store.load(copiedLocator);

    expect(result).toMatchObject({
      status: "rejected",
      reason: "session-mismatch",
      quarantined: true,
    });
    if (result.status === "rejected") {
      expect(result.error.message).toBe(
        "The saved study session does not match the requested session.",
      );
    }
  });

  it("quarantines an unsupported envelope version without exposing its payload", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const secretResponse = "DO NOT ECHO THIS ANSWER";
    const workspace = createWorkspace({ response: secretResponse });
    await store.save(workspace);

    const key = getResumeStorageKey(locator(workspace));
    const futureEnvelope = JSON.parse(storage.getItem(key)!) as {
      version: string;
    };
    futureEnvelope.version = "student-runtime.resume-envelope.v999";
    storage.setItem(key, JSON.stringify(futureEnvelope));

    const result = await store.load(locator(workspace));

    expect(result).toMatchObject({
      status: "quarantined",
      reason: "unsupported-version",
      quarantined: true,
    });
    if (result.status === "quarantined") {
      expect(result.error.message).toBe(
        "The saved study session uses an unsupported version.",
      );
      expect(String(result.error)).not.toContain(secretResponse);
    }
    expect(storage.getItem(key)).toBeNull();
    expect(await store.list()).toEqual([]);
    const quarantined = await store.listQuarantined();
    expect(quarantined).toEqual([
      expect.objectContaining({ reason: "unsupported-version" }),
    ]);
    expect(JSON.stringify(quarantined)).not.toContain(secretResponse);
  });

  it("quarantines a legacy v1 namespace record instead of reviving it", async () => {
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const workspace = createWorkspace({
      response: "LEGACY PRIVATE DRAFT",
      sessionId: "legacy-session",
    });
    await store.save(workspace);
    const currentKey = getResumeStorageKey(locator(workspace));
    const raw = storage.getItem(currentKey)!;
    storage.removeItem(currentKey);
    const legacyKey =
      "manuel-academy:student-runtime:resume:v1:math:legacy-session";
    storage.setItem(legacyKey, raw);

    const result = await store.load(locator(workspace));

    expect(result).toMatchObject({
      status: "quarantined",
      reason: "unsupported-version",
      quarantined: true,
    });
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(JSON.stringify(await store.listQuarantined())).not.toContain(
      "LEGACY PRIVATE DRAFT",
    );
  });

  it("uses the caller validator to reject a recomputed but forged history", async () => {
    const storage = new MemoryStorage();
    const forged = createWorkspace({
      completedSegments: ["warm-up"],
      eventLog: [
        {
          id: "forged-completion",
          sessionId: "different-session",
          type: "segment-completed",
          segmentId: "exit-ticket",
        },
      ],
    });

    await createStore(storage, SAFE_VALIDATOR).save(forged);
    const canonicalHistoryValidator: ResumeIntegrityValidator = (
      workspace,
      context,
    ) =>
      workspace.canonicalSession.eventLog.every(
        (event) =>
          event.sessionId === context.sessionId &&
          (event.type !== "segment-completed" ||
            (event.segmentId !== undefined &&
              workspace.completedSegments.some(
                (segmentId) => String(segmentId) === String(event.segmentId),
              ))),
      );

    const result = await createStore(
      storage,
      canonicalHistoryValidator,
    ).load(locator(forged));

    expect(result).toMatchObject({
      status: "rejected",
      reason: "invalid-history",
      quarantined: true,
    });
    if (result.status === "rejected") {
      expect(result.error.message).toBe(
        "The saved study session history could not be verified.",
      );
    }
  });

  it("lists safe summaries and clears one session or the entire namespace", async () => {
    const storage = new MemoryStorage();
    storage.setItem("unrelated:key", "keep-me");
    const store = createStore(storage);
    const math = createWorkspace({
      subjectId: "math",
      sessionId: "math-session",
      revision: 1,
    });
    const reading = createWorkspace({
      subjectId: "reading",
      sessionId: "reading-session",
      revision: 2,
      completedSegments: ["warm-up", "visual-lesson"],
    });

    await store.save(math);
    await store.save(reading);

    expect(await store.list()).toEqual([
      expect.objectContaining({
        subjectId: "reading",
        sessionId: "reading-session",
        completedSegmentCount: 2,
        revision: 2,
      }),
      expect.objectContaining({
        subjectId: "math",
        sessionId: "math-session",
        completedSegmentCount: 0,
        revision: 1,
      }),
    ]);

    await expect(store.clear(locator(math))).resolves.toBe(1);
    expect((await store.list()).map((entry) => entry.sessionId)).toEqual([
      "reading-session",
    ]);
    await expect(store.clear()).resolves.toBe(1);
    expect(await store.list()).toEqual([]);
    expect(storage.getItem("unrelated:key")).toBe("keep-me");
  });
});
