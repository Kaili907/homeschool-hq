/**
 * Corpus-level checks that the oracle cannot make on its own.
 *
 * The oracle proves a key follows from its parameters. These checks prove the
 * things that go wrong around it: a key derived from a figure the learner was
 * never shown, a lesson that quietly asks for real financial data, a judgment
 * item scored by an invented exact answer, and — the failure mode this lane
 * exists to avoid — one scenario re-skinned across many lessons with the
 * numbers changed.
 */
import { literalsIn } from './oracle.ts'
import type { Item, JudgmentItem, LessonSpec } from './types.ts'

export interface Finding {
  readonly lessonId: string
  readonly where: string
  readonly message: string
}

/** Counts, ratios, and small whole numbers that carry no scenario information. */
const STRUCTURAL = new Set(['0', '1', '2', '3', '4', '10', '12', '24', '26', '52', '60', '100', '365', '1000'])

/** The whole sheet: a figure stated in task 1 is still on the page in task 3. */
function visibleText(spec: LessonSpec): string {
  const parts: string[] = [spec.scenario, spec.objective]
  for (const task of spec.tasks) {
    parts.push(task.directions)
    for (const item of task.items) {
      parts.push(item.text)
      if (item.kind === 'choice') parts.push(...item.choices)
    }
  }
  return parts.join(' \n ')
}

/** Every plausible rendering of a figure a learner could read on the sheet. */
function renderings(v: number): string[] {
  const out = new Set<string>()
  // Only renderings that are exactly equal to the figure count. A lossy
  // rendering such as 0.0765 -> "0.08" would let a check pass against a number
  // the learner was never actually shown.
  const push = (s: string): void => {
    if (/^-?\d+(\.\d+)?$/.test(s) && Number(s) === v) out.add(s)
  }
  push(String(v))
  for (const dp of [0, 1, 2, 3, 4]) push(v.toFixed(dp))
  const pct = Number((v * 100).toFixed(8))
  const pushPct = (s: string): void => {
    if (/^-?\d+(\.\d+)?$/.test(s) && Number(s) === pct) out.add(s)
  }
  pushPct(String(pct))
  for (const dp of [0, 1, 2]) pushPct(pct.toFixed(dp))
  return [...out]
}

function appears(text: string, candidate: string): boolean {
  const normalized = text.replace(/,/g, '')
  const escaped = candidate.replace(/\./g, '\\.')
  return new RegExp(`(?<![\\d.])${escaped}(?![\\d])`).test(normalized)
}

/**
 * A figure the oracle scores against must be a figure the learner can see.
 * This is what stops a key drifting away from the sheet it grades.
 */
export function checkParameterVisibility(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const text = visibleText(spec)
  spec.tasks.forEach((task) => {
    for (const item of task.items) {
      if (item.kind === 'judgment') continue
      const given = item.given ?? {}
      for (const [name, value] of Object.entries(given)) {
        if (!renderings(value).some((c) => appears(text, c))) {
          findings.push({
            lessonId: spec.lessonId,
            where: item.ref,
            message: `parameter ${name}=${value} is used to score this item but does not appear anywhere the learner can read it`,
          })
        }
      }
      const exprs = item.kind === 'numeric'
        ? [item.expr]
        : item.decision ? [item.decision.left, item.decision.right] : []
      for (const e of exprs) {
        for (const lit of literalsIn(e)) {
          if (STRUCTURAL.has(lit)) continue
          if (Object.values(given).some((v) => renderings(v).includes(lit))) continue
          if (!appears(text, lit)) {
            findings.push({
              lessonId: spec.lessonId,
              where: item.ref,
              message: `expression literal ${lit} is neither a declared parameter, a structural constant, nor visible to the learner`,
            })
          }
        }
      }
    }
  })
  return findings
}

const ASKS_FOR_REAL_DATA = [
  /\byour (own )?(real |actual )?(bank|card|account|password|pin|routing|social security|ssn|credential|login|balance|paycheck|salary|income|savings|debt|credit score)\b/i,
  /\b(enter|provide|share|type|upload|report|tell us|write down)\b[^.?!]{0,80}\byour\b[^.?!]{0,40}\b(account|card|password|pin|ssn|social security|balance|income|salary|debt)\b/i,
  /\byour (family|household|parents|guardian)('s)?\b[^.?!]{0,40}\b(income|budget|debt|savings|balance|bills|finances)\b/i,
]

const GIVES_INDIVIDUAL_ADVICE = [
  /\bwhat should you personally\b/i,
  /\bwhich .{0,40}should you (buy|invest in|choose for yourself|open)\b/i,
  /\bfor your own (money|savings|investments?)\b/i,
]

/** Learner-facing text only: the boundary is about what a learner is asked. */
export function checkSafety(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const surfaces: { where: string; text: string }[] = [
    { where: 'scenario', text: spec.scenario },
    { where: 'objective', text: spec.objective },
  ]
  for (const task of spec.tasks) {
    surfaces.push({ where: `${task.taskId}.directions`, text: task.directions })
    for (const item of task.items) {
      surfaces.push({ where: item.ref, text: item.text })
      if (item.kind === 'choice') surfaces.push({ where: `${item.ref}.choices`, text: item.choices.join(' ') })
    }
  }
  for (const s of surfaces) {
    for (const re of ASKS_FOR_REAL_DATA) {
      if (re.test(s.text)) {
        findings.push({ lessonId: spec.lessonId, where: s.where, message: `learner-facing text appears to solicit real personal financial data: ${re}` })
      }
    }
    for (const re of GIVES_INDIVIDUAL_ADVICE) {
      if (re.test(s.text)) {
        findings.push({ lessonId: spec.lessonId, where: s.where, message: `learner-facing text asks the learner for a decision about their own real money: ${re}` })
      }
    }
  }
  if (!/\b(fictional|simulated)\b/i.test(spec.scenario)) {
    findings.push({ lessonId: spec.lessonId, where: 'scenario', message: 'the scenario does not state that it is fictional or simulated' })
  }
  return findings
}

const PLACEHOLDER = /\b(TODO|TBD|FIXME|placeholder|lorem ipsum|coming soon|to be written)\b/i

export function checkNoPlaceholders(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (PLACEHOLDER.test(value)) findings.push({ lessonId: spec.lessonId, where: path, message: `placeholder text: ${JSON.stringify(value.slice(0, 80))}` })
      return
    }
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`)); return }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
    }
  }
  walk(spec, spec.lessonId)
  return findings
}

/** Structural floor: what a lesson must contain to be usable at all. */
export function checkStructure(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const f = (where: string, message: string): void => { findings.push({ lessonId: spec.lessonId, where, message }) }
  const items = spec.tasks.flatMap((t) => t.items)
  if (spec.tasks.length < 3) f('tasks', `only ${spec.tasks.length} tasks; a lesson needs at least 3`)
  if (items.length < 5) f('tasks', `only ${items.length} items; a lesson needs at least 5`)
  const judgment = items.filter((i) => i.kind === 'judgment')
  if (judgment.length < 1) f('tasks', 'no judgment item; every lesson must require the learner to explain or defend something')
  if (!spec.tasks.some((t) => t.kind === 'independent' || t.kind === 'performance-task')) {
    f('tasks', 'no independent or performance task; mastery evidence requires unaided work')
  }
  const refs = new Set<string>()
  for (const item of items) {
    if (refs.has(item.ref)) f(item.ref, 'duplicate item ref within the lesson')
    refs.add(item.ref)
    if (item.text.trim().length < 20) f(item.ref, 'prompt text is too short to be a real prompt')
  }
  for (const j of judgment) {
    if (j.acceptableAnswerCriteria.length < 2) f(j.ref, 'a judgment item needs at least two acceptable-answer criteria')
    if (j.evidenceRequirements.length < 1) f(j.ref, 'a judgment item needs at least one evidence requirement')
    if (j.lookFors.length < 1) f(j.ref, 'a judgment item needs at least one look-for')
    if (j.dimensions.length < 1) f(j.ref, 'a judgment item needs at least one rubric dimension')
    for (const c of j.acceptableAnswerCriteria) {
      if (c.trim().length < 40) f(j.ref, `acceptable-answer criterion is too thin to score against: ${JSON.stringify(c)}`)
    }
    for (const e of j.evidenceRequirements) {
      if (e.trim().length < 25) f(j.ref, `evidence requirement is too thin: ${JSON.stringify(e)}`)
    }
  }
  for (const item of items) {
    if (item.kind !== 'judgment' && item.reasoning.trim().length < 30) {
      f(item.ref, 'a fixed answer needs reasoning a reviewer can check against the scenario')
    }
    if (item.kind === 'numeric' && Object.keys(item.given).length === 0 && !item.expr.includes('#')) {
      f(item.ref, 'a numeric item must declare the scenario parameters its answer depends on, or build on an earlier item in the lesson')
    }
  }
  if (spec.remediation.trim().length < 80) f('remediation', 'remediation is too thin to reteach from')
  if (spec.extension.trim().length < 60) f('extension', 'extension is too thin to be a real extension')
  return findings
}

/** Digits removed: what is left is the shape of the prompt, not its numbers. */
export function skeleton(spec: LessonSpec): string {
  return spec.tasks
    .flatMap((t) => [t.directions, ...t.items.map((i) => i.text)])
    .join(' | ')
    .replace(/[\d]+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The specific prohibition this lane was given: no answer copied from a
 * template with different numbers. Two lessons whose prompt text is identical
 * once the digits are removed are the same lesson twice.
 */
export function checkAntiTemplate(specs: readonly LessonSpec[]): Finding[] {
  const findings: Finding[] = []
  const seenSkeleton = new Map<string, string>()
  const seenScenario = new Map<string, string>()
  const seenObjective = new Map<string, string>()
  const seenRemediation = new Map<string, string>()

  const collide = (
    map: Map<string, string>,
    key: string,
    spec: LessonSpec,
    where: string,
    label: string,
  ): void => {
    const norm = key.replace(/\s+/g, ' ').trim().toLowerCase()
    const prior = map.get(norm)
    if (prior) {
      findings.push({ lessonId: spec.lessonId, where, message: `${label} is identical to ${prior}` })
    } else {
      map.set(norm, spec.lessonId)
    }
  }

  for (const spec of specs) {
    collide(seenSkeleton, skeleton(spec), spec, 'tasks', 'the prompt set, with every number removed,')
    collide(seenScenario, spec.scenario, spec, 'scenario', 'the scenario')
    collide(seenObjective, spec.objective, spec, 'objective', 'the objective')
    collide(seenRemediation, spec.remediation, spec, 'remediation', 'the remediation')
  }

  const answerSets = new Map<string, string>()
  for (const spec of specs) {
    const fixed = spec.tasks.flatMap((t) => t.items).filter((i) => i.kind !== 'judgment')
    if (fixed.length < 3) continue
    const key = fixed.map((i) => (i as { answer: string }).answer).join('|')
    const prior = answerSets.get(key)
    if (prior) {
      findings.push({ lessonId: spec.lessonId, where: 'answers', message: `the full fixed-answer set is identical to ${prior}` })
    } else {
      answerSets.set(key, spec.lessonId)
    }
  }
  return findings
}

/* ------------------------------------------------- grade 12 specific checks */

/**
 * Grade 12 is a senior integration year, not grade 9 with larger numbers.
 *
 * The brief for this lane names the domains a senior course should draw
 * together — income, taxes, budgeting, banking, credit, debt, insurance and
 * risk, saving and investing, consumer protection, fraud, postsecondary
 * financing, and multi-variable decisions. A lesson declares the domains it
 * actually makes the learner reason across, and a senior lesson must reason
 * across at least two. Declaring a domain the lesson never touches is caught
 * by review, not by this check; declaring too few is caught here.
 */
export function checkIntegration(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const unique = new Set(spec.domains)
  if (unique.size !== spec.domains.length) {
    findings.push({ lessonId: spec.lessonId, where: 'domains', message: 'a domain is declared twice' })
  }
  if (unique.size < 2) {
    findings.push({
      lessonId: spec.lessonId,
      where: 'domains',
      message: `declares ${unique.size} financial domain(s); a grade 12 lesson must integrate at least two`,
    })
  }
  return findings
}

/**
 * Every grade 12 lesson is mixed work.
 *
 * The brief requires mixed work to carry both fixed and judgment scoring
 * authority. Authoring every lesson that way is also what keeps the Production
 * Gate H3 projection honest: a FinLit lesson projects as ANSWER_KEY, and a
 * lesson with no fixed item projected that way would be claiming a key it does
 * not have.
 */
export function checkMixedScoring(spec: LessonSpec): Finding[] {
  const items = spec.tasks.flatMap((t) => t.items)
  const fixed = items.filter((i) => i.kind !== 'judgment')
  const judgment = items.filter((i) => i.kind === 'judgment')
  const findings: Finding[] = []
  if (fixed.length < 1) {
    findings.push({ lessonId: spec.lessonId, where: 'tasks', message: 'no fixed item; every grade 12 lesson carries fixed scoring authority the oracle can verify' })
  }
  if (judgment.length < 1) {
    findings.push({ lessonId: spec.lessonId, where: 'tasks', message: 'no judgment item; every grade 12 lesson carries judgment scoring authority' })
  }
  return findings
}

/** Anything a capstone must never ask a learner to supply about themselves. */
const CAPSTONE_PERSONAL_SOLICITATION = [
  /\byour (own )?(actual |real |current )?(income|salary|wage|earnings|pay)\b/i,
  /\byour (own )?(actual |real |current )?(bank|checking|savings|account) balance\b/i,
  /\byour (own )?(actual |real |current )?credit score\b/i,
  /\byour (own )?(actual |real |current )?(debts?|loans?|student loans?)\b/i,
  /\byour (own )?(actual |real |current )?(financial aid|fafsa|award letter)\b/i,
  /\byour (own )?(actual |real |current )?(tuition|tuition bill)\b/i,
  /\byour (own )?(actual |real |current )?tax return\b/i,
  /\byour (family|household|parents|guardians)('s)? (finances|income|budget|savings|debts?)\b/i,
  /\byour (own )?(actual |real |current )?(investment|brokerage|retirement) accounts?\b/i,
  /\byour (own )?(actual |real |current )?insurance polic(y|ies)\b/i,
]

/**
 * The capstone integrity rule.
 *
 * A capstone that quietly turns into a personal financial intake form is the
 * failure mode this check exists to prevent, and it is checked on text rather
 * than asserted in prose. A capstone must run on a supplied fictional case or
 * a learner-invented fictional profile; it must integrate broadly; and where
 * it asks for a decision it must record more than one defensible answer, so
 * no single "correct life plan" can be scored as the key.
 */
export function checkCapstoneIntegrity(spec: LessonSpec): Finding[] {
  if (!spec.isCapstone) return []
  const findings: Finding[] = []
  const f = (where: string, message: string): void => { findings.push({ lessonId: spec.lessonId, where, message }) }

  const learnerText = [
    spec.scenario,
    spec.objective,
    ...spec.tasks.flatMap((t) => [t.directions, ...t.items.map((i) => i.text)]),
  ].join(' \n ')

  for (const re of CAPSTONE_PERSONAL_SOLICITATION) {
    if (re.test(learnerText)) {
      f('capstone', `capstone text asks the learner for their own real financial position: ${re}`)
    }
  }

  if (!/\bfictional\b/i.test(spec.scenario)) {
    f('scenario', 'a capstone scenario must state that the case or profile it runs on is fictional')
  }

  if (spec.domains.length < 5) {
    f('domains', `a capstone lesson integrates ${spec.domains.length} domain(s); it must integrate at least five`)
  }

  const judgment = spec.tasks.flatMap((t) => t.items).filter((i): i is JudgmentItem => i.kind === 'judgment')
  if (judgment.length < 1) f('tasks', 'a capstone lesson must carry at least one judgment item')

  const withAlternatives = judgment.filter((j) => (j.defensibleAlternatives?.length ?? 0) >= 2)
  if (withAlternatives.length < 1) {
    f(
      'tasks',
      'no capstone judgment item records two or more defensible alternatives; a capstone must not score against one predetermined correct life plan',
    )
  }
  for (const j of judgment) {
    if (j.defensibleAlternatives && j.defensibleAlternatives.length === 1) {
      f(j.ref, 'defensibleAlternatives lists a single path, which is a predetermined answer wearing the wrong label')
    }
  }
  return findings
}

/**
 * The privacy scan, run over every learner-facing surface in the corpus.
 *
 * `checkSafety` covers the general boundary. This is narrower and blunter: no
 * lesson anywhere in grade 12 may solicit the specific real-world artefacts
 * the brief names, and no lesson may carry anything shaped like a real
 * credential or account identifier.
 */
const CREDENTIAL_SHAPES: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: 'a value shaped like a Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'a value shaped like a full payment card number', re: /\b(?:\d[ -]?){15,18}\b/ },
  { label: 'a password or credential assignment', re: /\b(password|passcode|pin|api[_ ]?key|routing number)\s*[:=]\s*\S+/i },
]

export function checkPrivacy(spec: LessonSpec): Finding[] {
  const findings: Finding[] = []
  const surfaces: { where: string; text: string }[] = [
    { where: 'scenario', text: spec.scenario },
    { where: 'objective', text: spec.objective },
    { where: 'remediation', text: spec.remediation },
    { where: 'extension', text: spec.extension },
  ]
  for (const task of spec.tasks) {
    surfaces.push({ where: `${task.taskId}.directions`, text: task.directions })
    for (const item of task.items) {
      surfaces.push({ where: item.ref, text: item.text })
      if (item.kind === 'choice') surfaces.push({ where: `${item.ref}.choices`, text: item.choices.join(' ') })
    }
  }
  for (const s of surfaces) {
    for (const re of CAPSTONE_PERSONAL_SOLICITATION) {
      if (re.test(s.text)) {
        findings.push({ lessonId: spec.lessonId, where: s.where, message: `solicits a real personal financial artefact: ${re}` })
      }
    }
    for (const c of CREDENTIAL_SHAPES) {
      if (c.re.test(s.text)) {
        findings.push({ lessonId: spec.lessonId, where: s.where, message: `contains ${c.label}` })
      }
    }
  }
  return findings
}
