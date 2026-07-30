import type {
  PrivacyActionCode,
  TutorCaptionCueV1,
  TutorMediaStateV1,
  TutorNarrationV1,
  TutorSpokenTurnV1,
  TutorVisualCommandBase,
} from "./contracts.ts";
import { sanitizeLearnerFacingText } from "./privacy.ts";
import { isTutorStableId } from "./validation.ts";

const VISUAL_KINDS = [
  "clear-board",
  "set-title",
  "add-text",
  "draw-fraction",
  "draw-number-line",
  "show-sentence-parts",
  "highlight",
  "reveal-step",
  "compare",
  "aria-announce",
] as const;
type VisualKind = (typeof VISUAL_KINDS)[number];

const VISUAL_KEYS: Readonly<Record<VisualKind, readonly string[]>> = {
  "clear-board": ["id", "kind", "durationMs", "ariaLabel"],
  "set-title": ["id", "kind", "durationMs", "ariaLabel", "text"],
  "add-text": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "text",
    "region",
    "emphasis",
  ],
  "draw-fraction": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "numerator",
    "denominator",
    "label",
    "representation",
  ],
  "draw-number-line": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "min",
    "max",
    "step",
    "highlightedValues",
  ],
  "show-sentence-parts": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "sentence",
    "subject",
    "predicate",
    "dependentMarker",
  ],
  highlight: [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "targetCommandId",
    "token",
    "reason",
  ],
  "reveal-step": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "stepNumber",
    "text",
  ],
  compare: [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "leftLabel",
    "rightLabel",
    "relationship",
  ],
  "aria-announce": [
    "id",
    "kind",
    "durationMs",
    "ariaLabel",
    "text",
    "priority",
  ],
};

export interface VisualMappingResult {
  readonly commands: readonly TutorVisualCommandBase[];
  readonly fallbackCount: number;
  readonly reasonCodes: readonly (
    | "unknown-visual-command"
    | "malformed-visual-command"
    | "missing-visual-media"
  )[];
  readonly privacyActions: readonly PrivacyActionCode[];
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function validBase(command: Record<string, unknown>): boolean {
  return (
    isTutorStableId(command.id) &&
    Number.isInteger(command.durationMs) &&
    Number(command.durationMs) >= 0 &&
    Number(command.durationMs) <= 30_000 &&
    typeof command.ariaLabel === "string" &&
    command.ariaLabel.length >= 1 &&
    command.ariaLabel.length <= 500
  );
}

function validKnownCommand(
  command: Record<string, unknown>,
  kind: VisualKind,
): boolean {
  if (!exactKeys(command, VISUAL_KEYS[kind]) || !validBase(command)) return false;
  const stringWithin = (
    value: unknown,
    minimum: number,
    maximum: number,
  ): value is string =>
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum;
  switch (kind) {
    case "clear-board":
      return true;
    case "set-title":
      return stringWithin(command.text, 1, 200);
    case "add-text":
      return (
        stringWithin(command.text, 1, 1200) &&
        ["top", "center", "bottom", "side"].includes(String(command.region)) &&
        ["normal", "strong", "muted"].includes(String(command.emphasis))
      );
    case "draw-fraction":
      return (
        Number.isInteger(command.numerator) &&
        Number(command.numerator) >= 0 &&
        Number(command.numerator) <= 100 &&
        Number.isInteger(command.denominator) &&
        Number(command.denominator) >= 1 &&
        Number(command.denominator) <= 100 &&
        stringWithin(command.label, 1, 100) &&
        ["bar", "circle", "set"].includes(String(command.representation))
      );
    case "draw-number-line":
      return (
        typeof command.min === "number" &&
        Number.isFinite(command.min) &&
        typeof command.max === "number" &&
        Number.isFinite(command.max) &&
        typeof command.step === "number" &&
        Number.isFinite(command.step) &&
        command.step > 0 &&
        Array.isArray(command.highlightedValues) &&
        command.highlightedValues.length <= 30 &&
        command.highlightedValues.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        )
      );
    case "show-sentence-parts":
      return (
        stringWithin(command.sentence, 1, 500) &&
        stringWithin(command.subject, 0, 300) &&
        stringWithin(command.predicate, 0, 300) &&
        (command.dependentMarker === undefined ||
          stringWithin(command.dependentMarker, 0, 100))
      );
    case "highlight":
      return (
        isTutorStableId(command.targetCommandId) &&
        stringWithin(command.token, 1, 200) &&
        stringWithin(command.reason, 1, 500)
      );
    case "reveal-step":
      return (
        Number.isInteger(command.stepNumber) &&
        Number(command.stepNumber) >= 1 &&
        Number(command.stepNumber) <= 50 &&
        stringWithin(command.text, 1, 800)
      );
    case "compare":
      return (
        stringWithin(command.leftLabel, 1, 300) &&
        stringWithin(command.rightLabel, 1, 300) &&
        ["equal", "not-equal", "part-whole", "complete-incomplete"].includes(
          String(command.relationship),
        )
      );
    case "aria-announce":
      return (
        stringWithin(command.text, 1, 800) &&
        ["polite", "assertive"].includes(String(command.priority))
      );
  }
}

function accessibleFallback(index: number): TutorVisualCommandBase {
  return {
    id: `visual-fallback-${index + 1}`,
    kind: "add-text",
    durationMs: 0,
    ariaLabel:
      "A visual step is unavailable. Follow the readable tutor instructions.",
    text: "A visual step is unavailable. Follow the readable tutor instructions.",
    region: "center",
    emphasis: "normal",
  };
}

export function mapVisualBoardCommands(
  commands: readonly unknown[],
  visualAvailable = true,
): VisualMappingResult {
  const output: TutorVisualCommandBase[] = [];
  const reasons = new Set<VisualMappingResult["reasonCodes"][number]>();
  const privacyActions = new Set<PrivacyActionCode>();
  let fallbackCount = 0;
  const source = visualAvailable ? commands : [];
  if (!visualAvailable) reasons.add("missing-visual-media");
  source.forEach((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      typeof (entry as Record<string, unknown>).kind !== "string"
    ) {
      reasons.add("malformed-visual-command");
      fallbackCount += 1;
      output.push(accessibleFallback(index));
      return;
    }
    const command = entry as Record<string, unknown>;
    if (!(VISUAL_KINDS as readonly string[]).includes(String(command.kind))) {
      reasons.add("unknown-visual-command");
      fallbackCount += 1;
      output.push(accessibleFallback(index));
      return;
    }
    const kind = command.kind as VisualKind;
    if (!validKnownCommand(command, kind)) {
      reasons.add("malformed-visual-command");
      fallbackCount += 1;
      output.push(accessibleFallback(index));
      return;
    }
    const aria = sanitizeLearnerFacingText(String(command.ariaLabel));
    aria.actions.forEach((action) => privacyActions.add(action));
    const clone: Record<string, unknown> = {
      ...command,
      ariaLabel: aria.text,
    };
    for (const key of [
      "text",
      "label",
      "sentence",
      "subject",
      "predicate",
      "dependentMarker",
      "token",
      "reason",
      "leftLabel",
      "rightLabel",
    ]) {
      if (typeof clone[key] === "string") {
        const safe = sanitizeLearnerFacingText(clone[key] as string);
        clone[key] = safe.text;
        safe.actions.forEach((action) => privacyActions.add(action));
      }
    }
    output.push(clone as TutorVisualCommandBase);
  });
  if (!visualAvailable || output.length === 0) {
    fallbackCount += 1;
    output.push(accessibleFallback(output.length));
  }
  return {
    commands: output,
    fallbackCount,
    reasonCodes: [...reasons],
    privacyActions: [...privacyActions],
  };
}

export interface LearnerMediaProjectionV1 {
  readonly visibleText: string;
  readonly locale: string;
  readonly pace: "slow" | "normal" | "brisk";
  readonly audioText: string | null;
  readonly audioUri: string | null;
  readonly captions: readonly TutorCaptionCueV1[];
  readonly boardCommands: readonly TutorVisualCommandBase[];
  readonly lessonMayContinueWithoutMedia: true;
  readonly captionsAlwaysVisible: true;
  readonly transcriptIncluded: false;
  readonly fallbackReasonCodes: readonly string[];
  readonly privacyActions: readonly PrivacyActionCode[];
}

export function mapLearnerMedia(
  spokenTurn: TutorSpokenTurnV1,
  media: TutorMediaStateV1,
  options: {
    readonly narration?: TutorNarrationV1;
    readonly boardCommands?: readonly unknown[];
  } = {},
): LearnerMediaProjectionV1 {
  const baseText = media.voiceAvailable
    ? spokenTurn.text
    : spokenTurn.fallbackText;
  const safeVisible = sanitizeLearnerFacingText(baseText);
  const visual = mapVisualBoardCommands(
    options.boardCommands ?? [],
    media.visualAvailable,
  );
  const captions =
    options.narration?.captions.map((cue) => {
      const safe = sanitizeLearnerFacingText(cue.text);
      return { ...cue, text: safe.text };
    }) ?? [
      {
        id: `${spokenTurn.id}-caption`,
        startMs: 0,
        endMs: Math.max(1, safeVisible.text.length * 45),
        text: safeVisible.text,
        speaker: "jarvis" as const,
      },
    ];
  const captionActions = new Set<PrivacyActionCode>();
  options.narration?.captions.forEach((cue) => {
    sanitizeLearnerFacingText(cue.text).actions.forEach((action) =>
      captionActions.add(action),
    );
  });
  const fallbackReasons: string[] = [];
  if (!media.voiceAvailable) fallbackReasons.push(`voice-${media.voiceReason}`);
  fallbackReasons.push(...visual.reasonCodes);
  return {
    visibleText: safeVisible.text,
    locale: spokenTurn.locale,
    pace: spokenTurn.pace,
    audioText: media.voiceAvailable ? safeVisible.text : null,
    audioUri:
      media.voiceAvailable && options.narration
        ? options.narration.audioUri
        : null,
    captions,
    boardCommands: visual.commands,
    lessonMayContinueWithoutMedia: true,
    captionsAlwaysVisible: true,
    transcriptIncluded: false,
    fallbackReasonCodes: fallbackReasons,
    privacyActions: [
      ...new Set([
        ...safeVisible.actions,
        ...captionActions,
        ...visual.privacyActions,
        ...(options.narration?.transcript
          ? (["raw-transcript-removed"] as const)
          : []),
      ]),
    ],
  };
}

export function getSupportedVisualCommandKinds(): readonly string[] {
  return VISUAL_KINDS;
}
