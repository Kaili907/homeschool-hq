function mean(values) {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
export function createParentTeacherReview(input) {
    const groups = [
        ["diagnostic", input.diagnosticScores],
        ["guided-practice", input.guidedScores],
        ["independent-attempt", input.independentScores],
        ["reassessment", input.reassessmentScores],
    ];
    const evidence = groups.map(([source, scores]) => ({
        source,
        itemCount: scores.length,
        meanScore: mean(scores),
        note: scores.length === 0
            ? "No scored evidence collected in this phase."
            : `Mean score ${Math.round(mean(scores) * 100)}% across ${scores.length} item(s).`,
    }));
    const persistentDifficulty = input.persistentDifficulty ?? false;
    const disputedGrading = input.disputedGrading ?? false;
    const strong = input.confidence.band === "strong";
    return {
        id: `review-${input.skillId}`,
        createdAt: new Date().toISOString(),
        skillId: input.skillId,
        learnerDisplayLabel: "Learner",
        evidence,
        confidence: input.confidence,
        misconceptionClassification: input.misconceptionClassification,
        strengths: strong
            ? ["Applied the target skill across more than one context."]
            : ["Participated in the full learning cycle and produced usable evidence."],
        needsSupport: strong
            ? []
            : ["Needs additional varied practice before the tutor can support a mastery claim."],
        suggestedNextSteps: strong
            ? ["Try a transfer problem in a new context and review the result with an adult."]
            : ["Reteach with an alternate visual explanation, then collect at least three independent responses across two contexts."],
        disputedGrading,
        persistentDifficulty,
        escalationRecommended: disputedGrading || persistentDifficulty,
        uncertaintyStatement: input.confidence.explanation,
        diagnosticClaimMade: false,
        highStakesPlacementDecisionMade: false,
        identifyingInformationRequested: false,
    };
}
//# sourceMappingURL=create-review.js.map