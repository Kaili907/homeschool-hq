export function formatMasteryTimestamp(value: string | undefined): string {
  if (!value) return "No independent demonstration recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function clampConfidenceScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

export function formatConfidencePercent(score: number): string {
  return `${Math.round(clampConfidenceScore(score) * 100)}%`;
}

export function formatEvidenceKind(
  kind: "assessment_attempt" | "tutor_intervention" | "independent_demonstration",
): string {
  switch (kind) {
    case "assessment_attempt":
      return "Assessment attempt";
    case "tutor_intervention":
      return "Tutor intervention";
    case "independent_demonstration":
      return "Independent demonstration";
  }
}

