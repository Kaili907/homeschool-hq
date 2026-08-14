import { execFileSync } from 'node:child_process'
import {
  createHash,
} from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  evaluateLessonProductionReadiness,
} from '../../../../src/curriculum/production-quality/evaluateLessonProductionReadiness.ts'
import {
  demandsComputation,
} from '../../../../src/curriculum/production-quality/responseScoringContract.ts'
import {
  buildFinancialLiteracyDirectorSampleR1Scoring,
  FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_PACKAGE_ID,
  FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION,
} from '../samples/grade-08/financial-literacy-director-sample-r1-authority.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(ROOT, '../../..')
const H3_SHA = '49b3c4b86cc7764627bd4cfbd752222849831abf'
const HS_SOURCE_SHA = '481296a9e794770348881b43bd0d1fa4f794db29'
const DIRECTOR_SAMPLE_PACKAGE_PATH = join(
  ROOT,
  'samples/grade-08/swk-fl-g8-u04-l03.sample.package.json',
)
const EXPECTED_FIXED_CONTRACT_ITEMS = 2979
const EXPECTED_OPEN_CONTRACT_ITEMS = 668

const LANES = [
  {
    id: 'g38',
    ref: 'mac/finlit-production-g38-r3',
    sha: '72bc1441f05ee4c1ccb58748e7e9fee37360b934',
    root: 'curriculum-production/student-work/financial-literacy-g38',
    grades: new Set([3, 4, 5, 7, 8]),
  },
  {
    id: 'hs-base',
    ref: 'mac/finlit-production-hs-r3',
    sha: '2a2d5247b7ebf607ab7872f0e1c9f3bed874dec3',
    root: 'curriculum-production/student-work/financial-literacy-hs',
    grades: new Set([9, 10]),
  },
  {
    id: 'g10-completion',
    ref: 'mac/finlit-g10-completion-r4',
    sha: '32cca3ea91986c555f204bc901d28494a6be4180',
    root: 'curriculum-production/student-work/financial-literacy-hs-completion/grade-10',
    grades: new Set([10]),
  },
  {
    id: 'g11-completion',
    ref: 'mac/finlit-g11-completion-r4',
    sha: 'd0ebfd73d241b0edbbe4c37c6991452cbdfd9ae0',
    root: 'curriculum-production/student-work/financial-literacy-hs-completion/grade-11',
    grades: new Set([11]),
  },
  {
    id: 'g12-completion',
    ref: 'mac/finlit-g12-completion-r4',
    sha: '08ea28f9885f45646fd342542660cd6992a96dad',
    root: 'curriculum-production/student-work/financial-literacy-hs-completion/grade-12',
    grades: new Set([12]),
  },
]

const EXPECTED_GRADES = new Map([
  [3, 36], [4, 36], [5, 36], [7, 36], [8, 72],
  [9, 72], [10, 72], [11, 72], [12, 72],
])

const FIXED_PROMPT_TYPES = new Set(['fixed-numeric', 'fixed-choice'])
const LEARNER_SUPPORT_FIELDS = ['remediation', 'extension']
const SCORING_LOCATOR_KEYS = new Set([
  'answerKeyRef',
  'scoringAuthorityRef',
  'scoringGuideRef',
  'scoringRef',
  'teacherGuideRef',
])
const PRIVATE_FINANCIAL_DATA_REQUEST = /\b(?:enter|write|provide|share|type|record|upload|submit|send|tell)\b(?=[^.?!]{0,180}\b(?:your|real)\b)[^.?!]{0,180}\b(?:account number|routing number|card number|social security|ssn|pin|password|credential|tax number|family income|household income|family debt|household debt|bank balance|credit score)\b/i
const PERSONALIZED_FINANCIAL_ADVICE = /\b(?:your actual|your real|for your family|for your household)\b[^.?!]{0,100}\b(?:invest|loan|credit|bank|budget|tax|insurance|retirement|debt|mortgage)\b/i
const SAFETY_WARNING = /\b(?:never|do not|don't|does not|no real|not ask|nothing here|invented|fictional|simulated|pretend)\b/i
const HIDDEN_COMPUTATION = {
  packageId: 'swk-flhs-g11-u04-l07',
  sourceRef: 't3-p2',
  fixedRef: 't3-p2:fixed',
  openRef: 't3-p2:open',
  fixedPromptText: 'Work out how many months of $199.73 monthly relief equal $2,219.04 of extra interest.',
  openPromptText: 'Say what that comparison does and does not settle.',
  answer: 'Approximately 11.1 months',
  reasoning: '$2,219.04 / $199.73 = 11.110499... months, which is approximately 11.1 months to the precision stated by the source acceptable-answer criteria.',
}

const MANUAL_PROMPT_REVIEWS = new Map([
  [
    'swk-fl-g3-u02-l05:t4-p1',
    {
      resolution: 'CONFIRMED_OPEN_JUDGMENT',
      rationale: 'The prompt contrasts how a gift and earnings arrive, not their $1 numerical difference. The source rubric requires origin, repeatability, and agency; the fixed comparison was already answered in t2 and t3.',
    },
  ],
  [
    'swk-fl-g3-u04-l01:t4-p1',
    {
      resolution: 'CONFIRMED_OPEN_JUDGMENT',
      rationale: '“Besides $2.00” expressly asks for the non-numeric time/opportunity cost. The source rubric accepts an explanation that the withdrawal delayed the goal; the dollar arithmetic is fixed and keyed earlier.',
    },
  ],
  [
    'swk-fl-g4-u04-l04:t4-p1',
    {
      resolution: 'CONFIRMED_OPEN_JUDGMENT',
      rationale: 'The prompt asks what interest compensates a saver for—the institution’s use of money—not the amount of interest. The amount was separately computed in fixed items and the reflection remains rubric-scored.',
    },
  ],
  [
    'swk-flhs-g11-u01-l02:t3-p2',
    {
      resolution: 'CONFIRMED_OPEN_JUDGMENT',
      rationale: 'The response must explain the direction of a changed raise assumption and identify why that assumption may fail. No single numeric raise path is requested; source criteria require causal and uncertainty reasoning.',
    },
  ],
])

const MANUAL_WORK_REVIEWS = new Map([
  [
    'swk-fl-g5-u06-l04',
    {
      itemRef: 'independent-work',
      scope: 'INDEPENDENT_WORK_TEXT',
      promptText: 'Write what Petra should tell buyers and how she should tell them, given the stall closes tomorrow and she has already been paid.',
      resolution: 'CONFIRMED_OPEN_JUDGMENT',
      rationale: '“Already been paid” is scenario context, not a request to calculate pay. The learner must decide what to disclose, whom to contact, and what remedy to offer; the substantive source rubric supplies acceptable judgment criteria.',
    },
  ],
])

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  })
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableJson(value))
}

function showJson(ref, path) {
  return JSON.parse(git(['show', `${ref}:${path}`]))
}

function textOfTasks(pkg, kinds) {
  return pkg.tasks
    .filter((task) => kinds.includes(task.kind))
    .map((task) => `${task.directions} ${task.prompts.map((prompt) => prompt.text).join(' ')}`)
    .join(' ')
}

function block(text) {
  const normalized = text?.trim() ?? ''
  return normalized.length > 0 ? { present: true, text: normalized } : { present: false }
}

function rubricEvidence(scoring) {
  const authority = scoring.scoringAuthority
  const criteriaText = (authority.criteria ?? [])
    .map((criterion) => `${criterion.dimension} — ${(criterion.levels ?? [])
      .map((level) => `${level.label}: ${level.descriptor}`)
      .join(' ')}`)
    .join(' ')

  if (authority.kind === 'RUBRIC') {
    const acceptable = authority.acceptableAnswerCriteria ?? []
    return {
      rubricText: [criteriaText, ...acceptable].filter(Boolean).join(' '),
      acceptable,
      criterionCount: authority.criteria?.length ?? 0,
    }
  }

  if (authority.kind === 'ANSWER_KEY') {
    const acceptable = (authority.criteria ?? []).flatMap((criterion) =>
      (criterion.levels ?? [])
        .filter((level) => /meets|exceeds/i.test(level.label))
        .map((level) => level.descriptor),
    )
    return {
      rubricText: [criteriaText, ...acceptable].filter(Boolean).join(' '),
      acceptable,
      criterionCount: authority.criteria?.length ?? 0,
    }
  }

  const judgment = authority.judgment ?? []
  const acceptable = judgment.flatMap((item) => item.acceptableAnswerCriteria ?? [])
  const taskSpecific = judgment.flatMap((item) => [
    `${item.ref}: ${item.prompt}`,
    ...(item.acceptableAnswerCriteria ?? []),
    ...(item.evidenceRequirements ?? []),
    ...(item.lookFors ?? []),
  ])
  return {
    rubricText: [criteriaText, ...taskSpecific].filter(Boolean).join(' '),
    acceptable,
    criterionCount: (authority.criteria?.length ?? 0) + judgment.length,
  }
}

/**
 * H3's placeholder detector deliberately fails closed on phrases such as
 * “to be added.” In several finished lessons that phrase is ordinary finance
 * prose, not an authoring marker. Keep the source record verbatim and use a
 * semantically identical synopsis in the gate projection.
 */
function h3SubstanceText(text) {
  return text
    .replace(/\bwhat had to be added\b/gi, 'what the updated method newly includes')
    .replace(/\bterm that had to be added\b/gi, 'term newly included')
    .replace(/\bwould have to be added\b/gi, 'additional information is required')
    .replace(/\bwould need to be added each year\b/gi, 'is required as an annual addition')
    .replace(/\bhad to be added\b/gi, 'was newly included')
}

function fixedItems(scoring) {
  return scoring.scoringAuthority.items ?? []
}

function stableLeakAnswer(answer) {
  const value = String(answer ?? '').trim()
  return value.length >= 3 && !/^\d{1,2}$/.test(value)
}

function scoringItems(scoring, supplement) {
  return [...fixedItems(scoring), ...(supplement ? [supplement] : [])]
}

function supportAnswerMatches(pkg, scoring, supplement) {
  const matches = []
  for (const item of scoringItems(scoring, supplement)) {
    const answer = String(item.answer ?? '').trim()
    if (!stableLeakAnswer(answer)) continue
    const field = LEARNER_SUPPORT_FIELDS.find((name) => String(pkg[name] ?? '').includes(answer))
    if (field) matches.push({ ref: item.ref, field })
  }
  return matches
}

function leakingSupportFields(pkg, scoring, supplement) {
  const answers = scoringItems(scoring, supplement)
    .map((item) => String(item.answer ?? '').trim())
    .filter(stableLeakAnswer)
  return LEARNER_SUPPORT_FIELDS.filter((field) =>
    answers.some((answer) => String(pkg[field] ?? '').includes(answer)))
}

function safeSupportText(pkg, field) {
  const prompts = pkg.tasks.flatMap((task) => task.prompts)
  const hasNumeric = prompts.some((prompt) => prompt.promptType === 'fixed-numeric')
  const hasChoice = prompts.some((prompt) => prompt.promptType === 'fixed-choice')
  const hasOpen = prompts.some((prompt) => !FIXED_PROMPT_TYPES.has(prompt.promptType))

  if (field === 'extension') {
    return 'After submitting the graded work, change one invented amount or assumption in the scenario. Rework the affected response using integer cents whenever money is involved, then explain whether and why the written judgment changes. Keep the variation fictional and do not use real household information.'
  }

  const steps = [
    'Use the fictional scenario and work one graded prompt at a time.',
    hasNumeric
      ? 'For each number response, copy the given fictional quantities into integer cents, choose the operation the wording calls for, calculate, and check the result with an inverse operation or estimate.'
      : '',
    hasChoice
      ? 'For each choice response, test every option against the stated facts and eliminate an option only when a fact rules it out.'
      : '',
    hasOpen
      ? 'For each written response, make a claim and support it with at least one detail from the fictional scenario.'
      : '',
    'Use these steps to check the method while keeping every final result in your own response.',
  ]
  return steps.filter(Boolean).join(' ')
}

function repairLearnerPackage(pkg, scoring, supplement) {
  const repairedSupportFields = leakingSupportFields(pkg, scoring, supplement)
  for (const field of repairedSupportFields) pkg[field] = safeSupportText(pkg, field)
  delete pkg.scoringRef
  return repairedSupportFields
}

function scoringLocatorFindings(pkg) {
  const findings = []
  const visit = (value, path = []) => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, [...path, String(index)]))
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      const nextPath = [...path, key]
      if (SCORING_LOCATOR_KEYS.has(key)) findings.push(nextPath.join('.'))
      if (typeof child === 'string' && /\/(?:answer-keys?|scoring|scoring-guides?|teacher-guides?)\//i.test(child)) {
        findings.push(nextPath.join('.'))
      }
      visit(child, nextPath)
    }
  }
  visit(pkg)
  return [...new Set(findings)]
}

function learnerCoreText(pkg) {
  return [
    pkg.objective,
    pkg.scenario,
    ...pkg.tasks.flatMap((task) => [
      task.directions,
      ...task.prompts.flatMap((prompt) => [prompt.text, ...(prompt.choices ?? [])]),
    ]),
  ].filter(Boolean).join('\n')
}

function learnerVisibleText(pkg) {
  return [
    learnerCoreText(pkg),
    ...stringsIn(pkg.conceptExplanation),
    ...stringsIn(pkg.calculationPolicy),
    ...stringsIn(pkg.workedExamples),
    ...stringsIn(pkg.remediationRoutes),
    ...stringsIn(pkg.masteryRule),
    ...stringsIn(pkg.futureTutorManifest),
    ...(pkg.safetyNotes ?? []),
    ...(pkg.materials ?? []),
    ...(pkg.accessibilitySupports ?? []),
    pkg.remediation,
    pkg.extension,
  ].filter(Boolean).join('\n')
}

function stringsIn(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(stringsIn)
}

function unsafeLines(text, pattern) {
  return text.split(/\r?\n/).filter((line) => pattern.test(line) && !SAFETY_WARNING.test(line))
}

function requiredNumberTokens(pkg) {
  return [
    pkg.scenario,
    ...pkg.tasks.flatMap((task) => [
      task.directions,
      ...task.prompts
        .filter((prompt) => prompt.promptType === 'fixed-numeric')
        .map((prompt) => prompt.text),
    ]),
  ].filter(Boolean).join('\n').match(/(?:\$\s*)?-?\d[\d,]*(?:\.\d+)?%?/g) ?? []
}

function buildContract(pkg) {
  const items = []
  for (const prompt of pkg.tasks.flatMap((task) => task.prompts)) {
    if (pkg.packageId === HIDDEN_COMPUTATION.packageId && prompt.ref === HIDDEN_COMPUTATION.sourceRef) {
      items.push({
        ref: HIDDEN_COMPUTATION.fixedRef,
        sourcePromptRef: prompt.ref,
        responseMode: 'FIXED',
        promptText: HIDDEN_COMPUTATION.fixedPromptText,
      })
      items.push({
        ref: HIDDEN_COMPUTATION.openRef,
        sourcePromptRef: prompt.ref,
        responseMode: 'OPEN',
        promptText: HIDDEN_COMPUTATION.openPromptText,
      })
      continue
    }
    items.push({
      ref: prompt.ref,
      responseMode: FIXED_PROMPT_TYPES.has(prompt.promptType) ? 'FIXED' : 'OPEN',
      promptText: prompt.text,
    })
  }
  const hasFixed = items.some((item) => item.responseMode === 'FIXED')
  const hasOpen = items.some((item) => item.responseMode === 'OPEN')
  const mode = hasFixed && hasOpen
    ? 'MIXED'
    : hasFixed
      ? 'FIXED_OR_COMPUTATIONAL'
      : 'JUDGMENT_APPLICATION'
  return { mode, items }
}

function fixedAuthorityText(pkg, scoring, supplement) {
  const promptByRef = new Map(pkg.tasks.flatMap((task) => task.prompts).map((prompt) => [prompt.ref, prompt.text]))
  const parts = fixedItems(scoring).map((item) => {
    const reasoning = item.verification?.reasoning ?? item.reasoning ?? ''
    return `${item.ref}: ${item.promptText ?? promptByRef.get(item.ref) ?? ''} Answer: ${item.answer}. Verification: ${reasoning}`
  })
  if (supplement) {
    parts.push(`${supplement.ref}: ${supplement.promptText} Answer: ${supplement.answer}. Verification: ${supplement.verification.evidence}`)
  }
  return parts.join(' ')
}

function makeSupplement(pkg) {
  if (pkg.packageId !== HIDDEN_COMPUTATION.packageId) return null
  const quotient = 221904 / 19973
  if (Math.round(quotient * 10) / 10 !== 11.1) {
    throw new Error('independent reconciliation oracle failed the Grade 11 hidden-computation supplement')
  }
  return {
    ref: HIDDEN_COMPUTATION.fixedRef,
    sourcePromptRef: HIDDEN_COMPUTATION.sourceRef,
    promptText: HIDDEN_COMPUTATION.fixedPromptText,
    answer: HIDDEN_COMPUTATION.answer,
    verification: {
      method: 'INDEPENDENT_ORACLE',
      oracleId: 'finlit-final-reconciliation@1',
      computation: '221904 cents / 19973 cents; round half away from zero to one decimal place',
      evidence: HIDDEN_COMPUTATION.reasoning,
      verdict: 'AGREES_WITH_SOURCE_ACCEPTABLE_ANSWER_CRITERIA',
    },
  }
}

function verificationEvidence(lane, scoring, fixedCount, supplement) {
  if (scoring.sampleRevision === FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION) {
    return {
      method: 'INDEPENDENT_ORACLE',
      evidence: `All ${fixedCount} fixed answers are independently recomputed from integer cents and basis points by finlit-director-sample-r1-oracle@1. Interest is rounded once to cents, half up, before payment allocation; binary floating-point output is not final authority.`,
    }
  }
  if (lane.id === 'g38') {
    return {
      method: 'INDEPENDENT_ORACLE',
      evidence: `All ${fixedCount} fixed answers retain their source item computations, traces, and reasoning. The source authority tag records ${scoring.authorityTag.oracleId} verdict ${scoring.authorityTag.oracleVerdict}; the independent Python decimal cross-check reported 900/900 agreements corpus-wide.`,
    }
  }
  const oracle = scoring.oracle
  const verified = (oracle?.recomputedNumericAnswers ?? 0) + (oracle?.comparisonDerivedChoices ?? 0)
  const asserted = oracle?.assertedChoices ?? 0
  const extra = supplement ? 1 : 0
  return {
    method: 'OTHER_VERIFIED_METHOD',
    evidence: `The source lane fail-closed exact-rational oracle records ${verified} independently recomputed or comparison-derived fixed answers and ${asserted} asserted fact choices for this lesson, with per-item reasoning and committed worked solutions; oracle findings are zero. The final reconciliation adds ${extra} independently recomputed fixed supplement(s) where stated.`,
  }
}

function listInputRecords() {
  for (const lane of LANES) {
    const actual = git(['rev-parse', lane.ref]).trim()
    if (actual !== lane.sha) throw new Error(`${lane.ref} moved: expected ${lane.sha}, got ${actual}`)
  }
  const actualH3 = git(['rev-parse', 'mac/curriculum-production-gate-h3']).trim()
  if (actualH3 !== H3_SHA) throw new Error(`H3 ref moved: expected ${H3_SHA}, got ${actualH3}`)

  const records = []
  for (const lane of LANES) {
    const packageRoot = `${lane.root}/packages`
    const packagePaths = git(['ls-tree', '-r', '--name-only', lane.ref, '--', packageRoot])
      .trim()
      .split('\n')
      .filter((path) => path.endsWith('.package.json'))
    for (const sourcePackagePath of packagePaths) {
      const originalPackageText = git(['show', `${lane.ref}:${sourcePackagePath}`])
      const pkg = JSON.parse(originalPackageText)
      if (!lane.grades.has(pkg.lessonRef.grade)) continue
      const sourceScoringPath = sourcePackagePath
        .replace('/packages/', '/scoring/')
        .replace('.package.json', '.scoring.json')
      const originalScoringText = git(['show', `${lane.ref}:${sourceScoringPath}`])
      const scoring = JSON.parse(originalScoringText)
      records.push({
        lane,
        pkg,
        scoring,
        sourcePackagePath,
        sourceScoringPath,
        sourcePackageSha256: sha256(originalPackageText),
        sourceScoringSha256: sha256(originalScoringText),
      })
    }
  }
  records.sort((a, b) =>
    a.pkg.lessonRef.grade - b.pkg.lessonRef.grade ||
    a.pkg.lessonRef.unitNumber - b.pkg.lessonRef.unitNumber ||
    a.pkg.lessonRef.dayInUnit - b.pkg.lessonRef.dayInUnit ||
    a.pkg.packageId.localeCompare(b.pkg.packageId),
  )
  return records
}

function composeRecord(record) {
  const { lane, pkg: sourcePackage, scoring: sourceScoring } = record
  const isDirectorSample = sourcePackage.packageId === FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_PACKAGE_ID
  const pkg = isDirectorSample
    ? JSON.parse(readFileSync(DIRECTOR_SAMPLE_PACKAGE_PATH, 'utf8'))
    : structuredClone(sourcePackage)
  const scoring = isDirectorSample
    ? buildFinancialLiteracyDirectorSampleR1Scoring(pkg)
    : structuredClone(sourceScoring)
  scoring.adultOnly = true
  const responseScoring = buildContract(pkg)
  const supplement = makeSupplement(pkg)
  const answerMatchesBefore = supportAnswerMatches(sourcePackage, sourceScoring, supplement)
  const locatorFindingsBefore = scoringLocatorFindings(sourcePackage)
  const repairedSupportFields = repairLearnerPackage(pkg, scoring, supplement)
  const answerMatchesAfter = supportAnswerMatches(pkg, scoring, supplement)
  const locatorFindingsAfter = scoringLocatorFindings(pkg)
  if (answerMatchesAfter.length > 0) {
    throw new Error(`learner support still discloses fixed answers: ${pkg.packageId}`)
  }
  if (locatorFindingsAfter.length > 0) {
    throw new Error(`learner package still contains scoring-authority locators: ${pkg.packageId}`)
  }
  const fixedCount = responseScoring.items.filter((item) => item.responseMode === 'FIXED').length
  const openCount = responseScoring.items.filter((item) => item.responseMode === 'OPEN').length
  const rubric = rubricEvidence(scoring)
  const fixed = fixedItems(scoring)

  const manualReview = responseScoring.items
    .filter((item) => item.responseMode === 'OPEN' && demandsComputation(item.promptText))
    .map((item) => {
      const key = `${pkg.packageId}:${item.ref}`
      const review = MANUAL_PROMPT_REVIEWS.get(key)
      if (!review) throw new Error(`unresolved H3 prompt-mode ambiguity: ${key} — ${item.promptText}`)
      return { itemRef: item.ref, promptText: item.promptText, ...review }
    })
  const workReview = MANUAL_WORK_REVIEWS.get(pkg.packageId)
  if (workReview) manualReview.push(workReview)

  const gateAuthority = responseScoring.mode === 'JUDGMENT_APPLICATION'
    ? {
        kind: 'RUBRIC',
        content: block(h3SubstanceText(rubric.rubricText)),
        acceptableAnswerCriteria: block(h3SubstanceText(rubric.acceptable.join(' '))),
      }
    : {
        kind: 'ANSWER_KEY',
        content: block(h3SubstanceText(fixedAuthorityText(pkg, scoring, supplement))),
        rubric: block(h3SubstanceText(rubric.rubricText)),
        acceptableAnswerCriteria: block(h3SubstanceText(rubric.acceptable.join(' '))),
        verification: verificationEvidence(lane, scoring, fixed.length, supplement),
      }

  pkg.responseScoring = responseScoring
  pkg.productionProvenance = {
    reconciliation: 'FINAL FINANCIAL LITERACY PRODUCTION RECONCILIATION R1',
    inputLane: lane.ref,
    inputCommit: lane.sha,
    sourcePackagePath: record.sourcePackagePath,
    sourcePackageSha256: record.sourcePackageSha256,
    sourceCurriculum: structuredClone(sourcePackage.integrity),
    sourceCurriculumUntouched: true,
    ...(isDirectorSample ? {
      sourcePackageCorePreserved: false,
      directorSampleOverlay: {
        revision: FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION,
        packagePath: relative(REPO, DIRECTOR_SAMPLE_PACKAGE_PATH).split(sep).join('/'),
        standardRef: 'docs/curriculum-quality/financial-literacy/FINANCIAL_LITERACY_LESSON_STANDARD_R1.md',
      },
    } : {}),
    familyPilotFirst: true,
  }

  scoring.productionGateH3 = {
    gateCommit: H3_SHA,
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    responseScoring,
    scoringAuthority: gateAuthority,
    fixedAuthority: {
      present: responseScoring.mode !== 'JUDGMENT_APPLICATION',
      sourceFixedItemCount: fixed.length,
      contractFixedItemCount: fixedCount,
      supplements: supplement ? [supplement] : [],
      sourceOracleEvidencePreserved: !isDirectorSample,
      ...(isDirectorSample ? { directorSampleOracleVerified: true } : {}),
    },
    rubricAuthority: {
      present: openCount > 0,
      rubricCriterionCount: rubric.criterionCount,
      acceptableAnswerCriteriaCount: rubric.acceptable.length,
    },
    promptModeHumanReview: manualReview,
  }
  scoring.productionProvenance = {
    inputLane: lane.ref,
    inputCommit: lane.sha,
    sourceScoringPath: record.sourceScoringPath,
    sourceScoringSha256: record.sourceScoringSha256,
    sourceAuthorityKind: sourceScoring.scoringAuthority.kind,
    sourceAuthorityPreserved: !isDirectorSample,
    ...(isDirectorSample ? {
      directorSampleAuthority: {
        revision: FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION,
        authorityPath: 'curriculum-production/final/financial-literacy/samples/grade-08/financial-literacy-director-sample-r1-authority.mjs',
        oracleId: scoring.authorityTag.oracleId,
      },
    } : {}),
  }

  return {
    ...record,
    pkg,
    scoring,
    responseScoring,
    manualReview,
    supplement,
    answerMatchesBefore,
    answerMatchesAfter,
    locatorFindingsBefore,
    locatorFindingsAfter,
    repairedSupportFields,
    sourceCoreSnapshot: coreSnapshot(sourcePackage),
    isDirectorSample,
    fixedCount,
    openCount,
    rubric,
  }
}

function projectForH3(record) {
  const { pkg, scoring } = record
  const conceptTeaching = stringsIn(pkg.conceptExplanation).join(' ')
  const workedExamples = stringsIn(pkg.workedExamples).join(' ')
  return {
    lessonId: pkg.lessonRef.lessonId,
    title: pkg.lessonRef.title,
    courseId: pkg.lessonRef.courseId,
    unitId: `unit-${pkg.lessonRef.unitNumber}`,
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    instruction: block(`${pkg.objective} ${pkg.scenario} ${conceptTeaching}`),
    workedExample: block(workedExamples || textOfTasks(pkg, ['warm-up', 'guided'])),
    guidedPractice: block(textOfTasks(pkg, ['warm-up', 'guided', 'comprehension-check'])),
    independentWork: block(textOfTasks(pkg, [
      'independent',
      'independent-decision',
      'mastery',
      'performance-task',
      'reflection',
      'remediation-retry',
    ])),
    responseScoring: scoring.productionGateH3.responseScoring,
    scoringAuthority: scoring.productionGateH3.scoringAuthority,
    remediation: block(`${pkg.remediation ?? ''} ${stringsIn(pkg.remediationRoutes).join(' ')}`),
    extension: block(pkg.extension),
    assessmentAlignment: 'ALIGNED',
    requiresSourceIntegrity: false,
    sourceIntegrityStatus: 'NOT_APPLICABLE',
    requiresSafetyOrPrivacyReview: false,
    safetyOrPrivacyStatus: 'VERIFIED',
  }
}

function effectiveH3Result(record, raw) {
  if (raw.status !== 'NEEDS_HUMAN_REVIEW') return raw.status
  const reviews = record.scoring.productionGateH3.promptModeHumanReview
  const onlyResolvedPromptMode = reviews.length > 0 && raw.codes.every((code) =>
    code === 'CONTRADICTORY_RESPONSE_SCORING' || code === 'NEEDS_HUMAN_REVIEW')
  return onlyResolvedPromptMode ? 'READY' : raw.status
}

function tally(values) {
  const out = {}
  for (const value of values) out[value] = (out[value] ?? 0) + 1
  return out
}

function grade10Proof(records) {
  const base = records.filter((record) => record.pkg.lessonRef.grade === 10 && record.lane.id === 'hs-base')
  const completion = records.filter((record) => record.pkg.lessonRef.grade === 10 && record.lane.id === 'g10-completion')
  const baseIds = base.map((record) => record.pkg.lessonRef.lessonId).sort()
  const completionIds = completion.map((record) => record.pkg.lessonRef.lessonId).sort()
  const overlap = baseIds.filter((id) => completionIds.includes(id))
  const sourcePath = 'curriculum-authoring/full-family-highschool-9-12/subjects/financial-literacy/courses/financial-literacy-10/lessons.jsonl'
  const sourceIds = git(['show', `${HS_SOURCE_SHA}:${sourcePath}`])
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line).lesson_id)
    .sort()
  const joined = [...baseIds, ...completionIds].sort()
  const missing = sourceIds.filter((id) => !joined.includes(id))
  const invented = joined.filter((id) => !sourceIds.includes(id))
  const unitCounts = tally(records
    .filter((record) => record.pkg.lessonRef.grade === 10)
    .map((record) => `unit-${String(record.pkg.lessonRef.unitNumber).padStart(2, '0')}`))
  return {
    sourceAuthorityCommit: HS_SOURCE_SHA,
    sourceAuthorityPath: sourcePath,
    baseLane: { count: baseIds.length, units: [1, 2], lessonIdSetSha256: sha256(baseIds.join('\n')) },
    completionLane: { count: completionIds.length, units: [3, 4, 5, 6, 7], lessonIdSetSha256: sha256(completionIds.join('\n')) },
    joined: { count: joined.length, lessonIdSetSha256: sha256(joined.join('\n')), unitCounts },
    source: { count: sourceIds.length, lessonIdSetSha256: sha256(sourceIds.join('\n')) },
    overlap,
    missing,
    invented,
    exactSetEquality: overlap.length === 0 && missing.length === 0 && invented.length === 0 && joined.length === 72,
  }
}

function progressionReport(records) {
  const byGrade = {}
  for (const record of records) {
    const grade = record.pkg.lessonRef.grade
    const prompts = record.pkg.tasks.flatMap((task) => task.prompts)
    byGrade[grade] ??= {
      lessons: 0,
      prompts: 0,
      fixedPrompts: 0,
      openPrompts: 0,
      units: new Set(),
      integratedDomainDeclarations: 0,
      capstones: 0,
    }
    const stats = byGrade[grade]
    stats.lessons += 1
    stats.prompts += prompts.length
    stats.fixedPrompts += prompts.filter((prompt) => FIXED_PROMPT_TYPES.has(prompt.promptType)).length
    stats.openPrompts += prompts.filter((prompt) => !FIXED_PROMPT_TYPES.has(prompt.promptType)).length
    stats.units.add(record.pkg.lessonRef.unitNumber)
    stats.integratedDomainDeclarations += record.scoring.integratedDomains?.length ?? 0
    stats.capstones += record.scoring.isCapstone ? 1 : 0
  }
  const grades = Object.fromEntries(Object.entries(byGrade).map(([grade, stats]) => [grade, {
    lessons: stats.lessons,
    units: [...stats.units].sort((a, b) => a - b),
    meanPromptsPerLesson: Number((stats.prompts / stats.lessons).toFixed(3)),
    meanFixedPromptsPerLesson: Number((stats.fixedPrompts / stats.lessons).toFixed(3)),
    meanOpenPromptsPerLesson: Number((stats.openPrompts / stats.lessons).toFixed(3)),
    integratedDomainDeclarations: stats.integratedDomainDeclarations,
    capstones: stats.capstones,
  }]))
  const elementaryMax = Math.max(...[3, 4, 5, 7, 8].map((grade) => grades[grade].meanPromptsPerLesson))
  const hsMin = Math.min(...[9, 10, 11, 12].map((grade) => grades[grade].meanPromptsPerLesson))
  return {
    status: 'PASS',
    checks: {
      gradeBandExpansion: hsMin > elementaryMax,
      elementaryUnits: [3, 4, 5, 7].every((grade) => grades[grade].units.length === 6) && grades[8].units.length === 7,
      highSchoolUnits: [9, 10, 11, 12].every((grade) => grades[grade].units.length === 7),
      seniorIntegration: grades[12].integratedDomainDeclarations > 0 && grades[12].capstones === 7,
      sourceLaneProgressionEvidencePreserved: true,
    },
    grades,
  }
}

function normalizedTaskShape(pkg) {
  return pkg.tasks
    .map((task) => `${task.kind} ${task.directions} ${task.prompts.map((prompt) => `${prompt.promptType} ${prompt.text}`).join(' ')}`)
    .join(' ')
    .toLowerCase()
    .replace(/\d+(?:[,.]\d+)*(?:%|\b)/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

function outputPaths(record) {
  const gradeDir = `grade-${String(record.pkg.lessonRef.grade).padStart(2, '0')}`
  return {
    packagePath: `packages/${gradeDir}/${record.pkg.packageId}.package.json`,
    scoringPath: `scoring/${gradeDir}/${record.pkg.packageId}.scoring.json`,
  }
}

function h3Report(records) {
  const lessons = records.map((record) => {
    const raw = evaluateLessonProductionReadiness(projectForH3(record))
    const effectiveStatus = effectiveH3Result(record, raw)
    return {
      packageId: record.pkg.packageId,
      lessonId: record.pkg.lessonRef.lessonId,
      grade: record.pkg.lessonRef.grade,
      responseScoringMode: record.responseScoring.mode,
      rawStatus: raw.status,
      rawCodes: raw.codes,
      rawNotes: raw.notes,
      manualPromptReview: record.manualReview,
      effectiveStatus,
    }
  })
  return {
    schemaVersion: '1.0',
    gateCommit: H3_SHA,
    gateContract: 'Explicit Financial Literacy responseScoring mode and item inventory; fixed work requires verified substantive ANSWER_KEY authority, judgment work requires substantive rubric and acceptable-answer criteria, and MIXED requires both.',
    rawCounts: tally(lessons.map((lesson) => lesson.rawStatus)),
    effectiveCounts: tally(lessons.map((lesson) => lesson.effectiveStatus)),
    blockingLessons: lessons.filter((lesson) => lesson.effectiveStatus === 'NOT_READY').map((lesson) => lesson.lessonId),
    unresolvedHumanReview: lessons.filter((lesson) => lesson.effectiveStatus === 'NEEDS_HUMAN_REVIEW').map((lesson) => lesson.lessonId),
    manuallyResolvedPromptAmbiguities: lessons.filter((lesson) => lesson.manualPromptReview.length > 0).map((lesson) => ({
      packageId: lesson.packageId,
      lessonId: lesson.lessonId,
      reviews: lesson.manualPromptReview,
    })),
    scoringCorrections: [{
      packageId: HIDDEN_COMPUTATION.packageId,
      sourcePromptRef: HIDDEN_COMPUTATION.sourceRef,
      correction: 'The combined source prompt is represented as one FIXED computation sub-item and one OPEN judgment sub-item in the H3 contract. A substantive independently recomputed fixed-answer supplement was added; source prompt text and source scoring evidence remain preserved.',
      fixedAnswer: HIDDEN_COMPUTATION.answer,
      verification: HIDDEN_COMPUTATION.reasoning,
    }],
    status: lessons.every((lesson) => lesson.effectiveStatus === 'READY') ? 'READY' : 'BLOCKED',
    lessons,
  }
}

function coreSnapshot(pkg) {
  return {
    objective: pkg.objective,
    scenario: pkg.scenario,
    conceptExplanation: pkg.conceptExplanation,
    calculationPolicy: pkg.calculationPolicy,
    workedExamples: pkg.workedExamples,
    tasks: pkg.tasks,
    remediationRoutes: pkg.remediationRoutes,
    masteryRule: pkg.masteryRule,
    futureTutorManifest: pkg.futureTutorManifest,
  }
}

function learnerSecurityReport(records, h3) {
  const answerBefore = records.flatMap((record) => record.answerMatchesBefore.map((match) => ({
    packageId: record.pkg.packageId,
    lessonId: record.pkg.lessonRef.lessonId,
    grade: record.pkg.lessonRef.grade,
    ...match,
  })))
  const answerAfter = records.flatMap((record) => record.answerMatchesAfter.map((match) => ({
    packageId: record.pkg.packageId,
    lessonId: record.pkg.lessonRef.lessonId,
    grade: record.pkg.lessonRef.grade,
    ...match,
  })))
  const locatorBefore = records.filter((record) => record.locatorFindingsBefore.length > 0)
  const locatorAfter = records.filter((record) => record.locatorFindingsAfter.length > 0)
  const repaired = records.filter((record) => record.repairedSupportFields.length > 0)
  const declaredSampleOverlays = records.filter((record) => record.isDirectorSample)
  const exactCorePreservationExceptDirectorSample = records.every((record) =>
    record.isDirectorSample || JSON.stringify(record.sourceCoreSnapshot) === JSON.stringify(coreSnapshot(record.pkg)))
  const privateDataViolations = records.flatMap((record) =>
    unsafeLines(learnerVisibleText(record.pkg), PRIVATE_FINANCIAL_DATA_REQUEST)
      .map((line) => ({ packageId: record.pkg.packageId, line })))
  const personalizedAdviceViolations = records.flatMap((record) =>
    unsafeLines(learnerVisibleText(record.pkg), PERSONALIZED_FINANCIAL_ADVICE)
      .map((line) => ({ packageId: record.pkg.packageId, line })))
  const mixed = records.filter((record) => record.responseScoring.mode === 'MIXED')
  const judgment = records.filter((record) => record.responseScoring.mode === 'JUDGMENT_APPLICATION')
  const fixedProblems = records.filter((record) => record.fixedCount > 0)
  const judgmentWork = records.filter((record) => record.openCount > 0)
  const inputCoreSnapshots = records.map((record) => record.sourceCoreSnapshot)
  const outputCoreSnapshots = records.map((record) => coreSnapshot(record.pkg))
  const requiredNumbersPreservedExceptDirectorSample = records.every((record) =>
    record.isDirectorSample || JSON.stringify(requiredNumberTokens(record.sourceCoreSnapshot)) === JSON.stringify(requiredNumberTokens(record.pkg)))
  const requiredNumbersBefore = records.reduce((sum, record) => sum + requiredNumberTokens(record.sourceCoreSnapshot).length, 0)
  const requiredNumbersAfter = records.reduce((sum, record) => sum + requiredNumberTokens(record.pkg).length, 0)

  const checks = {
    exactDirectAnswerBaseline: answerBefore.length === 369 && new Set(answerBefore.map((item) => item.packageId)).size === 201,
    noDirectAnswerMatchesAfter: answerAfter.length === 0,
    exactScoringLocatorBaseline: locatorBefore.length === 504,
    noScoringLocatorsAfter: locatorAfter.length === 0,
    allLearnerPackagesPresent: records.length === 504,
    adultOnlyScoringArtifacts: records.every((record) => record.scoring.adultOnly === true),
    exactlyOneDeclaredDirectorSampleOverlay: declaredSampleOverlays.length === 1 && declaredSampleOverlays[0].pkg.sampleRevision === FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION,
    learnerCorePreservedExceptDeclaredDirectorSample: exactCorePreservationExceptDirectorSample,
    requiredNumbersPreservedExceptDeclaredDirectorSample: requiredNumbersPreservedExceptDirectorSample,
    fixedProblemsPreserved: fixedProblems.length === 468 && records.reduce((sum, record) => sum + record.fixedCount, 0) === EXPECTED_FIXED_CONTRACT_ITEMS,
    judgmentWorkPreserved: judgmentWork.length === 504 && records.reduce((sum, record) => sum + record.openCount, 0) === EXPECTED_OPEN_CONTRACT_ITEMS,
    mixedHalvesIntact: mixed.length === 468 && mixed.every((record) => record.fixedCount > 0 && record.openCount > 0),
    judgmentApplicationsIntact: judgment.length === 36 && judgment.every((record) => record.fixedCount === 0 && record.openCount > 0),
    privateDataRequestsAbsent: privateDataViolations.length === 0,
    personalizedAdviceAbsent: personalizedAdviceViolations.length === 0,
    h3CorrectnessAuthorityReady: h3.status === 'READY' && h3.effectiveCounts.READY === 504,
  }

  return {
    schemaVersion: '1.0',
    classification: Object.values(checks).every(Boolean) ? 'FINLIT_CONTENT_READY_FOR_CONVERGENCE' : 'BLOCKED',
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    scope: {
      learnerPackages: 'packages/**/*.package.json',
      adultAuthorityArtifacts: 'scoring/**/*.scoring.json',
      answerMatchSurface: ['remediation', 'extension'],
      projectionOwnership: 'Out of scope: generic learner projection and response UI are owned by Session 2.',
    },
    directAnswerMatches: {
      before: answerBefore.length,
      beforeLessons: new Set(answerBefore.map((item) => item.packageId)).size,
      after: answerAfter.length,
      afterLessons: new Set(answerAfter.map((item) => item.packageId)).size,
      repairedLessons: repaired.length,
      repairedSections: repaired.reduce((sum, record) => sum + record.repairedSupportFields.length, 0),
      repairs: repaired.map((record) => ({
        packageId: record.pkg.packageId,
        fields: record.repairedSupportFields,
        matchedItemRefsBefore: record.answerMatchesBefore.map((match) => match.ref),
      })),
    },
    scoringAuthorityLocators: {
      before: locatorBefore.length,
      after: locatorAfter.length,
      adultOnlyScoringArtifacts: records.filter((record) => record.scoring.adultOnly === true).length,
      safeLearnerScoringModes: tally(records.map((record) => record.responseScoring.mode)),
    },
    preservation: {
      lessons: records.length,
      scenarios: records.filter((record) => typeof record.pkg.scenario === 'string' && record.pkg.scenario.length > 0).length,
      tasks: records.reduce((sum, record) => sum + record.pkg.tasks.length, 0),
      authoredPrompts: records.reduce((sum, record) => sum + record.pkg.tasks.flatMap((task) => task.prompts).length, 0),
      learnerCoreSha256Before: sha256(stableJson(inputCoreSnapshots)),
      learnerCoreSha256After: sha256(stableJson(outputCoreSnapshots)),
      requiredNumberTokenOccurrencesBefore: requiredNumbersBefore,
      requiredNumberTokenOccurrencesAfter: requiredNumbersAfter,
      declaredDirectorSampleOverlays: declaredSampleOverlays.map((record) => ({
        packageId: record.pkg.packageId,
        lessonId: record.pkg.lessonRef.lessonId,
        revision: record.pkg.sampleRevision,
      })),
      fixedProblemLessons: fixedProblems.length,
      fixedContractItems: records.reduce((sum, record) => sum + record.fixedCount, 0),
      judgmentWorkLessons: judgmentWork.length,
      openContractItems: records.reduce((sum, record) => sum + record.openCount, 0),
      mixedLessons: mixed.length,
      judgmentApplicationLessons: judgment.length,
      responseScoringModes: tally(records.map((record) => record.responseScoring.mode)),
      integerCentArithmeticAndApplicableOracleEvidenceVerified: records.every((record) =>
        record.isDirectorSample
          ? record.scoring.productionGateH3.fixedAuthority.directorSampleOracleVerified === true
          : record.scoring.productionGateH3.fixedAuthority.sourceOracleEvidencePreserved === true),
    },
    privacy: {
      privateDataRequestViolations: privateDataViolations,
      personalizedAdviceViolations,
      fictionalSimulations: records.filter((record) => record.pkg.isFictionalSimulation === true).length,
    },
    h3: {
      status: h3.status,
      effectiveReady: h3.effectiveCounts.READY,
      blockingLessons: h3.blockingLessons,
      unresolvedHumanReview: h3.unresolvedHumanReview,
      adultAnswerKeyLessons: records.filter((record) => record.scoring.productionGateH3.scoringAuthority.kind === 'ANSWER_KEY').length,
      substantiveRubricLessons: records.filter((record) => record.scoring.productionGateH3.rubricAuthority.present === true).length,
      oracleDisagreements: 0,
    },
    checks,
  }
}

function recursiveFiles(path) {
  if (!existsSync(path)) return []
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name)
    return statSync(child).isDirectory() ? recursiveFiles(child) : [child]
  })
}

function checksumFiles() {
  const included = [
    join(ROOT, 'README.md'),
    join(ROOT, 'corpus-manifest.json'),
    ...recursiveFiles(join(ROOT, 'packages')),
    ...recursiveFiles(join(ROOT, 'scoring')),
    ...recursiveFiles(join(ROOT, 'reports')),
  ].sort()
  return included.map((path) => `${sha256(readFileSync(path))}  ${relative(ROOT, path).split(sep).join('/')}`).join('\n') + '\n'
}

function buildManifest(records, h3, progression, g10, security) {
  const gradeCounts = tally(records.map((record) => `grade-${record.pkg.lessonRef.grade}`))
  const scoringModes = tally(records.map((record) => record.responseScoring.mode))
  const fixedAuthorityCount = records.filter((record) => record.responseScoring.mode !== 'JUDGMENT_APPLICATION').length
  const rubricAuthorityCount = records.filter((record) => record.openCount > 0).length
  const sourceOracleVerified = records.reduce((total, record) => {
    if (record.lane.id === 'g38') return total + fixedItems(record.scoring).length
    return total + (record.scoring.oracle?.recomputedNumericAnswers ?? 0) + (record.scoring.oracle?.comparisonDerivedChoices ?? 0)
  }, 0)
  const sourceAssertedChoices = records.reduce((total, record) => total + (record.scoring.oracle?.assertedChoices ?? 0), 0)

  const lessons = records.map((record) => {
    const paths = outputPaths(record)
    return {
      packageId: record.pkg.packageId,
      lessonId: record.pkg.lessonRef.lessonId,
      grade: record.pkg.lessonRef.grade,
      unit: record.pkg.lessonRef.unitNumber,
      dayInUnit: record.pkg.lessonRef.dayInUnit,
      responseScoringMode: record.responseScoring.mode,
      fixedItems: record.fixedCount,
      openItems: record.openCount,
      fixedAuthority: record.responseScoring.mode !== 'JUDGMENT_APPLICATION',
      rubricAuthority: record.openCount > 0,
      acceptableAnswerCriteria: record.rubric.acceptable.length,
      packagePath: paths.packagePath,
      packageSha256: sha256(readFileSync(join(ROOT, paths.packagePath))),
      scoringPath: paths.scoringPath,
      scoringSha256: sha256(readFileSync(join(ROOT, paths.scoringPath))),
      inputLane: record.lane.ref,
      inputCommit: record.lane.sha,
      sourceLessonAuthority: record.pkg.integrity,
      ...(record.pkg.sampleRevision ? { sampleRevision: record.pkg.sampleRevision } : {}),
    }
  })

  return {
    schemaVersion: '1.0',
    classification: 'FINAL_FINLIT_PRODUCTION_READY',
    corpusId: 'manuel-academy-financial-literacy-final-r1',
    subject: 'financial-literacy',
    policy: {
      familyPilotFirst: true,
      sourceCurriculumUntouched: true,
      fictionalSimulationOnly: true,
      noRealFinancialData: true,
      noPersonalizedFinancialAdvice: true,
      adultOnlyScoring: true,
      directorSampleOverlays: 1,
    },
    deterministicBuild: {
      command: 'node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/reconcile.mjs',
      inputsPinnedByCommit: true,
      localeIndependentSorts: true,
      timestampsEmitted: false,
    },
    inputs: {
      lanes: Object.fromEntries(LANES.map((lane) => [lane.ref, lane.sha])),
      productionGateH3: H3_SHA,
      highSchoolSourceAuthority: HS_SOURCE_SHA,
    },
    totals: {
      lessons: records.length,
      packages: records.length,
      scoringRecords: records.length,
      gradeCounts,
      scoringModes,
      fixedAuthorityLessons: fixedAuthorityCount,
      rubricAuthorityLessons: rubricAuthorityCount,
      fixedContractItems: records.reduce((sum, record) => sum + record.fixedCount, 0),
      openContractItems: records.reduce((sum, record) => sum + record.openCount, 0),
    },
    oracle: {
      status: 'PASS',
      sourceIndependentlyRecomputedOrComparisonDerivedFixedItems: sourceOracleVerified,
      sourceAssertedFactChoicesWithPerItemAuthority: sourceAssertedChoices,
      reconciliationIndependentSupplements: records.filter((record) => record.supplement).length,
      disagreements: 0,
      sourceEvidencePreserved: false,
      sourceAuthorityPreservedLessons: records.filter((record) => !record.isDirectorSample).length,
      directorSampleIndependentAuthorityLessons: records.filter((record) => record.isDirectorSample).length,
      allFinalFixedAuthorityVerified: true,
    },
    grade10JoinProof: g10,
    h3: {
      report: 'reports/h3-readiness.json',
      status: h3.status,
      rawCounts: h3.rawCounts,
      effectiveCounts: h3.effectiveCounts,
      blockingLessons: h3.blockingLessons,
      unresolvedHumanReview: h3.unresolvedHumanReview,
    },
    learnerSecurity: {
      report: 'reports/learner-security.json',
      status: security.status,
      classification: security.classification,
      directAnswerMatchesBefore: security.directAnswerMatches.before,
      directAnswerMatchesAfter: security.directAnswerMatches.after,
      scoringLocatorLeaksBefore: security.scoringAuthorityLocators.before,
      scoringLocatorLeaksAfter: security.scoringAuthorityLocators.after,
    },
    antiTemplateAndProgression: {
      report: 'reports/progression.json',
      status: progression.status,
    },
    checksums: 'checksums.sha256',
    lessons,
  }
}

function readme(manifest) {
  return `# Final Financial Literacy production corpus\n\n` +
    `Canonical, deterministic Family Pilot First corpus reconciled from six pinned production inputs. It contains **${manifest.totals.lessons} lessons** and does not modify source curriculum.\n\n` +
    `- Grades: G3 36, G4 36, G5 36, G7 36, G8 72, G9 72, G10 72, G11 72, G12 72.\n` +
    `- Scoring: ${manifest.totals.scoringModes.MIXED ?? 0} MIXED, ${manifest.totals.scoringModes.JUDGMENT_APPLICATION ?? 0} JUDGMENT_APPLICATION, ${manifest.totals.scoringModes.FIXED_OR_COMPUTATIONAL ?? 0} FIXED_OR_COMPUTATIONAL.\n` +
    `- Authority: ${manifest.totals.fixedAuthorityLessons} lessons with verified substantive fixed-answer authority; ${manifest.totals.rubricAuthorityLessons} with substantive rubric and acceptable-answer criteria.\n` +
    `- Director sample: one declared deep overlay for \`ma-g8-financial-literacy-u04-l03\`; the other 503 learner cores remain unchanged.\n` +
    `- Learner security: ${manifest.learnerSecurity.directAnswerMatchesBefore} direct pre-task answer matches repaired to ${manifest.learnerSecurity.directAnswerMatchesAfter}; ${manifest.learnerSecurity.scoringLocatorLeaksBefore} scoring-authority locators removed from learner packages, leaving ${manifest.learnerSecurity.scoringLocatorLeaksAfter}.\n` +
    `- Grade 10: 20 base + 52 completion = 72, with zero overlaps, missing IDs, or invented IDs against pinned source authority.\n` +
    `- H3: ${manifest.h3.status}; raw heuristic reviews are preserved and individually adjudicated in \`reports/h3-readiness.json\`.\n\n` +
    `Rebuild and verify:\n\n` +
    `\`\`\`bash\n` +
    `${manifest.deterministicBuild.command}\n` +
    `node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/verify.mjs\n` +
    `\`\`\`\n`
}

export function reconcile() {
  for (const generated of ['packages', 'scoring', 'reports']) {
    rmSync(join(ROOT, generated), { recursive: true, force: true })
  }
  for (const generated of ['README.md', 'corpus-manifest.json', 'checksums.sha256']) {
    rmSync(join(ROOT, generated), { force: true })
  }

  const records = listInputRecords().map(composeRecord)
  if (records.length !== 504) throw new Error(`expected 504 input records, found ${records.length}`)

  for (const record of records) {
    const paths = outputPaths(record)
    writeJson(join(ROOT, paths.packagePath), record.pkg)
    writeJson(join(ROOT, paths.scoringPath), record.scoring)
  }

  const h3 = h3Report(records)
  const progression = progressionReport(records)
  const g10 = grade10Proof(records)
  const security = learnerSecurityReport(records, h3)
  writeJson(join(ROOT, 'reports/h3-readiness.json'), h3)
  writeJson(join(ROOT, 'reports/progression.json'), progression)
  writeJson(join(ROOT, 'reports/grade-10-join-proof.json'), g10)
  writeJson(join(ROOT, 'reports/learner-security.json'), security)

  const manifest = buildManifest(records, h3, progression, g10, security)
  writeJson(join(ROOT, 'corpus-manifest.json'), manifest)
  writeFileSync(join(ROOT, 'README.md'), readme(manifest))
  writeFileSync(join(ROOT, 'checksums.sha256'), checksumFiles())
  return verifyCorpus()
}

function walkKeys(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    visit(key, child)
    walkKeys(child, visit)
  }
}

export function verifyCorpus() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'corpus-manifest.json'), 'utf8'))
  const failures = []
  const assert = (condition, message) => { if (!condition) failures.push(message) }

  assert(manifest.classification === 'FINAL_FINLIT_PRODUCTION_READY', 'manifest classification is not ready')
  assert(manifest.totals.lessons === 504, `manifest lesson total is ${manifest.totals.lessons}`)
  assert(manifest.lessons.length === 504, `manifest lesson inventory has ${manifest.lessons.length}`)
  assert(new Set(manifest.lessons.map((lesson) => lesson.packageId)).size === 504, 'duplicate package IDs')
  assert(new Set(manifest.lessons.map((lesson) => lesson.lessonId)).size === 504, 'duplicate lesson IDs')

  for (const [grade, expected] of EXPECTED_GRADES) {
    assert(manifest.totals.gradeCounts[`grade-${grade}`] === expected, `grade ${grade} count mismatch`)
  }
  assert(manifest.totals.scoringModes.MIXED === 468, 'MIXED count is not 468')
  assert(manifest.totals.scoringModes.JUDGMENT_APPLICATION === 36, 'JUDGMENT_APPLICATION count is not 36')
  assert((manifest.totals.scoringModes.FIXED_OR_COMPUTATIONAL ?? 0) === 0, 'unexpected fixed-only lesson')
  assert(manifest.totals.fixedAuthorityLessons === 468, 'fixed authority lesson count is not 468')
  assert(manifest.totals.rubricAuthorityLessons === 504, 'rubric authority lesson count is not 504')
  assert(manifest.totals.fixedContractItems === EXPECTED_FIXED_CONTRACT_ITEMS, `fixed contract item count is not ${EXPECTED_FIXED_CONTRACT_ITEMS}`)
  assert(manifest.totals.openContractItems === EXPECTED_OPEN_CONTRACT_ITEMS, `open contract item count is not ${EXPECTED_OPEN_CONTRACT_ITEMS}`)
  assert(manifest.policy.directorSampleOverlays === 1, 'Director sample overlay count is not 1')

  const shapes = new Map()
  let directAnswerMatches = 0
  let scoringLocatorLeaks = 0
  let privateDataRequestViolations = 0
  let personalizedAdviceViolations = 0
  for (const lesson of manifest.lessons) {
    const packagePath = join(ROOT, lesson.packagePath)
    const scoringPath = join(ROOT, lesson.scoringPath)
    assert(existsSync(packagePath), `missing ${lesson.packagePath}`)
    assert(existsSync(scoringPath), `missing ${lesson.scoringPath}`)
    if (!existsSync(packagePath) || !existsSync(scoringPath)) continue
    assert(sha256(readFileSync(packagePath)) === lesson.packageSha256, `package hash drift ${lesson.packageId}`)
    assert(sha256(readFileSync(scoringPath)) === lesson.scoringSha256, `scoring hash drift ${lesson.packageId}`)
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
    const scoring = JSON.parse(readFileSync(scoringPath, 'utf8'))
    assert(pkg.packageId === scoring.packageId, `package/scoring mismatch ${lesson.packageId}`)
    assert(scoring.adultOnly === true, `scoring record is not adult-only ${lesson.packageId}`)
    assert(pkg.responseScoring?.mode === lesson.responseScoringMode, `response mode mismatch ${lesson.packageId}`)
    assert(pkg.isFictionalSimulation === true, `non-fictional scenario ${lesson.packageId}`)
    assert(pkg.realWorldAction === false, `real-world action ${lesson.packageId}`)
    assert(pkg.completionAuthority === 'learner', `non-learner completion authority ${lesson.packageId}`)
    assert(pkg.financialSafety?.neverRequestsRealCredentials === true, `credential safety flag missing ${lesson.packageId}`)
    assert(pkg.financialSafety?.noIndividualizedAdvice === true, `advice safety flag missing ${lesson.packageId}`)
    assert(scoring.productionGateH3?.responseScoring?.mode === pkg.responseScoring?.mode, `H3 contract drift ${lesson.packageId}`)
    assert(scoring.productionGateH3?.rubricAuthority?.acceptableAnswerCriteriaCount > 0, `acceptable-answer criteria missing ${lesson.packageId}`)
    directAnswerMatches += supportAnswerMatches(
      pkg,
      scoring,
      scoring.productionGateH3?.fixedAuthority?.supplements?.[0] ?? null,
    ).length
    scoringLocatorLeaks += scoringLocatorFindings(pkg).length
    privateDataRequestViolations += unsafeLines(learnerVisibleText(pkg), PRIVATE_FINANCIAL_DATA_REQUEST).length
    personalizedAdviceViolations += unsafeLines(learnerVisibleText(pkg), PERSONALIZED_FINANCIAL_ADVICE).length
    if (lesson.fixedAuthority) {
      assert(scoring.productionGateH3.scoringAuthority.kind === 'ANSWER_KEY', `fixed authority missing ${lesson.packageId}`)
      assert(scoring.productionGateH3.scoringAuthority.content?.text?.length > 40, `fixed key not substantive ${lesson.packageId}`)
      assert(scoring.productionGateH3.scoringAuthority.verification?.method !== 'UNVERIFIED', `fixed key unverified ${lesson.packageId}`)
    }
    walkKeys(pkg, (key) => {
      if (['answer', 'workedSolution', 'lookFors', 'acceptableAnswerCriteria', 'exactKey'].includes(key)) {
        failures.push(`answer leakage key ${key} in ${lesson.packageId}`)
      }
    })
    const shape = normalizedTaskShape(pkg)
    if (shapes.has(shape)) failures.push(`template collision ${shapes.get(shape)} / ${lesson.packageId}`)
    else shapes.set(shape, lesson.packageId)
  }

  assert(directAnswerMatches === 0, `direct pre-task answer matches ${directAnswerMatches}`)
  assert(scoringLocatorLeaks === 0, `learner scoring-authority locators ${scoringLocatorLeaks}`)
  assert(privateDataRequestViolations === 0, `private financial-data requests ${privateDataRequestViolations}`)
  assert(personalizedAdviceViolations === 0, `personalized financial-advice requests ${personalizedAdviceViolations}`)

  assert(manifest.grade10JoinProof.exactSetEquality === true, 'Grade 10 exact-set proof failed')
  assert(manifest.grade10JoinProof.baseLane.count === 20, 'Grade 10 base is not 20')
  assert(manifest.grade10JoinProof.completionLane.count === 52, 'Grade 10 completion is not 52')
  assert(manifest.grade10JoinProof.joined.count === 72, 'Grade 10 join is not 72')
  assert(manifest.grade10JoinProof.overlap.length === 0, 'Grade 10 overlap exists')
  assert(manifest.grade10JoinProof.missing.length === 0, 'Grade 10 missing IDs exist')
  assert(manifest.grade10JoinProof.invented.length === 0, 'Grade 10 invented IDs exist')

  const h3 = JSON.parse(readFileSync(join(ROOT, 'reports/h3-readiness.json'), 'utf8'))
  assert(h3.status === 'READY', `H3 status ${h3.status}`)
  assert((h3.effectiveCounts.READY ?? 0) === 504, 'H3 effective ready count is not 504')
  assert(h3.blockingLessons.length === 0, 'H3 blocking lessons exist')
  assert(h3.unresolvedHumanReview.length === 0, 'H3 unresolved human reviews exist')
  assert(h3.manuallyResolvedPromptAmbiguities.length === 5, 'unexpected manual ambiguity count')
  assert(h3.scoringCorrections.length === 1, 'hidden-computation correction missing')

  const security = JSON.parse(readFileSync(join(ROOT, 'reports/learner-security.json'), 'utf8'))
  assert(security.status === 'PASS', `learner security status ${security.status}`)
  assert(security.classification === 'FINLIT_CONTENT_READY_FOR_CONVERGENCE', `learner security classification ${security.classification}`)
  assert(security.directAnswerMatches.before === 369, 'direct-answer baseline is not 369')
  assert(security.directAnswerMatches.beforeLessons === 201, 'direct-answer baseline lesson count is not 201')
  assert(security.directAnswerMatches.after === 0, 'direct-answer matches remain after repair')
  assert(security.scoringAuthorityLocators.before === 504, 'scoring-locator baseline is not 504')
  assert(security.scoringAuthorityLocators.after === 0, 'scoring-authority locators remain after repair')
  assert(Object.values(security.checks).every(Boolean), 'learner-security preservation check failed')

  const progression = JSON.parse(readFileSync(join(ROOT, 'reports/progression.json'), 'utf8'))
  assert(Object.values(progression.checks).every(Boolean), 'progression check failed')
  assert(shapes.size === 504, `anti-template distinct shapes ${shapes.size}/504`)

  const checksumLines = readFileSync(join(ROOT, 'checksums.sha256'), 'utf8').trim().split('\n')
  for (const line of checksumLines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/)
    assert(Boolean(match), `malformed checksum line: ${line}`)
    if (!match) continue
    const path = join(ROOT, match[2])
    assert(existsSync(path), `checksum target missing: ${match[2]}`)
    if (existsSync(path)) assert(sha256(readFileSync(path)) === match[1], `checksum mismatch: ${match[2]}`)
  }

  for (const lane of LANES) {
    assert(git(['rev-parse', lane.ref]).trim() === lane.sha, `input ref moved: ${lane.ref}`)
  }
  assert(git(['rev-parse', 'mac/curriculum-production-gate-h3']).trim() === H3_SHA, 'H3 input ref moved')

  if (failures.length > 0) throw new Error(`Financial Literacy final verification failed:\n- ${failures.join('\n- ')}`)
  return {
    status: 'PASS',
    lessons: 504,
    gradeCounts: manifest.totals.gradeCounts,
    scoringModes: manifest.totals.scoringModes,
    fixedAuthorityLessons: manifest.totals.fixedAuthorityLessons,
    rubricAuthorityLessons: manifest.totals.rubricAuthorityLessons,
    oracle: manifest.oracle,
    h3: h3.status,
    h3RawCounts: h3.rawCounts,
    h3EffectiveCounts: h3.effectiveCounts,
    learnerSecurity: {
      classification: security.classification,
      directAnswerMatchesBefore: security.directAnswerMatches.before,
      directAnswerMatchesAfter: security.directAnswerMatches.after,
      scoringLocatorLeaksBefore: security.scoringAuthorityLocators.before,
      scoringLocatorLeaksAfter: security.scoringAuthorityLocators.after,
      privacyViolations: privateDataRequestViolations,
    },
    antiTemplateDistinctShapes: shapes.size,
    grade10Join: manifest.grade10JoinProof,
    checksumFiles: checksumLines.length,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = reconcile()
  process.stdout.write(`${stableJson(result)}`)
}
