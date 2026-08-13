/**
 * Detects lesson text that would itself ask a learner for a real credential.
 *
 * This deliberately differs from the RFL/FinLit corpus lint
 * (`curriculum-production/student-work/ready-for-life-financial-literacy/
 * src/validate.ts :: lintNoRealCredentialRequests`), which strips single-quoted
 * spans before matching so that fictional scam-message examples are not
 * flagged. That strip is unconditional, so a genuine request for a real
 * credential disappears from the lint the moment it sits inside quotes.
 *
 * Here, quoting changes how confident the gate is, never whether it can see
 * the request: an unquoted request is a blocking gap, and a request that only
 * appears inside quotes is surfaced for human review, because the gate cannot
 * tell a teaching example apart from a real request hidden in quotation marks.
 *
 * Prohibitions are the one thing genuinely filtered out. "Never enter your
 * password into a link that arrives by text" is the core sentence of the
 * safety curriculum this gate serves; it is not a request, and reporting it —
 * even as a review item — would bury every real finding under the lessons
 * that exist to teach refusal.
 */

export interface CredentialRequestMatch {
  /** The matched text, for the reviewer to read in the report. */
  readonly excerpt: string
  /** True when this occurrence sits inside a quoted span. */
  readonly insideQuotedSpan: boolean
}

const CREDENTIAL_REQUEST_PATTERNS: readonly RegExp[] = [
  /\benter (?:your|the|their) (?:real |actual |family'?s |parents?'? )?(?:bank account|account|card|credit card|debit card|routing) number\b/gi,
  /\benter (?:your|the|their) (?:real |actual |family'?s |parents?'? )?(?:password|passcode|pin|ssn|social security)\b/gi,
  /\bwhat is your (?:real |actual |family'?s |parents?'? )?(?:bank account|account number|card|credit card|password|passcode|pin|ssn|social security)\b/gi,
  /\btype (?:your|in your|the) (?:real |actual )?(?:password|passcode|pin|account number|card number|ssn|social security)\b/gi,
  /\b(?:send|share|give|tell|post|email) (?:me |us |it )?(?:your|the) (?:real |actual |family'?s |parents?'? )?(?:password|passcode|pin|account number|card number|ssn|social security|login)\b/gi,
]

/**
 * Cues that the surrounding clause forbids the action rather than asking for
 * it. Scoped to the clause the match sits in, so "Do not skip this step:
 * enter your real account number" is still read as a request.
 */
const PROHIBITION_CUES =
  /\b(?:never|not|n'?t|do ?n'?t|cannot|can'?t|avoid|refuse|refusing|beware|nobody|no one)\b/i

const CLAUSE_BOUNDARIES = new Set(['.', '!', '?', ';', ':', '\n'])

function clausePrecedingMatch(text: string, index: number): string {
  let start = 0
  for (let i = index - 1; i >= 0; i -= 1) {
    if (CLAUSE_BOUNDARIES.has(text[i])) {
      start = i + 1
      break
    }
  }
  return text.slice(start, index)
}

interface Span {
  readonly start: number
  readonly end: number
}

/**
 * Inner spans of paired quotes. A straight single quote only opens a span when
 * it follows the start of the string, whitespace, or an opening bracket, so
 * contraction and possessive apostrophes ("student's") are left alone.
 */
const QUOTE_PAIRS: readonly RegExp[] = [
  /"([^"]*)"/g,
  /“([^”]*)”/g,
  /(^|[\s([])'((?:[^']|(?<=\w)'(?=\w))*)'/g,
  /‘([^’]*)’/g,
]

function quotedSpans(text: string): Span[] {
  const spans: Span[] = []
  for (const pattern of QUOTE_PAIRS) {
    for (const match of text.matchAll(pattern)) {
      const inner = match[match.length - 1] ?? ''
      const start = match.index + match[0].length - inner.length - 1
      spans.push({ start, end: start + inner.length })
    }
  }
  return spans
}

function within(spans: readonly Span[], start: number, end: number): boolean {
  return spans.some((span) => start >= span.start && end <= span.end)
}

export function detectCredentialRequests(
  text: string | undefined,
): CredentialRequestMatch[] {
  if (!text || text.trim().length === 0) return []

  const spans = quotedSpans(text)
  const matches: CredentialRequestMatch[] = []

  for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (PROHIBITION_CUES.test(clausePrecedingMatch(text, start))) continue
      matches.push({
        excerpt: match[0],
        insideQuotedSpan: within(spans, start, end),
      })
    }
  }

  return matches
}
