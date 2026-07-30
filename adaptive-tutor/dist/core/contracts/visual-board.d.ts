import { type Static } from "../schema/typebox.js";
export declare const VisualBoardCommandSchema: import("../schema/typebox.js").TSchema<({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    kind: "clear-board";
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    text: string;
    kind: "set-title";
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    text: string;
    kind: "add-text";
    region: "top" | "center" | "bottom" | "side";
    emphasis: "strong" | "normal" | "muted";
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    label: string;
    kind: "draw-fraction";
    representation: "bar" | "circle" | "set";
    numerator: number;
    denominator: number;
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    min: number;
    max: number;
    kind: "draw-number-line";
    highlightedValues: number[];
    step: number;
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    subject: string;
    kind: "show-sentence-parts";
    sentence: string;
    predicate: string;
} & {
    dependentMarker?: string;
}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    kind: "highlight";
    targetCommandId: string;
    token: string;
    reason: string;
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    text: string;
    kind: "reveal-step";
    stepNumber: number;
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    kind: "compare";
    relationship: "equal" | "not-equal" | "part-whole" | "complete-incomplete";
    leftLabel: string;
    rightLabel: string;
} & {}) | ({
    id: string;
    durationMs: number;
    ariaLabel: string;
} & {} & {
    text: string;
    kind: "aria-announce";
    priority: "polite" | "assertive";
} & {})>;
export type VisualBoardCommand = Static<typeof VisualBoardCommandSchema>;
//# sourceMappingURL=visual-board.d.ts.map