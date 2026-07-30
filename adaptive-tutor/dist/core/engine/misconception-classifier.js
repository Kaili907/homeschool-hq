export function classifyMisconceptions(skillId, definitions, evidence) {
    const observedTags = evidence.flatMap((item) => item.tags);
    const hypotheses = definitions
        .filter((definition) => definition.skillId === skillId)
        .map((definition) => {
        let support = 0;
        let contradiction = 0;
        const supportingTags = [];
        const contradictingTags = [];
        for (const signal of definition.distinguishingEvidence) {
            if (!observedTags.includes(signal.tag))
                continue;
            if (signal.direction === "supports") {
                support += signal.weight;
                supportingTags.push(signal.tag);
            }
            else if (signal.direction === "contradicts") {
                contradiction += signal.weight;
                contradictingTags.push(signal.tag);
            }
        }
        const evidenceCount = supportingTags.length + contradictingTags.length;
        const raw = evidenceCount === 0 ? 0.5 : (support + 1) / (support + contradiction + 2);
        const uncertainty = Math.max(0.12, 1 / Math.sqrt(evidenceCount + 1));
        let status = "insufficient-evidence";
        if (evidenceCount >= definition.minimumEvidenceCount) {
            status = raw >= 0.66 ? "probable" : raw <= 0.34 ? "unlikely" : "possible";
        }
        return {
            misconceptionId: definition.id,
            probability: raw,
            uncertainty,
            evidenceCount,
            supportingTags,
            contradictingTags,
            status,
        };
    })
        .sort((a, b) => b.probability - a.probability);
    const selected = hypotheses.find((hypothesis) => hypothesis.status === "probable") ?? null;
    return {
        skillId,
        hypotheses,
        selectedMisconceptionId: selected?.misconceptionId ?? null,
        uncertaintyStatement: selected
            ? `The response pattern is consistent with ${selected.misconceptionId}, but this is a learning hypothesis rather than a diagnosis.`
            : "The available responses do not distinguish one misconception with enough confidence, so the tutor will use a neutral explanation and gather more evidence.",
        doNotDiagnose: true,
    };
}
//# sourceMappingURL=misconception-classifier.js.map