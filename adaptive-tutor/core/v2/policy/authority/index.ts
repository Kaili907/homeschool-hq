export const AUTHORITY_POLICY_REJECTION = "POLICY_REJECTION" as const;

export interface AuthorityPolicyIssue {
  readonly path: string;
  readonly code:
    | "forbidden-authority-field"
    | "forbidden-authority-action"
    | "unsupported-authority-claim";
}

export type AuthorityPolicyDecision =
  | { readonly status: "allowed" }
  | {
      readonly status: "rejected";
      readonly code: typeof AUTHORITY_POLICY_REJECTION;
      readonly issues: readonly AuthorityPolicyIssue[];
    };

interface TraversedValue {
  readonly path: string;
  readonly key: string | null;
  readonly value: unknown;
}

const MAXIMUM_SCAN_DEPTH = 24;
const MAXIMUM_SCAN_NODES = 10_000;

const FORBIDDEN_FIELD_NAMES = new Set([
  "assessmentresult",
  "assessmentresults",
  "authoritativemastery",
  "certifyguardianwork",
  "clearsafetyhold",
  "curriculumchange",
  "curriculummutation",
  "declaremastery",
  "gradechange",
  "guardianauthority",
  "guardianworkcertified",
  "officialgrade",
  "officialworkinggrade",
  "officialworkinglevel",
  "permissionchange",
  "permissions",
  "safetyrules",
  "setsafetyclearance",
  "studentstate",
  "studentstatewrite",
  "writearbitrarystudentstate",
  "writestudentrecord",
]);

const FORBIDDEN_ACTION_KINDS = new Set([
  "alter-assessment-results",
  "certify-guardian-work",
  "change-curriculum",
  "change-grade",
  "change-guardian-authority",
  "change-permissions",
  "change-safety-rules",
  "change-working-level",
  "clear-safety-hold",
  "declare-mastery",
  "set-official-grade",
  "write-student-state",
]);

const FORBIDDEN_AUTHORITY_CLAIMS: readonly RegExp[] = [
  /\b(?:change|changed|set|update|updated|override|overrode|alter|altered)\b.{0,48}\bofficial\s+grade\b/i,
  /\bofficial\s+grade\b.{0,32}\b(?:is\s+now|has\s+been|changed|updated|set)\b/i,
  /\b(?:change|changed|set|update|updated|override|overrode|alter|altered)\b.{0,48}\bworking\s+level\b/i,
  /\b(?:declare|declared|certify|certified|award|awarded)\b.{0,40}\b(?:authoritative\s+)?mastery\b/i,
  /\b(?:you|learner|student)\b.{0,24}\b(?:officially|authoritatively)\s+mastered\b/i,
  /\b(?:alter|altered|change|changed|override|overrode|replace|replaced)\b.{0,48}\bauthoritative\s+assessment\s+results?\b/i,
  /\b(?:alter|altered|change|changed|replace|replaced|rewrite|rewrote)\b.{0,48}\bcurriculum\b/i,
  /\b(?:grant|granted|revoke|revoked|change|changed|set|updated?)\b.{0,40}\bpermissions?\b/i,
  /\b(?:change|changed|transfer|transferred|override|overrode)\b.{0,40}\bguardian\s+authority\b/i,
  /\b(?:certify|certified|approve|approved)\b.{0,40}\bguardian\s+work\b/i,
  /\b(?:clear|cleared|remove|removed|override|overrode)\b.{0,40}\bsafety\s+hold\b/i,
  /\b(?:change|changed|disable|disabled|override|overrode|rewrite|rewrote)\b.{0,40}\bsafety\s+rules?\b/i,
  /\b(?:write|wrote|persist|persisted|store|stored|mutate|mutated)\b.{0,48}\b(?:arbitrary\s+)?student\s+state\b/i,
];

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function traverseSafely(root: unknown): readonly TraversedValue[] {
  const found: TraversedValue[] = [];
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, path: string, key: string | null, depth: number): void => {
    nodes += 1;
    if (nodes > MAXIMUM_SCAN_NODES || depth > MAXIMUM_SCAN_DEPTH) return;
    found.push({ path, key, value });
    if (value === null || typeof value !== "object" || ancestors.has(value)) return;

    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) return;
      ancestors.add(value);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor && "value" in descriptor && !descriptor.get && !descriptor.set) {
          visit(descriptor.value, `${path}/${index}`, String(index), depth + 1);
        }
      }
      ancestors.delete(value);
      return;
    }

    if (prototype !== Object.prototype) return;
    ancestors.add(value);
    for (const [childKey, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor && !descriptor.get && !descriptor.set) {
        visit(descriptor.value, `${path}/${childKey}`, childKey, depth + 1);
      }
    }
    ancestors.delete(value);
  };

  visit(root, "$", null, 0);
  return found;
}

/**
 * Detects authority abuse in untrusted Tutor output without executing accessors.
 * This is a pre-schema check: closed contract validation remains mandatory after it.
 */
export function evaluateAuthorityPolicy(proposal: unknown): AuthorityPolicyDecision {
  const issues: AuthorityPolicyIssue[] = [];

  for (const candidate of traverseSafely(proposal)) {
    if (candidate.key !== null && FORBIDDEN_FIELD_NAMES.has(normalizeFieldName(candidate.key))) {
      issues.push({ path: candidate.path, code: "forbidden-authority-field" });
      continue;
    }

    if (candidate.key === "kind" && typeof candidate.value === "string") {
      if (FORBIDDEN_ACTION_KINDS.has(candidate.value.toLowerCase())) {
        issues.push({ path: candidate.path, code: "forbidden-authority-action" });
        continue;
      }
    }

    if (typeof candidate.value === "string") {
      const text = candidate.value;
      if (FORBIDDEN_AUTHORITY_CLAIMS.some((pattern) => pattern.test(text))) {
        issues.push({ path: candidate.path, code: "unsupported-authority-claim" });
      }
    }
  }

  return issues.length === 0
    ? { status: "allowed" }
    : { status: "rejected", code: AUTHORITY_POLICY_REJECTION, issues };
}
