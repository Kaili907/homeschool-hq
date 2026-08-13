/**
 * Deterministic projection of an authored LessonSpec into the two files that
 * ship: the learner-facing task sheet and the adult-only scoring record.
 *
 * The split is the same one the sibling Ready for Life / Financial Literacy
 * lane uses: a learner holding the task sheet alone can see no answer, no
 * rubric descriptor, and no look-for. Composition invents nothing — every
 * sentence in the output is either authored in the spec, read from the pinned
 * source lesson, or a stated policy boundary that is identical by design.
 */
import { DIMENSIONS } from './rubric.ts'
import { format, verifyLesson } from './oracle.ts'
import { SOURCE_CORPUS_VERSION, type SourceLesson } from './sourceIndex.ts'
import type { Item, JudgmentItem, LessonSpec } from './types.ts'

export const NON_DIAGNOSTIC_GUARD =
  'Do not infer effort, motivation, diagnosis, or character from an error.'

/** Identical by design across the lane: this is a policy boundary, not content. */
export const SAFETY_NOTES: readonly string[] = [
  'Every figure, person, employer, institution, offer, account, and document on this task sheet is fictional and exists only for practice.',
  'No real transaction is part of this lesson, and no real bank, card, brokerage, tax, or login detail is ever requested. If a task sheet ever appears to ask for one, stop and tell a trusted adult.',
  'This lesson teaches general financial concepts and does not advise anyone about their own money. For a real decision, talk with a trusted adult or a qualified licensed professional.',
]

export function packageId(spec: LessonSpec): string {
  return `swk-flhs-g${spec.grade}-u${String(spec.unit).padStart(2, '0')}-l${String(spec.day).padStart(2, '0')}`
}

export function gradeDir(grade: number): string {
  return `grade-${String(grade).padStart(2, '0')}`
}

/**
 * The lane-internal scoring kind. Grade 12 authors every lesson as mixed
 * work, so this is HYBRID throughout; the other two arms are kept because the
 * kind is derived from what a lesson actually contains, never asserted.
 */
export function scoringKind(spec: LessonSpec): 'ANSWER_KEY' | 'RUBRIC' | 'HYBRID' {
  const items = spec.tasks.flatMap((t) => t.items)
  const fixed = items.some((i) => i.kind !== 'judgment')
  const judgment = items.some((i) => i.kind === 'judgment')
  return fixed && judgment ? 'HYBRID' : fixed ? 'ANSWER_KEY' : 'RUBRIC'
}

export function packagePath(spec: LessonSpec): string {
  return `packages/${gradeDir(spec.grade)}/${packageId(spec)}.package.json`
}

export function scoringPath(spec: LessonSpec): string {
  return `scoring/${gradeDir(spec.grade)}/${packageId(spec)}.scoring.json`
}

function promptType(item: Item): string {
  if (item.kind === 'numeric') return 'fixed-numeric'
  if (item.kind === 'choice') return 'fixed-choice'
  return item.length === 'short' ? 'short-response' : 'extended-response'
}

/** Substitutes declared parameter values into an expression, for the worked solution. */
export function substitute(expr: string, given: Readonly<Record<string, number>>): string {
  const names = Object.keys(given).sort((a, b) => b.length - a.length)
  let out = expr
  for (const name of names) {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), String(given[name]))
  }
  return out
}

export function composeTaskSheet(spec: LessonSpec, src: SourceLesson): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    packageId: packageId(spec),
    lessonRef: {
      lessonId: src.lessonId,
      courseId: src.courseId,
      grade: src.grade,
      subject: 'financial-literacy',
      unitNumber: src.unitNumber,
      unitTitle: src.unitTitle,
      dayInUnit: src.dayInUnit,
      phase: src.phase,
      title: src.title,
    },
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    standardsRefs: src.standards,
    focus: src.focus,
    objective: spec.objective,
    scenario: spec.scenario,
    isFictionalSimulation: true,
    completionAuthority: 'learner',
    realWorldAction: false,
    signOff: null,
    safetyNotes: SAFETY_NOTES,
    simulationAlternative: null,
    materials: spec.materials,
    tasks: spec.tasks.map((task) => ({
      taskId: task.taskId,
      kind: task.kind,
      directions: task.directions,
      prompts: task.items.map((item) => {
        const base: Record<string, unknown> = {
          ref: item.ref,
          promptType: promptType(item),
          text: item.text,
        }
        if (item.kind === 'choice') base.choices = item.choices
        if (item.kind === 'numeric' && item.unit) base.unit = item.unit
        return base
      }),
    })),
    remediation: spec.remediation,
    extension: spec.extension,
    scoringRef: scoringPath(spec),
    financialSafety: { neverRequestsRealCredentials: true, noIndividualizedAdvice: true },
    integrity: {
      sourceCorpusVersion: SOURCE_CORPUS_VERSION,
      sourceLessonId: src.lessonId,
      sourceStage: 'authoring',
      authoredBy: 'manual',
    },
  }
}

export function composeScoringRecord(spec: LessonSpec, src: SourceLesson): Record<string, unknown> {
  const oracle = verifyLesson(spec)
  if (oracle.findings.length > 0) {
    throw new Error(
      `refusing to emit a scoring record for ${spec.lessonId}: the oracle could not reproduce ${oracle.findings.length} answer(s). ` +
      oracle.findings.map((f) => `${f.ref}: ${f.message}`).join(' | '),
    )
  }

  const items: Record<string, unknown>[] = []
  const worked: Record<string, unknown>[] = []
  const judgment: Record<string, unknown>[] = []
  const dimensionIds = new Set<string>()

  for (const task of spec.tasks) {
    for (const item of task.items) {
      if (item.kind === 'numeric') {
        items.push({
          ref: item.ref,
          answer: item.answer,
          verification: { method: 'recomputed', reasoning: item.reasoning },
        })
        worked.push({
          ref: item.ref,
          expression: item.expr,
          substituted: substitute(item.expr, item.given),
          result: item.answer,
          why: item.reasoning,
        })
        continue
      }
      if (item.kind === 'choice') {
        items.push({
          ref: item.ref,
          answer: item.answer,
          verification: {
            method: item.decision ? 'derived-from-comparison' : 'asserted-fixed-value',
            reasoning: item.reasoning,
          },
        })
        if (item.decision) {
          worked.push({
            ref: item.ref,
            expression: `${item.decision.left} ${item.decision.cmp} ${item.decision.right}`,
            substituted: `${substitute(item.decision.left, item.given ?? {})} ${item.decision.cmp} ${substitute(item.decision.right, item.given ?? {})}`,
            result: item.answer,
            why: item.reasoning,
          })
        }
        continue
      }
      const j = item as JudgmentItem
      for (const d of j.dimensions) dimensionIds.add(d)
      judgment.push({
        ref: j.ref,
        prompt: j.text,
        scoredBy: 'rubric',
        exactKey: null,
        acceptableAnswerCriteria: j.acceptableAnswerCriteria,
        evidenceRequirements: j.evidenceRequirements,
        lookFors: j.lookFors,
        ...(j.commonMisconception ? { commonMisconception: j.commonMisconception } : {}),
        ...(j.defensibleAlternatives ? { defensibleAlternatives: j.defensibleAlternatives } : {}),
        dimensions: j.dimensions,
      })
    }
  }

  const kind = scoringKind(spec)

  const criteria = [...dimensionIds].sort().map((id) => DIMENSIONS[id as keyof typeof DIMENSIONS])

  return {
    schemaVersion: '1.0',
    packageId: packageId(spec),
    lessonId: src.lessonId,
    integratedDomains: spec.domains,
    isCapstone: Boolean(spec.isCapstone),
    scoringAuthority: {
      kind,
      ...(items.length > 0 ? { items } : {}),
      ...(worked.length > 0 ? { workedSolution: worked } : {}),
      ...(criteria.length > 0 ? { criteria } : {}),
      ...(judgment.length > 0 ? { judgment } : {}),
    },
    completionAuthority: 'learner',
    nonDiagnosticGuard: NON_DIAGNOSTIC_GUARD,
    oracle: {
      method: "every fixed answer above was recomputed from the item's own stated scenario parameters, not transcribed",
      arithmetic: 'exact rational arithmetic over BigInt; no binary floating point',
      failsClosed: true,
      recomputedNumericAnswers: oracle.recomputedNumeric,
      comparisonDerivedChoices: oracle.derivedChoices,
      assertedChoices: oracle.assertedChoices,
      limits: 'Recomputation establishes that the key follows from the stated figures. It does not by itself establish that the model chosen is the right model for the scenario; that is carried by the per-item reasoning, the parameter-visibility check, and human review.',
    },
  }
}

export { format }
