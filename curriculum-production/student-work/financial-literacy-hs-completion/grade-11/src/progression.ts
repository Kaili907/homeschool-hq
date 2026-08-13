/**
 * Grade 11 progression checks.
 *
 * The brief for this supplement is explicit that grade 11 must sit
 * substantively above grade 9 and must not be grade 9 re-skinned with larger
 * numbers. Both halves of that are enforced here rather than asserted in prose.
 *
 * The source lane's own `progression/rigor-progression-9-12.md` names the move
 * that defines each year: grade 9 is "one well-scoped decision, figures
 * supplied"; grade 11 is "quantify multi-year consequences; reason about
 * education, career, and opportunity cost under uncertainty". The floors below
 * are the operational reading of that difference:
 *
 *   - every lesson carries a genuinely composed computation, not a chain of
 *     one-step arithmetic — some item consumes at least two earlier results;
 *   - most lessons carry a deeper composition still, or an explicit
 *     multi-period model (`pow`), which is what "multi-year consequences" means
 *     once it has to be computed rather than described;
 *   - every lesson requires at least two pieces of judgment work, and at least
 *     one of them is scored on a tradeoff, assumption, uncertainty, transfer,
 *     or error-diagnosis dimension rather than on recall.
 *
 * The measured grade-9 corpus in the sibling lane is the baseline these were
 * set against: 7.21 prompts and 6.00 fixed items per lesson, an expression
 * depth of 1.93 earlier results at its deepest, 54 of 72 lessons reaching a
 * depth of two, 8 reaching three, and 7 using `pow` at all.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Item, LessonSpec, NumericItem } from './types.ts'
import type { Finding } from './validate.ts'
import { skeleton } from './validate.ts'

/** Dimensions that carry analysis and tradeoff work rather than recall. */
export const ANALYSIS_DIMENSIONS = new Set([
  'assumption-identification',
  'tradeoff-defense',
  'communication-of-uncertainty',
  'transfer',
  'error-diagnosis',
  'plan-coherence',
])

export const FLOORS = {
  itemsPerLesson: 8,
  fixedItemsPerLesson: 6,
  judgmentItemsPerLesson: 2,
  /** Every lesson: some expression consumes at least this many earlier results. */
  composedDepthEveryLesson: 2,
  /**
   * At least this many lessons reach a depth of three earlier results. Set as a
   * gate just under what the corpus achieves (20), and more than twice the
   * grade-9 figure of 8: the floors are bars a regression would trip, not
   * targets the content was bent to reach.
   */
  deepLessonsMin: 18,
  /** At least this many lessons model more than one period explicitly. Corpus: 19; grade 9: 7. */
  multiPeriodLessonsMin: 16,
} as const

/** Grade 9 as measured in the sibling lane, for the comparative report. */
export const GRADE9_BASELINE = {
  lessons: 72,
  meanPrompts: 7.21,
  meanFixed: 6.0,
  meanMaxDepth: 1.93,
  lessonsAtDepth2: 54,
  lessonsAtDepth3: 8,
  lessonsUsingPow: 7,
} as const

const REF = /#[A-Za-z0-9_-]+/g

function expressionsOf(item: Item): string[] {
  if (item.kind === 'numeric') return [item.expr]
  if (item.kind === 'choice' && item.decision) return [item.decision.left, item.decision.right]
  return []
}

/** How many earlier results a single expression consumes. */
export function refDepth(expr: string): number {
  return (expr.match(REF) ?? []).length
}

export interface LessonMetrics {
  readonly lessonId: string
  readonly unit: number
  readonly items: number
  readonly fixed: number
  readonly judgment: number
  readonly maxDepth: number
  readonly usesMultiPeriod: boolean
  readonly analysisDimensions: readonly string[]
  readonly distinctParameters: number
}

export function metricsFor(spec: LessonSpec): LessonMetrics {
  const items = spec.tasks.flatMap((t) => t.items)
  const exprs = items.flatMap(expressionsOf)
  const params = new Set<string>()
  for (const item of items) {
    if (item.kind === 'judgment') continue
    for (const name of Object.keys(item.given ?? {})) params.add(name)
  }
  const dims = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'judgment') continue
    for (const d of item.dimensions) if (ANALYSIS_DIMENSIONS.has(d)) dims.add(d)
  }
  return {
    lessonId: spec.lessonId,
    unit: spec.unit,
    items: items.length,
    fixed: items.filter((i) => i.kind !== 'judgment').length,
    judgment: items.filter((i) => i.kind === 'judgment').length,
    maxDepth: exprs.length === 0 ? 0 : Math.max(...exprs.map(refDepth)),
    usesMultiPeriod: exprs.some((e) => /\bpow\s*\(/.test(e)),
    analysisDimensions: [...dims].sort(),
    distinctParameters: params.size,
  }
}

/** Per-lesson floors. A lesson below any of these is not grade-11 work. */
export function checkLessonProgression(spec: LessonSpec): Finding[] {
  const m = metricsFor(spec)
  const out: Finding[] = []
  const f = (message: string): void => { out.push({ lessonId: spec.lessonId, where: 'progression', message }) }
  if (m.items < FLOORS.itemsPerLesson) f(`${m.items} items; grade 11 requires at least ${FLOORS.itemsPerLesson}`)
  if (m.fixed < FLOORS.fixedItemsPerLesson) f(`${m.fixed} fixed items; grade 11 requires at least ${FLOORS.fixedItemsPerLesson}`)
  if (m.judgment < FLOORS.judgmentItemsPerLesson) f(`${m.judgment} judgment items; grade 11 requires at least ${FLOORS.judgmentItemsPerLesson}`)
  if (m.maxDepth < FLOORS.composedDepthEveryLesson) {
    f(`no expression composes ${FLOORS.composedDepthEveryLesson} earlier results (deepest is ${m.maxDepth}); this is grade-9 shaped one-step work`)
  }
  if (m.analysisDimensions.length === 0) {
    f('no judgment item is scored on a tradeoff, assumption, uncertainty, transfer, error-diagnosis, or plan-coherence dimension')
  }
  return out
}

export interface CorpusProgression {
  readonly lessons: number
  readonly meanItems: number
  readonly meanFixed: number
  readonly meanJudgment: number
  readonly meanMaxDepth: number
  readonly lessonsAtDepth2: number
  readonly lessonsAtDepth3: number
  readonly multiPeriodLessons: number
  readonly findings: readonly Finding[]
}

const mean = (xs: number[]): number => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100

/** Corpus-level floors, plus the strict comparison against the grade-9 means. */
export function checkCorpusProgression(specs: readonly LessonSpec[]): CorpusProgression {
  const ms = specs.map(metricsFor)
  const findings: Finding[] = []
  const f = (message: string): void => { findings.push({ lessonId: 'grade-11', where: 'progression', message }) }

  const atDepth3 = ms.filter((m) => m.maxDepth >= 3).length
  const multiPeriod = ms.filter((m) => m.usesMultiPeriod).length
  if (atDepth3 < FLOORS.deepLessonsMin) {
    f(`only ${atDepth3} lessons compose three or more earlier results; grade 11 requires at least ${FLOORS.deepLessonsMin} (grade 9 measured ${GRADE9_BASELINE.lessonsAtDepth3})`)
  }
  if (multiPeriod < FLOORS.multiPeriodLessonsMin) {
    f(`only ${multiPeriod} lessons model more than one period with pow(); grade 11 requires at least ${FLOORS.multiPeriodLessonsMin} (grade 9 measured ${GRADE9_BASELINE.lessonsUsingPow})`)
  }

  const meanItems = mean(ms.map((m) => m.items))
  const meanFixed = mean(ms.map((m) => m.fixed))
  const meanDepth = mean(ms.map((m) => m.maxDepth))
  if (meanItems <= GRADE9_BASELINE.meanPrompts) f(`mean items per lesson ${meanItems} does not exceed the grade-9 mean ${GRADE9_BASELINE.meanPrompts}`)
  if (meanFixed <= GRADE9_BASELINE.meanFixed) f(`mean fixed items per lesson ${meanFixed} does not exceed the grade-9 mean ${GRADE9_BASELINE.meanFixed}`)
  if (meanDepth <= GRADE9_BASELINE.meanMaxDepth) f(`mean composition depth ${meanDepth} does not exceed the grade-9 mean ${GRADE9_BASELINE.meanMaxDepth}`)

  return {
    lessons: specs.length,
    meanItems,
    meanFixed,
    meanJudgment: mean(ms.map((m) => m.judgment)),
    meanMaxDepth: meanDepth,
    lessonsAtDepth2: ms.filter((m) => m.maxDepth >= 2).length,
    lessonsAtDepth3: atDepth3,
    multiPeriodLessons: multiPeriod,
    findings,
  }
}

/* -------------------------------------------------- the anti-reskin check */

const SIBLING_G9 = fileURLToPath(
  new URL('../../../financial-literacy-hs/packages/grade-09/', import.meta.url),
)

/** True when the grades 9-10 lane is checked out beside this supplement. */
export const grade9CorpusAvailable = (): boolean => existsSync(SIBLING_G9)

interface EmittedSheet {
  packageId: string
  tasks: { directions: string; prompts: { text: string }[] }[]
}

/** The same digit-stripped shape `validate.ts` uses, over an emitted sheet. */
function sheetSkeleton(sheet: EmittedSheet): string {
  return sheet.tasks
    .flatMap((t) => [t.directions, ...t.prompts.map((p) => p.text)])
    .join(' | ')
    .replace(/[\d]+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The prohibition stated in the brief, made testable: a grade-11 lesson whose
 * prompt set is grade 9's with the digits changed collides here and fails.
 *
 * Skipped, and reported as skipped, when the sibling lane is not present — this
 * supplement must stand alone, so it may not hard-depend on that corpus.
 */
export function checkNotReskinnedFromGrade9(specs: readonly LessonSpec[]): Finding[] {
  if (!grade9CorpusAvailable()) return []
  const g9 = new Map<string, string>()
  for (const entry of readdirSync(SIBLING_G9)) {
    if (!entry.endsWith('.package.json')) continue
    const sheet = JSON.parse(readFileSync(join(SIBLING_G9, entry), 'utf-8')) as EmittedSheet
    g9.set(sheetSkeleton(sheet), sheet.packageId)
  }
  const findings: Finding[] = []
  for (const spec of specs) {
    const prior = g9.get(skeleton(spec))
    if (prior) {
      findings.push({
        lessonId: spec.lessonId,
        where: 'tasks',
        message: `the prompt set, with every number removed, is identical to the grade-9 lesson ${prior}`,
      })
    }
  }
  return findings
}

/** A numeric item that consumes earlier results, for the report. */
export const isComposed = (i: Item): i is NumericItem =>
  i.kind === 'numeric' && refDepth(i.expr) >= 2
