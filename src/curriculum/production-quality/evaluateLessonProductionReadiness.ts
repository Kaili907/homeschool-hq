import { assessAnswerKeyAuthority, assessAnswerKeyContent } from './answerKeyAuthority'
import { detectCredentialRequests } from './credentialRequests'
import { assessResponseScoringContract } from './responseScoringContract'
import { assessScoringContentSubstance } from './scoringContentSubstance'
import { assessContentSpecificity } from './specificity'
import type {
  LessonContentBlock,
  LessonProductionInput,
  LessonReadinessResult,
  LessonReadinessStatus,
  ReadinessCode,
  ScoringAuthority,
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
  // on the subject. MATH legitimately requires a fixed answer key; ELA/Social
  // Studies, science and arts legitimately use a rubric (or parent/teacher
  // judgment) instead. Financial Literacy is the one subject that genuinely
  // runs both, so it declares an explicit contract and is checked against it.
  const authority = lesson.scoringAuthority
  const contract = lesson.responseScoring
  // Financial Literacy alone. A math lesson keeps the H2 fixed-answer-key
  // requirement whatever it attaches, so a contract cannot be used to opt out
  // of answer authority in the subject that most needs it.
  const usesMixedScoringContract =
    lesson.subjectFamily === 'MATH_STRUCTURED_FINLIT' &&
    lesson.structuredDiscipline === 'FINANCIAL_LITERACY'

  const assessFixedAuthority = (scoring: ScoringAuthority) => {
    // An answer key claims a single correct answer, so it has to survive more
    // than a presence check.
    const substance = assessAnswerKeyContent(scoring.content, lesson.title)
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
    // correctness was established and treats the absence of one as unproven —
    // never as correct.
    const keyAuthority = assessAnswerKeyAuthority(scoring.verification)
    if (!keyAuthority.verified) {
      reviewCodes.push('ANSWER_KEY_UNVERIFIED')
      notes.push(`answer key scoring authority is not established: ${keyAuthority.reason}`)
    } else {
      // Recorded even on the passing path, so a READY report never reads as
      // if the gate checked the answers itself.
      notes.push(
        `answer key accepted on a recorded ${scoring.verification?.method} attestation, not on anything this gate proved independently`,
      )
    }
  }

  /**
   * Judgment work is scored by criteria rather than by a key, so the criteria
   * carry the whole authority and have to be substantive in their own right.
   * `label` names which half of a MIXED lesson the criteria govern.
   */
  const assessRubricAuthority = (criteria: LessonContentBlock | undefined, label: string) => {
    if (!isSubstantive(criteria)) {
      blockingCodes.push('MISSING_RUBRIC')
      notes.push(`${label} has no rubric/criteria content`)
      return
    }
    const substance = assessScoringContentSubstance(criteria, lesson.title, {
      emptyReason: 'no rubric text is recorded, so there is nothing for a scorer to apply',
      placeholderReason: 'rubric text still contains an authoring placeholder',
      fillerReason: 'rubric text is a filler token rather than criteria',
      deferralReason: 'rubric defers the actual criteria elsewhere rather than stating them',
    })
    if (substance.hollowReasons.length > 0) {
      blockingCodes.push('RUBRIC_NOT_SUBSTANTIVE')
      notes.push(`${label} has no applicable criteria: ${substance.hollowReasons.join('; ')}`)
    } else if (substance.doubtReasons.length > 0) {
      reviewCodes.push('RUBRIC_CONTENT_UNCERTAIN')
      notes.push(
        `${label} could not be confirmed as scorable criteria: ${substance.doubtReasons.join('; ')}`,
      )
    }
  }

  if (!authority) {
    blockingCodes.push('MISSING_SCORING_AUTHORITY')
    notes.push('no answer key, rubric, or scoring authority of any kind')
  } else if (usesMixedScoringContract) {
    // Fail closed: without a declared mode the gate has no basis for relaxing
    // the fixed-answer bar, and no basis for holding a judgment lesson to it
    // either.
    if (!contract) {
      blockingCodes.push('MISSING_RESPONSE_SCORING_MODE')
      notes.push(
        'Financial Literacy lesson does not declare a response/scoring mode, so the gate cannot tell settleable work from judgment work',
      )
    } else {
      const contradictions = assessResponseScoringContract(contract, authority, [
        { label: 'guided practice', block: lesson.guidedPractice },
        { label: 'independent work', block: lesson.independentWork },
      ])
      for (const finding of contradictions) {
        if (finding.severity === 'BLOCKING') {
          blockingCodes.push('CONTRADICTORY_RESPONSE_SCORING')
          notes.push(`declared ${contract.mode} scoring contradicts the lesson: ${finding.reason}`)
        } else {
          reviewCodes.push('CONTRADICTORY_RESPONSE_SCORING')
          // Worded as doubt, because that is all a text heuristic can be.
          notes.push(
            `declared ${contract.mode} scoring may not match the lesson, and a human has to settle it: ${finding.reason}`,
          )
        }
      }

      const needsFixedAuthority =
        contract.mode === 'FIXED_OR_COMPUTATIONAL' || contract.mode === 'MIXED'
      const needsJudgmentAuthority =
        contract.mode === 'JUDGMENT_APPLICATION' || contract.mode === 'MIXED'

      if (needsFixedAuthority) {
        if (authority.kind !== 'ANSWER_KEY' || !isSubstantive(authority.content)) {
          blockingCodes.push('MISSING_ANSWER_KEY')
          notes.push(
            `${contract.mode} Financial Literacy lesson requires a fixed authoritative answer key for its settleable items`,
          )
        } else {
          assessFixedAuthority(authority)
        }
      }

      if (needsJudgmentAuthority) {
        // For MIXED the key is the fixed authority, so the judgment criteria
        // must be recorded separately; for pure judgment the authority's own
        // content is the rubric.
        assessRubricAuthority(
          contract.mode === 'MIXED' ? authority.rubric : authority.content,
          contract.mode === 'MIXED'
            ? 'judgment portion of this MIXED Financial Literacy lesson'
            : 'judgment Financial Literacy lesson',
        )
        if (
          authority.acceptableAnswerCriteria &&
          !isSubstantive(authority.acceptableAnswerCriteria)
        ) {
          blockingCodes.push('MISSING_RUBRIC')
          notes.push('Financial Literacy rubric has no acceptable-answer criteria')
        }
      }
    }
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
      // Rubrics and scoring judgment outside the Financial Literacy contract
      // are left exactly as they were — for open-ended subjects the criteria
      // are the authority, and holding them to a fixed-answer bar would be
      // wrong.
      if (authority.kind === 'ANSWER_KEY') {
        assessFixedAuthority(authority)
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
      ['judgment rubric criteria', authority?.rubric],
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
  // Deduplicated: a lesson can trip the same gap twice — two contradictions,
  // or a rubric that is both absent and missing its criteria — and the gap
  // summary counts lessons per code, not occurrences.
  if (blockingCodes.length > 0) {
    status = 'NOT_READY'
    codes = [...new Set(blockingCodes)]
  } else if (reviewCodes.length > 0 || needsHumanReview) {
    status = 'NEEDS_HUMAN_REVIEW'
    codes = [...new Set([...reviewCodes, 'NEEDS_HUMAN_REVIEW' as const])]
  } else {
    status = 'READY'
    codes = ['READY']
  }

  return { lessonId: lesson.lessonId, status, codes, notes }
}
