import type {
  LessonContentBlock,
  LessonResponseItem,
  ResponseScoringContract,
  ScoringAuthority,
} from './types'

/**
 * Contradiction checks for the Financial Literacy scoring contract.
 *
 * Financial Literacy is the one subject that legitimately mixes settleable
 * arithmetic with genuine judgment work, so it cannot be held to a single
 * fixed-answer bar. Relaxing that bar on the author's say-so alone would let
 * "Calculate the sales tax" declare itself judgment and escape answer
 * authority, so the declared mode is only ever accepted when it survives a
 * cross-check against the lesson's own item inventory and prompts.
 *
 * Two kinds of check, deliberately given different weight:
 *
 *   - The inventory and authority-kind checks are exact. A lesson that calls
 *     itself judgment while carrying fixed items, or carrying an answer key,
 *     has contradicted itself in a way no reading is needed to see. Blocking.
 *   - The prompt-text check is a heuristic. It reads a prompt and guesses
 *     whether the student is being asked to produce a value. It is right far
 *     more often than not, but "what is the cost to a friendship of talking
 *     about what someone can afford" is a dignity question wearing a money
 *     noun. A guess routes to human review; it never fails a lesson on its
 *     own, and it never lets one through either.
 *
 * None of this decides whether an answer is right, or whether a rubric is
 * well-judged. It only refuses declarations the lesson's own contents
 * contradict.
 */

export type ResponseScoringFindingSeverity = 'BLOCKING' | 'REVIEW'

export interface ResponseScoringFinding {
  readonly severity: ResponseScoringFindingSeverity
  readonly reason: string
}

/** Nouns naming a quantity a student could be asked to produce. */
const QUANTITY_NOUN =
  '(?:total|totals|sum|cost|costs|price|prices|amount|amounts|balance|difference|profit|' +
  'interest|payment|payments|premium|fee|fees|tax|taxes|budget|savings?|earnings?|pay|pays|' +
  'net|average|subtotal|remainder|rate|return|returns|gain|gains|money)'

/**
 * Up to two words between the article and the quantity noun, so "what is the
 * holding's total return" and "what is the 8% price gain" read the same way
 * as "what is the total".
 */
const QUANTITY_MODIFIERS = "(?:[\\w%.,'’-]+\\s+){0,2}"

/**
 * Verbs and quantity words that can follow "how much"/"how many". This is
 * what separates "how much is withheld" from "how much privacy does someone
 * give up" — the second asks about a thing, not an amount.
 */
const QUANTITY_HEAD =
  '(?:is|are|was|were|does|do|did|will|would|has|have|had|should|can|could|goes|go|comes|' +
  'come|costs?|remains?|more|less|extra|further|money|cash|left|over|under|past|short)'

/**
 * Arithmetic imperatives. These are not suppressible: "calculate the sales
 * tax and show your work" is still a calculation, and letting a reasoning
 * word anywhere in the sentence switch the check off is exactly how a
 * computational lesson would talk its way into the judgment bucket.
 */
const ARITHMETIC_IMPERATIVE: readonly RegExp[] = [
  /\b(?:calculate|calculates|compute|computes|add up|adds up|total up|tally|multiply|divide|subtract|figure out)\b/i,
  // "work out the net pay" counts; "work out whether that is worth doing" does not.
  /\bworks? out\b(?!\s+(?:whether|why|if|what|how))/i,
  /\bround to the nearest\b/i,
  new RegExp(`\\bfind (?:the|his|her|their|each) ${QUANTITY_MODIFIERS}${QUANTITY_NOUN}\\b`, 'i'),
  new RegExp(`\\bdetermine (?:the|his|her|their) ${QUANTITY_MODIFIERS}${QUANTITY_NOUN}\\b`, 'i'),
  /\bfill in the (?:missing )?(?:amounts?|totals?|figures?|numbers?)\b/i,
]

/**
 * Questions that ask for a value. Unlike the imperatives these are phrasings
 * a judgment prompt can borrow, so a reasoning demand in the same sentence
 * suppresses them.
 */
const QUANTITY_QUESTION: readonly RegExp[] = [
  new RegExp(`\\bhow (?:much|many|far|long) ${QUANTITY_HEAD}\\b`, 'i'),
  /\bhow many\b/i,
  /\b(?:by |and )?how much (?:more|less|larger|smaller|cheaper)\b/i,
  new RegExp(
    `\\bwhat (?:is|are|was|were|will|would)\\s+(?:the\\s+|his\\s+|her\\s+|their\\s+|its\\s+)?${QUANTITY_MODIFIERS}${QUANTITY_NOUN}\\b`,
    'i',
  ),
  /\bwhat (?:is|are|was|were|do|does|did|will|would|has|have)\b[^?]{0,40}\b(?:cost|costs|pay|pays|paid|earned|saved|spent|owes?|come to|comes to|add up to|adds up to|total|worth)\b/i,
  /\bwhat (?:is|are|was|were)\s+(?:left|remaining|the remainder|the lower|the higher|the greater|the smaller|the larger)\b/i,
  /\bwhat remains\b/i,
]

/**
 * Demands for reasoning rather than for a value. Only these suppress a
 * quantity question — weaker cues like "should" or "show" are left out,
 * because "how much should Maya pay" and "calculate the tax and show your
 * work" are computations that happen to contain one.
 */
const REASONING_DEMAND: readonly RegExp[] = [
  /\b(?:why|explain|explains|justify|justifies|recommend|recommends|argue|argues|argument|assess|evaluate|evaluates|describe|describes|persuade|convince)\b/i,
  /\bin what order\b/i,
  /\b(?:would|do|will) you\b/i,
  /\bwhat (?:makes|else|information)\b/i,
  /\bwhat would make\b/i,
  // "What does that show", "what did it change" — reasoning about a result,
  // not a request for one. Deliberately excludes "the", so "what does the
  // club payment come to" is still read as a computation.
  /\bwhat (?:does|did|do|would) (?:that|this|it)\b/i,
  /\b(?:tradeoff|trade-off)\b/i,
]

/**
 * True when the text asks the reader to produce a value. A heuristic: callers
 * must treat a positive as a reason to look, not as a proven defect.
 */
export function demandsComputation(text: string | undefined): boolean {
  const trimmed = text?.trim() ?? ''
  if (trimmed.length === 0) return false
  if (ARITHMETIC_IMPERATIVE.some((pattern) => pattern.test(trimmed))) return true
  if (REASONING_DEMAND.some((pattern) => pattern.test(trimmed))) return false
  return QUANTITY_QUESTION.some((pattern) => pattern.test(trimmed))
}

function refsOf(items: readonly LessonResponseItem[]): string {
  return items.map((item) => item.ref).join(', ')
}

/**
 * The student work a judgment lesson claims to set, used as a second reading
 * of the same question when the item prompts say nothing incriminating.
 */
export interface LessonWorkText {
  readonly label: string
  readonly block?: LessonContentBlock
}

/**
 * Checks the declared mode against the lesson's own item inventory, prompts,
 * scoring authority, and student-work text. Returns every contradiction
 * found; an empty list means the declaration is at least self-consistent, not
 * that it is true.
 */
export function assessResponseScoringContract(
  contract: ResponseScoringContract,
  authority: ScoringAuthority | undefined,
  workText: readonly LessonWorkText[] = [],
): readonly ResponseScoringFinding[] {
  const findings: ResponseScoringFinding[] = []

  if (contract.items.length === 0) {
    findings.push({
      severity: 'BLOCKING',
      reason:
        'no response items are declared, so the scoring mode rests on nothing the gate can check it against',
    })
    return findings
  }

  const fixedItems = contract.items.filter((item) => item.responseMode === 'FIXED')
  const openItems = contract.items.filter((item) => item.responseMode === 'OPEN')

  switch (contract.mode) {
    case 'FIXED_OR_COMPUTATIONAL':
      if (openItems.length > 0) {
        findings.push({
          severity: 'BLOCKING',
          reason: `declared FIXED_OR_COMPUTATIONAL but ${openItems.length} item(s) are open-response (${refsOf(openItems)}) — a lesson with both kinds of item is MIXED and owes a rubric for the open half`,
        })
      }
      break
    case 'JUDGMENT_APPLICATION':
      if (fixedItems.length > 0) {
        findings.push({
          severity: 'BLOCKING',
          reason: `declared JUDGMENT_APPLICATION but ${fixedItems.length} item(s) are fixed-response (${refsOf(fixedItems)}) — fixed items owe a verified answer key and cannot be scored by rubric alone`,
        })
      }
      if (authority && authority.kind !== 'RUBRIC') {
        findings.push({
          severity: 'BLOCKING',
          reason: `declared JUDGMENT_APPLICATION but the scoring authority is ${authority.kind} — judgment work is scored against stated criteria, and neither a fixed key nor unstated adult judgment is a rubric`,
        })
      }
      break
    case 'MIXED':
      if (fixedItems.length === 0) {
        findings.push({
          severity: 'BLOCKING',
          reason:
            'declared MIXED but no item is fixed-response — a lesson with only judgment items is JUDGMENT_APPLICATION',
        })
      }
      if (openItems.length === 0) {
        findings.push({
          severity: 'BLOCKING',
          reason:
            'declared MIXED but no item is open-response — a lesson with only fixed items is FIXED_OR_COMPUTATIONAL',
        })
      }
      break
  }

  if (contract.mode === 'JUDGMENT_APPLICATION') {
    // Fail closed: a judgment declaration is the one that relaxes answer
    // authority, and it can only be cross-checked against prompts the caller
    // actually supplied. Omitting the text would otherwise be the cheapest
    // way to switch the check off.
    const untextedItems = contract.items.filter(
      (item) => (item.promptText?.trim() ?? '').length === 0,
    )
    if (untextedItems.length > 0) {
      findings.push({
        severity: 'BLOCKING',
        reason: `declared JUDGMENT_APPLICATION but ${untextedItems.length} item(s) record no prompt text (${refsOf(untextedItems)}), so the declaration cannot be checked against what the student is actually asked`,
      })
    }
  }

  // Items declared open whose prompt reads as a demand for a value. A
  // heuristic, so a doubt rather than a defect — but a doubt that keeps the
  // lesson out of READY until someone settles it.
  const computationalOpenItems = openItems.filter((item) => demandsComputation(item.promptText))
  if (computationalOpenItems.length > 0) {
    findings.push({
      severity: 'REVIEW',
      reason: `item(s) declared open-response read as asking the student to produce a value, which a rubric cannot settle: ${computationalOpenItems
        .map((item) => `${item.ref}: "${item.promptText}"`)
        .join('; ')}`,
    })
  }

  // Second reading for judgment lessons: the item prompts may say nothing
  // incriminating while the student-work text sets arithmetic anyway.
  if (contract.mode === 'JUDGMENT_APPLICATION') {
    const computationalWork = workText.filter((work) => demandsComputation(work.block?.text))
    if (computationalWork.length > 0) {
      findings.push({
        severity: 'REVIEW',
        reason: `declared JUDGMENT_APPLICATION but the ${computationalWork
          .map((work) => work.label)
          .join(' and ')} text sets work that reads as a computation`,
      })
    }
  }

  return findings
}
