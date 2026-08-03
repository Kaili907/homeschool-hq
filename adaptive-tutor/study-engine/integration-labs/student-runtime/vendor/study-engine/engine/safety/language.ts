export type UnsafeLanguageCode =
  | "attention_blame"
  | "focus_blame"
  | "duration_coercion"
  | "diagnostic_claim"
  | "permanent_capacity_claim"
  | "punitive_break_language";

export interface UnsafeLanguageFinding {
  readonly code: UnsafeLanguageCode;
  readonly summary: string;
}

interface SafetyRule {
  readonly code: UnsafeLanguageCode;
  readonly pattern: RegExp;
  readonly summary: string;
}

/**
 * Rules intentionally target claims and blame, not neutral words such as
 * "attention" in a parent-facing policy description.
 */
const SAFETY_RULES: readonly SafetyRule[] = [
  {
    code: "attention_blame",
    pattern:
      /\byou\b[^.!?\n]{0,40}\b(?:not paying attention|weren't paying attention|aren't paying attention)\b/i,
    summary: "Blames the learner's attention.",
  },
  {
    code: "focus_blame",
    pattern:
      /\byou\b[^.!?\n]{0,35}\bfailed because you\b[^.!?\n]{0,25}\b(?:(?:did not|didn't) focus|(?:were not|weren't) focused)\b/i,
    summary: "Attributes failure to focus.",
  },
  {
    code: "duration_coercion",
    pattern: /\byou should be able to sit longer\b/i,
    summary: "Pressures the learner to tolerate a longer duration.",
  },
  {
    code: "diagnostic_claim",
    pattern:
      /\b(?:you\s+(?:(?:(?:may|might|could|probably|likely)\s+|seem(?:s)?\s+to\s+)?have|must have|are|must be)\s+(?:(?:a|an|severe|mild|possible|probable)\s+){0,3}(?:adhd|add|autism|autistic|dyslexia|dyslexic|dyscalculia|dyscalculic|attention disorder|learning disability)|this (?:means|proves) you have\s+(?:(?:a|an)\s+)?(?:adhd|add|autism|dyslexia|dyscalculia|attention disorder|learning disability))\b/i,
    summary: "Infers or states a diagnosis.",
  },
  {
    code: "permanent_capacity_claim",
    pattern:
      /\b(?:(?:your|you have an?)\s+(?:permanent|permanently|fixed|unchangeable|bad|short|limited)\s+attention span|your attention span (?:is|will (?:always|never) be)\s+(?:permanently\s+)?(?:permanent|fixed|unchangeable|bad|short|limited))\b/i,
    summary: "Describes attention capacity as a permanent trait.",
  },
  {
    code: "punitive_break_language",
    pattern:
      /\b(?:(?:lose|lost|do not deserve|don't deserve|forfeit|forfeited)\s+(?:your\s+)?break|your break (?:is|was) (?:lost|forfeited|revoked)|you (?:do not|don't) get (?:a|your) break|no break for you|break privileges (?:are|were) revoked)\b/i,
    summary: "Frames a break as punishment or a reward to revoke.",
  },
] as const;

export class UnsafeCoachLanguageError extends Error {
  public readonly name = "UnsafeCoachLanguageError";

  public constructor(
    public readonly findings: readonly UnsafeLanguageFinding[],
  ) {
    super("Coach language did not pass the study-engine safety policy.");
  }
}

export function inspectCoachLanguage(
  message: string,
): readonly UnsafeLanguageFinding[] {
  return SAFETY_RULES.filter(({ pattern }) => pattern.test(message)).map(
    ({ code, summary }) => ({ code, summary }),
  );
}

export function assertSafeCoachLanguage(message: string): void {
  const findings = inspectCoachLanguage(message);
  if (findings.length > 0) {
    throw new UnsafeCoachLanguageError(findings);
  }
}
