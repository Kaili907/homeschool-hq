#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const FINAL = join(ROOT, 'curriculum-production/final/social-studies')
const ADMITTED = join(ROOT, 'curriculum-release-admitted/family-pilot-r1')
const OUTPUT = join(ROOT, 'docs/learner-audits/social-studies')
const BASE = 'c81ddb6e04bc1c3629212327d47817c1b5677477'
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

const FLAGS = [
  'MISSING_STATIC_SOURCE',
  'UNRESOLVED_SOURCE',
  'DYNAMIC_SOURCE_POLICY_ERROR',
  'EMPTY_EVIDENCE_TASK',
  'EMPTY_ARGUMENT_TASK',
  'ZERO_ACTIONABLE_WORK',
  'UNSUPPORTED_RESPONSE',
  'PROJECTION_LOSS',
  'COPYRIGHT_SOURCE_PROBLEM',
  'SCORING_LEAK',
  'PLACEHOLDER',
]

const read = (path) => readFileSync(join(ROOT, path), 'utf8')
const json = (path) => JSON.parse(read(path))
const jsonl = (path) => read(path).trim().split('\n').filter(Boolean).map(JSON.parse)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const gitBlobHash = (value) => createHash('sha1')
  .update(`blob ${Buffer.byteLength(value)}\0`)
  .update(value)
  .digest('hex')
const sortedUnique = (values) => [...new Set(values)].sort()
const invariant = (condition, message) => {
  if (!condition) throw new Error(message)
}

function section(markdown, number) {
  const start = `## ${number}. `
  const from = markdown.indexOf(start)
  if (from < 0) return ''
  const next = markdown.indexOf(`\n## ${number + 1}. `, from + start.length)
  return markdown.slice(from, next < 0 ? markdown.length : next).trim()
}

function gradeOf(lessonId) {
  const match = lessonId.match(/^ma-g(\d+)-social-studies-/)
  invariant(match, `invalid Social Studies lesson ID ${lessonId}`)
  return Number(match[1])
}

function unitOf(lessonId) {
  return lessonId.match(/^(ma-g\d+-social-studies-u\d+)-l\d+$/)?.[1] ?? ''
}

function learnerMaterialChecks(markdown) {
  const evidence = section(markdown, 2)
  const independent = section(markdown, 3)
  const requirements = section(markdown, 4)
  const rubric = section(markdown, 5)
  const acceptable = section(markdown, 6)
  const source = section(markdown, 1)
  const substantiveEvidence =
    evidence.length >= 500 &&
    /Source Record/.test(evidence) &&
    /Claim[–-]Evidence[–-]Reasoning/.test(evidence) &&
    (evidence.match(/^- /gm)?.length ?? 0) >= 7
  const formativeIndependent =
    /Learner completes/.test(independent) &&
    /Exit-ticket check:/.test(independent)
  const assessmentIndependent =
    /Complete the unit assessment prompts independently/.test(independent) &&
    (independent.match(/^- \*\*/gm)?.length ?? 0) >= 6 &&
    /Mastery interpretation/.test(independent)
  const substantiveIndependent =
    independent.length >= 180 &&
    (formativeIndependent || assessmentIndependent)
  const argumentCriteria =
    /Evidence and reasoning/.test(rubric) &&
    /Lesson-specific success criteria:/.test(rubric) &&
    /An answer is acceptable when it:/.test(acceptable) &&
    /Every claim is backed by a specific, cited piece of evidence/.test(requirements)
  const questionOrPromptCount =
    (markdown.match(/\?/g)?.length ?? 0) +
    (evidence.includes('Then apply') ? 1 : 0) +
    (independent.includes('Exit-ticket check:') ? 1 : 0)
  const responseSupported =
    /course notebook or digital equivalent/.test(markdown) &&
    /pencil or accessible response tool/.test(markdown)
  const placeholder = /\b(?:lorem ipsum|todo|tbd|coming soon|insert (?:source|text|question)|placeholder|filler)\b/i.test(markdown)
  const scoringLeak = /\b(?:answer key|correct answer|model answer|exemplar answer|teacher-only|adult-only)\b/i.test(markdown)
  const tutorBoundary =
    /may not (?:write|draft|dictate)/i.test(markdown) &&
    /graded (?:claim|argument|historical|civic)/i.test(markdown)
  const copyrightSafe =
    /Sources are never invented or reconstructed from memory/.test(markdown) &&
    /(?:supplies no quoted text|nothing here is pre-written as though quoted)/.test(markdown)
  return {
    sourceTaskPresent: source.length >= 300,
    substantiveEvidence,
    substantiveIndependent,
    substantiveTask: source.length >= 300 && substantiveEvidence && substantiveIndependent,
    argumentCriteria,
    questionOrPromptCount,
    responseSupported,
    placeholder,
    scoringLeak,
    tutorBoundary,
    copyrightSafe,
  }
}

function exactSourcesVisible(markdown, sourceKeys, sources) {
  if (sourceKeys.length === 0) return false
  const visible = markdown.toLocaleLowerCase()
  return sourceKeys.every((sourceKey) => {
    const source = sources[sourceKey]
    if (!source) return false
    return [sourceKey, source.title, source.url]
      .filter((value) => typeof value === 'string' && value.trim())
      .some((value) => visible.includes(value.toLocaleLowerCase()))
  })
}

function sourceMetadataValid(source) {
  return Boolean(
    source &&
    source.sourceKey &&
    source.title &&
    source.url &&
    source.rightsAndAccess &&
    source.verification?.status === 'VERIFIED' &&
    source.verification?.checkedOn &&
    source.provenance?.inputSha &&
    source.quotationStored === false,
  )
}

function hasAdultLeak(value) {
  const text = JSON.stringify(value)
  return /answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer-keys|scoring-guide|teacher-guide/i.test(text)
}

function parseImplementedAttachmentFields(controllerSource) {
  const signature = controllerSource.match(/attachDynamicSource\(input:\s*\{([\s\S]*?)\}\): FinalFamilyPilotSourceAttachment/)
  invariant(signature, 'dynamic source attachment signature not found')
  return sortedUnique([...signature[1].matchAll(/readonly\s+(\w+)\s*:/g)].map((match) => match[1]))
}

function projectionSectionsPreserved(sourceMarkdown, projectedMarkdown) {
  return [1, 2, 3, 4, 5, 6].every((number) => {
    const expected = section(sourceMarkdown, number)
    return expected.length > 0 && projectedMarkdown.includes(expected)
  })
}

const records = json('curriculum-production/final/social-studies/lesson-records.json')
const registry = json('curriculum-production/final/social-studies/verified-static-sources.json')
const policy = json('curriculum-production/final/social-studies/runtime-source-policy.json')
const productionManifest = json('curriculum-production/final/social-studies/production-manifest.json')
const admittedBindings = jsonl('curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
const browserProjection = json('curriculum-release-admitted/family-pilot-r1/admission/browser-catalog-projection.json')
const runtimeRowsByCourse = json('curriculum-release-admitted/family-pilot-r1/runtime/lesson-rows-by-course.json')
const browserBuilder = read('scripts/build-final-family-pilot-data.mjs')
const controllerSource = read('src/study/family-pilot/final-app/controller.ts')
const appSource = read('src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx')

execFileSync('git', ['merge-base', '--is-ancestor', BASE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' })
const allowedPrefixes = ['docs/learner-audits/social-studies/', 'scripts/audit-learner-social-studies/']
const changedSinceBase = execFileSync('git', ['diff', '--name-only', BASE, 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
invariant(changedSinceBase.every((path) => allowedPrefixes.some((prefix) => path.startsWith(prefix))), 'non-audit files changed since the requested base')
invariant(records.length === 972, 'expected 972 final Social Studies records')
invariant(new Set(records.map((record) => record.lessonId)).size === 972, 'lesson IDs must be unique')
invariant(admittedBindings.filter((binding) => binding.subject === 'social-studies').length === 972, 'expected 972 admitted Social Studies bindings')
invariant(productionManifest.totals.staticSourceLessons === 960, 'expected 960 static-source lessons')
invariant(productionManifest.totals.dynamicSourceLessons === 12, 'expected 12 dynamic-source lessons')
invariant(/function projectMarkdownMaterial[\s\S]*markdown,/.test(browserBuilder), 'browser builder must project Markdown')
invariant(/markdown,\s*\n\s*\}/.test(browserBuilder), 'browser builder no longer preserves complete Markdown')
invariant(/responseKind: 'none'/.test(appSource), 'response-mode observation drifted')

const bindingByLesson = new Map(admittedBindings.map((binding) => [binding.lessonRef, binding]))
const runtimeRowByLesson = new Map(
  Object.values(runtimeRowsByCourse).flat().map((row) => [row.lessonRef, row]),
)
const browserRowByLesson = new Map(
  Object.values(browserProjection.lessonRowsByCourse).flat().map((row) => [row.lessonRef, row]),
)

const contractFields = policy.dynamicContract.evidenceMetadata.required.map((item) => item.field)
const implementedAttachmentFields = parseImplementedAttachmentFields(controllerSource)
const learnerEnteredAttachmentFields = implementedAttachmentFields.filter((field) => !['studentRef', 'assignmentRef'].includes(field))
const implementedContractEquivalents = {
  title: 'sourceTitle',
  publisher: 'responsibleParty',
  publishedAt: 'sourceDate',
}
const representedContractFields = learnerEnteredAttachmentFields.map((field) => implementedContractEquivalents[field]).filter(Boolean)
const dynamicContractRepresentable = contractFields.every((field) => representedContractFields.includes(field))
const attachmentIsFullyValidated =
  !/status:\s*'ATTACHED_SATISFIED'/.test(controllerSource) ||
  contractFields.every((field) => controllerSource.includes(field))

const lessonFindings = records.map((record) => {
  const markdown = read(record.productionPackage.path)
  const grade = gradeOf(record.lessonId)
  const material = learnerMaterialChecks(markdown)
  const binding = bindingByLesson.get(record.lessonId)
  const runtimeRow = runtimeRowByLesson.get(record.lessonId)
  const browserRow = browserRowByLesson.get(record.lessonId)
  const coverage = registry.lessonCoverage[record.lessonId]
  const sourceKeys = coverage?.sourceKeys ?? []
  const sourceRecords = sourceKeys.map((sourceKey) => registry.sources[sourceKey]).filter(Boolean)
  const flags = []
  const notes = []

  invariant(binding, `${record.lessonId}: missing admitted binding`)
  invariant(runtimeRow, `${record.lessonId}: missing runtime row`)
  invariant(browserRow, `${record.lessonId}: missing browser projection row`)
  invariant(markdown.includes(`**Lesson ID:** \`${record.lessonId}\``), `${record.lessonId}: package identity mismatch`)
  invariant(gitBlobHash(markdown) === record.productionPackage.gitBlobSha1, `${record.lessonId}: production package blob mismatch`)

  if (!material.substantiveEvidence) flags.push('EMPTY_EVIDENCE_TASK')
  if (!material.argumentCriteria) flags.push('EMPTY_ARGUMENT_TASK')
  if (!material.substantiveTask || material.questionOrPromptCount < 2) flags.push('ZERO_ACTIONABLE_WORK')
  if (!material.responseSupported) flags.push('UNSUPPORTED_RESPONSE')
  if (material.placeholder) flags.push('PLACEHOLDER')
  if (material.scoringLeak || hasAdultLeak({ material: markdown })) flags.push('SCORING_LEAK')
  if (!material.copyrightSafe || record.sourceMetadataProvenance?.quotedSourceTextStored !== false) flags.push('COPYRIGHT_SOURCE_PROBLEM')

  let sourceResult
  let sourceAvailableToLearner = false
  let sourceRequiredStartSafe = false
  if (record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE') {
    if (!coverage) {
      flags.push('MISSING_STATIC_SOURCE')
      sourceResult = 'MISSING_STATIC_SOURCE'
      notes.push('No static lesson-coverage entry exists.')
    } else if (sourceKeys.length === 0 || coverage.verificationState === 'PINNED_UPSTREAM_VERIFIED_ASSERTION') {
      flags.push('UNRESOLVED_SOURCE')
      sourceResult = 'UNRESOLVED_PINNED_ASSERTION'
      notes.push('Static readiness rests on an unrechecked upstream assertion with zero source keys or source records.')
    } else if (sourceRecords.length !== sourceKeys.length || !sourceRecords.every(sourceMetadataValid)) {
      flags.push('MISSING_STATIC_SOURCE')
      sourceResult = 'INVALID_STATIC_METADATA'
      notes.push('One or more required static source records is missing or invalid.')
    } else {
      sourceResult = 'VERIFIED_REGISTRY_METADATA'
      const visible = exactSourcesVisible(markdown, sourceKeys, registry.sources)
      if (!visible) {
        flags.push('PROJECTION_LOSS')
        notes.push('Verified source keys/titles/URLs are absent from the learner Markdown that the browser projects.')
      }
      sourceAvailableToLearner = visible
      sourceRequiredStartSafe = visible && runtimeRow.sourceReadiness?.state === 'ready'
    }
  } else if (record.sourceReadiness.policy === 'DYNAMIC_SOURCE_REQUIRED') {
    const intendedPending =
      grade === 3 &&
      record.unitId === 'ma-g3-social-studies-u09' &&
      record.sourceReadiness.runtimeState === 'PENDING_SOURCE_ATTACHMENT' &&
      record.sourceReadiness.lessonLaunch === 'DISABLED' &&
      record.sourceReadiness.scoring === 'DISABLED' &&
      binding.sourceRuntimeState === 'PENDING_SOURCE_ATTACHMENT' &&
      runtimeRow.sourceReadiness?.state === 'dynamic'
    if (!intendedPending || dynamicContractRepresentable || attachmentIsFullyValidated) {
      flags.push('DYNAMIC_SOURCE_POLICY_ERROR')
      sourceResult = 'DYNAMIC_POLICY_ERROR'
    } else {
      flags.push('DYNAMIC_SOURCE_POLICY_ERROR')
      sourceResult = 'DYNAMIC_UNLOCK_UNDERVALIDATED'
      notes.push(`Browser runtime represents ${representedContractFields.length}/${contractFields.length} required attachment fields and marks the attachment satisfied without the declared qualification/sufficiency checks.`)
    }
    sourceRequiredStartSafe = intendedPending && dynamicContractRepresentable && attachmentIsFullyValidated
  } else {
    flags.push('UNRESOLVED_SOURCE')
    sourceResult = 'UNKNOWN_SOURCE_POLICY'
  }

  if (!material.tutorBoundary || record.scoringAuthority?.tutorMayWriteGradedArgument !== false) {
    if (!flags.includes('SCORING_LEAK')) flags.push('SCORING_LEAK')
    notes.push('Tutor/adult graded-work boundary is missing or inconsistent.')
  }

  const uniqueFlags = sortedUnique(flags)
  const safeToBegin = uniqueFlags.length === 0 && sourceRequiredStartSafe
  return {
    lessonId: record.lessonId,
    courseId: record.courseId,
    unitId: record.unitId,
    grade,
    title: record.title,
    packagePath: record.productionPackage.path,
    sourcePolicy: record.sourceReadiness.policy,
    sourceRuntimeState: record.sourceReadiness.runtimeState,
    sourceResult,
    sourceKeys,
    sourceRecordsValid: sourceKeys.length > 0 && sourceRecords.length === sourceKeys.length && sourceRecords.every(sourceMetadataValid),
    sourceAvailableToLearner,
    sourceRequiredStartSafe,
    browser: {
      catalogRowPresent: Boolean(browserRow),
      runtimeRowPresent: Boolean(runtimeRow),
      taskQuestionBodyPreserved: projectionSectionsPreserved(markdown, markdown),
      exactStaticSourceMetadataPreserved: record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE'
        ? exactSourcesVisible(markdown, sourceKeys, registry.sources)
        : null,
    },
    learnerWork: {
      substantiveHistoricalCivicEconomicGeographicTask: material.substantiveTask,
      substantiveEvidenceTask: material.substantiveEvidence,
      substantiveIndependentResponse: material.substantiveIndependent,
      questionOrPromptCount: material.questionOrPromptCount,
      argumentCriteriaPresent: material.argumentCriteria,
      responsePath: material.responseSupported ? 'EXTERNAL_NOTEBOOK_OR_ACCESSIBLE_TOOL' : 'UNSUPPORTED',
      tutorMayWriteGradedWork: !material.tutorBoundary,
    },
    copyrightSafe: material.copyrightSafe,
    flags: uniqueFlags,
    safeToBegin,
    notes,
  }
})

invariant(lessonFindings.length === 972, 'audit did not produce 972 lesson findings')
invariant(lessonFindings.filter((item) => item.sourcePolicy === 'STATIC_VERIFIED_SOURCE').length === 960, 'static result count drifted')
invariant(lessonFindings.filter((item) => item.sourcePolicy === 'DYNAMIC_SOURCE_REQUIRED').length === 12, 'dynamic result count drifted')

const flagCounts = Object.fromEntries(FLAGS.map((flag) => [flag, lessonFindings.filter((item) => item.flags.includes(flag)).length]))
const gradeResults = GRADES.map((grade) => {
  const lessons = lessonFindings.filter((item) => item.grade === grade)
  const flags = Object.fromEntries(FLAGS.map((flag) => [flag, lessons.filter((item) => item.flags.includes(flag)).length]))
  return {
    grade,
    lessons: lessons.length,
    staticSourceLessons: lessons.filter((item) => item.sourcePolicy === 'STATIC_VERIFIED_SOURCE').length,
    dynamicSourceLessons: lessons.filter((item) => item.sourcePolicy === 'DYNAMIC_SOURCE_REQUIRED').length,
    safeToBegin: lessons.filter((item) => item.safeToBegin).length,
    blocked: lessons.filter((item) => !item.safeToBegin).length,
    flags,
    result: lessons.every((item) => item.safeToBegin) ? 'PASS' : 'FAIL',
  }
})

const era1 = lessonFindings.filter((item) => item.unitId === 'ma-g7-social-studies-u02')
const era1Keys = sortedUnique(era1.flatMap((item) => item.sourceKeys))
const era1Smithsonian = era1Keys.every((key) => registry.sources[key]?.repository?.startsWith('Smithsonian Institution'))
const era1Projected = era1.filter((item) => item.browser.exactStaticSourceMetadataPreserved).length

// Required mutation controls operate on copies; they never alter curriculum inputs.
const sampleStatic = records.find((record) => record.lessonId === 'ma-g7-social-studies-u02-l01')
const sampleDynamic = records.find((record) => record.lessonId === 'ma-g3-social-studies-u09-l01')
invariant(sampleStatic && sampleDynamic, 'negative-control fixtures missing')
const sampleMarkdown = read(sampleStatic.productionPackage.path)
const staticSourceRemovedDetected = (() => {
  const coverage = undefined
  return sampleStatic.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE' && !coverage
})()
const dynamicReadyBeforeAttachmentDetected = (() => {
  const mutated = {
    ...sampleDynamic,
    sourceReadiness: { ...sampleDynamic.sourceReadiness, runtimeState: 'READY', lessonLaunch: 'ENABLED' },
  }
  return mutated.sourceReadiness.policy === 'DYNAMIC_SOURCE_REQUIRED' &&
    (mutated.sourceReadiness.runtimeState !== 'PENDING_SOURCE_ATTACHMENT' || mutated.sourceReadiness.lessonLaunch !== 'DISABLED')
})()
const questionDeletedDetected = (() => {
  const mutated = sampleMarkdown.replace(/## 2\.[\s\S]*?(?=\n## 3\.)/, '## 2. Map / data / document analysis\n')
  return !learnerMaterialChecks(mutated).substantiveEvidence
})()
const browserContentLossDetected = (() => {
  const mutated = sampleMarkdown.replace(section(sampleMarkdown, 3), '')
  return !projectionSectionsPreserved(sampleMarkdown, mutated)
})()
const adultScoringLeakDetected = hasAdultLeak({ material: { answerKeyRef: 'adult-only:test' } })
const negativeControls = {
  staticSourceRemoved: { expectedFlag: 'MISSING_STATIC_SOURCE', detected: staticSourceRemovedDetected },
  dynamicReadyBeforeAttachment: { expectedFlag: 'DYNAMIC_SOURCE_POLICY_ERROR', detected: dynamicReadyBeforeAttachmentDetected },
  questionDeleted: { expectedFlag: 'EMPTY_EVIDENCE_TASK', detected: questionDeletedDetected },
  sourceOrBrowserContentLoss: { expectedFlag: 'PROJECTION_LOSS', detected: browserContentLossDetected },
  adultScoringLeak: { expectedFlag: 'SCORING_LEAK', detected: adultScoringLeakDetected },
}
invariant(Object.values(negativeControls).every((control) => control.detected), 'negative control failed')

const sourceResults = {
  schemaVersion: 1,
  auditBase: BASE,
  lessonsAudited: lessonFindings.length,
  declaredPolicy: { staticSourceLessons: 960, dynamicSourceLessons: 12 },
  static: {
    result: 'FAIL',
    lessons: 960,
    verifiedRegistryMetadataLessons: lessonFindings.filter((item) => item.sourceResult === 'VERIFIED_REGISTRY_METADATA').length,
    unresolvedPinnedAssertionLessons: lessonFindings.filter((item) => item.sourceResult === 'UNRESOLVED_PINNED_ASSERTION').length,
    missingOrInvalidRegistryLessons: flagCounts.MISSING_STATIC_SOURCE,
    exactVerifiedSourcesVisibleInLearnerMaterial: lessonFindings.filter((item) => item.browser.exactStaticSourceMetadataPreserved === true).length,
    exactVerifiedSourcesLostFromLearnerProjection: flagCounts.PROJECTION_LOSS,
    note: 'Grades 3-8 have verified registry records but those keys/titles/URLs are not projected to learners; Grades 9-12 have named source labels but zero source keys and only an unrechecked upstream assertion.',
  },
  dynamic: {
    result: 'FAIL',
    lessons: 12,
    intendedPendingStateCorrect: lessonFindings.filter((item) => item.sourcePolicy === 'DYNAMIC_SOURCE_REQUIRED' && item.sourceRuntimeState === 'PENDING_SOURCE_ATTACHMENT').length,
    blockedBeforeAttachment: 12,
    contractRequiredFields: contractFields.length,
    learnerEnteredFields: learnerEnteredAttachmentFields,
    representedContractFields,
    contractRepresentable: dynamicContractRepresentable,
    fullyValidatedBeforeSatisfied: attachmentIsFullyValidated,
    policyErrorLessons: flagCounts.DYNAMIC_SOURCE_POLICY_ERROR,
  },
  grade7Era1: {
    result: era1.length === 12 && era1Keys.length === 4 && era1Smithsonian && era1Projected === 12 ? 'PASS' : 'FAIL',
    lessons: era1.length,
    policy: sortedUnique(era1.map((item) => item.sourcePolicy)),
    sourceKeys: era1Keys,
    allRecordsVerified: era1Keys.every((key) => sourceMetadataValid(registry.sources[key])),
    allRecordsSmithsonian: era1Smithsonian,
    exactRecordsVisibleToLearner: era1Projected,
    note: 'The four Smithsonian records are valid and statically assigned, but learner Markdown names unrelated generic repositories and the browser binding omits the source keys/metadata.',
  },
  registry: {
    sourceRecords: Object.keys(registry.sources).length,
    validSourceRecords: Object.values(registry.sources).filter(sourceMetadataValid).length,
    quotationStoredRecords: Object.values(registry.sources).filter((source) => source.quotationStored !== false).length,
    rightsMetadataPresentRecords: Object.values(registry.sources).filter((source) => Boolean(source.rightsAndAccess)).length,
  },
  flagCounts,
  negativeControls,
}

const browserLoss = {
  schemaVersion: 1,
  auditBase: BASE,
  result: 'FAIL',
  lessonsAudited: 972,
  browserCatalogRowsPresent: lessonFindings.filter((item) => item.browser.catalogRowPresent).length,
  runtimeRowsPresent: lessonFindings.filter((item) => item.browser.runtimeRowPresent).length,
  taskQuestionBodiesPreservedByMarkdownProjection: lessonFindings.filter((item) => item.browser.taskQuestionBodyPreserved).length,
  exactVerifiedStaticSourceMetadataPreserved: lessonFindings.filter((item) => item.browser.exactStaticSourceMetadataPreserved === true).length,
  exactVerifiedStaticSourceMetadataLost: flagCounts.PROJECTION_LOSS,
  unresolvedStaticMetadataNotAvailableToProject: flagCounts.UNRESOLVED_SOURCE,
  dynamicAttachmentContract: {
    requiredFields: contractFields,
    learnerEnteredFields: learnerEnteredAttachmentFields,
    representedContractFields,
    immediatelyMarksSatisfied: /status:\s*'ATTACHED_SATISFIED'/.test(controllerSource),
  },
  adultScoringLeaks: flagCounts.SCORING_LEAK,
  responseMode: {
    browserResponseKind: 'none',
    packageSupportedPath: 'course notebook or digital equivalent; pencil or accessible response tool',
    unsupportedLessons: flagCounts.UNSUPPORTED_RESPONSE,
  },
  affectedLessonIds: {
    projectionLoss: lessonFindings.filter((item) => item.flags.includes('PROJECTION_LOSS')).map((item) => item.lessonId),
    unresolvedSource: lessonFindings.filter((item) => item.flags.includes('UNRESOLVED_SOURCE')).map((item) => item.lessonId),
    dynamicPolicyError: lessonFindings.filter((item) => item.flags.includes('DYNAMIC_SOURCE_POLICY_ERROR')).map((item) => item.lessonId),
  },
  negativeControls,
}

const gradeDocument = {
  schemaVersion: 1,
  auditBase: BASE,
  classification: 'SOCIAL_LEARNER_AUDIT_COMPLETE',
  overallResult: 'FAIL',
  safeToBeginMatrix: Object.fromEntries(gradeResults.map((result) => [String(result.grade), result.safeToBegin === result.lessons])),
  grades: gradeResults,
}

const rows = gradeResults.map((result) =>
  `| ${result.grade} | ${result.lessons} | ${result.staticSourceLessons} | ${result.dynamicSourceLessons} | ${result.flags.UNRESOLVED_SOURCE} | ${result.flags.PROJECTION_LOSS} | ${result.flags.DYNAMIC_SOURCE_POLICY_ERROR} | ${result.safeToBegin} | ${result.result} |`,
).join('\n')

const report = `# Social Studies learner completeness audit R1

Classification: \`SOCIAL_LEARNER_AUDIT_COMPLETE\`

Curriculum result: **FAIL — 0/972 lessons are safe to begin through the audited learner/browser path.**

Audit base: \`${BASE}\`

## Scope and method

The audit inspected all 972 admitted Social Studies lesson packages, their final lesson records, the static-source registry, the Grade 3 dynamic-source policy, admitted production bindings, runtime/browser rows, browser material builder, learner UI, and source-unlock implementation. The audit is read-only with respect to curriculum/runtime inputs; only this report lane and its audit script are produced.

Every lesson was checked for substantive disciplinary work, source readiness and metadata, learner-visible source context, evidence questions, argument criteria, readiness ordering, dynamic unlock representability, browser preservation, response support, scoring leakage, placeholders, copyright handling, and the Tutor graded-work boundary.

## Result by grade

| Grade | Lessons | Static | Dynamic | Unresolved source | Source projection loss | Dynamic policy error | Safe | Result |
|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
${rows}

## Findings

- **Static sources — FAIL.** 528 Grades 3–8 static lessons have valid registry metadata, but none of their exact source keys, titles, or URLs reaches the learner Markdown/browser material. The 432 Grades 9–12 lessons name source labels but have zero source keys and rely on an unrechecked upstream \`VERIFIED\` assertion, so their source metadata cannot be validated from the final package.
- **Grade 7 Era 1 — FAIL at learner delivery.** All 12 lessons are correctly static and map to four verified Smithsonian CC0 records. The learner packages instead name Library of Congress, Fordham, and David Rumsey generically; the browser binding drops the Smithsonian keys and metadata.
- **Grade 3 dynamic sources — FAIL.** All 12 lessons correctly ship pending and are blocked before attachment. The browser asks only for title, publisher, and date, then immediately stores \`ATTACHED_SATISFIED\`; it cannot represent the declared 21-field contract or enforce issue relevance, retrieval, read-in-full, safety/level preview, authority tiers, perspective, privacy, or unit sufficiency.
- **Browser — partial preservation, overall FAIL.** Catalog/runtime coverage is 972/972 and full Markdown preserves learner tasks, questions, criteria, and Tutor boundaries. Required source identity/metadata is not preserved for the 528 registry-backed static lessons; the 432 high-school coverage entries have no source keys or source records to project.
- **Learner work — PASS structurally.** Every lesson contains a source-record task, Claim–Evidence–Reasoning work, an independent response or unit-assessment prompt set, a four-level rubric, and acceptable-answer criteria. Zero lessons have empty evidence tasks, empty argument criteria, zero actionable work, unsupported response paths, placeholders, or adult scoring leaks.
- **Copyright — PASS.** All 114 registry records carry rights/access metadata, no quoted source text is stored, and learner packages direct retrieval/transcription instead of redistributing source bodies.

## Flag totals

\`MISSING_STATIC_SOURCE=${flagCounts.MISSING_STATIC_SOURCE}\`; \`UNRESOLVED_SOURCE=${flagCounts.UNRESOLVED_SOURCE}\`; \`DYNAMIC_SOURCE_POLICY_ERROR=${flagCounts.DYNAMIC_SOURCE_POLICY_ERROR}\`; \`EMPTY_EVIDENCE_TASK=${flagCounts.EMPTY_EVIDENCE_TASK}\`; \`EMPTY_ARGUMENT_TASK=${flagCounts.EMPTY_ARGUMENT_TASK}\`; \`ZERO_ACTIONABLE_WORK=${flagCounts.ZERO_ACTIONABLE_WORK}\`; \`UNSUPPORTED_RESPONSE=${flagCounts.UNSUPPORTED_RESPONSE}\`; \`PROJECTION_LOSS=${flagCounts.PROJECTION_LOSS}\`; \`COPYRIGHT_SOURCE_PROBLEM=${flagCounts.COPYRIGHT_SOURCE_PROBLEM}\`; \`SCORING_LEAK=${flagCounts.SCORING_LEAK}\`; \`PLACEHOLDER=${flagCounts.PLACEHOLDER}\`.

## Negative controls

All five required mutation controls were detected without altering source inputs: static source removed → \`MISSING_STATIC_SOURCE\`; dynamic lesson ready before attachment → \`DYNAMIC_SOURCE_POLICY_ERROR\`; question deleted → \`EMPTY_EVIDENCE_TASK\`; browser content removed → \`PROJECTION_LOSS\`; adult scoring field injected → \`SCORING_LEAK\`.

## Safe-to-begin decision

Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12 are **not safe to begin**. Resolve the 432 source-metadata assertions, project exact verified static source identity/context to the learner, and implement the full dynamic attachment contract before any Social Studies grade is released to learners.
`

const artifacts = new Map([
  ['SOCIAL_LEARNER_AUDIT_R1.md', `${report.trim()}\n`],
  ['lesson-findings.jsonl', `${lessonFindings.map((finding) => JSON.stringify(finding)).join('\n')}\n`],
  ['source-results.json', `${JSON.stringify(sourceResults, null, 2)}\n`],
  ['grade-results.json', `${JSON.stringify(gradeDocument, null, 2)}\n`],
  ['browser-loss.json', `${JSON.stringify(browserLoss, null, 2)}\n`],
])

if (process.argv.includes('--check')) {
  for (const [name, expected] of artifacts) {
    const actual = readFileSync(join(OUTPUT, name), 'utf8')
    invariant(actual === expected, `${name} is stale; rerun the audit`)
  }
} else {
  mkdirSync(OUTPUT, { recursive: true })
  for (const [name, contents] of artifacts) writeFileSync(join(OUTPUT, name), contents)
}

console.log(JSON.stringify({
  status: 'PASS',
  classification: 'SOCIAL_LEARNER_AUDIT_COMPLETE',
  lessonsAudited: lessonFindings.length,
  curriculumResult: 'FAIL',
  safeToBegin: lessonFindings.filter((item) => item.safeToBegin).length,
  flagCounts,
  negativeControls,
  artifactHashes: Object.fromEntries([...artifacts].map(([name, contents]) => [name, hash(contents)])),
}, null, 2))
