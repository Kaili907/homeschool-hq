import type {
  EscalationLevel,
  SafetyEventCategory,
  SafetySeverity,
  TutorSpeaker,
  Weekday,
} from "./contracts";

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string): string {
  const date = validDate(value);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string, zoneId?: string): string {
  const date = validDate(value);
  if (!date) return "Time unavailable";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(zoneId ? { timeZone: zoneId } : {}),
    }).format(date);
  } catch {
    return formatDateTime(value);
  }
}

export function sentenceCase(value: string): string {
  const words = value.replaceAll("_", " ");
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

export const SPEAKER_LABEL: Record<TutorSpeaker, string> = {
  student: "Student",
  tutor: "Tutor",
  system: "Safety system",
};

export const SEVERITY_LABEL: Record<SafetySeverity, string> = {
  info: "Information",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Urgent adult check-in",
};

export const CATEGORY_LABEL: Record<SafetyEventCategory, string> = {
  "answer-integrity": "Answer integrity",
  "academic-integrity": "Academic integrity",
  "age-inappropriate-content": "Age-inappropriate content",
  "dangerous-activity": "Dangerous activity",
  "harassment-or-hate": "Harassment or hate",
  "medical-boundary": "Medical boundary",
  "legal-boundary": "Legal boundary",
  "potential-self-harm": "Potential self-harm",
  "potential-immediate-danger": "Potential immediate danger",
  "potential-abuse-or-unsafe-situation": "Potential unsafe situation",
  "privacy-or-personal-data": "Privacy or personal data",
  "prompt-injection": "Prompt injection",
  "restricted-subject": "Restricted subject",
  "sexual-content": "Sexual content",
  "violent-content": "Violent content",
  "student-report": "Student report",
  "student-block": "Student block",
  "model-policy-failure": "Model policy failure",
  "access-control": "Access control",
};

export const ESCALATION_LABEL: Record<EscalationLevel, string> = {
  none: "No escalation",
  "record-for-parent": "Recorded for parent",
  "parent-review": "Parent review",
  "urgent-parent-attention": "Urgent parent attention",
  "human-safety-review": "Human safety review",
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};
