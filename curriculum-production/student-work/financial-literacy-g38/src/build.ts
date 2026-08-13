import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AUTHORED_LESSONS } from './authoring/index.ts'
import { loadSourceLessons } from './inventory.ts'
import { ORACLE_ID, verify } from './oracle.ts'
import type {
  AnswerKeyItem,
  AuthoredLesson,
  AuthorityTag,
  CorpusEntry,
  ScoringRecord,
  SourceLesson,
  TaskSheetPackage,
} from './types.ts'

export const CORPUS_ROOT = new URL('..', import.meta.url).pathname

const CORPUS_SAFETY_NOTES: readonly string[] = [
  'Every amount, person, business, and account in this task is invented for practice. Nothing here refers to a real household.',
  'Never write a real bank account, card, PIN, password, Social Security, or tax number on this sheet; the task never asks for one.',
  'This is education, not individualized financial advice. Real money decisions belong to a trusted adult.',
]

const STANDARDS_FALLBACK = ['Michigan Personal Finance foundations']

function gradeDir(grade: number): string {
  return `grade-0${grade}`
}

export function packageId(key: string): string {
  return `swk-fl-${key}`
}

function packageRelPath(source: SourceLesson): string {
  return `packages/${gradeDir(source.grade)}/${packageId(source.key)}.package.json`
}

function scoringRelPath(source: SourceLesson): string {
  return `scoring/${gradeDir(source.grade)}/${packageId(source.key)}.scoring.json`
}

/** Joins authored records to source lessons, failing closed on any mismatch. */
export function joinAuthoredToSource(requireComplete = true): { source: SourceLesson; authored: AuthoredLesson }[] {
  const sources = loadSourceLessons()
  const byKey = new Map(AUTHORED_LESSONS.map((a) => [a.key, a]))
  const missing = sources.filter((s) => !byKey.has(s.key)).map((s) => s.key)
  if (missing.length > 0 && requireComplete) {
    throw new Error(`${missing.length} source lesson(s) have no authored student work: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''}`)
  }
  const sourceKeys = new Set(sources.map((s) => s.key))
  const orphans = AUTHORED_LESSONS.filter((a) => !sourceKeys.has(a.key)).map((a) => a.key)
  if (orphans.length > 0) throw new Error(`authored lesson(s) match no source lesson: ${orphans.join(', ')}`)
  if (byKey.size !== AUTHORED_LESSONS.length) throw new Error('duplicate authored lesson key')
  return sources.filter((s) => byKey.has(s.key)).map((source) => ({ source, authored: byKey.get(source.key)! }))
}

function buildPackage(source: SourceLesson, authored: AuthoredLesson): TaskSheetPackage {
  return {
    schemaVersion: '2.0',
    packageId: packageId(source.key),
    lessonRef: {
      lessonId: source.lessonId,
      courseId: source.courseId,
      grade: source.grade,
      subject: 'financial-literacy',
      unitNumber: source.unitNumber,
      unitTitle: source.unitTitle,
      dayInUnit: source.dayInUnit,
      phase: source.phase,
      title: source.title,
      focus: source.focus,
    },
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    standardsRefs: source.standards.length > 0 ? source.standards : STANDARDS_FALLBACK,
    objective: authored.objective,
    scenario: authored.scenario,
    isFictionalSimulation: true,
    completionAuthority: 'learner',
    realWorldAction: false,
    signOff: null,
    safetyNotes: [...CORPUS_SAFETY_NOTES, ...(authored.safetyNotes ?? [])],
    materials: authored.materials ?? ['pencil or accessible response tool', 'this task sheet'],
    tasks: authored.tasks.map((task) => ({
      taskId: task.taskId,
      kind: task.kind,
      directions: task.directions,
      // `fixed` is deliberately dropped here: it is the answer authority and
      // must never appear in a student-facing file.
      prompts: task.prompts.map((p) => ({
        ref: p.ref,
        promptType: p.promptType,
        text: p.text,
        ...(p.unit ? { unit: p.unit } : {}),
        ...(p.choices ? { choices: p.choices } : {}),
      })),
    })),
    remediation: authored.remediation,
    extension: authored.extension,
    scoringRef: scoringRelPath(source),
    financialSafety: { neverRequestsRealCredentials: true, noIndividualizedAdvice: true },
    integrity: {
      sourceCorpusVersion: '1.0.0',
      sourceRef: source.sourceRef,
      sourcePath: source.sourcePath,
      sourceLessonId: source.lessonId,
      authoredBy: 'manual',
      answerDerivedFromSourceGuidance: false,
    },
  }
}

/**
 * Builds the adult-only scoring record. Every fixed answer is re-derived by
 * the oracle from the committed computation spec and compared to the
 * hand-authored literal; a disagreement throws and nothing is emitted.
 */
function buildScoring(source: SourceLesson, authored: AuthoredLesson): ScoringRecord {
  const items: AnswerKeyItem[] = []
  for (const task of authored.tasks) {
    for (const prompt of task.prompts) {
      const isFixedPrompt = prompt.promptType === 'fixed-numeric' || prompt.promptType === 'fixed-choice'
      if (!prompt.fixed) {
        if (isFixedPrompt) throw new Error(`${source.key} ${prompt.ref}: ${prompt.promptType} prompt has no fixed answer authority`)
        continue
      }
      if (!isFixedPrompt) throw new Error(`${source.key} ${prompt.ref}: open prompt must not carry a fixed answer`)
      const result = verify(prompt.fixed.expected, prompt.fixed.compute, `${source.key} ${prompt.ref}`)
      if (prompt.promptType === 'fixed-choice') {
        if (!prompt.choices || prompt.choices.length < 2) throw new Error(`${source.key} ${prompt.ref}: fixed-choice prompt needs at least two choices`)
        if (!prompt.choices.includes(result.formatted)) {
          throw new Error(`${source.key} ${prompt.ref}: recomputed answer "${result.formatted}" is not among the offered choices`)
        }
      }
      items.push({
        ref: prompt.ref,
        promptText: prompt.text,
        answer: result.formatted,
        verification: {
          method: 'independent-recompute',
          reasoning: `${result.trace}. Recomputed by ${ORACLE_ID} from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement.${prompt.fixed.note ? ` ${prompt.fixed.note}` : ''}`,
          computation: prompt.fixed.compute,
          trace: result.trace,
        },
      })
    }
  }

  const openPrompts = authored.tasks.flatMap((t) => t.prompts).filter((p) => !p.fixed)
  if (authored.authority === 'FIXED' && items.length === 0) throw new Error(`${source.key}: FIXED lesson has no verified answer-key item`)
  if (authored.authority === 'JUDGMENT' && items.length > 0) throw new Error(`${source.key}: JUDGMENT lesson must not assert an exact answer`)
  if (openPrompts.length > 0 && (authored.rubric ?? []).length === 0) {
    throw new Error(`${source.key}: has ${openPrompts.length} open prompt(s) but no rubric criteria`)
  }

  const authorityTag: AuthorityTag = {
    gate: 'H2',
    authorityClass: authored.authority === 'FIXED' ? 'FIXED_ANSWER_KEY' : 'RUBRIC_JUDGMENT',
    answerTextPresent: authored.authority === 'FIXED' ? items.every((i) => i.answer.trim().length > 0) : (authored.rubric ?? []).length > 0,
    fixedItemCount: items.length,
    rubricCriterionCount: (authored.rubric ?? []).length,
    answerDerivation: authored.authority === 'FIXED' ? 'independent-recompute' : 'not-applicable-judgment',
    derivedFromSourceGenericGuidance: false,
    oracleId: ORACLE_ID,
    oracleVerdict: 'AGREES',
  }

  const common = {
    schemaVersion: '2.0' as const,
    packageId: packageId(source.key),
    lessonId: source.lessonId,
    adultOnly: true as const,
    authorityTag,
    completionAuthority: 'learner' as const,
    nonDiagnosticGuard: 'Do not infer effort, motivation, diagnosis, or character from an error.' as const,
  }

  if (authored.authority === 'FIXED') {
    return {
      ...common,
      scoringAuthority: {
        kind: 'ANSWER_KEY',
        items,
        ...(authored.rubric ? { criteria: authored.rubric } : {}),
        ...(authored.lookFors ? { lookFors: authored.lookFors } : {}),
      },
    }
  }
  if (!authored.rubric || authored.rubric.length === 0) throw new Error(`${source.key}: JUDGMENT lesson has no rubric`)
  if (!authored.lookFors || authored.lookFors.length === 0) throw new Error(`${source.key}: JUDGMENT lesson has no acceptable-answer criteria`)
  return {
    ...common,
    scoringAuthority: {
      kind: 'RUBRIC',
      criteria: authored.rubric,
      acceptableAnswerCriteria: authored.lookFors,
    },
  }
}

export function buildCorpus(requireComplete = true): CorpusEntry[] {
  return joinAuthoredToSource(requireComplete).map(({ source, authored }) => ({
    source,
    authored,
    pkg: buildPackage(source, authored),
    scoring: buildScoring(source, authored),
    packagePath: packageRelPath(source),
    scoringPath: scoringRelPath(source),
  }))
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export interface WriteReport {
  readonly written: number
  readonly unchanged: number
  readonly drift: readonly string[]
}

/** `check` mode never writes: it reports drift between authored source and committed files. */
export function writeCorpus(entries: readonly CorpusEntry[], mode: 'write' | 'check'): WriteReport {
  let written = 0
  let unchanged = 0
  const drift: string[] = []
  for (const entry of entries) {
    for (const [relPath, value] of [
      [entry.packagePath, entry.pkg],
      [entry.scoringPath, entry.scoring],
    ] as const) {
      const abs = join(CORPUS_ROOT, relPath)
      const next = serialize(value)
      let current: string | null = null
      try {
        current = readFileSync(abs, 'utf-8')
      } catch {
        current = null
      }
      if (current === next) {
        unchanged += 1
        continue
      }
      drift.push(relPath)
      if (mode === 'write') {
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, next)
        written += 1
      }
    }
  }
  return { written, unchanged, drift }
}
