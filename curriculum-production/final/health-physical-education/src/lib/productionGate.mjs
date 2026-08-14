/**
 * Plain-JS projection of the H3 production-readiness gate at
 * mac/curriculum-production-gate-h3@49b3c4b86cc7764627bd4cfbd752222849831abf.
 *
 * This corpus only projects the ARTS_RFL_PE_PROJECT family. The implementation
 * below intentionally covers that family's H3 path exactly: independent work,
 * real rubric/judgment authority, remediation, extension, alignment,
 * credential-request detection, and verified safety/privacy alternatives.
 * Fixed answer keys are never synthesized for Health/PE judgment work.
 */

export const READINESS_CODES = [
  'READY',
  'MISSING_STUDENT_WORK',
  'MISSING_INDEPENDENT_WORK',
  'MISSING_SCORING_AUTHORITY',
  'MISSING_RUBRIC',
  'MISSING_REMEDIATION',
  'MISSING_EXTENSION',
  'ASSESSMENT_NOT_ALIGNED',
  'SOURCE_INTEGRITY_GAP',
  'SAFETY_OR_PRIVACY_GAP',
  'TRANSFER_AUTHORITY_CONFLICT',
  'CREDENTIAL_REQUEST',
  'CREDENTIAL_REQUEST_QUOTED',
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

const CREDENTIAL_REQUEST_PATTERNS = [
  /\benter (?:your|the|their) (?:real |actual |family'?s |parents?'? )?(?:bank account|account|card|credit card|debit card|routing) number\b/gi,
  /\benter (?:your|the|their) (?:real |actual |family'?s |parents?'? )?(?:password|passcode|pin|ssn|social security)\b/gi,
  /\bwhat is your (?:real |actual |family'?s |parents?'? )?(?:bank account|account number|card|credit card|password|passcode|pin|ssn|social security)\b/gi,
  /\btype (?:your|in your|the) (?:real |actual )?(?:password|passcode|pin|account number|card number|ssn|social security)\b/gi,
  /\b(?:send|share|give|tell|post|email) (?:me |us |it )?(?:your|the) (?:real |actual |family'?s |parents?'? )?(?:password|passcode|pin|account number|card number|ssn|social security|login)\b/gi,
]

const PROHIBITION_CUES =
  /\b(?:never|not|n'?t|do ?n'?t|cannot|can'?t|avoid|refuse|refusing|beware|nobody|no one)\b/i
const CLAUSE_BOUNDARIES = new Set(['.', '!', '?', ';', ':', '\n'])
const QUOTE_PAIRS = [
  /"([^"]*)"/g,
  /“([^”]*)”/g,
  /(^|[\s([])'((?:[^']|(?<=\w)'(?=\w))*)'/g,
  /‘([^’]*)’/g,
]

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
  if (words.length < 25) reasons.push(`content is only ${words.length} words, below the 25-word confidence floor`)
  const titleWords = new Set(tokenize(title))
  const uniqueContentWords = new Set(words.filter((word) => !STOPWORDS.has(word) && !titleWords.has(word)))
  if (uniqueContentWords.size < 8) {
    reasons.push(`only ${uniqueContentWords.size} distinct words beyond the title and common stopwords — reads as the title interpolated into generic text`)
  }
  return { evaluated: true, sufficientlySpecific: reasons.length === 0, reasons }
}

function clausePrecedingMatch(text, index) {
  let start = 0
  for (let i = index - 1; i >= 0; i -= 1) {
    if (CLAUSE_BOUNDARIES.has(text[i])) {
      start = i + 1
      break
    }
  }
  return text.slice(start, index)
}

function quotedSpans(text) {
  const spans = []
  for (const pattern of QUOTE_PAIRS) {
    for (const match of text.matchAll(pattern)) {
      const inner = match[match.length - 1] ?? ''
      const start = match.index + match[0].length - inner.length - 1
      spans.push({ start, end: start + inner.length })
    }
  }
  return spans
}

export function detectCredentialRequests(text) {
  if (!text || text.trim().length === 0) return []
  const spans = quotedSpans(text)
  const matches = []
  for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (PROHIBITION_CUES.test(clausePrecedingMatch(text, start))) continue
      matches.push({
        excerpt: match[0],
        insideQuotedSpan: spans.some((span) => start >= span.start && end <= span.end),
      })
    }
  }
  return matches
}

function isSubstantive(block) {
  return block?.present === true
}

export function evaluateLessonProductionReadiness(lesson) {
  if (lesson.subjectFamily !== 'ARTS_RFL_PE_PROJECT') {
    throw new Error(`Health/PE H3 projection does not support subject family ${lesson.subjectFamily}`)
  }

  const blockingCodes = []
  const reviewCodes = []
  const notes = []
  let needsHumanReview = false

  const independent = lesson.independentWork
  if (!isSubstantive(independent)) {
    blockingCodes.push('MISSING_STUDENT_WORK', 'MISSING_INDEPENDENT_WORK')
    notes.push('lesson has no independent/summative student-work path')
  } else {
    const specificity = assessContentSpecificity(independent, lesson.title)
    if (specificity.evaluated && !specificity.sufficientlySpecific) {
      needsHumanReview = true
      notes.push(`independent work reads as insufficiently specific: ${specificity.reasons.join('; ')}`)
    }
  }

  const authority = lesson.scoringAuthority
  if (!authority) {
    blockingCodes.push('MISSING_SCORING_AUTHORITY')
    notes.push('no rubric or scoring authority of any kind')
  } else if (authority.kind === 'ANSWER_KEY') {
    blockingCodes.push('MISSING_RUBRIC')
    notes.push('Health/PE judgment work must use a rubric or scoring judgment, not a synthesized fixed answer key')
  } else if (!isSubstantive(authority.content) || !authority.content.text?.trim()) {
    blockingCodes.push('MISSING_RUBRIC')
    notes.push('scoring authority declared but has no rubric/criteria content')
  }

  const credentialMatches = [
    ['independent work', lesson.independentWork],
    ['remediation', lesson.remediation],
    ['extension', lesson.extension],
    ['safe alternative', lesson.safeAlternative],
    ['scoring authority content', authority?.content],
  ].flatMap(([label, block]) => detectCredentialRequests(block?.text).map((match) => ({ label, ...match })))

  const directRequests = credentialMatches.filter((match) => !match.insideQuotedSpan)
  const quotedRequests = credentialMatches.filter((match) => match.insideQuotedSpan)
  if (directRequests.length > 0) {
    blockingCodes.push('CREDENTIAL_REQUEST')
    notes.push(`student-facing text asks for a real credential: ${directRequests.map((m) => `${m.label}: "${m.excerpt}"`).join('; ')}`)
  }
  if (quotedRequests.length > 0) {
    reviewCodes.push('CREDENTIAL_REQUEST_QUOTED')
    notes.push(`a credential request appears inside quotation marks and requires human review: ${quotedRequests.map((m) => `${m.label}: "${m.excerpt}"`).join('; ')}`)
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
    notes.push('assessment does not align to the stated objective')
  } else if (!lesson.assessmentAlignment || lesson.assessmentAlignment === 'UNKNOWN') {
    needsHumanReview = true
    notes.push('assessment alignment has not been verified')
  }

  if (lesson.requiresSourceIntegrity) {
    if (lesson.sourceIntegrityStatus === 'GAP') {
      blockingCodes.push('SOURCE_INTEGRITY_GAP')
    } else if (!lesson.sourceIntegrityStatus || lesson.sourceIntegrityStatus === 'UNKNOWN') {
      needsHumanReview = true
    }
  }

  if (lesson.requiresSafetyOrPrivacyReview) {
    const missingSafeAlternative = !isSubstantive(lesson.safeAlternative)
    if (lesson.safetyOrPrivacyStatus === 'GAP' || missingSafeAlternative) {
      blockingCodes.push('SAFETY_OR_PRIVACY_GAP')
      notes.push(missingSafeAlternative ? 'no safe/private alternative on record' : 'safety/privacy gap flagged')
    } else if (!lesson.safetyOrPrivacyStatus || lesson.safetyOrPrivacyStatus === 'UNKNOWN') {
      needsHumanReview = true
    }
  }

  if (lesson.requiresTransferConsistency) {
    if (lesson.transferConsistencyStatus !== 'CONSISTENT') {
      blockingCodes.push('TRANSFER_AUTHORITY_CONFLICT')
      notes.push(...(lesson.transferConsistencyFindings ?? ['learner task, transfer evidence, equal-credit expectation, and adult authority are not semantically consistent']))
    }
  }

  if (blockingCodes.length > 0) {
    return { lessonId: lesson.lessonId, status: 'NOT_READY', codes: [...new Set(blockingCodes)], notes }
  }
  if (reviewCodes.length > 0 || needsHumanReview) {
    return { lessonId: lesson.lessonId, status: 'NEEDS_HUMAN_REVIEW', codes: [...new Set([...reviewCodes, 'NEEDS_HUMAN_REVIEW'])], notes }
  }
  return { lessonId: lesson.lessonId, status: 'READY', codes: ['READY'], notes }
}

export function summarizeProductionGaps(lessonResults) {
  const codeCounts = Object.fromEntries(READINESS_CODES.map((code) => [code, 0]))
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
