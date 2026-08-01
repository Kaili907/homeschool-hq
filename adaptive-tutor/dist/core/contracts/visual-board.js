import { Type } from "../schema/typebox.js";
import { StableIdSchema } from "./common.js";
const BaseCommand = Type.Object({
    id: StableIdSchema,
    durationMs: Type.Integer({ minimum: 0, maximum: 30000 }),
    ariaLabel: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
const ClearBoardCommand = Type.Composite([
    BaseCommand,
    Type.Object({ kind: Type.Literal("clear-board") }, { additionalProperties: false }),
]);
const SetTitleCommand = Type.Composite([
    BaseCommand,
    Type.Object({ kind: Type.Literal("set-title"), text: Type.String({ minLength: 1, maxLength: 200 }) }, { additionalProperties: false }),
]);
const AddTextCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("add-text"),
        text: Type.String({ minLength: 1, maxLength: 1200 }),
        region: Type.Union([
            Type.Literal("top"),
            Type.Literal("center"),
            Type.Literal("bottom"),
            Type.Literal("side"),
        ]),
        emphasis: Type.Union([
            Type.Literal("normal"),
            Type.Literal("strong"),
            Type.Literal("muted"),
        ]),
    }, { additionalProperties: false }),
]);
const DrawFractionCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("draw-fraction"),
        numerator: Type.Integer({ minimum: 0, maximum: 100 }),
        denominator: Type.Integer({ minimum: 1, maximum: 100 }),
        label: Type.String({ minLength: 1, maxLength: 100 }),
        representation: Type.Union([
            Type.Literal("bar"),
            Type.Literal("circle"),
            Type.Literal("set"),
        ]),
    }, { additionalProperties: false }),
]);
const DrawNumberLineCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("draw-number-line"),
        min: Type.Number(),
        max: Type.Number(),
        step: Type.Number({ exclusiveMinimum: 0 }),
        highlightedValues: Type.Array(Type.Number(), { maxItems: 30 }),
    }, { additionalProperties: false }),
]);
const ShowSentencePartsCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("show-sentence-parts"),
        sentence: Type.String({ minLength: 1, maxLength: 500 }),
        subject: Type.String({ maxLength: 300 }),
        predicate: Type.String({ maxLength: 300 }),
        dependentMarker: Type.Optional(Type.String({ maxLength: 100 })),
    }, { additionalProperties: false }),
]);
const HighlightCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("highlight"),
        targetCommandId: StableIdSchema,
        token: Type.String({ minLength: 1, maxLength: 200 }),
        reason: Type.String({ minLength: 1, maxLength: 500 }),
    }, { additionalProperties: false }),
]);
const RevealStepCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("reveal-step"),
        stepNumber: Type.Integer({ minimum: 1, maximum: 50 }),
        text: Type.String({ minLength: 1, maxLength: 800 }),
    }, { additionalProperties: false }),
]);
const CompareCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("compare"),
        leftLabel: Type.String({ minLength: 1, maxLength: 300 }),
        rightLabel: Type.String({ minLength: 1, maxLength: 300 }),
        relationship: Type.Union([
            Type.Literal("equal"),
            Type.Literal("not-equal"),
            Type.Literal("part-whole"),
            Type.Literal("complete-incomplete"),
        ]),
    }, { additionalProperties: false }),
]);
const AnnounceCommand = Type.Composite([
    BaseCommand,
    Type.Object({
        kind: Type.Literal("aria-announce"),
        text: Type.String({ minLength: 1, maxLength: 800 }),
        priority: Type.Union([Type.Literal("polite"), Type.Literal("assertive")]),
    }, { additionalProperties: false }),
]);
export const VisualBoardCommandSchema = Type.Union([
    ClearBoardCommand,
    SetTitleCommand,
    AddTextCommand,
    DrawFractionCommand,
    DrawNumberLineCommand,
    ShowSentencePartsCommand,
    HighlightCommand,
    RevealStepCommand,
    CompareCommand,
    AnnounceCommand,
], { $id: "VisualBoardCommand" });
//# sourceMappingURL=visual-board.js.map