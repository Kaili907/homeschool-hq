import { defaultMediaFallback } from "../core/index.js";
import { boardBase, multipleChoice, teachingTurn } from "./builders.js";
const skillId = "math-equivalent-fractions";
const diagnosticItems = [
    multipleChoice({
        id: "math-diagnostic-one",
        skillId,
        purpose: "diagnostic",
        subject: "math",
        prompt: "Which fraction has the same value as 1/2?",
        options: [
            { id: "option-two-fourths", text: "2/4" },
            { id: "option-two-thirds", text: "2/3" },
            { id: "option-three-fifths", text: "3/5" },
            { id: "option-four-fifths", text: "4/5" },
        ],
        correctOptionId: "option-two-fourths",
    }),
    multipleChoice({
        id: "math-diagnostic-two",
        skillId,
        purpose: "diagnostic",
        subject: "math",
        prompt: "A bar is split into 6 equal parts and 3 are shaded. Which fraction names the same amount?",
        options: [
            { id: "option-one-half", text: "1/2" },
            { id: "option-three-thirds", text: "3/3" },
            { id: "option-three-ninths", text: "3/9" },
            { id: "option-six-thirds", text: "6/3" },
        ],
        correctOptionId: "option-one-half",
    }),
];
const guidedItems = [
    multipleChoice({
        id: "math-guided-one",
        skillId,
        purpose: "guided-practice",
        subject: "math",
        prompt: "Use the fraction bars: 3/6 is equal to which fraction?",
        options: [
            { id: "option-guided-one-half", text: "1/2" },
            { id: "option-guided-three-twelfths", text: "3/12" },
            { id: "option-guided-six-thirds", text: "6/3" },
        ],
        correctOptionId: "option-guided-one-half",
    }),
    multipleChoice({
        id: "math-guided-two",
        skillId,
        purpose: "guided-practice",
        subject: "math",
        prompt: "If both parts of 2/3 are multiplied by 2, what equivalent fraction is made?",
        options: [
            { id: "option-guided-four-sixths", text: "4/6" },
            { id: "option-guided-four-thirds", text: "4/3" },
            { id: "option-guided-two-sixths", text: "2/6" },
        ],
        correctOptionId: "option-guided-four-sixths",
    }),
];
const independentItems = [
    multipleChoice({
        id: "math-independent-one",
        skillId,
        purpose: "independent-mastery",
        subject: "math",
        prompt: "Which fraction is equivalent to 4/8?",
        options: [
            { id: "option-independent-one-half", text: "1/2" },
            { id: "option-independent-four-fourths", text: "4/4" },
            { id: "option-independent-eight-fourths", text: "8/4" },
        ],
        correctOptionId: "option-independent-one-half",
    }),
    multipleChoice({
        id: "math-independent-two",
        skillId,
        purpose: "independent-mastery",
        subject: "math",
        prompt: "Which fraction is equivalent to 2/5?",
        options: [
            { id: "option-independent-four-tenths", text: "4/10" },
            { id: "option-independent-two-tenths", text: "2/10" },
            { id: "option-independent-four-fifths", text: "4/5" },
        ],
        correctOptionId: "option-independent-four-tenths",
    }),
    multipleChoice({
        id: "math-independent-three",
        skillId,
        purpose: "independent-mastery",
        subject: "math",
        prompt: "Which fraction is equivalent to 3/4?",
        options: [
            { id: "option-independent-six-eighths", text: "6/8" },
            { id: "option-independent-three-eighths", text: "3/8" },
            { id: "option-independent-six-fourths", text: "6/4" },
        ],
        correctOptionId: "option-independent-six-eighths",
    }),
];
const reassessmentItems = [
    multipleChoice({
        id: "math-reassessment-one",
        skillId,
        purpose: "reassessment",
        subject: "math",
        prompt: "Which fraction is equivalent to 5/10?",
        options: [
            { id: "option-reassessment-one-half", text: "1/2" },
            { id: "option-reassessment-five-fifths", text: "5/5" },
            { id: "option-reassessment-ten-fifths", text: "10/5" },
        ],
        correctOptionId: "option-reassessment-one-half",
    }),
    multipleChoice({
        id: "math-reassessment-two",
        skillId,
        purpose: "reassessment",
        subject: "math",
        prompt: "Which fraction is equivalent to 6/9?",
        options: [
            { id: "option-reassessment-two-thirds", text: "2/3" },
            { id: "option-reassessment-six-thirds", text: "6/3" },
            { id: "option-reassessment-three-ninths", text: "3/9" },
        ],
        correctOptionId: "option-reassessment-two-thirds",
    }),
];
const visualTurnOne = teachingTurn({
    id: "math-teach-fraction-bars",
    skillId,
    text: "First useful step: equivalent fractions cover the same amount, even when the pieces are split differently. Compare the two bars, then tell yourself what stayed the same.",
    boardCommands: [
        ...boardBase("math-board-bars", "Same amount, different pieces"),
        {
            id: "math-board-half",
            kind: "draw-fraction",
            numerator: 1,
            denominator: 2,
            label: "1/2",
            representation: "bar",
            durationMs: 300,
            ariaLabel: "A fraction bar showing one out of two equal parts shaded",
        },
        {
            id: "math-board-two-fourths",
            kind: "draw-fraction",
            numerator: 2,
            denominator: 4,
            label: "2/4",
            representation: "bar",
            durationMs: 300,
            ariaLabel: "A fraction bar showing two out of four equal parts shaded",
        },
        {
            id: "math-board-compare",
            kind: "compare",
            leftLabel: "1/2",
            rightLabel: "2/4",
            relationship: "equal",
            durationMs: 250,
            ariaLabel: "One half and two fourths are equal",
        },
    ],
});
const visualTurnTwo = teachingTurn({
    id: "math-teach-same-factor",
    skillId,
    text: "Next useful step: multiply or divide the numerator and denominator by the same nonzero number. That changes the names of the pieces, not the amount.",
    boardCommands: [
        ...boardBase("math-board-factor", "Use the same factor"),
        {
            id: "math-board-step-one",
            kind: "reveal-step",
            stepNumber: 1,
            text: "1 × 2 = 2",
            durationMs: 250,
            ariaLabel: "Step one: one times two equals two",
        },
        {
            id: "math-board-step-two",
            kind: "reveal-step",
            stepNumber: 2,
            text: "2 × 2 = 4",
            durationMs: 250,
            ariaLabel: "Step two: two times two equals four",
        },
        {
            id: "math-board-equality",
            kind: "compare",
            leftLabel: "1/2",
            rightLabel: "2/4",
            relationship: "equal",
            durationMs: 250,
            ariaLabel: "One half equals two fourths",
        },
    ],
});
const alternateTurn = teachingTurn({
    id: "math-teach-number-line",
    skillId,
    text: "Alternate explanation: place both fractions on a number line. Different fraction names are equivalent when they land on the same point.",
    boardCommands: [
        ...boardBase("math-board-line", "Same point on a number line"),
        {
            id: "math-board-number-line",
            kind: "draw-number-line",
            min: 0,
            max: 1,
            step: 0.25,
            highlightedValues: [0.5],
            durationMs: 400,
            ariaLabel: "Number line from zero to one with one half highlighted",
        },
        {
            id: "math-board-line-text",
            kind: "add-text",
            text: "1/2 and 2/4 both land at 0.5",
            region: "bottom",
            emphasis: "strong",
            durationMs: 200,
            ariaLabel: "One half and two fourths both land at zero point five",
        },
    ],
});
export const mathTutorProgram = {
    id: "demo-math-equivalent-fractions",
    version: "0.2.0",
    title: "Equivalent Fractions Demonstration",
    subject: "math",
    gradeBand: { min: 4, max: 6, label: "Grades 4–6" },
    locale: "en-US",
    targetSkillId: skillId,
    skillGraph: {
        id: "math-fraction-skill-graph",
        version: "0.2.0",
        nodes: [
            {
                id: "math-fraction-parts",
                title: "Interpret fraction parts",
                description: "Interpret numerator and denominator as parts of a whole.",
                subject: "math",
                gradeBand: { min: 3, max: 5, label: "Grades 3–5" },
                observableEvidence: ["Identifies equal parts and the shaded count."],
            },
            {
                id: skillId,
                title: "Recognize equivalent fractions",
                description: "Recognize and generate fractions with the same value.",
                subject: "math",
                gradeBand: { min: 4, max: 6, label: "Grades 4–6" },
                observableEvidence: ["Matches visual models.", "Uses the same factor on numerator and denominator."],
            },
        ],
        edges: [
            {
                prerequisiteSkillId: "math-fraction-parts",
                dependentSkillId: skillId,
                strength: "required",
                rationale: "Equivalent fractions depend on understanding equal-sized parts and part counts.",
            },
        ],
    },
    diagnosticItems,
    misconceptions: [
        {
            id: "math-change-one-number-only",
            skillId,
            label: "Changes only numerator or denominator",
            learnerSafeDescription: "You may be changing only one number, even though equivalent fractions require the same factor for both numbers.",
            distinguishingEvidence: [
                {
                    tag: "changes-denominator-only",
                    direction: "supports",
                    weight: 1,
                    explanation: "The selected answer changed the denominator without preserving the value.",
                },
                {
                    tag: "uses-same-factor",
                    direction: "contradicts",
                    weight: 1,
                    explanation: "The response used the same factor on both parts.",
                },
            ],
            alternateExplanations: ["Fraction bars", "Number line"],
            minimumEvidenceCount: 1,
            escalationAfterRepeatedCycles: 2,
        },
        {
            id: "math-whole-number-comparison",
            skillId,
            label: "Compares numerator and denominator as whole numbers",
            learnerSafeDescription: "You may be comparing the two written numbers instead of comparing the amount the fraction represents.",
            distinguishingEvidence: [
                {
                    tag: "compares-whole-numbers",
                    direction: "supports",
                    weight: 1,
                    explanation: "The selected response appears based on larger written numbers.",
                },
                {
                    tag: "matches-visual-value",
                    direction: "contradicts",
                    weight: 1,
                    explanation: "The response matched fractions by represented amount.",
                },
            ],
            alternateExplanations: ["Number line", "Area model"],
            minimumEvidenceCount: 1,
            escalationAfterRepeatedCycles: 2,
        },
    ],
    teachingSequences: [
        { misconceptionId: "math-change-one-number-only", turns: [visualTurnOne, visualTurnTwo] },
        { misconceptionId: "math-whole-number-comparison", turns: [visualTurnOne, alternateTurn] },
        { misconceptionId: "default", turns: [visualTurnOne, visualTurnTwo] },
        { misconceptionId: "default", turns: [alternateTurn] },
    ],
    guidedPractice: {
        id: "math-guided-contract",
        skillId,
        items: guidedItems,
        hintLadder: [
            {
                level: 1,
                prompt: "Look for two fractions that cover the same portion of the bar.",
                revealsAnswer: false,
                visualSupportCommandIds: ["math-board-half", "math-board-two-fourths"],
            },
            {
                level: 2,
                prompt: "Check whether the numerator and denominator changed by the same factor.",
                revealsAnswer: false,
                visualSupportCommandIds: ["math-board-step-one", "math-board-step-two"],
            },
        ],
        maxSupportedAttemptsPerItem: 3,
        askLearnerToExplain: true,
        alternateExplanationAllowed: true,
        feedbackPolicy: "immediate",
    },
    independentMastery: {
        id: "math-independent-contract",
        skillId,
        items: independentItems,
        minimumEvidenceCount: 3,
        minimumDistinctContexts: 2,
        minimumMeanScore: 0.75,
        maximumUncertainty: 0.45,
        reassessmentRequired: true,
        singleAnswerCanEstablishMastery: false,
        supportsTeacherOverride: true,
        placementDecisionAllowed: false,
    },
    reassessmentItems,
    mediaFallback: defaultMediaFallback,
    persistentDifficultyCycleLimit: 2,
};
export const mathRuntimeHooks = {
    evidenceTagsFor: (item, input, evaluation) => {
        const selected = input.selectedOptionIds?.[0] ?? "no-selection";
        const tags = [
            evaluation.score === 1 ? "uses-same-factor" : "needs-more-evidence",
            evaluation.score === 1 ? "matches-visual-value" : "value-mismatch",
        ];
        if (["option-two-thirds", "option-three-ninths", "option-guided-two-sixths"].includes(selected)) {
            tags.push("changes-denominator-only");
        }
        if (["option-four-fifths", "option-six-thirds", "option-independent-eight-fourths"].includes(selected)) {
            tags.push("compares-whole-numbers");
        }
        tags.push(item.id);
        return tags;
    },
    feedbackFor: (_item, _input, evaluation) => evaluation.score === 1
        ? "Yes—the two fractions name the same amount."
        : "Not yet. Compare the amount first, then check whether both numbers changed by the same factor.",
};
//# sourceMappingURL=math-interaction.js.map