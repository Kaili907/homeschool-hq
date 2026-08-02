import type { SafetyDecision, SafetyTrigger } from "../contracts/index.js";
import { safetyRules } from "./rules.js";

function redactIdentifyingInformation(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, "[redacted-address]");
}

export function evaluateSafety(input: string): SafetyDecision {
  const triggers: SafetyTrigger[] = [];
  for (const rule of safetyRules) {
    const match = rule.patterns.map((pattern) => input.match(pattern)).find(Boolean);
    if (!match) continue;
    triggers.push({
      id: `${rule.id}-trigger`,
      category: rule.category,
      severity: rule.severity,
      matchedText: match[0].slice(0, 500),
      learnerSafeMessage: rule.learnerSafeMessage,
      parentTeacherMessage: rule.parentTeacherMessage,
      continueTutoringAllowed: rule.continueTutoringAllowed,
    });
  }
  const mustStopAcademicFlow = triggers.some(
    (trigger) => trigger.severity === "urgent-escalation" || !trigger.continueTutoringAllowed,
  );
  return {
    allowed: !mustStopAcademicFlow,
    triggers,
    redactedInput: redactIdentifyingInformation(input),
    responseRuleIds: triggers.map((trigger) => trigger.id.replace(/-trigger$/, "")),
    mustEscalateToAdult: triggers.some(
      (trigger) => trigger.severity === "escalate" || trigger.severity === "urgent-escalation",
    ),
    mustStopAcademicFlow,
  };
}
