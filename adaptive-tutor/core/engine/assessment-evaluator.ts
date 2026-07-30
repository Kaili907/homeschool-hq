import type {
  AssessmentItem,
  AssessmentEvaluator,
  LearnerInput,
} from "../contracts/index.js";

function normalizeBasicText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "");
}

function normalizeNumeric(value: string): string {
  const trimmed = value.trim().replace(/,/g, "");
  const number = Number(trimmed);
  return Number.isFinite(number) ? String(number) : trimmed;
}

export const evaluateAssessmentItem: AssessmentEvaluator = (
  item: AssessmentItem,
  input: LearnerInput,
) => {
  if (item.kind === "multiple-choice") {
    const selected = [...(input.selectedOptionIds ?? [])].sort();
    const correct = [...item.correctOptionIds].sort();
    const isCorrect =
      selected.length === correct.length &&
      selected.every((optionId, index) => optionId === correct[index]);
    return {
      score: isCorrect ? 1 : 0,
      isCorrect,
      normalizedAnswer: selected.join(","),
    };
  }

  if (item.kind === "sequencing") {
    const ordered = input.orderedOptionIds ?? [];
    const isCorrect =
      ordered.length === item.correctOrder.length &&
      ordered.every((optionId, index) => optionId === item.correctOrder[index]);
    return {
      score: isCorrect ? 1 : 0,
      isCorrect,
      normalizedAnswer: ordered.join(","),
    };
  }

  const normalize = (value: string): string => {
    if (item.normalization === "numeric") return normalizeNumeric(value);
    if (item.normalization === "basic-text") return normalizeBasicText(value);
    const trimmed = item.trimWhitespace ? value.trim() : value;
    return item.caseSensitive ? trimmed : trimmed.toLocaleLowerCase("en-US");
  };
  const normalizedAnswer = normalize(input.raw);
  const accepted = item.acceptedAnswers.map(normalize);
  const isCorrect = accepted.includes(normalizedAnswer);
  return { score: isCorrect ? 1 : 0, isCorrect, normalizedAnswer };
};
