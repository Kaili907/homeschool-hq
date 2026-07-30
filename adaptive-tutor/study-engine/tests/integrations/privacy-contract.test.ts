import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCalendarMockDemonstration } from "../../integrations/calendar/index.js";
import { createMockReviewQueueDemo } from "../../integrations/review/index.js";
import { buildRomeoMockDemonstration } from "../../integrations/romeo/index.js";
import type {
  ParentControlEvent,
  ParentDashboardSnapshot,
} from "../../parent/contracts.js";
import { applyParentControlEvent } from "../../parent/controls.js";
import {
  PARENT_DASHBOARD_DEMO_SNAPSHOT,
  createParentDashboardDemoModel,
} from "../../parent/demo-data.js";
import {
  auditParentDashboardPrivacy,
  auditPrivateNoteIsolation,
} from "../../parent/privacy.js";

const studyEngineRoot = fileURLToPath(new URL("../../", import.meta.url));
const auditedSourceRoots = [
  join(studyEngineRoot, "integrations"),
  join(studyEngineRoot, "parent"),
] as const;

function implementationFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) return implementationFiles(absolute);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [absolute] : [];
  });
}

function auditedSources(): readonly {
  readonly path: string;
  readonly source: string;
}[] {
  return auditedSourceRoots.flatMap((root) =>
    implementationFiles(root).map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    })),
  );
}

function unsafeSnapshot(): ParentDashboardSnapshot {
  const snapshot = structuredClone(PARENT_DASHBOARD_DEMO_SNAPSHOT);
  const unsafe = {
    ...snapshot,
    webcamMonitoring: true,
    today: {
      ...snapshot.today,
      resumableWork: snapshot.today.resumableWork.map((item, index) =>
        index === 0
          ? {
              ...item,
              studentMessage: "You cannot focus, so try again.",
            }
          : item,
      ),
    },
    learning: {
      ...snapshot.learning,
      repeatedMisconceptions: snapshot.learning.repeatedMisconceptions.map(
        (item, index) =>
          index === 0
            ? { ...item, supportiveNextStep: "You failed again." }
            : item,
      ),
    },
    studyHabits: {
      ...snapshot.studyHabits,
      recommendation: {
        ...snapshot.studyHabits.recommendation,
        evidence: [],
      },
    },
  };
  return unsafe;
}

describe("privacy contract and static boundary", () => {
  it("keeps surveillance, hidden scoring, diagnosis, credentials, and raw responses out of public fields", () => {
    const declaredFields = auditedSources().flatMap(({ path, source }) => {
      const matches = source.matchAll(
        /\breadonly\s+([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/g,
      );
      return [...matches].map((match) => ({
        path,
        field: match[1],
        normalized: match[1].replace(/[^A-Za-z0-9]/g, "").toLowerCase(),
      }));
    });
    const prohibitedField =
      /webcam|eyetrack|gaze|medicaldiagnos|hiddenbehaviou?rscore|attentionspan|permanent(?:child)?label|biometric|raw(?:answer|response)|password|passcode|credential|accesstoken|refreshtoken|sessioncookie|apikey|secret/;

    expect(
      declaredFields.filter(({ normalized }) =>
        prohibitedField.test(normalized),
      ),
    ).toEqual([]);
  });

  it("contains no surveillance, network, production storage, database, or authentication API calls", () => {
    const prohibitedApis = [
      /\bnavigator\.mediaDevices\b/,
      /\bgetUserMedia\s*\(/,
      /\bMediaRecorder\s*\(/,
      /\bFaceDetector\s*\(/,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\s*\(/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
      /\bdocument\.cookie\b/,
      /\bsupabase\b/i,
      /\bfirebase\b/i,
      /\bsignInWith\w*\s*\(/,
    ] as const;

    const findings = auditedSources().flatMap(({ path, source }) =>
      prohibitedApis
        .filter((pattern) => pattern.test(source))
        .map((pattern) => ({ path, pattern: pattern.source })),
    );
    expect(findings).toEqual([]);
  });

  it("keeps working demonstration payloads minimized and pseudonymous", () => {
    const serialized = JSON.stringify({
      calendar: buildCalendarMockDemonstration(),
      review: createMockReviewQueueDemo(),
      romeo: buildRomeoMockDemonstration(),
      parent: PARENT_DASHBOARD_DEMO_SNAPSHOT,
    });

    expect(serialized).not.toMatch(
      /"(?:studentName|learnerName|email|birthDate|dateOfBirth|streetAddress|phoneNumber|ssn|rawAnswer|rawResponse|transcript|webcam|eyeTracking|gaze|medicalDiagnosis|hiddenBehaviorScore|attentionSpan|permanentLabel|password|passcode|credential|accessToken|refreshToken|sessionCookie|apiKey|secret)"\s*:/i,
    );
    expect(PARENT_DASHBOARD_DEMO_SNAPSHOT.studentRef).toMatch(
      /^student:[A-Za-z0-9-]+$/,
    );
    expect(
      PARENT_DASHBOARD_DEMO_SNAPSHOT.studyHabits
        .currentEffectiveWorkBlockRanges[0].displayText,
    ).toBe("Current effective math work-block range: 18–22 minutes");
  });

  it("accepts the safe demo and reports prohibited data, missing evidence, and harmful learner language", () => {
    expect(
      auditParentDashboardPrivacy(PARENT_DASHBOARD_DEMO_SNAPSHOT),
    ).toEqual([]);

    const issueCodes = auditParentDashboardPrivacy(unsafeSnapshot()).map(
      ({ code }) => code,
    );
    expect(issueCodes).toContain("prohibited_field");
    expect(issueCodes).toContain("missing_evidence");
    expect(issueCodes.filter((code) => code === "unsupported_student_language"))
      .toHaveLength(2);
  });

  it("keeps a parent-only note out of the dashboard snapshot", () => {
    const noteBody = "Try the shorter writing section after lunch.";
    const event: ParentControlEvent = {
      type: "private_note_added",
      noteRef: "note:privacy-test",
      body: noteBody,
      at: "2026-07-28T11:20:00-04:00",
    };
    const withPrivateNote = applyParentControlEvent(
      createParentDashboardDemoModel(),
      event,
    );

    expect(
      auditPrivateNoteIsolation(
        withPrivateNote.snapshot,
        withPrivateNote.controls,
      ),
    ).toEqual([]);
    expect(JSON.stringify(withPrivateNote.snapshot)).not.toContain(noteBody);

    const exposedSnapshot = {
      ...withPrivateNote.snapshot,
      learnerLabel: noteBody,
    };
    expect(
      auditPrivateNoteIsolation(exposedSnapshot, withPrivateNote.controls),
    ).toEqual([
      expect.objectContaining({
        code: "private_note_exposed",
        path: "controls.privateNotes[0]",
      }),
    ]);
  });

  it("rejects surveillance, diagnosis, permanent-label, and unsupportive accommodation text", () => {
    const model = createParentDashboardDemoModel();
    const baseEvent = {
      type: "accommodation_added",
      accommodationRef: "accommodation:privacy-test",
      at: "2026-07-28T11:25:00-04:00",
    } as const;

    expect(() =>
      applyParentControlEvent(model, {
        ...baseEvent,
        action: "Use webcam monitoring during each work block.",
        studentMessage: "This support is ready when you are.",
      }),
    ).toThrowError(expect.objectContaining({ code: "unsafe_data_request" }));
    expect(() =>
      applyParentControlEvent(model, {
        ...baseEvent,
        action: "Add a medical diagnosis as a permanent label.",
        studentMessage: "This support is ready when you are.",
      }),
    ).toThrowError(expect.objectContaining({ code: "unsafe_data_request" }));
    expect(() =>
      applyParentControlEvent(model, {
        ...baseEvent,
        action: "Offer a shorter guided section.",
        studentMessage: "You are a lazy, bad student.",
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_text" }));
  });

  it("keeps every learner-facing demo message supportive and temporary", () => {
    const parentMessages =
      PARENT_DASHBOARD_DEMO_SNAPSHOT.today.resumableWork.map(
        ({ studentMessage }) => studentMessage,
      );
    const reviewDemo = createMockReviewQueueDemo();
    const reviewMessages = [
      ...reviewDemo.queue.scheduled.map(({ studentMessage }) => studentMessage),
      ...reviewDemo.queue.capacityHeld.map(
        ({ studentMessage }) => studentMessage,
      ),
      reviewDemo.deferralDemonstration.studentMessage,
    ];
    const allMessages = JSON.stringify([...parentMessages, ...reviewMessages]);

    expect(allMessages).not.toMatch(
      /\b(lazy|bad student|failure|failed again|cannot focus|can't focus|attention span|diagnos|permanent label|behind everyone)\b/i,
    );
  });
});
