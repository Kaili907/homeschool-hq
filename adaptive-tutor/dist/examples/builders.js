export const demoGradeBand = { min: 4, max: 6, label: "Grades 4–6" };
export function multipleChoice(args) {
    return {
        id: args.id,
        skillId: args.skillId,
        purpose: args.purpose,
        subject: args.subject,
        gradeBand: demoGradeBand,
        locale: "en-US",
        prompt: args.prompt,
        maxAttempts: args.purpose === "guided-practice" ? 3 : 1,
        estimatedSeconds: 45,
        tags: args.tags ?? [],
        noCameraRequired: true,
        identifyingInformationRequested: false,
        kind: "multiple-choice",
        options: args.options,
        correctOptionIds: [args.correctOptionId],
        allowMultiple: false,
        shuffle: false,
    };
}
export function shortAnswer(args) {
    return {
        id: args.id,
        skillId: args.skillId,
        purpose: args.purpose,
        subject: args.subject,
        gradeBand: demoGradeBand,
        locale: "en-US",
        prompt: args.prompt,
        maxAttempts: args.purpose === "guided-practice" ? 3 : 1,
        estimatedSeconds: 75,
        tags: args.tags ?? [],
        noCameraRequired: true,
        identifyingInformationRequested: false,
        kind: "short-answer",
        acceptedAnswers: args.acceptedAnswers,
        caseSensitive: false,
        trimWhitespace: true,
        normalization: "basic-text",
    };
}
export function teachingTurn(args) {
    return {
        id: args.id,
        phase: "teach-visually",
        skillId: args.skillId,
        learnerMessage: args.text,
        spokenTurn: {
            id: `${args.id}-spoken`,
            text: args.text,
            locale: "en-US",
            pace: "normal",
            emphasisTokens: [],
            canInterrupt: true,
            requireLearnerResponse: args.asksLearnerToParticipate ?? true,
            fallbackText: args.text,
            captionsRequired: true,
            transcriptRequired: true,
            claimsHumanIdentity: false,
        },
        boardCommands: args.boardCommands,
        assessmentItem: null,
        expectedInput: "continue",
        oneUsefulStepOnly: true,
        givesFinalGradedAnswer: false,
        asksLearnerToParticipate: args.asksLearnerToParticipate ?? true,
        uncertaintyStatement: "This explanation is a teaching choice based on limited response evidence, not a diagnosis.",
        confidence: null,
        alternateExplanationAvailable: true,
        escalationReason: null,
        jarvisClaimsHumanIdentity: false,
    };
}
export function boardBase(id, title) {
    return [
        { id: `${id}-clear`, kind: "clear-board", durationMs: 0, ariaLabel: "Clear teaching board" },
        { id: `${id}-title`, kind: "set-title", text: title, durationMs: 0, ariaLabel: `Teaching board title: ${title}` },
    ];
}
//# sourceMappingURL=builders.js.map