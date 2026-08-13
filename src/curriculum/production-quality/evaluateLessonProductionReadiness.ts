import { assessAnswerKeyAuthority, assessAnswerKeyContent } from './answerKeyAuthority'
import { detectCredentialRequests } from './credentialRequests'
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
  // Blocking gaps fail the lesson outright; review signals only hold it back
  // from READY, because the gate has doubt rather than a proven defect.
  const blockingCodes: ReadinessCode[] = []
  const reviewCodes: ReadinessCode[] = []
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
      blockingCodes.push('MISSING_INSTRUCTION')
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
    blockingCodes.push('MISSING_STUDENT_WORK')
    notes.push('lesson has no guided or independent student-work path at all')
  } else {
    if (requiresGuidedPractice && !hasGuidedPractice) {
      blockingCodes.push('MISSING_GUIDED_PRACTICE')
      notes.push('structured math/FinLit lesson has no guided-practice step')
    } else if (hasGuidedPractice) {
      flagIfGeneric('guided practice', lesson.guidedPractice)
    }
    if (!hasIndependentWork) {
      blockingCodes.push('MISSING_INDEPENDENT_WORK')
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
    blockingCodes.push('MISSING_SCORING_AUTHORITY')
    notes.push('no answer key, rubric, or scoring authority of any kind')
  } else {
    const hasContent = isSubstantive(authority.content)
    const requiresAnswerKey = lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT'

    if (requiresAnswerKey && (!hasContent || authority.kind !== 'ANSWER_KEY')) {
      blockingCodes.push('MISSING_ANSWER_KEY')
      notes.push('structured math/FinLit lesson requires a fixed authoritative answer key')
    } else if (!hasContent) {
      blockingCodes.push('MISSING_RUBRIC')
      notes.push('scoring authority declared but has no rubric/criteria content')
    } else {
      // An answer key claims a single correct answer, so it has to survive
      // more than a presence check. Rubrics and scoring judgment are left
      // exactly as they were — for open-ended subjects the criteria are the
      // authority, and holding them to a fixed-answer bar would be wrong.
      if (authority.kind === 'ANSWER_KEY') {
        const substance = assessAnswerKeyContent(authority.content, lesson.title)
        if (substance.hollowReasons.length > 0) {
          blockingCodes.push('ANSWER_KEY_NOT_SUBSTANTIVE')
          notes.push(`answer key has no scorable content: ${substance.hollowReasons.join('; ')}`)
        } else if (substance.doubtReasons.length > 0) {
          reviewCodes.push('ANSWER_KEY_CONTENT_UNCERTAIN')
          notes.push(
            `answer key content could not be confirmed as student-ready: ${substance.doubtReasons.join('; ')}`,
          )
        }

        // The gate cannot prove an answer true, so it requires a record of how
        // correctness was established and treats the absence of one as
        // unproven — never as correct.
        const keyAuthority = assessAnswerKeyAuthority(authority.verification)
        if (!keyAuthority.verified) {
          reviewCodes.push('ANSWER_KEY_UNVERIFIED')
          notes.push(`answer key scoring authority is not established: ${keyAuthority.reason}`)
        } else {
          // Recorded even on the passing path, so a READY report never reads as
          // if the gate checked the answers itself.
          notes.push(
            `answer key accepted on a recorded ${authority.verification?.method} attestation, not on anything this gate proved independently`,
          )
        }
      }

      if (
        lesson.subjectFamily === 'ELA_SOCIAL_STUDIES' &&
        authority.acceptableAnswerCriteria &&
        !isSubstantive(authority.acceptableAnswerCriteria)
      ) {
        // Only flags when the caller explicitly tracked this field and marked
        // it absent — "where appropriate" is a curriculum call this gate can't
        // make on its own, so an omitted field is not itself a gap.
        blockingCodes.push('MISSING_RUBRIC')
        notes.push('ELA/Social Studies rubric has no acceptable-answer criteria')
      }
    }
  }

  // Credential requests in student-facing text. Quoting changes the confidence,
  // not the visibility: a request that only appears inside quotes may be a
  // teaching example, so it goes to human review rather than disappearing.
  const credentialMatches = (
    [
      ['instruction', lesson.instruction],
      ['worked example', lesson.workedExample],
      ['guided practice', lesson.guidedPractice],
      ['independent work', lesson.independentWork],
      ['remediation', lesson.remediation],
      ['extension', lesson.extension],
      ['safe alternative', lesson.safeAlternative],
      ['scoring authority content', authority?.content],
      ['acceptable-answer criteria', authority?.acceptableAnswerCriteria],
    ] as const
  ).flatMap(([label, block]) =>
    detectCredentialRequests(block?.text).map((match) => ({ label, ...match })),
  )

  const directRequests = credentialMatches.filter((match) => !match.insideQuotedSpan)
  const quotedRequests = credentialMatches.filter((match) => match.insideQuotedSpan)

  if (directRequests.length > 0) {
    blockingCodes.push('CREDENTIAL_REQUEST')
    notes.push(
      `student-facing text asks for a real credential: ${directRequests
        .map((match) => `${match.label}: "${match.excerpt}"`)
        .join('; ')}`,
    )
  }
  if (quotedRequests.length > 0) {
    reviewCodes.push('CREDENTIAL_REQUEST_QUOTED')
    notes.push(
      `a credential request appears inside quotation marks and may be a teaching example or a real request — a human must decide: ${quotedRequests
        .map((match) => `${match.label}: "${match.excerpt}"`)
        .join('; ')}`,
    )
  }

  if (!isSubstantive(lesson.remediation)) {
    blockingCodes.push('MISSING_REMEDIATION')
    notes.push('no remediation path for students who need reteaching')
  }
  if (!isSubstantive(lesson.extension)) {
    blockingCodes.push('MISSING_EXTENSION')
    notes.push('no extension path for students ready to go further')
  }

  if (lesson.assessmentAlignment === 'NOT_ALIGNED') {
    blockingCodes.push('ASSESSMENT_NOT_ALIGNED')
    notes.push('assessment does not align to the lesson\'s stated objective')
  } else if (!lesson.assessmentAlignment || lesson.assessmentAlignment === 'UNKNOWN') {
    needsHumanReview = true
    notes.push('assessment alignment to the stated objective has not been verified')
  }

  if (lesson.requiresSourceIntegrity) {
    if (lesson.sourceIntegrityStatus === 'GAP') {
      blockingCodes.push('SOURCE_INTEGRITY_GAP')
      notes.push('source/provenance integrity gap flagged for this lesson')
    } else if (!lesson.sourceIntegrityStatus || lesson.sourceIntegrityStatus === 'UNKNOWN') {
      needsHumanReview = true
      notes.push('source integrity requires verification but has not been checked')
    }
  }

  if (lesson.requiresSafetyOrPrivacyReview) {
    const missingSafeAlternative = !isSubstantive(lesson.safeAlternative)
    if (lesson.safetyOrPrivacyStatus === 'GAP' || missingSafeAlternative) {
      blockingCodes.push('SAFETY_OR_PRIVACY_GAP')
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
  let codes: ReadinessCode[]
  if (blockingCodes.length > 0) {
    status = 'NOT_READY'
    codes = blockingCodes
  } else if (reviewCodes.length > 0 || needsHumanReview) {
    status = 'NEEDS_HUMAN_REVIEW'
    codes = [...reviewCodes, 'NEEDS_HUMAN_REVIEW']
  } else {
    status = 'READY'
    codes = ['READY']
  }

  return { lessonId: lesson.lessonId, status, codes, notes }
}
