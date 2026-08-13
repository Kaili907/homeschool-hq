/**
 * Production Gate H3 reconciliation metadata.
 *
 * H3 reconciles what a lane claims to have produced against what it actually
 * emitted. This module builds that claim explicitly rather than leaving the
 * gate to infer it: every source lesson, the package and scoring record it maps
 * to, the content digest of each, which scoring authority governs it, how many
 * of its answers were independently recomputed, and which checks were run to
 * get there.
 *
 * The manifest is derived, never hand-maintained: `tests/gateH3.test.ts`
 * rebuilds it and fails if the committed file differs, so it cannot drift away
 * from the corpus it describes.
 */
import { createHash } from 'node:crypto'
import { composeScoringRecord, composeTaskSheet, packageId, packagePath, scoringPath } from './compose.ts'
import { verifyLesson } from './oracle.ts'
import { checkCorpusProgression, metricsFor } from './progression.ts'
import {
  EXPECTED_LESSON_COUNT, GRADE, SOURCE_BRANCH, SOURCE_CORPUS_VERSION, SOURCE_COURSE, SOURCE_SHA,
  loadSourceLessons, sourceLessonMap,
} from './sourceIndex.ts'
import type { LessonSpec } from './types.ts'
import {
  checkAntiTemplate, checkNoPlaceholders, checkParameterVisibility, checkSafety, checkStructure,
} from './validate.ts'
import { checkLessonProgression, checkNotReskinnedFromGrade9, grade9CorpusAvailable } from './progression.ts'

export const LANE_ID = 'swk-flhs-g11-completion'

const digest = (value: unknown): string =>
  createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`, 'utf-8').digest('hex')

export interface H3LessonRow {
  readonly sourceLessonId: string
  readonly packageId: string
  readonly unit: number
  readonly dayInUnit: number
  readonly standards: readonly string[]
  readonly phase: string
  readonly taskSheet: string
  readonly taskSheetSha256: string
  readonly scoringRecord: string
  readonly scoringRecordSha256: string
  readonly scoringAuthorityKind: string
  readonly fixedItems: number
  readonly rubricItems: number
  readonly recomputedNumericAnswers: number
  readonly comparisonDerivedChoices: number
  readonly assertedChoices: number
  readonly compositionDepth: number
  readonly modelsMultiplePeriods: boolean
}

export interface H3Manifest {
  readonly schemaVersion: '1.0'
  readonly gate: 'H3'
  readonly laneId: string
  readonly grade: number
  readonly selfContained: true
  readonly source: Readonly<Record<string, unknown>>
  readonly coverage: Readonly<Record<string, unknown>>
  readonly counts: Readonly<Record<string, number>>
  readonly verification: Readonly<Record<string, unknown>>
  readonly progression: Readonly<Record<string, unknown>>
  readonly safety: Readonly<Record<string, unknown>>
  readonly lessons: readonly H3LessonRow[]
}

export function buildH3Manifest(specs: readonly LessonSpec[]): H3Manifest {
  const source = loadSourceLessons()
  const byId = sourceLessonMap()
  const authored = new Set(specs.map((s) => s.lessonId))
  const sourceIds = source.map((l) => l.lessonId)

  const rows: H3LessonRow[] = []
  let fixed = 0
  let rubric = 0
  let recomputed = 0
  let derived = 0
  let asserted = 0
  let oracleFindings = 0
  const kinds: Record<string, number> = {}

  for (const spec of [...specs].sort((a, b) => a.lessonId.localeCompare(b.lessonId))) {
    const src = byId.get(spec.lessonId)
    if (!src) throw new Error(`spec ${spec.lessonId} does not match any lesson in the pinned source course`)
    const sheet = composeTaskSheet(spec, src)
    const record = composeScoringRecord(spec, src) as {
      scoringAuthority: { kind: string; items?: unknown[]; judgment?: unknown[] }
    }
    const oracle = verifyLesson(spec)
    const m = metricsFor(spec)
    oracleFindings += oracle.findings.length
    fixed += m.fixed
    rubric += m.judgment
    recomputed += oracle.recomputedNumeric
    derived += oracle.derivedChoices
    asserted += oracle.assertedChoices
    kinds[record.scoringAuthority.kind] = (kinds[record.scoringAuthority.kind] ?? 0) + 1
    rows.push({
      sourceLessonId: spec.lessonId,
      packageId: packageId(spec),
      unit: spec.unit,
      dayInUnit: spec.day,
      standards: src.standards,
      phase: src.phase,
      taskSheet: packagePath(spec),
      taskSheetSha256: digest(sheet),
      scoringRecord: scoringPath(spec),
      scoringRecordSha256: digest(record),
      scoringAuthorityKind: record.scoringAuthority.kind,
      fixedItems: m.fixed,
      rubricItems: m.judgment,
      recomputedNumericAnswers: oracle.recomputedNumeric,
      comparisonDerivedChoices: oracle.derivedChoices,
      assertedChoices: oracle.assertedChoices,
      compositionDepth: m.maxDepth,
      modelsMultiplePeriods: m.usesMultiPeriod,
    })
  }

  const missing = sourceIds.filter((id) => !authored.has(id))
  const invented = [...authored].filter((id) => !sourceIds.includes(id))
  const progression = checkCorpusProgression(specs)

  const validationFindings =
    specs.flatMap(checkParameterVisibility).length +
    specs.flatMap(checkSafety).length +
    specs.flatMap(checkNoPlaceholders).length +
    specs.flatMap(checkStructure).length +
    specs.flatMap(checkLessonProgression).length +
    checkAntiTemplate(specs).length +
    checkNotReskinnedFromGrade9(specs).length +
    progression.findings.length

  return {
    schemaVersion: '1.0',
    gate: 'H3',
    laneId: LANE_ID,
    grade: GRADE,
    selfContained: true,
    source: {
      branch: SOURCE_BRANCH,
      sha: SOURCE_SHA,
      corpusVersion: SOURCE_CORPUS_VERSION,
      course: SOURCE_COURSE,
      stage: 'authoring',
      readVia: 'git show at the pinned sha; the source branch is not checked out',
    },
    coverage: {
      expectedSourceLessons: EXPECTED_LESSON_COUNT,
      sourceLessons: source.length,
      authoredLessons: specs.length,
      missing,
      invented,
      oneToOne: missing.length === 0 && invented.length === 0 && source.length === specs.length,
      unitsCovered: [...new Set(source.map((l) => l.unitNumber))].sort((a, b) => a - b),
      lessonsPerUnit: Object.fromEntries(
        [...new Set(source.map((l) => l.unitNumber))]
          .sort((a, b) => a - b)
          .map((u) => [`u${String(u).padStart(2, '0')}`, source.filter((l) => l.unitNumber === u).length]),
      ),
      standardsCovered: [...new Set(source.flatMap((l) => l.standards))].sort(),
    },
    counts: {
      taskSheets: rows.length,
      scoringRecords: rows.length,
      questions: fixed + rubric,
      fixedItems: fixed,
      rubricItems: rubric,
      recomputedNumericAnswers: recomputed,
      comparisonDerivedChoices: derived,
      assertedChoices: asserted,
      ...Object.fromEntries(Object.entries(kinds).map(([k, v]) => [`scoringAuthority_${k}`, v])),
    },
    verification: {
      oracleFindings,
      validationFindings,
      failsClosed: true,
      arithmetic: 'exact rational arithmetic over BigInt; no binary floating point',
      negativeControl: 'tests/oracle.test.ts feeds a deliberately wrong key and a broken expression and requires both to be rejected',
      checks: [
        'source-to-package 1:1 against the pinned source course',
        'independent recomputation of every fixed answer',
        'keyed choice index verified against the parameters that decide it',
        'every scored parameter visible in the learner-facing text',
        'no answer, rubric descriptor, worked solution, or look-for in a task sheet',
        'no exact key attached to any judgment item',
        'rubric integrity: acceptable-answer criteria, evidence requirements, look-fors, dimensions',
        'anti-template and duplicate-content checks within grade 11',
        'anti-reskin check against the emitted grade-9 corpus',
        'grade-11 progression floors, per lesson and corpus-wide',
        'deterministic emission: byte-identical output from the same specs',
      ],
    },
    progression: {
      band: 'grade 11 — analysis and tradeoffs',
      meanItemsPerLesson: progression.meanItems,
      meanFixedItemsPerLesson: progression.meanFixed,
      meanRubricItemsPerLesson: progression.meanJudgment,
      meanCompositionDepth: progression.meanMaxDepth,
      lessonsComposingTwoOrMoreResults: progression.lessonsAtDepth2,
      lessonsComposingThreeOrMoreResults: progression.lessonsAtDepth3,
      lessonsModellingMultiplePeriods: progression.multiPeriodLessons,
      comparedAgainstGrade9: grade9CorpusAvailable(),
      findings: progression.findings.length,
    },
    safety: {
      isFictionalSimulation: true,
      realWorldAction: false,
      completionAuthority: 'learner',
      collectsRealFinancialData: false,
      requestsCredentials: false,
      individualizedInvestmentAdvice: false,
      fraudTasksRequireNoContactWithARealScammer: true,
      taxSchedulesAreFictionalAndLabelled: true,
    },
    lessons: rows,
  }
}
