// Projects one generated (package, scoring guide) pair — plus the lesson IR
// they were built from — into the generic LessonProductionInput contract
// consumed by src/curriculum/production-quality. Kept separate from lib.mjs
// so the gate-facing shape can evolve without touching the generator.

export function aggregateSourceIntegrity(textRefs) {
  if (!textRefs.length) return undefined
  const statuses = textRefs.map((t) => t.sourceIntegrityStatus)
  if (statuses.includes('GAP')) return 'GAP'
  if (statuses.includes('VERIFIED')) return 'VERIFIED'
  return 'UNKNOWN'
}

export function projectToLessonProductionInput(ir, pkg, guide) {
  const requiresSourceIntegrity = ir.textRefs.length > 0

  return {
    lessonId: ir.lessonId,
    title: ir.title,
    courseId: ir.courseId,
    unitId: `${ir.courseId}-u${String(ir.unitNumber).padStart(2, '0')}`,
    subjectFamily: 'ELA_SOCIAL_STUDIES',

    instruction: pkg.guidedSupport,
    independentWork: pkg.independentEvidenceTask,

    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: guide.scoringAuthority.rubric.length > 0,
        text: [
          guide.scoringAuthority.scoringGuidance,
          ...guide.scoringAuthority.rubric.map((r) => r.description),
        ]
          .filter(Boolean)
          .join(' '),
      },
      acceptableAnswerCriteria: guide.scoringAuthority.acceptableAnswerCriteria,
    },

    remediation: pkg.remediation,
    extension: pkg.extension,

    // The independent task is built directly from this lesson's own
    // standards/objectives, so alignment is true by construction rather than
    // eyeballed.
    assessmentAlignment: ir.standards.length > 0 ? 'ALIGNED' : 'UNKNOWN',

    requiresSourceIntegrity,
    sourceIntegrityStatus: requiresSourceIntegrity ? aggregateSourceIntegrity(ir.textRefs) : undefined,

    // Safety/privacy review is a gate concern this generator does not
    // evaluate per lesson (the gate's own comments scope it to science labs,
    // PE, arts performance, and RFL discussion topics) — left false rather
    // than guessed.
    requiresSafetyOrPrivacyReview: false,
  }
}
