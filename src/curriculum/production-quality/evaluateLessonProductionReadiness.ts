import { assessContentSpecificity } from './specificity'
import type {
  LessonContentBlock,
  LessonProductionInput,
  LessonReadinessResult,
  LessonReadinessStatus,
  ReadinessCode,
} from './types'

function isSubstantive(block?: LessonContentBlock | null): boolean {
  return block?.present === true
}

export function evaluateLessonProductionReadiness(
  lesson: LessonProductionInput,
): LessonReadinessResult {
  const codes: ReadinessCode[] = []
  const notes: string[] = []
  let needsHumanReview = false

  const flagIfGeneric = (label: string, block: LessonContentBlock | undefined) => {
    const signal = assessContentSpecificity(block, lesson.title)
    if (signal.evaluated && !signal.sufficientlySpecific) {
      needsHumanReview = true
      notes.push(`${label} reads as insufficiently specific: ${signal.reasons.join('; ')}`)
    }
  }

  // Instruction — required for every family except ARTS/RFL/PE/PROJECT,
  // where the activity itself carries the instructional load.
  if (lesson.subjectFamily !== 'ARTS_RFL_PE_PROJECT') {
    const hasInstruction = isSubstantive(lesson.instruction)
    const requiresWorkedExample = lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT'
    const hasWorkedExample = !requiresWorkedExample || isSubstantive(lesson.workedExample)

    if (!hasInstruction || !hasWorkedExample) {
      codes.push('MISSING_INSTRUCTION')
      notes.push(
        !hasInstruction
          ? 'no instruction/source content'
          : 'instruction present but missing the worked example structured math/FinLit lessons require',
      )
    } else {
      flagIfGeneric('instruction', lesson.instruction)
      if (requiresWorkedExample) flagIfGeneric('worked example', lesson.workedExample)
    }
  }

  // Work path: guided practice (math/FinLit only) + independent work (every family).
  const requiresGuidedPractice = lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT'
  const hasGuidedPractice = isSubstantive(lesson.guidedPractice)
  const hasIndependentWork = isSubstantive(lesson.independentWork)

  if (!hasIndependentWork && (!requiresGuidedPractice || !hasGuidedPractice)) {
    codes.push('MISSING_STUDENT_WORK')
    notes.push('lesson has no guided or independent student-work path at all')
  } else {
    if (requiresGuidedPractice && !hasGuidedPractice) {
      codes.push('MISSING_GUIDED_PRACTICE')
      notes.push('structured math/FinLit lesson has no guided-practice step')
    } else if (hasGuidedPractice) {
      flagIfGeneric('guided practice', lesson.guidedPractice)
    }
    if (!hasIndependentWork) {
      codes.push('MISSING_INDEPENDENT_WORK')
      notes.push('no independent/summative student work')
    } else {
      flagIfGeneric('independent work', lesson.independentWork)
    }
  }

  // Scoring authority — every lesson needs one; the acceptable kind depends
  // on the subject. MATH/FinLit legitimately requires a fixed answer key;
  // other families legitimately use a rubric (or parent/teacher judgment)
  // instead, and must not be held to the fixed-answer-key bar.
  const authority = lesson.scoringAuthority
  if (!authority) {
    codes.push('MISSING_SCORING_AUTHORITY')
    notes.push('no answer key, rubric, or scoring authority of any kind')
  } else {
    const hasContent = isSubstantive(authority.content)
    if (lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT') {
      if (!hasContent || authority.kind !== 'ANSWER_KEY') {
        codes.push('MISSING_ANSWER_KEY')
        notes.push('structured math/FinLit lesson requires a fixed authoritative answer key')
      }
    } else if (!hasContent) {
      codes.push('MISSING_RUBRIC')
      notes.push('scoring authority declared but has no rubric/criteria content')
    } else if (
      lesson.subjectFamily === 'ELA_SOCIAL_STUDIES' &&
      authority.acceptableAnswerCriteria &&
      !isSubstantive(authority.acceptableAnswerCriteria)
    ) {
      // Only flags when the caller explicitly tracked this field and marked
      // it absent — "where appropriate" is a curriculum call this gate can't
      // make on its own, so an omitted field is not itself a gap.
      codes.push('MISSING_RUBRIC')
      notes.push('ELA/Social Studies rubric has no acceptable-answer criteria')
    }
  }

  if (!isSubstantive(lesson.remediation)) {
    codes.push('MISSING_REMEDIATION')
    notes.push('no remediation path for students who need reteaching')
  }
  if (!isSubstantive(lesson.extension)) {
    codes.push('MISSING_EXTENSION')
    notes.push('no extension path for students ready to go further')
  }

  if (lesson.assessmentAlignment === 'NOT_ALIGNED') {
    codes.push('ASSESSMENT_NOT_ALIGNED')
    notes.push('assessment does not align to the lesson\'s stated objective')
  } else if (!lesson.assessmentAlignment || lesson.assessmentAlignment === 'UNKNOWN') {
    needsHumanReview = true
    notes.push('assessment alignment to the stated objective has not been verified')
  }

  if (lesson.requiresSourceIntegrity) {
    if (lesson.sourceIntegrityStatus === 'GAP') {
      codes.push('SOURCE_INTEGRITY_GAP')
      notes.push('source/provenance integrity gap flagged for this lesson')
    } else if (!lesson.sourceIntegrityStatus || lesson.sourceIntegrityStatus === 'UNKNOWN') {
      needsHumanReview = true
      notes.push('source integrity requires verification but has not been checked')
    }
  }

  if (lesson.requiresSafetyOrPrivacyReview) {
    const missingSafeAlternative = !isSubstantive(lesson.safeAlternative)
    if (lesson.safetyOrPrivacyStatus === 'GAP' || missingSafeAlternative) {
      codes.push('SAFETY_OR_PRIVACY_GAP')
      notes.push(
        missingSafeAlternative
          ? 'flagged for safety/privacy review but has no safe/private alternative on record'
          : 'safety/privacy gap flagged for this lesson',
      )
    } else if (!lesson.safetyOrPrivacyStatus || lesson.safetyOrPrivacyStatus === 'UNKNOWN') {
      needsHumanReview = true
      notes.push('safety/privacy review required but has not been completed')
    }
  }

  let status: LessonReadinessStatus
  if (codes.length > 0) {
    status = 'NOT_READY'
  } else if (needsHumanReview) {
    status = 'NEEDS_HUMAN_REVIEW'
    codes.push('NEEDS_HUMAN_REVIEW')
  } else {
    status = 'READY'
    codes.push('READY')
  }

  return { lessonId: lesson.lessonId, status, codes, notes }
}
