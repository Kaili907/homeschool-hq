/**
 * Plain-JS port of the production readiness gate contract defined in
 * `src/curriculum/production-quality/` (branch mac/curriculum-production-gate-r1,
 * commit aee3e51 — already present on this branch too, but as TypeScript with
 * no build tooling installed in this worktree). Ported by hand rather than
 * imported so this package's self-check can run with plain `node` and no
 * bundler step; the logic below is line-for-line equivalent to that module
 * and should be replaced with a direct import once a TS runner is available
 * in this branch.
 *
 * This is a self-check tool only. It does not modify or re-author the gate
 * itself, which this branch does not own.
 */

export const READINESS_CODES = [
  'READY',
  'MISSING_INSTRUCTION',
  'MISSING_STUDENT_WORK',
  'MISSING_GUIDED_PRACTICE',
  'MISSING_INDEPENDENT_WORK',
  'MISSING_SCORING_AUTHORITY',
  'MISSING_ANSWER_KEY',
  'MISSING_RUBRIC',
  'MISSING_REMEDIATION',
  'MISSING_EXTENSION',
  'ASSESSMENT_NOT_ALIGNED',
  'SOURCE_INTEGRITY_GAP',
  'SAFETY_OR_PRIVACY_GAP',
  'NEEDS_HUMAN_REVIEW',
]

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'this', 'that', 'will', 'students', 'student', 'lesson', 'unit',
])

const GENERIC_SCAFFOLD_PHRASES = [
  /in this lesson,?\s+students will\s+/i,
  /complete the .*\bworksheet\b/i,
  /review the (key )?concepts? (from|of) this (unit|lesson)/i,
  /practice (the )?skills? (learned|covered) in this (unit|lesson)/i,
  /students will learn about/i,
  /this (lesson|unit) covers/i,
]

const MIN_WORDS_FOR_CONFIDENCE = 25
const MIN_UNIQUE_CONTENT_WORDS = 8

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

export function assessContentSpecificity(block, title) {
  if (!block?.present || !block.text || block.text.trim().length === 0) {
    return { evaluated: false, sufficientlySpecific: true, reasons: [] }
  }
  const text = block.text.trim()
  const reasons = []
  if (GENERIC_SCAFFOLD_PHRASES.some((pattern) => pattern.test(text))) {
    reasons.push('matches a known generic scaffold phrase')
  }
  const words = tokenize(text)
  if (words.length < MIN_WORDS_FOR_CONFIDENCE) {
    reasons.push(`content is only ${words.length} words, below the ${MIN_WORDS_FOR_CONFIDENCE}-word confidence floor`)
  }
  const titleWords = new Set(tokenize(title))
  const uniqueContentWords = new Set(words.filter((w) => !STOPWORDS.has(w) && !titleWords.has(w)))
  if (uniqueContentWords.size < MIN_UNIQUE_CONTENT_WORDS) {
    reasons.push(`only ${uniqueContentWords.size} distinct words beyond the title and common stopwords — reads as the title interpolated into generic text`)
  }
  return { evaluated: true, sufficientlySpecific: reasons.length === 0, reasons }
}

function isSubstantive(block) {
  return block?.present === true
}

export function evaluateLessonProductionReadiness(lesson) {
  const codes = []
  const notes = []
  let needsHumanReview = false

  const flagIfGeneric = (label, block) => {
    const signal = assessContentSpecificity(block, lesson.title)
    if (signal.evaluated && !signal.sufficientlySpecific) {
      needsHumanReview = true
      notes.push(`${label} reads as insufficiently specific: ${signal.reasons.join('; ')}`)
    }
  }

  if (lesson.subjectFamily !== 'ARTS_RFL_PE_PROJECT') {
    const hasInstruction = isSubstantive(lesson.instruction)
    const requiresWorkedExample = lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT'
    const hasWorkedExample = !requiresWorkedExample || isSubstantive(lesson.workedExample)
    if (!hasInstruction || !hasWorkedExample) {
      codes.push('MISSING_INSTRUCTION')
      notes.push(!hasInstruction ? 'no instruction/source content' : 'instruction present but missing the worked example structured math/FinLit lessons require')
    } else {
      flagIfGeneric('instruction', lesson.instruction)
      if (requiresWorkedExample) flagIfGeneric('worked example', lesson.workedExample)
    }
  }

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
      notes.push(missingSafeAlternative ? 'flagged for safety/privacy review but has no safe/private alternative on record' : 'safety/privacy gap flagged for this lesson')
    } else if (!lesson.safetyOrPrivacyStatus || lesson.safetyOrPrivacyStatus === 'UNKNOWN') {
      needsHumanReview = true
      notes.push('safety/privacy review required but has not been completed')
    }
  }

  let status
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

export function summarizeProductionGaps(lessonResults) {
  const codeCounts = Object.fromEntries(READINESS_CODES.map((c) => [c, 0]))
  const lessonsByCode = {}
  for (const result of lessonResults) {
    for (const code of result.codes) {
      codeCounts[code] += 1
      ;(lessonsByCode[code] ??= []).push(result.lessonId)
    }
  }
  return {
    totalLessons: lessonResults.length,
    readyCount: lessonResults.filter((r) => r.status === 'READY').length,
    needsHumanReviewCount: lessonResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW').length,
    notReadyCount: lessonResults.filter((r) => r.status === 'NOT_READY').length,
    codeCounts,
    lessonsByCode,
  }
}

export function evaluateCourseProductionReadiness(course) {
  if (course.lessons.length === 0) {
    return {
      courseId: course.courseId,
      status: 'NOT_READY',
      lessonResults: [],
      gapSummary: summarizeProductionGaps([]),
      notes: ['course has no lessons to evaluate'],
    }
  }
  const lessonResults = course.lessons.map(evaluateLessonProductionReadiness)
  let status
  if (lessonResults.some((r) => r.status === 'NOT_READY')) status = 'NOT_READY'
  else if (lessonResults.some((r) => r.status === 'NEEDS_HUMAN_REVIEW')) status = 'NEEDS_HUMAN_REVIEW'
  else status = 'READY'
  return { courseId: course.courseId, status, lessonResults, gapSummary: summarizeProductionGaps(lessonResults), notes: [] }
}
