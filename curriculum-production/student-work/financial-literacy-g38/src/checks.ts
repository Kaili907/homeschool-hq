import { checkGradeArithmetic } from './gradeLevel.ts'
import type { CorpusEntry } from './types.ts'

export interface Issue {
  readonly rule: string
  readonly packageId: string
  readonly detail: string
}

const issue = (rule: string, packageId: string, detail: string): Issue => ({ rule, packageId, detail })

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

const MIN_WORDS = 25

// ---------------------------------------------------------------------------
// Structure — also what keeps the shared readiness gate's specificity
// heuristic satisfied without ever tuning content to the heuristic.
// ---------------------------------------------------------------------------

export function checkStructure(entry: CorpusEntry): Issue[] {
  const out: Issue[] = []
  const { pkg, authored } = entry
  const id = pkg.packageId

  const kinds = new Set(pkg.tasks.map((t) => t.kind))
  if (pkg.tasks.length < 3) out.push(issue('structure', id, `only ${pkg.tasks.length} task(s); every sheet needs at least three`))
  if (!kinds.has('guided')) out.push(issue('structure', id, 'no guided-practice task'))
  if (!kinds.has('independent') && !kinds.has('performance-task')) out.push(issue('structure', id, 'no independent or performance task'))

  const instructionWords = words(`${pkg.objective} ${pkg.scenario}`).length
  if (instructionWords < MIN_WORDS) out.push(issue('structure', id, `objective + scenario is only ${instructionWords} words`))

  for (const group of [
    { label: 'guided', kinds: ['guided'] },
    { label: 'independent', kinds: ['independent', 'performance-task'] },
  ]) {
    const text = pkg.tasks
      .filter((t) => group.kinds.includes(t.kind))
      .map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`)
      .join(' ')
    if (words(text).length < MIN_WORDS) out.push(issue('structure', id, `${group.label} text is only ${words(text).length} words`))
  }

  if (words(pkg.remediation).length < 20) out.push(issue('structure', id, 'remediation is too thin to reteach from'))
  if (words(pkg.extension).length < 12) out.push(issue('structure', id, 'extension is too thin'))

  const refs = new Set<string>()
  for (const task of pkg.tasks) {
    if (task.prompts.length === 0) out.push(issue('structure', id, `task ${task.taskId} has no prompts`))
    for (const prompt of task.prompts) {
      if (refs.has(prompt.ref)) out.push(issue('structure', id, `duplicate prompt ref ${prompt.ref}`))
      refs.add(prompt.ref)
      if (!prompt.ref.startsWith(`${task.taskId}-`)) out.push(issue('structure', id, `prompt ref ${prompt.ref} does not belong to task ${task.taskId}`))
      if (prompt.promptType === 'fixed-choice' && (prompt.choices ?? []).length < 2) {
        out.push(issue('structure', id, `fixed-choice prompt ${prompt.ref} offers fewer than two choices`))
      }
    }
  }

  // The scoring record must answer or rubric-cover every prompt, with nothing left unscored.
  const scoredRefs = new Set(
    entry.scoring.scoringAuthority.kind === 'ANSWER_KEY' ? entry.scoring.scoringAuthority.items.map((i) => i.ref) : [],
  )
  const openRefs = authored.tasks.flatMap((t) => t.prompts).filter((p) => !p.fixed).map((p) => p.ref)
  for (const ref of refs) {
    if (!scoredRefs.has(ref) && !openRefs.includes(ref)) out.push(issue('structure', id, `prompt ${ref} has no scoring authority`))
  }
  if (openRefs.length > 0 && (authored.rubric ?? []).length === 0) {
    out.push(issue('structure', id, 'open prompts present but no rubric'))
  }
  for (const criterion of authored.rubric ?? []) {
    const labels = criterion.levels.map((l) => l.label)
    if (new Set(labels).size !== 3) out.push(issue('structure', id, `rubric dimension "${criterion.dimension}" does not carry all three levels`))
    for (const level of criterion.levels) {
      if (words(level.descriptor).length < 6) out.push(issue('structure', id, `rubric level "${level.label}" of "${criterion.dimension}" is too thin to score from`))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const CREDENTIAL_REQUEST_PATTERNS: readonly RegExp[] = [
  /\b(enter|type|write|give|share|tell us|record)\s+(your|the learner'?s|a real|your family'?s)\s+(real\s+|actual\s+)?(bank\s+account|account|routing|card|credit\s+card|debit\s+card|pin|password|social\s+security|ssn|tax\s+id)\b/i,
  /\bwhat is your (real |actual |family'?s )?(bank account|account number|card|credit card|password|pin|ssn|social security|balance|salary|income)\b/i,
  /\bhow much (money )?(does|do|did) your (family|parents?|mom|dad|guardian)\b/i,
  /\byour real (allowance|savings|paycheck|balance|account|card)\b/i,
  /\blog ?in to (your|the family)\b/i,
]

const ADVICE_PATTERNS: readonly RegExp[] = [
  /\byou should (invest|buy|borrow|open an account|take out|refinance|put your money)\b/i,
  /\bwe recommend (that )?you\b/i,
  /\bthe best (stock|fund|card|loan|bank) (for you|to buy)\b/i,
]

const FICTION_MARKERS = ['fictional', 'made-up', 'made up', 'invented', 'pretend', 'simulated', 'imaginary', 'practice scenario']

/**
 * Fictional scam wording is deliberately quoted in these sheets so learners
 * can practise recognising it; quoted example text is stripped before the
 * credential lint runs, exactly as in the reviewed vertical-slice corpus.
 */
function stripQuotedExamples(text: string): string {
  return text.replace(/(^|\s)'[^']*'/g, '$1').replace(/(^|\s)“[^”]*”/g, '$1')
}

const NEGATION_MARKERS = /\b(never|do not|don't|doesn't|does not|no real|without ever|is not asked|are not asked)\b/i

/**
 * The lint looks for a sheet ASKING a learner for a real credential, so a
 * sentence that forbids it ("Never write a real bank account number here")
 * must not itself trip the lint. Sentences are tested one at a time and a
 * sentence carrying a negation marker is skipped, which keeps a following
 * sentence in the same block fully in scope.
 */
function requestSentences(text: string): string[] {
  return text
    .replace(/"/g, ' ')
    .split(/(?<=[.!?;])\s+/)
    .filter((sentence) => !NEGATION_MARKERS.test(sentence))
}

export function checkSafety(entry: CorpusEntry): Issue[] {
  const out: Issue[] = []
  const { pkg, scoring } = entry
  const id = pkg.packageId
  const serialized = stripQuotedExamples(JSON.stringify(pkg)) + stripQuotedExamples(JSON.stringify(scoring))
  const sentences = requestSentences(serialized)

  for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
    const hit = sentences.find((sentence) => pattern.test(sentence))
    if (hit) out.push(issue('no-real-credential-request', id, `"${hit.trim().slice(0, 120)}" matches ${pattern}`))
  }
  for (const pattern of ADVICE_PATTERNS) {
    const hit = sentences.find((sentence) => pattern.test(sentence))
    if (hit) out.push(issue('no-individualized-advice', id, `"${hit.trim().slice(0, 120)}" matches ${pattern}`))
  }
  if (pkg.isFictionalSimulation !== true) out.push(issue('always-fictional', id, 'not marked as a fictional simulation'))
  if (pkg.realWorldAction !== false) out.push(issue('always-fictional', id, 'declares a real-world action'))
  if (pkg.completionAuthority !== 'learner' || pkg.signOff !== null) out.push(issue('always-fictional', id, 'declares a non-learner completion authority'))
  if (pkg.financialSafety.neverRequestsRealCredentials !== true || pkg.financialSafety.noIndividualizedAdvice !== true) {
    out.push(issue('financial-safety-flag', id, 'missing a financial-safety declaration'))
  }
  const scenario = pkg.scenario.toLowerCase()
  if (!FICTION_MARKERS.some((marker) => scenario.includes(marker))) {
    out.push(issue('always-fictional', id, 'scenario never says on its face that it is invented'))
  }
  if (scoring.adultOnly !== true) out.push(issue('adult-only-scoring', id, 'scoring record is not marked adult-only'))
  return out
}

// ---------------------------------------------------------------------------
// Answer leakage — no answer authority may reach a student-facing file.
// ---------------------------------------------------------------------------

const ANSWER_BEARING_KEYS = ['answer', 'answerIndex', 'expected', 'compute', 'computation', 'fixed', 'criteria', 'scoringAuthority', 'authorityTag', 'trace', 'lookFors']

export function checkNoAnswerLeakage(entry: CorpusEntry): Issue[] {
  const out: Issue[] = []
  const serialized = JSON.stringify(entry.pkg)
  for (const key of ANSWER_BEARING_KEYS) {
    if (serialized.includes(`"${key}"`)) out.push(issue('no-answer-leakage', entry.pkg.packageId, `student-facing package carries the answer-bearing key "${key}"`))
  }
  return out
}

// ---------------------------------------------------------------------------
// Answer authority
// ---------------------------------------------------------------------------

/** The exact string the source corpus repeats for every lesson in every course. */
export const SOURCE_GENERIC_GUIDANCE =
  'Score the stated learning target, accuracy, evidence/reasoning, and revision. Accept multiple valid approaches when they meet the criteria. Do not infer effort, motivation, diagnosis, or character from an error.'

export function checkAnswerAuthority(entry: CorpusEntry): Issue[] {
  const out: Issue[] = []
  const { pkg, scoring, source } = entry
  const id = pkg.packageId
  const authority = scoring.scoringAuthority

  if (authority.kind === 'ANSWER_KEY') {
    if (authority.items.length === 0) out.push(issue('answer-authority', id, 'answer key with no items'))
    for (const item of authority.items) {
      if (item.answer.trim().length === 0) out.push(issue('answer-authority', id, `${item.ref} has an empty answer`))
      if (!/\d/.test(item.verification.trace)) out.push(issue('answer-authority', id, `${item.ref} has a trace with no figures in it`))
      if (item.verification.method !== 'independent-recompute') out.push(issue('answer-authority', id, `${item.ref} is not independently recomputed`))
      out.push(
        ...checkGradeArithmetic(source.grade, item.verification.computation, `${id} ${item.ref}`).map((detail) =>
          issue('grade-level-arithmetic', id, detail),
        ),
      )
    }
    if (scoring.authorityTag.authorityClass !== 'FIXED_ANSWER_KEY') out.push(issue('answer-authority', id, 'answer key is not tagged FIXED_ANSWER_KEY'))
  } else {
    if (authority.criteria.length === 0) out.push(issue('answer-authority', id, 'rubric with no criteria'))
    if (authority.acceptableAnswerCriteria.length === 0) out.push(issue('answer-authority', id, 'judgment lesson with no acceptable-answer criteria'))
    if (scoring.authorityTag.authorityClass !== 'RUBRIC_JUDGMENT') out.push(issue('answer-authority', id, 'rubric is not tagged RUBRIC_JUDGMENT'))
    if (JSON.stringify(authority).includes('"answer"')) out.push(issue('answer-authority', id, 'judgment lesson asserts an exact answer'))
  }

  if (scoring.authorityTag.derivedFromSourceGenericGuidance !== false) out.push(issue('answer-authority', id, 'authority tag admits derivation from source guidance'))
  if (scoring.authorityTag.oracleVerdict !== 'AGREES') out.push(issue('answer-authority', id, 'authority tag carries a non-agreeing oracle verdict'))
  if (JSON.stringify(scoring).includes(SOURCE_GENERIC_GUIDANCE.slice(0, 60))) {
    out.push(issue('not-source-boilerplate', id, "scoring record repeats the source corpus's generic guidance"))
  }
  if (pkg.integrity.answerDerivedFromSourceGuidance !== false) out.push(issue('not-source-boilerplate', id, 'package admits deriving answers from source guidance'))
  return out
}

// ---------------------------------------------------------------------------
// Distinctness — the direct answer to the prior review's boilerplate finding.
// ---------------------------------------------------------------------------

export function checkDistinctness(entries: readonly CorpusEntry[]): Issue[] {
  const out: Issue[] = []
  const fields: { label: string; get: (e: CorpusEntry) => string }[] = [
    { label: 'objective', get: (e) => e.pkg.objective },
    { label: 'scenario', get: (e) => e.pkg.scenario },
    { label: 'task text', get: (e) => e.pkg.tasks.map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`).join(' ') },
    { label: 'remediation', get: (e) => e.pkg.remediation },
    { label: 'extension', get: (e) => e.pkg.extension },
    {
      label: 'scoring authority text',
      get: (e) =>
        e.scoring.scoringAuthority.kind === 'ANSWER_KEY'
          ? e.scoring.scoringAuthority.items.map((i) => `${i.answer} ${i.verification.trace}`).join(' ')
          : e.scoring.scoringAuthority.criteria.map((c) => c.levels.map((l) => l.descriptor).join(' ')).join(' '),
    },
  ]
  for (const field of fields) {
    const seen = new Map<string, string>()
    for (const entry of entries) {
      const value = field.get(entry).trim()
      const prior = seen.get(value)
      if (prior) out.push(issue('distinctness', entry.pkg.packageId, `${field.label} is byte-identical to ${prior}`))
      else seen.set(value, entry.pkg.packageId)
    }
  }

  // Every rubric must talk about this lesson's own scenario, not a template.
  for (const entry of entries) {
    const rubric = entry.authored.rubric ?? []
    if (rubric.length === 0) continue
    const descriptors = rubric.flatMap((c) => c.levels.map((l) => l.descriptor)).join(' ').toLowerCase()
    const firstName = entry.authored.character.split(/[\s,]+/)[0].toLowerCase()
    if (!descriptors.includes(firstName)) {
      out.push(issue('distinctness', entry.pkg.packageId, `rubric never names this lesson's own scenario figure (${firstName})`))
    }
  }

  // A single cast of characters across a whole grade would read as a template.
  const byGrade = new Map<number, Set<string>>()
  for (const entry of entries) {
    const set = byGrade.get(entry.source.grade) ?? new Set<string>()
    set.add(entry.authored.character.split(/[\s,]+/)[0].toLowerCase())
    byGrade.set(entry.source.grade, set)
  }
  for (const [grade, names] of byGrade) {
    const lessons = entries.filter((e) => e.source.grade === grade).length
    const floor = Math.ceil(lessons / 4)
    if (names.size < floor) out.push(issue('distinctness', `grade-0${grade}`, `only ${names.size} distinct scenario figures across ${lessons} lessons (floor ${floor})`))
  }
  return out
}

export function checkEntry(entry: CorpusEntry): Issue[] {
  return [...checkStructure(entry), ...checkSafety(entry), ...checkNoAnswerLeakage(entry), ...checkAnswerAuthority(entry)]
}

export function checkCorpus(entries: readonly CorpusEntry[]): Issue[] {
  return [...entries.flatMap(checkEntry), ...checkDistinctness(entries)]
}
