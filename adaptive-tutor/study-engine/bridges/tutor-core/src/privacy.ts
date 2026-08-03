import type { PrivacyActionCode } from "./contracts.ts";
import {
  textContainsCredential,
  textContainsDiagnosisLanguage,
  textContainsEmail,
  textContainsPhone,
} from "./validation.ts";

const FORBIDDEN_KEYS = new Set([
  "raw",
  "rawAnswer",
  "rawLearnerResponse",
  "rawResponse",
  "rawTranscript",
  "transcript",
  "matchedText",
  "learnerName",
  "fullName",
  "email",
  "emailAddress",
  "phone",
  "phoneNumber",
  "password",
  "passcode",
  "credential",
  "credentials",
  "apiKey",
  "accessToken",
  "authorization",
  "cookie",
  "privateKey",
  "diagnosis",
  "diagnosisLanguage",
  "adultPrivateNote",
  "privateNote",
  "noteBody",
]);

export interface SafeTextResult {
  readonly text: string;
  readonly actions: readonly PrivacyActionCode[];
}

/**
 * Accessibility text may be shown to the learner, but is never used as Study
 * evidence. This function removes direct contact details without retaining
 * either their original values or their match locations.
 */
export function sanitizeLearnerFacingText(value: string): SafeTextResult {
  const actions: PrivacyActionCode[] = [];
  let text = value;
  if (/^[A-Z][A-Za-z'-]+\s+[A-Z][A-Za-z'-]+,\s*/.test(text)) {
    actions.push("name-removed");
    text = text.replace(
      /^[A-Z][A-Za-z'-]+\s+[A-Z][A-Za-z'-]+,\s*/,
      "",
    );
  }
  if (textContainsEmail(text)) {
    actions.push("email-removed");
    text = text.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[contact detail removed]",
    );
  }
  if (textContainsPhone(text)) {
    actions.push("phone-removed");
    text = text.replace(
      /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
      "[contact detail removed]",
    );
  }
  if (textContainsCredential(text)) {
    actions.push("credential-rejected");
    text = "This content is unavailable. Please ask an authorized adult for help.";
  }
  if (textContainsDiagnosisLanguage(text)) {
    actions.push("diagnosis-language-rejected");
    text =
      "The tutor cannot make a diagnosis. A trusted adult can help choose the next support.";
  }
  if (
    /\b(?:you (?:failed|are) because you are|lazy|stupid|incapable|adult[- ]only note|private adult note|ignore (?:all |the )?previous instructions|mark (?:this|the learner) (?:as )?master(?:ed|y))\b/i.test(
      text,
    )
  ) {
    actions.push("unsafe-language-replaced");
    text =
      "This step needs a supportive explanation. Please use the visible learning prompt or ask a trusted adult for help.";
  }
  return { text, actions };
}

export interface ProjectionPrivacyInspection {
  readonly safe: boolean;
  readonly reasonCodes: readonly (
    | "forbidden-key"
    | "direct-identifier"
    | "credential"
    | "diagnosis-language"
    | "non-json-value"
    | "cyclic-value"
  )[];
}

/**
 * Defense-in-depth assertion for persistence-bound payloads. Production
 * projection still has to be constructed from exact allowlists; this scan is
 * not a denylist projector.
 */
export function inspectPersistenceProjection(
  value: unknown,
): ProjectionPrivacyInspection {
  const reasons = new Set<ProjectionPrivacyInspection["reasonCodes"][number]>();
  const active = new WeakSet<object>();
  const visit = (entry: unknown): void => {
    if (
      entry === null ||
      typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry))
    ) {
      return;
    }
    if (typeof entry === "string") {
      if (textContainsEmail(entry) || textContainsPhone(entry)) {
        reasons.add("direct-identifier");
      }
      if (textContainsCredential(entry)) reasons.add("credential");
      if (textContainsDiagnosisLanguage(entry)) {
        reasons.add("diagnosis-language");
      }
      return;
    }
    if (typeof entry !== "object" || entry === null) {
      reasons.add("non-json-value");
      return;
    }
    if (active.has(entry)) {
      reasons.add("cyclic-value");
      return;
    }
    active.add(entry);
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      active.delete(entry);
      return;
    }
    for (const [key, child] of Object.entries(
      entry as Record<string, unknown>,
    )) {
      if (FORBIDDEN_KEYS.has(key)) reasons.add("forbidden-key");
      visit(child);
    }
    active.delete(entry);
  };
  visit(value);
  return { safe: reasons.size === 0, reasonCodes: [...reasons] };
}

export function assertPersistenceProjectionSafe(value: unknown): void {
  const result = inspectPersistenceProjection(value);
  if (!result.safe) {
    throw new Error(
      "Persistence projection failed the non-echoing privacy boundary.",
    );
  }
}
