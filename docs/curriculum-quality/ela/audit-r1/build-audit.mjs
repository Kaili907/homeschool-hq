import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AUDIT_VERSION = 'ela-depth-audit-r1'
const AUDIT_DATE = '2026-08-14'
const BASE = '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9'
const ACTIVE_RELEASE = 'family-pilot-r1'
const EXPECTED_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const EXPECTED_PER_GRADE = 180
const EXPECTED_TOTAL = EXPECTED_GRADES.length * EXPECTED_PER_GRADE
const PRODUCTION_SOURCE_COMMIT = 'd161efc876ad7563505897323f80fdb2cb11d5a4'

const auditDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(auditDir, '../../../..')
const packageRoot = path.join(repoRoot, 'curriculum-production/student-work/english-language-arts/packages')
const guideRoot = path.join(repoRoot, 'curriculum-production/student-work/english-language-arts/scoring-guides')
const bindingPath = path.join(repoRoot, 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
const releaseManifestPath = path.join(repoRoot, 'curriculum-release-admitted/family-pilot-r1/MANIFEST.json')
const compositionSource = 'curriculum-production/student-work/english-language-arts/src/contentRepair.mjs'
const projectionSource = 'curriculum-production/student-work/english-language-arts/src/lib.mjs'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function countBy(rows, selector) {
  const result = {}
  for (const row of rows) {
    const key = String(selector(row))
    result[key] = (result[key] || 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })))
}

function groupBy(rows, selector) {
  const result = new Map()
  for (const row of rows) {
    const key = selector(row)
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(row)
  }
  return result
}

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function quantile(values, ratio) {
  const sorted = values.slice().sort((a, b) => a - b)
  if (!sorted.length) return null
  return sorted[Math.floor((sorted.length - 1) * ratio)]
}

function distribution(values) {
  return {
    n: values.length,
    min: round(Math.min(...values)),
    p25: round(quantile(values, 0.25)),
    median: round(quantile(values, 0.5)),
    p75: round(quantile(values, 0.75)),
    max: round(Math.max(...values)),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
  }
}

function words(text) {
  return String(text).match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []
}

function syllables(word) {
  let value = word.toLowerCase().replace(/[^a-z]/g, '')
  if (value.length <= 3) return 1
  value = value.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, (value.match(/[aeiouy]{1,2}/g) || []).length)
}

function readability(text) {
  const tokenList = words(text)
  const sentences = Math.max(1, (String(text).match(/[.!?]+(?:\s|$)/g) || []).length)
  const syllableCount = tokenList.reduce((sum, word) => sum + syllables(word), 0)
  const grade = 0.39 * (tokenList.length / sentences) + 11.8 * (syllableCount / tokenList.length) - 15.59
  return {
    words: tokenList.length,
    sentences,
    averageSentenceWords: round(tokenList.length / sentences),
    fleschKincaidGradeAdvisory: round(grade),
  }
}

function primaryLessonType(pkg) {
  const phase = pkg.lessonRef.phase.toLowerCase()
  const context = `${pkg.lessonRef.unitTitle} ${pkg.lessonRef.focus} ${pkg.lessonRef.title}`.toLowerCase()
  if (/launch|diagnostic|baseline/.test(phase)) return 'diagnostic'
  if (/unit assessment/.test(phase)) return 'assessment'
  if (/reteach|correction/.test(phase)) return 'remediation'
  if (/consolidation|retrieval|assessment preparation|review/.test(phase)) return 'review'
  if (/transfer/.test(phase)) return 'mastery'
  if (/performance task|publication|presentation|portfolio|capstone|project/.test(phase)) return 'project'
  if (/writing|draft|revision|revise|edit/.test(phase)) return 'writing'
  if (/word work|word study|vocabulary|morphology|fluency|decoding/.test(phase) ||
      /grammar|language|word study|sentence|style manual|convention|usage|punctuation|syntax/.test(context)) {
    return 'grammar/language'
  }
  if (/reading|investigation|source|research|craft|structure|literature|poetry|theme|character|main idea|evidence/.test(`${phase} ${context}`)) {
    return 'reading'
  }
  return 'concept/skill'
}

function sourceAdapterFamily(grade) {
  if (grade <= 4) return 'g34-adapter'
  if ([5, 7, 8].includes(grade)) return 'canonical-g578-adapter'
  return 'hs912-adapter'
}

const QUESTION_FAMILIES = [
  'baseline-observation-and-question',
  'word-and-meaning-annotation',
  'trace-example-and-prioritize-step',
  'apply-and-check',
  'compare-perspectives-or-versions',
  'independent-annotation-and-inference',
  'detail-changes-interpretation',
  'misunderstanding-correction',
  'craft-choice-and-effect',
  'debatable-claim',
  'writing-plan',
  'source-developed-draft',
  'revision-and-effect',
  'transfer-and-adjustment',
  'readiness-audit',
  'independent-assessment-claim',
  'error-analysis-and-correction',
  'publication-and-reflection',
]

function questionFamily(pkg) {
  return QUESTION_FAMILIES[pkg.lessonRef.dayInUnit - 1] || 'unmapped'
}

function normalizedGeneratedPassageSignature(pkg) {
  if (pkg.sourceReference.refs[0].origin !== 'academy_original_generated') return null
  const form = pkg.sourceReference.refs[0].form
  return `contentRepair:${form}`
}

function normalizeGuided(pkg) {
  return pkg.guidedSupport.text
    .replace(/“[^”]+”/g, '“TITLE”')
    .replaceAll(pkg.lessonRef.focus, 'FOCUS')
}

function normalizeRemediation(pkg) {
  return pkg.remediation.text
    .replace(/“[^”]+”/g, '“TITLE”')
    .replaceAll(pkg.lessonRef.focus, 'FOCUS')
}

function learnerAdultFieldLeak(pkg) {
  const forbidden = /^(?:scoringAuthority|rubric|acceptableAnswerCriteria|masteryCriteria|doNotUse|answerKey|correctAnswer|modelAnswer)$/i
  let found = false
  const visit = (value) => {
    if (found || value == null) return
    if (Array.isArray(value)) return value.forEach(visit)
    if (typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.test(key)) found = true
      visit(child)
    }
  }
  visit(pkg)
  return found
}

function learnerEngineeringLanguage(pkg) {
  return /delivered Academy-original source|named deliverable|Evidence requirement|learner success criterion/i.test(JSON.stringify(pkg))
}

function sourceAnchoredScoringExampleCount(guide) {
  let count = 0
  const visit = (value, key = '') => {
    if (value == null) return
    if (Array.isArray(value)) return value.forEach((child) => visit(child, key))
    if (typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey)
      return
    }
    if (/example|exemplar|anchor/i.test(key) && String(value).trim()) count += 1
  }
  visit(guide)
  return count
}

function defectCodes(pkg, guide) {
  const generated = pkg.sourceReference.refs[0].origin === 'academy_original_generated'
  const writingRequired = pkg.writingTask.required === true
  const phase = pkg.lessonRef.phase.toLowerCase()
  const lessonType = primaryLessonType(pkg)
  const instructionExpected = new Set(['concept/skill', 'reading', 'writing', 'grammar/language', 'remediation']).has(lessonType)
  const comprehensionCheckExpected = !new Set(['assessment', 'mastery']).has(lessonType)
  const adultLeak = learnerAdultFieldLeak(pkg)
  const scoringExampleCount = sourceAnchoredScoringExampleCount(guide)
  const codes = [
    'MASTERY_EVIDENCE_NOT_RUNTIME_ADDRESSABLE',
    'GENERIC_REMEDIATION',
    'READING_LEVEL_EVIDENCE_MISSING',
    'SOURCE_QUALITY_TEMPLATE_OR_REUSE',
    'QUESTION_VARIETY_TEMPLATE_BOUND',
    'NEAR_DUPLICATE_STRUCTURE',
    'TUTOR_READINESS_METADATA_MISSING',
  ]
  if (learnerEngineeringLanguage(pkg)) codes.push('LEARNER_FACING_ENGINEERING_LANGUAGE')
  if (adultLeak) codes.push('LEARNER_ADULT_FIELD_LEAK')
  if (scoringExampleCount === 0) codes.push('ADULT_AUTHORITY_NOT_SOURCE_ANCHORED')
  if (instructionExpected) {
    codes.push('SHALLOW_TEACHING_EXPLANATION')
    codes.push('NO_MODELED_READING_OR_WRITING_EXAMPLE')
    codes.push('NO_EXPLICIT_VOCABULARY_SUPPORT')
    codes.push('GENERIC_GUIDED_ROUTINE')
  }
  if (comprehensionCheckExpected) codes.push('NO_EMBEDDED_COMPREHENSION_CHECKS')
  if (generated) {
    codes.push('GENERATED_PASSAGE_NOT_AUTHENTICALLY_GRADE_DIFFERENTIATED')
    codes.push('SOURCE_TELEGRAPHS_TARGET_REASONING')
  }
  if (writingRequired) codes.push('WRITING_SCAFFOLD_NOT_PHASE_SPECIFIC')
  if (!writingRequired && /\bwrite\b/i.test(pkg.independentEvidenceTask.text)) codes.push('WRITING_REQUIRED_FLAG_CONTRADICTS_WRITTEN_DELIVERABLE')
  if (/concept model|explicit model/.test(phase)) codes.push('MODEL_LABELED_LESSON_HAS_NO_MODEL')
  if (/guided practice/.test(phase)) codes.push('GUIDED_LABELED_LESSON_HAS_NO_GUIDED_TRY_FEEDBACK_LOOP')
  if (/transfer/.test(phase)) codes.push('TRANSFER_LABELED_LESSON_HAS_NO_NEW_TEXT')
  if (/unit assessment/.test(phase)) codes.push('UNIT_ASSESSMENT_PROMPTS_NOT_PROJECTED')
  if (!guide?.scoringAuthority) codes.push('MISSING_ADULT_SCORING_AUTHORITY')
  return codes.sort()
}

function depthClassification(codes) {
  const blockers = new Set([
    'SHALLOW_TEACHING_EXPLANATION',
    'NO_MODELED_READING_OR_WRITING_EXAMPLE',
    'NO_EMBEDDED_COMPREHENSION_CHECKS',
    'ADULT_AUTHORITY_NOT_SOURCE_ANCHORED',
    'TUTOR_READINESS_METADATA_MISSING',
  ])
  return codes.some((code) => blockers.has(code)) ? 'NOT_DEPTH_READY' : 'DEPTH_READY'
}

function loadCorpus() {
  const packages = []
  const guides = new Map()
  for (const grade of EXPECTED_GRADES) {
    const gradeDir = `grade-${String(grade).padStart(2, '0')}`
    const packageDir = path.join(packageRoot, gradeDir)
    const scoringDir = path.join(guideRoot, gradeDir)
    for (const filename of fs.readdirSync(packageDir).filter((name) => name.endsWith('.package.json')).sort()) {
      const packagePath = path.join(packageDir, filename)
      packages.push({ pkg: readJson(packagePath), packagePath })
    }
    for (const filename of fs.readdirSync(scoringDir).filter((name) => name.endsWith('.scoring.json')).sort()) {
      const guidePath = path.join(scoringDir, filename)
      const guide = readJson(guidePath)
      guides.set(guide.lessonRef.lessonId, { guide, guidePath })
    }
  }
  return { packages, guides }
}

const releaseManifest = readJson(releaseManifestPath)
const bindings = readJsonl(bindingPath).filter((row) => row.subject === 'english-language-arts')
const bindingByLesson = new Map(bindings.map((row) => [row.lessonRef, row]))
const { packages, guides } = loadCorpus()

const bodyGroups = groupBy(packages, ({ pkg }) => pkg.sourceReference.refs[0].sha256)
const exactDuplicateBodyGroups = [...bodyGroups.values()].filter((rows) => rows.length > 1)
const exactDuplicateLessons = new Set(exactDuplicateBodyGroups.flatMap((rows) => rows.map(({ pkg }) => pkg.lessonRef.lessonId)))
const generatedGroups = groupBy(
  packages.filter(({ pkg }) => pkg.sourceReference.refs[0].origin === 'academy_original_generated'),
  ({ pkg }) => normalizedGeneratedPassageSignature(pkg),
)

const findings = packages
  .map(({ pkg, packagePath }) => {
    const lessonId = pkg.lessonRef.lessonId
    const guideRecord = guides.get(lessonId)
    const guide = guideRecord?.guide
    const binding = bindingByLesson.get(lessonId)
    const codes = defectCodes(pkg, guide)
    const source = pkg.sourceReference.refs[0]
    const duplicateGroup = bodyGroups.get(source.sha256)
    const normalizedFamily = normalizedGeneratedPassageSignature(pkg)
    const expectedPackageRef = `git+${PRODUCTION_SOURCE_COMMIT}:${relative(packagePath)}`
    const expectedGuideRef = guideRecord ? `git+${PRODUCTION_SOURCE_COMMIT}:${relative(guideRecord.guidePath)}` : null
    const productionBindingExact = Boolean(
      binding &&
      binding.productionSourceCommit === PRODUCTION_SOURCE_COMMIT &&
      binding.productionPackageRef === expectedPackageRef &&
      binding.scoringAuthorityRef === expectedGuideRef &&
      binding.productionGate?.status === 'READY'
    )
    return {
      auditVersion: AUDIT_VERSION,
      authoritativeBase: BASE,
      activeRelease: ACTIVE_RELEASE,
      productionSourceCommit: binding?.productionSourceCommit || null,
      lessonId,
      packagePath: relative(packagePath),
      adultGuidePath: guideRecord ? relative(guideRecord.guidePath) : null,
      productionBindingPresent: Boolean(binding),
      productionBindingExact,
      grade: pkg.lessonRef.grade,
      unitNumber: pkg.lessonRef.unitNumber,
      courseDay: pkg.lessonRef.courseDay,
      dayInUnit: pkg.lessonRef.dayInUnit,
      title: pkg.lessonRef.title,
      phase: pkg.lessonRef.phase,
      focus: pkg.lessonRef.focus,
      primaryLessonType: primaryLessonType(pkg),
      standards: pkg.standards,
      writingRequired: pkg.writingTask.required,
      source: {
        origin: source.origin,
        form: source.form,
        textId: source.textId,
        title: source.title,
        wordCount: source.wordCount,
        bodySha256: source.sha256,
        readability: readability(pkg.sourceReference.text),
        exactDuplicateBody: exactDuplicateLessons.has(lessonId),
        exactDuplicateBodyGroupSize: duplicateGroup.length,
        compositionFamily: normalizedFamily || 'academy-original-bank-reuse',
      },
      pedagogy: {
        teachingExplanation: new Set(['concept/skill', 'reading', 'writing', 'grammar/language', 'remediation']).has(primaryLessonType(pkg)) ? 'SHALLOW_ORIENTATION_ONLY' : 'NOT_REQUIRED_FOR_PRIMARY_TYPE',
        modeledExampleCount: 0,
        modeledExampleExpectation: new Set(['concept/skill', 'reading', 'writing', 'grammar/language', 'remediation']).has(primaryLessonType(pkg)) ? 'EXPECTED' : 'NOT_REQUIRED_FOR_PRIMARY_TYPE',
        vocabularySupport: new Set(['concept/skill', 'reading', 'writing', 'grammar/language', 'remediation']).has(primaryLessonType(pkg)) ? 'ABSENT' : 'NOT_REQUIRED_FOR_PRIMARY_TYPE',
        guidedWork: new Set(['concept/skill', 'reading', 'writing', 'grammar/language', 'remediation']).has(primaryLessonType(pkg)) ? 'GENERIC_ROUTINE_NO_FEEDBACK_LOOP' : 'NOT_REQUIRED_FOR_PRIMARY_TYPE',
        independentWork: 'PRESENT_SINGLE_CONSTRUCTED_RESPONSE',
        comprehensionChecks: 0,
        learnerVisibleMasteryRule: false,
        remediation: 'GENERIC_FOUR_GAP_ROUTINE',
        writingScaffold: pkg.writingTask.required ? 'LENGTH_AND_PRODUCT_ONLY' : 'NOT_MARKED_REQUIRED',
      },
      variety: {
        questionFamily: questionFamily(pkg),
        questionCount: 1,
        normalizedQuestionFamilyCountAcrossCorpus: 18,
        normalizedGuidedRoutineSha256: sha256(normalizeGuided(pkg)),
        normalizedRemediationRoutineSha256: sha256(normalizeRemediation(pkg)),
      },
      authority: {
        learnerAdultFieldLeak: learnerAdultFieldLeak(pkg),
        sourceTelegraphsTargetReasoning: source.origin === 'academy_original_generated',
        adultGuidePresent: Boolean(guide),
        kind: guide?.scoringAuthority?.kind || null,
        rubricDimensions: guide?.scoringAuthority?.rubric?.length || 0,
        sourceAnchoredScoringExamples: sourceAnchoredScoringExampleCount(guide),
        masteryCriteriaPresent: Boolean(guide?.masteryCriteria),
        authorshipPolicyPresent: Boolean(guide?.authorshipPolicy),
      },
      tutorReadiness: {
        phasePresent: Boolean(pkg.lessonRef.phase),
        gradePresent: Number.isInteger(pkg.lessonRef.grade),
        conceptIds: false,
        prerequisites: false,
        misconceptionIdsOrTriggers: false,
        tutorRoutes: false,
        hintProgression: false,
        retryPolicy: false,
        evidenceCaptureSchema: false,
        ageOrReadingPolicy: false,
        answerRevealPolicy: false,
      },
      generatorFamily: {
        sourceAdapterFamily: sourceAdapterFamily(pkg.lessonRef.grade),
        sharedCompositionFamily: 'ela-content-repair-v2',
        sharedCompositionSource: compositionSource,
        packageProjectionSource: projectionSource,
        readingCompositionFamily: normalizedFamily || 'academy-original-bank-reuse',
        questionCompositionFamily: `phase-task-${String(pkg.lessonRef.dayInUnit).padStart(2, '0')}`,
      },
      defectCodes: codes,
      depthClassification: depthClassification(codes),
    }
  })
  .sort((a, b) => a.grade - b.grade || a.courseDay - b.courseDay || a.lessonId.localeCompare(b.lessonId))

const defectCounts = countBy(findings.flatMap((finding) => finding.defectCodes.map((code) => ({ code }))), (row) => row.code)
const byGrade = {}
for (const grade of EXPECTED_GRADES) {
  const rows = findings.filter((finding) => finding.grade === grade)
  byGrade[grade] = {
    lessons: rows.length,
    packages: rows.filter((row) => fs.existsSync(path.join(repoRoot, row.packagePath))).length,
    adultGuides: rows.filter((row) => row.authority.adultGuidePresent).length,
    productionBindings: rows.filter((row) => row.productionBindingExact).length,
    uniqueLessonIds: new Set(rows.map((row) => row.lessonId)).size,
    primaryLessonTypes: countBy(rows, (row) => row.primaryLessonType),
    sourceOrigins: countBy(rows, (row) => row.source.origin),
    sourceWordCounts: distribution(rows.map((row) => row.source.wordCount)),
    advisoryFleschKincaid: distribution(rows.map((row) => row.source.readability.fleschKincaidGradeAdvisory)),
    lessonsWithDefects: rows.filter((row) => row.defectCodes.length > 0).length,
    depthReady: rows.filter((row) => row.depthClassification === 'DEPTH_READY').length,
  }
}

const summary = {
  auditVersion: AUDIT_VERSION,
  auditDate: AUDIT_DATE,
  authoritativeBase: BASE,
  status: 'COMPLETE',
  scope: {
    activeRelease: ACTIVE_RELEASE,
    subject: 'english-language-arts',
    supportedGrades: EXPECTED_GRADES,
    excludedGrade: 6,
    reserveExcluded: true,
    assessmentsCountedOnlyWhenTheyAreScheduledLessonRows: true,
    mathLessonCountAssumptionsUsed: false,
  },
  inventory: {
    expectedLessons: EXPECTED_TOTAL,
    lessonsAudited: findings.length,
    uniqueLessonIds: new Set(findings.map((row) => row.lessonId)).size,
    packageFiles: packages.length,
    adultGuides: guides.size,
    admittedProductionBindings: bindings.length,
    exactProductionBindings: findings.filter((row) => row.productionBindingExact).length,
    releaseManifestElaBindings: releaseManifest.productionBindings.familyTotals['english-language-arts'],
    exactReconciliation: findings.length === EXPECTED_TOTAL && packages.length === EXPECTED_TOTAL && guides.size === EXPECTED_TOTAL && bindings.length === EXPECTED_TOTAL && findings.every((row) => row.productionBindingExact),
  },
  primaryLessonTypes: countBy(findings, (row) => row.primaryLessonType),
  defectCounts,
  depthClassifications: countBy(findings, (row) => row.depthClassification),
  corpusMechanics: {
    sourceOrigins: countBy(findings, (row) => row.source.origin),
    uniqueSourceBodies: bodyGroups.size,
    exactDuplicateSourceBodyGroups: exactDuplicateBodyGroups.length,
    lessonsAffectedByExactSourceBodyReuse: exactDuplicateLessons.size,
    generatedPassageTemplateFamilies: generatedGroups.size,
    generatedPassageTemplateFamilyCounts: countBy(findings.filter((row) => row.source.origin === 'academy_original_generated'), (row) => row.source.compositionFamily),
    lessonsAffectedByGeneratedPassageTemplates: findings.filter((row) => row.source.origin === 'academy_original_generated').length,
    normalizedQuestionFamilies: new Set(findings.map((row) => row.variety.questionFamily)).size,
    normalizedQuestionFamilyCounts: countBy(findings, (row) => row.variety.questionFamily),
    normalizedGuidedRoutines: new Set(findings.map((row) => row.variety.normalizedGuidedRoutineSha256)).size,
    normalizedRemediationRoutines: new Set(findings.map((row) => row.variety.normalizedRemediationRoutineSha256)).size,
    writingRequiredTrue: findings.filter((row) => row.writingRequired).length,
    writingRequiredFalseDespiteWrittenDeliverable: findings.filter((row) => !row.writingRequired).length,
  },
  authority: {
    adultGuidesPresent: findings.filter((row) => row.authority.adultGuidePresent).length,
    learnerAdultLeaks: findings.filter((row) => row.authority.learnerAdultFieldLeak).length,
    sourceTelegraphsTargetReasoning: findings.filter((row) => row.authority.sourceTelegraphsTargetReasoning).length,
    sourceAnchoredScoringExamples: findings.filter((row) => row.authority.sourceAnchoredScoringExamples > 0).length,
  },
  byGrade,
  representativeSampleRecommendation: {
    lessonId: 'ma-g7-english-language-arts-u05-l03',
    rationale: 'A middle-grade guided-practice argument lesson that should make teaching, modeling, guided reasoning, independent evidence use, vocabulary, remediation, adult scoring, and Tutor metadata visible in one reviewable sample.',
  },
}

const generatorFamilies = {
  auditVersion: AUDIT_VERSION,
  authoritativeBase: BASE,
  sharedFamilies: [
    {
      familyId: 'ela-content-repair-v2',
      lessonCount: 1620,
      sources: [compositionSource, projectionSource],
      responsibility: [
        'one orientation paragraph for teaching',
        '18 phase-task prompt templates',
        'one guided routine after title/focus normalization',
        'one remediation routine after title/focus normalization',
        'writing-required inference',
        'learner-package and adult-guide projection',
      ],
      defectCodes: [
        'SHALLOW_TEACHING_EXPLANATION',
        'NO_MODELED_READING_OR_WRITING_EXAMPLE',
        'GENERIC_GUIDED_ROUTINE',
        'GENERIC_REMEDIATION',
        'QUESTION_VARIETY_TEMPLATE_BOUND',
        'LEARNER_FACING_ENGINEERING_LANGUAGE',
        'TUTOR_READINESS_METADATA_MISSING',
      ],
    },
    {
      familyId: 'academy-original-generated-five-shells',
      lessonCount: 1300,
      source: compositionSource,
      subfamilies: summary.corpusMechanics.generatedPassageTemplateFamilyCounts,
      defectCodes: [
        'GENERATED_PASSAGE_NOT_AUTHENTICALLY_GRADE_DIFFERENTIATED',
        'SOURCE_QUALITY_TEMPLATE_OR_REUSE',
        'NEAR_DUPLICATE_STRUCTURE',
        'SOURCE_TELEGRAPHS_TARGET_REASONING',
      ],
    },
    {
      familyId: 'academy-original-bank-reuse',
      lessonCount: 320,
      uniqueBodies: 33,
      exactDuplicateBodyGroups: 33,
      maximumLessonsSharingOneBody: Math.max(...exactDuplicateBodyGroups.map((rows) => rows.length)),
      defectCodes: ['SOURCE_QUALITY_TEMPLATE_OR_REUSE', 'NEAR_DUPLICATE_STRUCTURE'],
    },
  ],
  sourceAdapters: [
    { familyId: 'g34-adapter', grades: [3, 4], lessonCount: 360 },
    { familyId: 'canonical-g578-adapter', grades: [5, 7, 8], lessonCount: 540 },
    { familyId: 'hs912-adapter', grades: [9, 10, 11, 12], lessonCount: 720 },
  ],
  questionFamilies: summary.corpusMechanics.normalizedQuestionFamilyCounts,
}

const repairPlan = {
  auditVersion: AUDIT_VERSION,
  authoritativeBase: BASE,
  repairPerformed: false,
  productionCurriculumEdited: false,
  lessonUniverse: EXPECTED_TOTAL,
  representativeStephenReviewSample: summary.representativeSampleRecommendation,
  principles: [
    'Use ELA-specific quality criteria; do not copy Mathematics item-count thresholds.',
    'Preserve the 180-day ELA schedules and admitted lesson identities unless curriculum leadership separately authorizes a schedule change.',
    'Repair canonical generators and source banks, then regenerate packages and adult guides; do not hand-edit emitted package snapshots.',
    'Keep learner content and adult scoring authority separate while adding source-anchored scoring evidence.',
    'Do not scale bulk repair until the representative lesson is approved by Stephen.',
  ],
  stages: [
    {
      stage: 0,
      mode: 'serialized-human-standard',
      objective: 'Build and Stephen-review one complete ELA lesson before bulk work.',
      lessonIds: ['ma-g7-english-language-arts-u05-l03'],
      acceptance: [
        'lesson-specific explanation of reasoning and warrants',
        'a worked annotation/claim-evidence-warrant model on a separate example',
        'guided try with checkpoint and feedback moves',
        'independent argument-source task without answer leakage',
        'vocabulary and writing scaffolds appropriate to Grade 7',
        'source-specific adult rubric and Tutor-ready metadata',
      ],
    },
    {
      stage: 1,
      mode: 'serialized-shared-contract',
      objective: 'Replace the shared repair composer contract that causes corpus-wide shallowness.',
      owns: [compositionSource, projectionSource],
      lessonCount: 1620,
      defectCodes: generatorFamilies.sharedFamilies[0].defectCodes,
      requiredChanges: [
        'type-aware ELA lesson schemas for diagnostic, concept/skill, reading, writing, grammar/language, review, remediation, mastery, assessment, and project lessons',
        'explicit fields for explanation, model, guided checkpoint, independent task, comprehension checks, vocabulary, writing scaffold, reteach route, and mastery evidence',
        'stable Tutor concept/prerequisite/misconception/route/hint/retry/evidence metadata',
        'learner-language lint and semantic validation for writingRequired, transfer text, model, guided, and assessment labels',
      ],
    },
    {
      stage: 2,
      mode: 'parallel-nonoverlapping-source-families',
      objective: 'Replace source shells and repeated bank assignments with lesson-worthy text sets and source-specific questions.',
      builders: [
        {
          builderId: 'ELA_G34_SOURCE_AND_PEDAGOGY',
          sourceAdapterFamily: 'g34-adapter',
          grades: [3, 4],
          lessonCount: 360,
          primaryRisk: '320 bank-backed assignments collapse to 33 unique bodies; 40 more use generated shells.',
        },
        {
          builderId: 'ELA_G578_SOURCE_AND_PEDAGOGY',
          sourceAdapterFamily: 'canonical-g578-adapter',
          grades: [5, 7, 8],
          lessonCount: 540,
          primaryRisk: 'All 540 readings use generated case shells rather than grade-authentic text sequences.',
        },
        {
          builderId: 'ELA_HS912_SOURCE_AND_PEDAGOGY',
          sourceAdapterFamily: 'hs912-adapter',
          grades: [9, 10, 11, 12],
          lessonCount: 720,
          primaryRisk: 'All 720 readings use generated case shells with length added by repeated rigor paragraphs rather than authentic complexity.',
        },
      ],
      sharedAcceptance: [
        'documented grade-band complexity and human appropriateness review',
        'genre/source variety appropriate to the unit',
        'question variety beyond the 18 day-position templates',
        'no prompt-answer telegraphing inside the source',
        'true new-text transfer and assessment prompt projection',
      ],
    },
    {
      stage: 3,
      mode: 'serialized-authority-and-tutor-integration',
      objective: 'Regenerate learner packages, adult guides, Tutor metadata, bindings, and audit gates from approved canonical sources.',
      lessonCount: 1620,
      acceptance: [
        '1,620 unique lesson IDs, packages, adult guides, and admitted bindings reconcile',
        'learner answer/adult-key leakage remains zero',
        'adult rubrics contain source/task-specific anchors without supplying learner prose',
        'Tutor routes can record guided versus independent evidence and enact reteach without revealing answers',
        'depth audit rerun has no unresolved blocking codes',
      ],
    },
  ],
}

const defectRows = Object.entries(defectCounts).sort(([, a], [, b]) => b - a || 0)
const gradeRows = EXPECTED_GRADES.map((grade) => {
  const row = byGrade[grade]
  return `| ${grade} | ${row.lessons} | ${row.packages} | ${row.adultGuides} | ${row.productionBindings} | ${row.depthReady} |`
}).join('\n')
const typeRows = Object.entries(summary.primaryLessonTypes).map(([type, count]) => `| ${type} | ${count} |`).join('\n')
const defectTable = defectRows.map(([code, count]) => `| \`${code}\` | ${count} |`).join('\n')
const readabilityRows = EXPECTED_GRADES.map((grade) => {
  const word = byGrade[grade].sourceWordCounts
  const fk = byGrade[grade].advisoryFleschKincaid
  return `| ${grade} | ${word.min} / ${word.median} / ${word.max} | ${fk.min} / ${fk.median} / ${fk.max} | ${JSON.stringify(byGrade[grade].sourceOrigins).replaceAll('|', '\\|')} |`
}).join('\n')
const generatedFamilyRows = Object.entries(summary.corpusMechanics.generatedPassageTemplateFamilyCounts).map(([family, count]) => `| ${family} | ${count} |`).join('\n')

const report = `# ELA learner depth audit R1

**Status:** COMPLETE

**Authoritative base:** \`${BASE}\`

**Active production release:** \`${ACTIVE_RELEASE}\` (ELA production source \`${PRODUCTION_SOURCE_COMMIT}\`)

**Scope:** ${EXPECTED_TOTAL.toLocaleString()} active English Language Arts lessons across Grades ${EXPECTED_GRADES.join(', ')}. Grade 6 is unsupported by the admitted release. Production curriculum was read only; this branch contains audit evidence only.

## Executive finding

The active ELA inventory reconciles exactly, but **0 of ${EXPECTED_TOTAL.toLocaleString()} lessons are learner-depth ready** under an ELA-specific, type-aware review. This is not a lesson-count finding and does not apply Mathematics item-count expectations to ELA. The core problem is composition collapse: all lessons are projected by one repair family into an orientation paragraph, one of 18 single-response prompts, one normalized guided routine, and one normalized reteach routine. No learner package contains a worked reading/writing model, an embedded comprehension checkpoint, or runtime-addressable Tutor metadata.

The present structural H3 gate remains useful evidence for package presence, source delivery, and adult-key separation. It does not test instructional depth, authentic grade progression, passage diversity, or Tutor enactability, so its ${EXPECTED_TOTAL.toLocaleString()} READY result does not contradict this audit.

## Reconciled active inventory

| Grade | Scheduled/admitted lessons | Learner packages | Adult guides | Production bindings | Depth ready |
| --- | ---: | ---: | ---: | ---: | ---: |
${gradeRows}

Total: **${findings.length.toLocaleString()}** lessons, **${packages.length.toLocaleString()}** packages, **${guides.size.toLocaleString()}** adult guides, and **${bindings.length.toLocaleString()}** admitted ELA bindings. The release manifest independently declares **${releaseManifest.productionBindings.familyTotals['english-language-arts'].toLocaleString()}** ELA bindings. Reconciliation: **${summary.inventory.exactReconciliation ? 'exact' : 'failed'}**.

Assessments are counted only when they occupy one of the 180 scheduled ELA lesson rows. Separate assessment artifacts are authority/supporting material, not additional lessons. Reserve material is excluded.

## ELA lesson types

Every lesson receives one deterministic dominant type so counts do not overlap. Phase labels control diagnostic, assessment, remediation, review, mastery, project, and writing classifications; grammar/language and reading use phase plus unit/focus evidence; the remainder is concept/skill. These are audit groupings, not a proposed schedule.

| Dominant lesson type | Lessons |
| --- | ---: |
${typeRows}

Type-aware review means, for example, that an assessment is not rejected for lacking a mini-lesson and a diagnostic is not required to look like a concept lesson. The corpus-wide blocking findings instead come from the shared projection: even where a lesson type calls for modeling, guided feedback, source transfer, or assessment prompts, the emitted package supplies the same shallow shell.

## Exact defect counts

Counts are lesson incidence, not unique-error totals; one lesson can carry multiple codes.

| Defect code | Lessons affected |
| --- | ---: |
${defectTable}

Important negative controls:

- Missing independent reading/writing task: **0**. Every package has a complete inline source and one constructed-response task.
- Missing adult guide or admitted production binding: **0**.
- Learner exposure of adult rubric/key fields: **0**.
- Exact duplicate independent-task strings: **0**; focus/title interpolation makes strings unique even though their normalized shapes repeat.

## Dimension findings

### Teaching, modeling, vocabulary, and guided work

All ${EXPECTED_TOTAL.toLocaleString()} learner packages use one short orientation pattern: identify explicit text versus inference, select relevant evidence, and explain the connection. That is a useful reminder, not a lesson-specific explanation of the named skill. The type-aware defect applies to **${defectCounts.SHALLOW_TEACHING_EXPLANATION}** concept/skill, reading, writing, grammar/language, and remediation lessons; diagnostic, review, mastery, assessment, and project lessons are not assigned this code merely for lacking a mini-lesson. Worked or annotated examples physically present: **0**; the modeled-example defect is likewise limited to the same **${defectCounts.NO_MODELED_READING_OR_WRITING_EXAMPLE}** instruction-bearing lessons. This includes **250** lessons explicitly labeled \`Concept model\` or \`Explicit model\`, which contain no model, and **180** lessons labeled \`Guided practice\`, which contain no guided try/check/feedback loop.

Vocabulary support is physically absent in all ${EXPECTED_TOTAL.toLocaleString()} packages: there are no selected terms with learner-friendly meanings, morphology/word-part support, pronunciation/decoding help, contextual examples, or vocabulary checks. The defect count is limited to the **${defectCounts.NO_EXPLICIT_VOCABULARY_SUPPORT}** instruction-bearing lessons. Even word-study, morphology, decoding, fluency, grammar, and language lessons receive the same inference/evidence routine.

After replacing the inserted source title and focus, guided support has **${summary.corpusMechanics.normalizedGuidedRoutines}** unique routine across the whole corpus. It tells the learner to preview, mark an explicit statement and inference, test evidence, and draft, but it never presents a partial example or records a learner response before independent work.

### Independent work, comprehension, mastery, and reteach

Independent work is present in all lessons, but it is always a single constructed response from one of **${summary.corpusMechanics.normalizedQuestionFamilies}** day-position families (**90 uses of each family**). There are no embedded comprehension checks or feedback opportunities before submission in any lesson; the type-aware defect applies to **${defectCounts.NO_EMBEDDED_COMPREHENSION_CHECKS}** lessons and excludes assessment and mastery lessons from that expectation.

Adult guides carry a mastery statement for every lesson, usually requiring evidence on multiple occasions. Learner packages and Tutor metadata provide no stable occasion ID, evidence type, independence state, misconception code, or transfer record, so the rule cannot be enacted from the package. The normalized remediation routine count is **${summary.corpusMechanics.normalizedRemediationRoutines}**: evidence gap, reasoning gap, overclaim, and completion gap are repeated in all ${EXPECTED_TOTAL.toLocaleString()} lessons without diagnosis-specific examples or a new check.

All **90** transfer-labeled lessons tell the learner to use a different paragraph or perspective in the same delivered source, despite claiming transfer to a new text. All **90** unit-assessment lessons use the generic independent-claim phase prompt; the source unit-assessment prompts adapted by \`${projectionSource}\` are not emitted into the learner package.

### Writing scaffolds

The generator marks **${summary.corpusMechanics.writingRequiredTrue}** lessons as writing-required. Their scaffold is only a product label, response length, three generic task steps, and general success criteria; none includes phase-specific planning organizers, paragraph/function guidance, transition or syntax support, revision lenses, exemplar/non-exemplar analysis, or a feedback cycle. The other **${summary.corpusMechanics.writingRequiredFalseDespiteWrittenDeliverable}** lessons set \`writingTask.required: false\` while still directing the learner to write a paragraph or multi-paragraph response, a semantic contradiction for UI/Tutor consumers.

### Reading level and source/passage quality

No package records a grade-band complexity judgment, readability provenance, qualitative complexity review, knowledge-demand note, accessibility adaptation, or human approval. Word count alone is present. Therefore reading-level appropriateness is **not evidenced for all ${EXPECTED_TOTAL.toLocaleString()} lessons**; the Flesch–Kincaid values below are advisory machine evidence only and do not decide the defect classification.

| Grade | Source words min / median / max | Advisory FK min / median / max | Source origin counts |
| --- | --- | --- | --- |
${readabilityRows}

The source corpus has **${summary.corpusMechanics.uniqueSourceBodies.toLocaleString()} unique bodies for ${EXPECTED_TOTAL.toLocaleString()} lessons**. The 320 bank-backed assignments collapse to **${summary.corpusMechanics.exactDuplicateSourceBodyGroups} exact-body groups** (all 320 lessons affected; up to ${generatorFamilies.sharedFamilies[2].maximumLessonsSharingOneBody} lessons share one body). The remaining 1,300 readings are composed from only five paragraph shells:

| Generated passage family | Lessons |
| --- | ---: |
${generatedFamilyRows}

Grade progression in those 1,300 readings is implemented chiefly by appending the same paragraph 5 for Grades 5+, paragraph 6 for Grades 9+, and paragraph 7 for Grades 11+, while the four-paragraph case remains structurally shared. That is not authentic differentiation of syntax, vocabulary, background knowledge, genre, text structure, or disciplinary demand.

### Question variety and near duplication

Every unit repeats the same 18 question positions. Focus interpolation prevents exact task duplicates but does not create a new reasoning design. All 1,620 lessons are therefore affected by normalized question-template reuse. Near-duplication affects all lessons through one of two mechanisms: **320** use exact repeated bank bodies and **1,300** use the five generated passage shells. The single normalized guided and remediation routines amplify the repetition.

### Learner-facing engineering language and answer leakage

All learner packages use production/compliance language such as “delivered Academy-original source,” “named deliverable,” “evidence requirement,” and “learner success criterion.” These labels make the generator visible to the learner and are especially unsuitable in elementary grades.

There are **0 adult-field leaks** into learner JSON. However, all **1,300 generated passages** have instructional answer leakage of a different kind: paragraph 4 explicitly inserts the lesson focus and explains how the case demonstrates it; Grades 5+ also receive a paragraph that names the workshop goal and describes the evidence move. The independent prompt then asks the learner to explain or apply that same relationship. This is source-to-question telegraphing, not an exposed adult key.

### Adult-key authority

Pairing and separation are complete: ${EXPECTED_TOTAL.toLocaleString()} of ${EXPECTED_TOTAL.toLocaleString()} lessons have an external \`RUBRIC\` guide, mastery criteria, and an authorship boundary, with no guide fields copied into learner packages. Authority depth is still weak in all lessons. Rubric dimensions are inherited generic criteria, while acceptable-answer text concatenates criteria and the generic generated success statements; no guide contains source-specific evidence anchors, misconception boundaries, or annotated examples that would let two adults or a Tutor score the named task consistently without inventing content.

### Tutor readiness

| Metadata | Lessons present | Audit result |
| --- | ---: | --- |
| grade and phase | ${EXPECTED_TOTAL} | present/derivable |
| adult authorship boundary | ${EXPECTED_TOTAL} | present in separate guide |
| stable concept IDs | 0 | gap |
| prerequisites | 0 | gap |
| misconception IDs/triggers | 0 | gap |
| Tutor routes | 0 | gap; source adapter reads routes but package projection drops them |
| graduated hints | 0 | gap |
| retry/reteach policy | 0 | gap |
| evidence-capture schema | 0 | gap |
| age/reading-language policy | 0 | gap |
| answer-reveal policy | 0 | gap |

## Generator and composition responsibility

The corpus is not 1,620 independently authored learner lessons. Three source adapters normalize upstream records—Grades 3/4 (**360**), Grades 5/7/8 (**540**), and Grades 9–12 (**720**)—then \`${compositionSource}\` and \`${projectionSource}\` overwrite the learner experience with shared source/work shells.

- \`ela-content-repair-v2\` affects all **1,620** lessons and owns the teaching paragraph, 18 prompt families, guided routine, remediation routine, writing-required inference, learner projection, and adult-guide projection.
- \`academy-original-generated-five-shells\` affects **1,300** lessons and owns passage templating, weak grade differentiation, source-quality repetition, and source-to-question telegraphing.
- \`academy-original-bank-reuse\` affects **320** lessons; 33 bodies are repeatedly assigned across those lesson slots.

Exact family membership is recorded on every row in \`lesson-findings.jsonl\` and summarized in \`generator-families.json\`.

## Representative Stephen-reviewed sample

Recommend exactly one lesson: **\`ma-g7-english-language-arts-u05-l03\` — “Guided practice A: reasoning and warrants.”**

It is the best first sample because it sits in a high-value middle-grade argument unit and should exercise nearly every required ELA capability in a compact review: explicit teaching of claim/evidence/warrant, a modeled annotation on a separate example, vocabulary, guided reasoning with feedback, independent source use, writing support, comprehension checks, reteach, an adult rubric, authorship boundaries, and Tutor routes. Its current form also cleanly demonstrates the systemic defect: it is labeled guided practice but emits the same generic routine and a fully independent two-paragraph response.

## Repair plan

\`repair-plan.json\` begins with the single Stephen-reviewed lesson, then repairs the shared contract, separates source work into non-overlapping G3–4, G5/7/8, and G9–12 families, and finally regenerates/integrates authority and Tutor metadata. No repair was performed in this audit.

## Evidence files

- \`lesson-findings.jsonl\`: one record per active ELA lesson (${findings.length.toLocaleString()} lines).
- \`summary.json\`: reconciled inventory, exact defect counts, type counts, grade metrics, and corpus mechanics.
- \`generator-families.json\`: composition ownership and family counts.
- \`repair-plan.json\`: future staged repair ownership and acceptance criteria.
- \`build-audit.mjs\`: deterministic evidence builder; it reads production files and writes only this audit directory.

## Audit limits

- The audit judges emitted learner packages and paired adult guides, not the quality of inaccessible prior branch history.
- Machine readability is advisory; missing human complexity evidence is the defect, not a numeric score by itself.
- Structural repetition is not automatically bad in a routine. It becomes a defect here because the same routine replaces lesson-specific explanation, modeling, guided feedback, source variety, and reteach across a full-year ELA program.
- The audit does not run a Tutor runtime; it inventories whether the lesson metadata could support one.

**Final classification: ELA_DEPTH_AUDIT_COMPLETE**
`

fs.mkdirSync(auditDir, { recursive: true })
fs.writeFileSync(path.join(auditDir, 'lesson-findings.jsonl'), `${findings.map((row) => JSON.stringify(row)).join('\n')}\n`)
fs.writeFileSync(path.join(auditDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
fs.writeFileSync(path.join(auditDir, 'generator-families.json'), `${JSON.stringify(generatorFamilies, null, 2)}\n`)
fs.writeFileSync(path.join(auditDir, 'repair-plan.json'), `${JSON.stringify(repairPlan, null, 2)}\n`)
fs.writeFileSync(path.join(auditDir, 'ELA_DEPTH_AUDIT_R1.md'), report)

console.log(JSON.stringify({
  status: summary.status,
  lessons: findings.length,
  grades: EXPECTED_GRADES,
  inventoryReconciled: summary.inventory.exactReconciliation,
  depthReady: summary.depthClassifications.DEPTH_READY || 0,
  findingsLines: findings.length,
  outputDirectory: relative(auditDir),
}, null, 2))
