import type { TutorAction } from "../../../core/v2/contracts/index.js";
import type { MinimizedProviderContext } from "../../tutor-v2/privacy/index.js";

export interface TutorV2BridgePrivacyIssue {
  readonly path: string;
  readonly code:
    | "credential-contamination"
    | "pin-contamination"
    | "household-private-contamination"
    | "sibling-contamination"
    | "adult-private-contamination"
    | "answer-authority-contamination"
    | "transcript-contamination"
    | "direct-identifier-contamination";
}

export type TutorV2BridgePrivacyDecision =
  | { readonly status: "accepted" }
  | {
      readonly status: "rejected";
      readonly code: "PROVIDER_CONTEXT_PRIVACY_REJECTED";
      readonly issues: readonly TutorV2BridgePrivacyIssue[];
    };

const RULES: readonly {
  readonly code: TutorV2BridgePrivacyIssue["code"];
  readonly pattern: RegExp;
}[] = [
  {
    code: "credential-contamination",
    pattern:
      /\b(?:bearer\s+[A-Za-z0-9._~-]+|password\s*[:=]|api[-_ ]?key\s*[:=]|access[-_ ]?token\s*[:=]|refresh[-_ ]?token\s*[:=]|service[-_ ]?role\s*[:=]|client[-_ ]?secret\s*[:=])\b/i,
  },
  {
    code: "pin-contamination",
    pattern: /\b(?:parent|guardian|learner|student)?\s*pin\s*(?:is|[:=])?\s*\d{4,12}\b/i,
  },
  {
    code: "household-private-contamination",
    pattern:
      /\b(?:household|family)\s+(?:private|address|income|financial|medical|record|secret|profile|data)\b/i,
  },
  {
    code: "sibling-contamination",
    pattern: /\b(?:sibling|brother|sister)\s+(?:record|profile|history|grade|data|private|name)\b/i,
  },
  {
    code: "adult-private-contamination",
    pattern: /\b(?:adult|parent|guardian|teacher)\s+private\s+(?:note|notes|comment|comments|data)\b/i,
  },
  {
    code: "answer-authority-contamination",
    pattern:
      /\b(?:answer[- ]?key|protected\s+answer|correct\s+answer\s+authority|scoring\s+authority|adult\s+answer[- ]?key\s+path)\b/i,
  },
  {
    code: "transcript-contamination",
    pattern: /\b(?:raw\s+)?(?:tutor|provider)\s+(?:transcript|conversation|prompt|response)\b/i,
  },
  {
    code: "direct-identifier-contamination",
    pattern:
      /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:learner|student|child)\s+(?:full\s+)?name\s*[:=]|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b)/i,
  },
];

function scanStrings(value: unknown): readonly TutorV2BridgePrivacyIssue[] {
  const issues: TutorV2BridgePrivacyIssue[] = [];
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (candidate: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > 10_000 || depth > 24) return;
    if (typeof candidate === "string") {
      for (const rule of RULES) {
        if (rule.pattern.test(candidate)) issues.push({ path, code: rule.code });
      }
      return;
    }
    if (candidate === null || typeof candidate !== "object" || ancestors.has(candidate)) return;
    const prototype = Object.getPrototypeOf(candidate);
    if (Array.isArray(candidate)) {
      if (prototype !== Array.prototype) return;
      ancestors.add(candidate);
      for (const [index, child] of candidate.entries()) visit(child, `${path}/${index}`, depth + 1);
      ancestors.delete(candidate);
      return;
    }
    if (prototype !== Object.prototype) return;
    ancestors.add(candidate);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(candidate))) {
      if ("value" in descriptor && !descriptor.get && !descriptor.set) {
        visit(descriptor.value, `${path}/${key}`, depth + 1);
      }
    }
    ancestors.delete(candidate);
  };

  visit(value, "$", 0);
  return issues;
}

function decide(value: unknown): TutorV2BridgePrivacyDecision {
  const issues = scanStrings(value);
  return issues.length === 0
    ? { status: "accepted" }
    : {
        status: "rejected",
        code: "PROVIDER_CONTEXT_PRIVACY_REJECTED",
        issues,
      };
}

/** Runs after W1-06 exact minimization and before the provider port. */
export function validateProviderContextContentPrivacy(
  context: MinimizedProviderContext,
): TutorV2BridgePrivacyDecision {
  return decide(context);
}

/** Prevents contaminated provider prose from becoming learner-facing output. */
export function validateLearnerSafeTutorAction(
  action: TutorAction,
): TutorV2BridgePrivacyDecision {
  return decide(action);
}
