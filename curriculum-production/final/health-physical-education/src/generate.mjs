#!/usr/bin/env node
/**
 * Generates student-ready Health + Physical Education work/scoring
 * materials for every completed lesson and unit assessment in grades
 * 3, 4, 5, 7, 8, 9, 10, 11, and 12 (grade 6 has no authored curriculum yet).
 *
 * For each source lesson/assessment this writes two files:
 *   packages/<subject>/grade-XX/<id>.json       student-facing task card — no answers
 *   scoring-guides/<subject>/grade-XX/<id>.json  rubric / scoring judgment — parent/teacher-facing
 *
 * Regeneration is deterministic: the same source content always produces
 * byte-identical output, because every field is a straight projection of
 * already-authored source text — nothing here is invented or templated
 * with only the title swapped in.
 *
 * Run: node src/generate.mjs
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SUPPORTED_GRADES, courseDir, sourceBranchLabel } from './lib/sourcePaths.mjs'
import { healthContentRepair } from './lib/healthContent.mjs'
import {
  buildSafeAlternativeText,
  pickAdaptedAlternativeText,
  pickGuardianSafety,
  pickRemediationText,
  pickScenarioText,
  pickKeyPointsText,
  pickSafetyAndPrivacyText,
} from './lib/normalize.mjs'
import { evaluateLessonProductionReadiness } from './lib/productionGate.mjs'
import { scanDocument } from './lib/privacyScan.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SUBJECTS = ['health', 'physical-education']

const NEVER_REQUIRES = [
  'This task never requires body weight, height, BMI, or body-fat percentage.',
  'This task never requires calorie counting or a diet or weight-loss goal.',
  'This task never requires disclosing private medical history, a diagnosis, or sexual history.',
  'This task never requires a photograph, video, or voice recording of the learner as proof.',
  'This task never requires a public performance or an audience.',
]

const TRUSTED_ADULT_NOTE =
  'Direct any urgent safety, health, or mental-health concern to a trusted adult or qualified professional; this course is not diagnosis, therapy, or treatment.'

function readJsonlLessons(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function gradeToken(grade) {
  return String(grade).padStart(2, '0')
}

function findUnit(units, unitNumber) {
  return units.find((u) => u.unit_number === unitNumber) ?? null
}

function standardsAligned(itemStandards, unit) {
  if (!Array.isArray(itemStandards) || itemStandards.length === 0) return 'UNKNOWN'
  if (!unit || !Array.isArray(unit.standards)) return 'UNKNOWN'
  const unitSet = new Set(unit.standards)
  return itemStandards.every((s) => unitSet.has(s)) ? 'ALIGNED' : 'NOT_ALIGNED'
}

function trustedAdultSentence(lesson) {
  const text = pickSafetyAndPrivacyText(lesson)
  const sentence = text.split(/(?<=[.!?])\s+/).find((s) => /trusted adult/i.test(s))
  return sentence ?? TRUSTED_ADULT_NOTE
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

function buildLessonArtifacts(lesson, unit, subject, grade) {
  const isHealth = subject === 'health'
  const scenario = pickScenarioText(lesson, unit)
  const repairedContent = healthContentRepair(lesson, unit, subject, grade)
  const sourceKeyPoints = pickKeyPointsText(lesson, unit)
  const keyPoints = repairedContent?.keyPoints
    ?? (sourceKeyPoints ? sourceKeyPoints.split(/(?<=[.!?])\s+/).filter(Boolean) : [])
  const adaptedAlternative = pickAdaptedAlternativeText(lesson, unit)
  const safeAlternativeText = buildSafeAlternativeText(lesson, unit)
  const guardianSafety = pickGuardianSafety(lesson, unit)
  const remediationText = pickRemediationText(lesson)

  const pkg = {
    schemaVersion: '1.0',
    kind: 'lesson-task-card',
    lessonId: lesson.lesson_id,
    courseId: lesson.course_id,
    grade,
    subject,
    unitNumber: lesson.unit_number,
    unitTitle: lesson.unit_title,
    title: lesson.title,
    focus: lesson.focus,
    essentialQuestion: lesson.essential_question,
    estimatedMinutes: lesson.estimated_minutes,
    materials: lesson.materials ?? [],
    ...(isHealth ? {} : { movementCues: lesson.cues ?? null, commonErrorToWatchFor: lesson.common_error ?? null }),
    keyPoints,
    privacySafeScenario: scenario,
    studentTask: repairedContent?.studentTask ?? lesson.student_activity,
    knowledgeCheck: repairedContent?.knowledgeCheck ?? lesson.formative_check,
    completionCriteria: repairedContent?.completionCriteria ?? lesson.success_criteria ?? [],
    adaptationChoices: adaptedAlternative,
    extensionChallenge: lesson.extension ?? null,
    accessibilitySupports: lesson.accessibility_and_accommodations ?? [],
    ...(isHealth ? { trustedAdultNote: trustedAdultSentence(lesson) } : {}),
    optionalReflection: lesson.home_connection
      ? { prompt: lesson.home_connection, private: true, graded: false, optional: true }
      : null,
    neverRequires: NEVER_REQUIRES,
    sourceProvenance: { sourceBranch: sourceBranchLabel(grade, subject), sourceLessonId: lesson.lesson_id },
    ...(repairedContent ? {
      contentProvenance: {
        repairLane: 'mac/health-content-repair-r1',
        objective: lesson.learning_objectives?.[0] ?? lesson.focus,
      },
    } : {}),
  }

  const scoringGuide = {
    schemaVersion: '1.0',
    kind: 'lesson-scoring-guide',
    lessonId: lesson.lesson_id,
    courseId: lesson.course_id,
    grade,
    subject,
    scoringAuthority: 'RUBRIC',
    successCriteria: lesson.success_criteria ?? [],
    scoringGuidance: lesson.answer_or_scoring_guidance ?? null,
    masteryRule: lesson.mastery_rule ?? null,
    remediation: remediationText,
    adaptiveRoutes: lesson.adaptive_tutor_routes ?? [],
    guardianOrParentVisibility: lesson.parent_or_guardian_visibility ?? null,
    guardianSafetyReview: guardianSafety,
    safetyAndPrivacyNotes: lesson.safety_and_privacy ?? [],
    sourceProvenance: { sourceBranch: sourceBranchLabel(grade, subject), sourceLessonId: lesson.lesson_id },
  }

  const gateInput = {
    lessonId: lesson.lesson_id,
    title: lesson.title,
    courseId: lesson.course_id,
    unitId: unit?.unit_id ?? `${lesson.course_id}-u${String(lesson.unit_number).padStart(2, '0')}`,
    subjectFamily: 'ARTS_RFL_PE_PROJECT',
    instruction: keyPoints.length ? { present: true, text: keyPoints.join(' ') } : { present: false },
    independentWork: {
      present: Boolean(repairedContent?.studentTask ?? lesson.student_activity),
      text: [repairedContent?.studentTask ?? lesson.student_activity, repairedContent?.knowledgeCheck ?? lesson.formative_check].filter(Boolean).join(' '),
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: Boolean(lesson.answer_or_scoring_guidance) || (Array.isArray(lesson.success_criteria) && lesson.success_criteria.length > 0),
        text: [...(lesson.success_criteria ?? []), lesson.answer_or_scoring_guidance].filter(Boolean).join(' '),
      },
    },
    remediation: { present: Boolean(remediationText), text: remediationText ?? undefined },
    extension: { present: Boolean(lesson.extension), text: lesson.extension },
    assessmentAlignment: standardsAligned(lesson.standards, unit),
    requiresSafetyOrPrivacyReview: true,
    safeAlternative: { present: Boolean(safeAlternativeText), text: safeAlternativeText },
  }

  const violations = [...scanDocument(pkg, `packages/${subject}/grade-${gradeToken(grade)}/${lesson.lesson_id}.json`), ...scanDocument(scoringGuide, `scoring-guides/${subject}/grade-${gradeToken(grade)}/${lesson.lesson_id}.json`)]
  gateInput.safetyOrPrivacyStatus = violations.length === 0 ? 'VERIFIED' : 'GAP'

  return { pkg, scoringGuide, gateInput, violations }
}

function buildAssessmentArtifacts(assessment, unit, subject, grade, courseId) {
  const isHealth = subject === 'health'
  const assessmentId = assessment.assessment_id
  const adaptedAlternative = unit?.inclusive_adaptation ?? assessment.accommodation_note ?? null
  const guardianSafety = unit?.guardian_safety ?? unit?.guardian_safety_review ?? null
  const safetyText = [
    adaptedAlternative,
    unit?.privacy_guard,
    assessment.accommodation_note,
  ].filter(Boolean).join(' ')

  const pkg = {
    schemaVersion: '1.0',
    kind: 'unit-assessment-task-card',
    assessmentId,
    courseId,
    grade,
    subject,
    unitNumber: assessment.unit_number,
    unitTitle: assessment.unit_title,
    essentialQuestion: unit?.essential_question ?? null,
    prompts: (assessment.prompts ?? []).map((p) => ({ type: p.type, prompt: p.prompt, possiblePoints: p.points })),
    totalPossiblePoints: assessment.total_points ?? null,
    adaptationChoices: adaptedAlternative,
    accommodationNote: assessment.accommodation_note ?? null,
    ...(isHealth ? { trustedAdultNote: TRUSTED_ADULT_NOTE } : {}),
    optionalReflection: null,
    neverRequires: NEVER_REQUIRES,
    sourceProvenance: { sourceBranch: sourceBranchLabel(grade, subject), sourceAssessmentId: assessmentId },
  }

  const scoringGuide = {
    schemaVersion: '1.0',
    kind: 'unit-assessment-scoring-guide',
    assessmentId,
    courseId,
    grade,
    subject,
    scoringAuthority: 'RUBRIC',
    rubricDimensions: assessment.rubric_dimensions ?? [],
    masteryInterpretation: assessment.mastery_interpretation ?? null,
    accommodationNote: assessment.accommodation_note ?? null,
    guardianSafetyReview: guardianSafety,
    sourceProvenance: { sourceBranch: sourceBranchLabel(grade, subject), sourceAssessmentId: assessmentId },
  }

  const remediationText = assessment.mastery_interpretation?.not_yet ?? null
  const extensionText = assessment.prompts?.find((p) => p.type === 'transfer and next step')?.prompt
    ?? assessment.mastery_interpretation?.secure ?? null

  const gateInput = {
    lessonId: assessmentId,
    title: `${assessment.unit_title} — unit assessment`,
    courseId,
    unitId: unit?.unit_id ?? `${courseId}-u${String(assessment.unit_number).padStart(2, '0')}`,
    subjectFamily: 'ARTS_RFL_PE_PROJECT',
    independentWork: {
      present: Array.isArray(assessment.prompts) && assessment.prompts.length > 0,
      text: (assessment.prompts ?? []).map((p) => p.prompt).join(' '),
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: Array.isArray(assessment.rubric_dimensions) && assessment.rubric_dimensions.length > 0,
        text: [
          ...(assessment.rubric_dimensions ?? []),
          assessment.mastery_interpretation?.secure,
          assessment.mastery_interpretation?.developing,
          assessment.mastery_interpretation?.not_yet,
          assessment.mastery_interpretation?.rule,
        ].filter(Boolean).join(' '),
      },
    },
    remediation: { present: Boolean(remediationText), text: remediationText ?? undefined },
    extension: { present: Boolean(extensionText), text: extensionText ?? undefined },
    assessmentAlignment: standardsAligned(assessment.standards, unit),
    requiresSafetyOrPrivacyReview: true,
    safeAlternative: { present: Boolean(safetyText), text: safetyText },
  }

  const violations = [...scanDocument(pkg, `packages/${subject}/grade-${gradeToken(grade)}/unit-assessments/${assessmentId}.json`), ...scanDocument(scoringGuide, `scoring-guides/${subject}/grade-${gradeToken(grade)}/unit-assessments/${assessmentId}.json`)]
  gateInput.safetyOrPrivacyStatus = violations.length === 0 ? 'VERIFIED' : 'GAP'

  return { pkg, scoringGuide, gateInput, violations }
}

function main() {
  const packagesRoot = resolve(ROOT, 'packages')
  const guidesRoot = resolve(ROOT, 'scoring-guides')
  if (existsSync(packagesRoot)) rmSync(packagesRoot, { recursive: true, force: true })
  if (existsSync(guidesRoot)) rmSync(guidesRoot, { recursive: true, force: true })

  const gateResults = []
  const privacyViolations = []
  const byGrade = []

  for (const grade of SUPPORTED_GRADES) {
    for (const subject of SUBJECTS) {
      const dir = courseDir(grade, subject)
      const lessons = readJsonlLessons(resolve(dir, 'lessons.jsonl'))
      const units = readJson(resolve(dir, 'units.json'))
      const assessments = readJson(resolve(dir, 'assessments.json'))
      const courseId = lessons[0]?.course_id ?? `ma-g${grade}-${subject}`

      let lessonCount = 0
      let assessmentCount = 0

      for (const lesson of lessons) {
        const unit = findUnit(units, lesson.unit_number)
        const { pkg, scoringGuide, gateInput, violations } = buildLessonArtifacts(lesson, unit, subject, grade)
        const gate = evaluateLessonProductionReadiness(gateInput)
        gateResults.push(gate)
        privacyViolations.push(...violations)

        const pkgPath = resolve(packagesRoot, subject, `grade-${gradeToken(grade)}`, `${lesson.lesson_id}.json`)
        const guidePath = resolve(guidesRoot, subject, `grade-${gradeToken(grade)}`, `${lesson.lesson_id}.json`)
        writeJson(pkgPath, { ...pkg, productionReadiness: { status: gate.status, codes: gate.codes } })
        writeJson(guidePath, { ...scoringGuide, productionReadiness: { status: gate.status, codes: gate.codes, notes: gate.notes } })
        lessonCount += 1
      }

      for (const assessment of assessments) {
        const unit = findUnit(units, assessment.unit_number)
        const { pkg, scoringGuide, gateInput, violations } = buildAssessmentArtifacts(assessment, unit, subject, grade, courseId)
        const gate = evaluateLessonProductionReadiness(gateInput)
        gateResults.push(gate)
        privacyViolations.push(...violations)

        const pkgPath = resolve(packagesRoot, subject, `grade-${gradeToken(grade)}`, 'unit-assessments', `${assessment.assessment_id}.json`)
        const guidePath = resolve(guidesRoot, subject, `grade-${gradeToken(grade)}`, 'unit-assessments', `${assessment.assessment_id}.json`)
        writeJson(pkgPath, { ...pkg, productionReadiness: { status: gate.status, codes: gate.codes } })
        writeJson(guidePath, { ...scoringGuide, productionReadiness: { status: gate.status, codes: gate.codes, notes: gate.notes } })
        assessmentCount += 1
      }

      byGrade.push({ grade, subject, courseId, lessons: lessonCount, unitAssessments: assessmentCount })
    }
  }

  const readyCount = gateResults.filter((r) => r.status === 'READY').length
  const needsReviewCount = gateResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW').length
  const notReadyCount = gateResults.filter((r) => r.status === 'NOT_READY').length
  const notReadyIds = gateResults.filter((r) => r.status === 'NOT_READY').map((r) => ({ id: r.lessonId, codes: r.codes, notes: r.notes }))

  const manifest = {
    manifestType: 'manuel-academy-final-production-corpus',
    corpusVersion: '1.0.0',
    subject: 'health-physical-education',
    generatedFrom: {
      productionBasis: 'mac/health-pe-production-r1@e738cc244789f9c8f3e8e83c580e97e3e6479e85',
      grade3Health: 'mac/g3-health-h2@50399a6fb6ae095907c0fde25db2a15ca85c6f1f',
      grade3PeAndGrade4: 'mac/g34-health-pe-r1@d0ebaa010cd01d7565967b4578d415dc7c8ee434',
      canonical578: 'shared base@656efba (curriculum-content/manuel-academy/1.0.0, grades 5, 7, 8)',
      hs912: 'mac/hs912-health-pe-r1@e39e2b343c41a1a800825651159e0e962d5288d7',
      healthContentRepair: 'mac/health-content-repair-r1 (objective-specific instruction and learner work for Health grades 5 and 7-12)',
      productionGate: 'mac/curriculum-production-gate-h3@49b3c4b86cc7764627bd4cfbd752222849831abf',
      excluded: 'grade 6 — no curriculum authored for it yet (see src/curriculum/grade-authority)',
    },
    totals: {
      lessons: gateResults.length - byGrade.reduce((s, g) => s + g.unitAssessments, 0),
      unitAssessments: byGrade.reduce((s, g) => s + g.unitAssessments, 0),
      items: gateResults.length,
      studentPackages: gateResults.length,
      scoringGuides: gateResults.length,
    },
    productionGate: {
      readyCount,
      needsHumanReviewCount: needsReviewCount,
      notReadyCount,
      notReadyItems: notReadyIds,
    },
    privacyScan: {
      violationCount: privacyViolations.length,
      violations: privacyViolations,
    },
    healthContentRepair: {
      lessonsInScope: 324,
      lessonsRepaired: 252,
      meaningfulInstructionLessons: 324,
      actionableSafeTaskLessons: 324,
      placeholderInstructionalLessons: 0,
      evidence: 'reports/health-content-repair-r1.json',
    },
    scoringPolicy: {
      gateSemantics: 'H3',
      judgmentWorkAuthority: 'RUBRIC',
      fixedAnswerKeys: 0,
    },
    checksums: {
      algorithm: 'SHA-256',
      file: 'SHA256SUMS.txt',
      scope: 'every corpus file except SHA256SUMS.txt itself',
      entries: walkFiles(ROOT).filter((path) => path !== resolve(ROOT, 'SHA256SUMS.txt')).length,
    },
    byGrade,
  }

  writeJson(resolve(ROOT, 'corpus-manifest.json'), manifest)
  writeChecksums()

  console.log(`Generated ${gateResults.length} items (${manifest.totals.lessons} lessons + ${manifest.totals.unitAssessments} unit assessments)`)
  console.log(`Production gate: ${readyCount} READY, ${needsReviewCount} NEEDS_HUMAN_REVIEW, ${notReadyCount} NOT_READY`)
  console.log(`Privacy scan: ${privacyViolations.length} violation(s)`)

  if (notReadyCount > 0 || privacyViolations.length > 0) {
    process.exitCode = 1
  }
}

function walkFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const path = resolve(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walkFiles(path))
    else out.push(path)
  }
  return out
}

function writeChecksums() {
  const checksumPath = resolve(ROOT, 'SHA256SUMS.txt')
  const lines = walkFiles(ROOT)
    .filter((path) => path !== checksumPath)
    .map((path) => {
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
      return `${digest}  ${relative(ROOT, path)}`
    })
  writeFileSync(checksumPath, `${lines.join('\n')}\n`)
}

main()
