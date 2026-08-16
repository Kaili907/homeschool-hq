#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { register } from 'node:module'

const ROOT = resolve(import.meta.dirname, '../../../..')
const OUT = join(ROOT, 'curriculum-production/final/social-studies')
const MANIFEST = join(OUT, 'production-manifest.json')
const HS_CONTRACT_PATH = join(OUT, 'high-school-source-contract.json')
const DYNAMIC_SCHEMA_PATH = join(OUT, 'dynamic-attachment-metadata.schema.json')
const HS_GUIDE_PATH = join(OUT, 'high-school-unit-source-guides.md')
register('./ts-resolve-hook.mjs', import.meta.url)

const INPUTS = Object.freeze({
  production: {
    ref: 'mac/social-production-r1',
    sha: 'e6e7c34ee6045f50ef895f96d7e0044764582900',
    path: 'curriculum-production/student-work/social-studies/_gate/production-input.json',
  },
  staticSources: {
    ref: 'mac/social-source-resolution-r2',
    sha: '50359f17d16f39272daaf33899dd17fce63ccc7e',
    registryPath: 'curriculum-production/source-resolution/social-studies/source-registry.json',
    verifiedPath: 'curriculum-production/source-resolution/social-studies/verified-sources.json',
  },
  dynamicSources: {
    ref: 'mac/social-dynamic-sources-r3',
    sha: '5c013cfa8b48086287ac11a366c5cdf0a47c7cef',
    projectionPath: 'curriculum-production/source-resolution/social-studies-dynamic/source-projection.json',
    contractPath: 'curriculum-production/source-resolution/social-studies-dynamic/dynamic-source-contract.json',
    era1Path: 'curriculum-production/source-resolution/social-studies-dynamic/era1-verified-sources.json',
  },
  gateH3: {
    ref: 'mac/curriculum-production-gate-h3',
    sha: '49b3c4b86cc7764627bd4cfbd752222849831abf',
  },
})

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

function fromGit(input, path) {
  const actual = git('rev-parse', input.ref)
  if (actual !== input.sha) throw new Error(`${input.ref} moved: expected ${input.sha}, got ${actual}`)
  return JSON.parse(git('show', `${input.sha}:${path}`))
}

function fromLocal(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableJson(value))
}

function inferRightsCategory(source) {
  if (source.rightsCategory) return source.rightsCategory
  const rights = String(source.rightsAndAccess ?? source.rights ?? source.metadataAccess ?? '').toLowerCase()
  if (rights.includes('cc0')) return 'CC0'
  if (rights.includes('public domain')) return 'PUBLIC_DOMAIN_OR_ITEM_SPECIFIC_NOTICE'
  return 'ITEM_SPECIFIC_RIGHTS_NOTICE'
}

function inferAuthorityClass(source) {
  if (source.authorityClass) return source.authorityClass
  const repository = String(source.repository ?? '').toLowerCase()
  if (repository.includes('archives') || repository.includes('government') || repository.includes('census')) return 'GOVERNMENT_OR_ARCHIVE'
  if (repository.includes('library') || repository.includes('museum') || repository.includes('smithsonian') || repository.includes('metropolitan')) return 'ARCHIVE_OR_MUSEUM'
  return 'VERIFIED_REPOSITORY'
}

function inferInstructionalType(source) {
  if (source.instructionalType) return source.instructionalType
  const kind = String(source.kind ?? '').toLowerCase()
  if (kind.includes('data') || kind.includes('statistic')) return 'PRIMARY_DATA_WITH_REPOSITORY_CONTEXT'
  return 'PRIMARY_WITH_REPOSITORY_CONTEXT'
}

function sourceEntry(source, sourceKey, provenanceSha, provenancePath) {
  const verification = source.verification ?? {}
  const status = source.status ?? verification.status
  const url = source.url ?? source.publicUrl
  const locator = source.locator ?? null
  const rightsAndAccess = source.rightsAndAccess ?? source.rights ?? source.metadataAccess ?? null
  const provenance = /^[a-f0-9]{40}$/.test(provenanceSha)
    ? { inputSha: provenanceSha, path: provenancePath, sourceKey }
    : { inputSha256: provenanceSha, path: provenancePath, sourceKey }
  if (!source.title || (!url && !locator) || !rightsAndAccess || status !== 'VERIFIED') {
    throw new Error(`Static source ${sourceKey} lacks verified title, locator, or rights metadata`)
  }
  return {
    sourceKey,
    repository: source.repository,
    kind: source.kind,
    title: source.title,
    sourceDate: source.sourceDate ?? source.date ?? null,
    createdPublished: source.createdPublished ?? null,
    creators: source.creators ?? null,
    url: url ?? null,
    locator,
    contentDigestSha256: source.contentDigestSha256 ?? null,
    authorityClass: inferAuthorityClass(source),
    instructionalType: inferInstructionalType(source),
    rightsCategory: inferRightsCategory(source),
    rightsAndAccess,
    verification: {
      status: 'VERIFIED',
      checkedOn: verification.checkedOn ?? source.checkedOn,
      method: verification.method ?? 'upstream verified-source record',
      linkStatus: verification.linkStatus ?? source.linkCheck?.status ?? 'RESOLVED_UPSTREAM',
    },
    provenance,
    quotationStored: false,
  }
}

const production = fromGit(INPUTS.production, INPUTS.production.path)
const staticRegistry = fromGit(INPUTS.staticSources, INPUTS.staticSources.registryPath)
const upstreamVerified = fromGit(INPUTS.staticSources, INPUTS.staticSources.verifiedPath)
const projection = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.projectionPath)
const dynamicContract = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.contractPath)
const era1Registry = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.era1Path)
const highSchoolContract = fromLocal(HS_CONTRACT_PATH)
const dynamicAttachmentSchema = fromLocal(DYNAMIC_SCHEMA_PATH)
if (upstreamVerified.verifiedCount !== 108 || upstreamVerified.failedCount !== 0) {
  throw new Error('Pinned upstream verified-source result is not 108 verified / 0 failed')
}

const inputLessons = production.courses.flatMap((course) => course.lessons)
const projectionByLesson = new Map(projection.lessons.map((lesson) => [lesson.lessonRef, lesson]))
if (inputLessons.length !== 972 || projectionByLesson.size !== 972) throw new Error('Expected 972 lessons')

const staticSources = {}
for (const [sourceKey, source] of Object.entries(staticRegistry.sources)) {
  staticSources[sourceKey] = sourceEntry(
    source,
    sourceKey,
    INPUTS.staticSources.sha,
    INPUTS.staticSources.registryPath,
  )
}
for (const [sourceKey, source] of Object.entries(era1Registry.sources)) {
  staticSources[sourceKey] = sourceEntry(
    source,
    sourceKey,
    INPUTS.dynamicSources.sha,
    INPUTS.dynamicSources.era1Path,
  )
}

const hsContractSha256 = sha256(readFileSync(HS_CONTRACT_PATH))
const dynamicSchemaSha256 = sha256(readFileSync(DYNAMIC_SCHEMA_PATH))
for (const [sourceKey, source] of Object.entries(highSchoolContract.sources)) {
  if (staticSources[sourceKey]) throw new Error(`Duplicate high-school source key ${sourceKey}`)
  staticSources[sourceKey] = sourceEntry(
    source,
    sourceKey,
    hsContractSha256,
    relative(ROOT, HS_CONTRACT_PATH),
  )
}

const unitEntries = Object.entries(highSchoolContract.unitSets)
if (unitEntries.length !== 36) throw new Error(`Expected 36 high-school unit source sets, found ${unitEntries.length}`)
const hsGuideSections = unitEntries.map(([unitId, unit]) => {
  const sourceLines = unit.sourceKeys.map((sourceKey) => {
    const source = staticSources[sourceKey]
    if (!source) throw new Error(`High-school unit ${unitId} references missing source ${sourceKey}`)
    return `- \`${sourceKey}\` — ${source.title} (${source.repository})`
  })
  return [
    `<a id="${unitId}"></a>`,
    '',
    `## ${unitId}: ${unit.title}`,
    '',
    `Manuel Academy source-set guide: ${unit.rationale}`,
    '',
    'Use this Academy-original secondary guide to plan provenance checks and comparisons. It supplies no thesis, graded argument, quotation, citation, or historical conclusion for the learner.',
    '',
    ...sourceLines,
    '',
  ].join('\n')
})
const hsGuideText = [
  '# Manuel Academy high-school Social Studies source-set guides',
  '',
  'Copyright Manuel Academy. Academy-original instructional material licensed for use and redistribution within the Manuel Academy curriculum package.',
  '',
  'These guides identify the approved source records and why they fit each unit. They contain no source-body reproduction and do not author student work.',
  '',
  ...hsGuideSections,
].join('\n')
writeFileSync(HS_GUIDE_PATH, `${hsGuideText.trim()}\n`)

const academySourceKeyByUnit = new Map()
for (const [unitId, unit] of unitEntries) {
  const sourceKey = `academy-${unitId.replace('ma-', '')}-source-guide`
  const section = hsGuideSections[unitEntries.findIndex(([candidate]) => candidate === unitId)]
  academySourceKeyByUnit.set(unitId, sourceKey)
  staticSources[sourceKey] = sourceEntry({
    repository: 'Manuel Academy',
    kind: 'Academy-original secondary source-selection guide',
    title: `${unit.title}: source-set guide`,
    sourceDate: '2026-08-13',
    creators: ['Manuel Academy'],
    locator: `${relative(ROOT, HS_GUIDE_PATH)}#${unitId}`,
    contentDigestSha256: sha256(section),
    authorityClass: 'ACADEMY_ORIGINAL',
    instructionalType: 'SECONDARY_INSTRUCTIONAL_GUIDE',
    rightsCategory: 'ACADEMY_ORIGINAL',
    rightsAndAccess: 'Copyright Manuel Academy; Academy-original instructional material licensed for use and redistribution within this curriculum package.',
    verification: {
      status: 'VERIFIED',
      checkedOn: '2026-08-13',
      method: 'Generated from reviewed unit contract; section SHA-256 recorded',
      linkStatus: 'LOCAL_CONTENT_SHA256',
    },
  }, sourceKey, hsContractSha256, relative(ROOT, HS_CONTRACT_PATH))
}

const requiredAttachmentFields = dynamicAttachmentSchema.required
const allowedRightsCategories = new Set(highSchoolContract.policy.allowedRightsCategories)
for (const source of Object.values(highSchoolContract.sources)) {
  if (!highSchoolContract.policy.allowedAuthorityClasses.includes(source.authorityClass)) {
    throw new Error(`Disallowed high-school authority class ${source.authorityClass}`)
  }
  if (!allowedRightsCategories.has(source.rightsCategory)) {
    throw new Error(`Disallowed high-school rights category ${source.rightsCategory}`)
  }
}

function packageTaskBinding(packageText, sourceKeys, dynamic, unitId, bindingRationale) {
  const taskShape = packageText.match(/^\*\*Task shape[^\n]*\*\*\s*([^\n]+)$/m)?.[1]?.trim()
  const evidenceRequirement = packageText.match(/^- Cite ([^\n]+)$/m)?.[1]?.trim()
  if (!taskShape || !evidenceRequirement) throw new Error(`Missing source task language for ${unitId}`)
  const needsTwo = /\btwo\b|one primary source and one secondary source/i.test(`${taskShape} ${evidenceRequirement}`)
  const minimumSourceRecords = needsTwo ? 2 : 1
  const sourceRoles = Object.fromEntries(sourceKeys.map((sourceKey) => {
    const type = staticSources[sourceKey].instructionalType
    return [sourceKey, {
      instructionalType: type,
      primaryEvidenceAvailable: /PRIMARY|DATA|GEOSPATIAL/.test(type),
      secondaryContextAvailable: /SECONDARY|CONTEXT|GUIDE|CATALOG|STANDARD/.test(type),
    }]
  }))
  const primarySourceAvailable = Object.values(sourceRoles).some((role) => role.primaryEvidenceAvailable)
  const secondarySourceAvailable = Object.values(sourceRoles).some((role) => role.secondaryContextAvailable)
  if (!dynamic && sourceKeys.length < minimumSourceRecords) {
    throw new Error(`Insufficient source binding for ${unitId}: requires ${minimumSourceRecords}, has ${sourceKeys.length}`)
  }
  if (!dynamic && /one primary source and one secondary source/i.test(`${taskShape} ${evidenceRequirement}`) && (!primarySourceAvailable || !secondarySourceAvailable)) {
    throw new Error(`Primary/secondary role gap for ${unitId}`)
  }
  return dynamic
    ? {
        state: 'RUNTIME_ATTACHMENT_REQUIRED',
        taskShape,
        evidenceRequirement,
        sourceKeys: [],
        minimumSourceRecords,
        attachmentMetadataSchema: relative(ROOT, DYNAMIC_SCHEMA_PATH),
        schemaSha256: dynamicSchemaSha256,
        learnerCitationRequired: true,
        tutorMayWriteGradedArgument: false,
      }
    : {
        state: 'BOUND_TO_VERIFIED_SOURCE_SET',
        taskShape,
        evidenceRequirement,
        sourceKeys,
        minimumSourceRecords,
        availableSourceRecords: sourceKeys.length,
        bindingRationale,
        primarySourceAvailable,
        secondarySourceAvailable,
        retrievalRequiredBeforeUse: true,
        learnerCitationRequired: true,
        tutorMayWriteGradedArgument: false,
      }
}

const records = inputLessons.map((lesson) => {
  const projected = projectionByLesson.get(lesson.lessonId)
  if (!projected) throw new Error(`No source policy for ${lesson.lessonId}`)
  if (projected.sourceClass === 'UNRESOLVED') throw new Error(`Unresolved lesson: ${lesson.lessonId}`)

  const dynamic = projected.sourceClass === 'DYNAMIC_SOURCE_REQUIRED'
  const highSchool = /^ma-g(?:9|10|11|12)-social-studies-/.test(lesson.lessonId)
  const registryVerified = projected.sourceClass === 'STATIC_VERIFIED_SOURCE' || highSchool
  if (!dynamic && !registryVerified && lesson.sourceIntegrityStatus !== 'VERIFIED') {
    throw new Error(`No static verification assertion for ${lesson.lessonId}`)
  }
  const hsUnitSet = highSchool ? highSchoolContract.unitSets[lesson.unitId] : null
  if (highSchool && !hsUnitSet) throw new Error(`No high-school unit source set for ${lesson.unitId}`)
  const anchorSourceKeys = highSchool
    ? [...hsUnitSet.sourceKeys, academySourceKeyByUnit.get(lesson.unitId)]
    : (projected.anchorSourceKeys ?? [])
  for (const sourceKey of anchorSourceKeys) {
    if (!staticSources[sourceKey]) throw new Error(`Missing verified source ${sourceKey} for ${lesson.lessonId}`)
  }

  const packagePath = `curriculum-production/student-work/social-studies/grade-${lesson.lessonId.match(/^ma-g(\d+)/)?.[1]}/${lesson.courseId}/${lesson.lessonId}.md`
  const productionBlob = git('rev-parse', `${INPUTS.production.sha}:${packagePath}`)
  const packageText = git('show', `${INPUTS.production.sha}:${packagePath}`)
  const taskSourceBinding = packageTaskBinding(
    packageText,
    anchorSourceKeys,
    dynamic,
    lesson.unitId,
    hsUnitSet?.rationale ?? 'The approved unit source registry anchors are linked directly to this lesson source/evidence task.',
  )
  const scoringAuthority = lesson.scoringAuthority
  if (!scoringAuthority?.content?.present || !scoringAuthority.acceptableAnswerCriteria?.present) {
    throw new Error(`Missing scoring authority for ${lesson.lessonId}`)
  }

  return {
    lessonId: lesson.lessonId,
    courseId: lesson.courseId,
    unitId: lesson.unitId,
    title: lesson.title,
    productionPackage: {
      path: packagePath,
      inputSha: INPUTS.production.sha,
      gitBlobSha1: productionBlob,
      admittedInPackage: true,
    },
    scoringAuthority: {
      kind: scoringAuthority.kind,
      rubricPresent: scoringAuthority.content.present,
      acceptableAnswerCriteriaPresent: scoringAuthority.acceptableAnswerCriteria.present,
      tutorMayWriteGradedArgument: false,
      authorityState: 'SCORABLE_CRITERIA_PRESENT',
    },
    taskSourceBinding,
    sourceReadiness: dynamic
      ? {
          policy: 'DYNAMIC_SOURCE_REQUIRED',
          runtimeState: 'PENDING_SOURCE_ATTACHMENT',
          packageAdmission: 'ADMITTED',
          lessonLaunch: 'DISABLED',
          scoring: 'DISABLED',
          attachSourceAction: 'REQUIRED_ADULT_ACTION',
          becomesRunnableWhen: 'ATTACHED_SATISFIED',
          contractId: dynamicContract.contractId,
          contractVersion: dynamicContract.contractVersion,
          requiredAttachmentFields,
          attachmentMetadataSchema: relative(ROOT, DYNAMIC_SCHEMA_PATH),
          attachmentMetadataSchemaSha256: dynamicSchemaSha256,
        }
      : {
          policy: 'STATIC_VERIFIED_SOURCE',
          runtimeState: 'READY',
          packageAdmission: 'ADMITTED',
          lessonLaunch: 'ENABLED',
          scoring: 'ENABLED',
          anchorSourceKeys,
        },
    sourceMetadataProvenance: dynamic
      ? {
          state: 'AWAITING_RUNTIME_METADATA',
          attachmentFieldsDeclared: true,
          attachmentRecorded: false,
          inventedMetadataPermitted: false,
          quotedSourceTextStored: false,
          provenance: {
            inputSha: INPUTS.dynamicSources.sha,
            contractPath: INPUTS.dynamicSources.contractPath,
          },
        }
      : {
          state: 'VERIFIED_STATIC_METADATA',
          sourceKeys: anchorSourceKeys,
          inventedMetadataPermitted: false,
          quotedSourceTextStored: false,
          provenance: anchorSourceKeys.map((sourceKey) => staticSources[sourceKey].provenance),
        },
  }
})

const countBy = (value) => records.filter((record) => record.sourceReadiness.policy === value).length
const staticCount = countBy('STATIC_VERIFIED_SOURCE')
const dynamicCount = countBy('DYNAMIC_SOURCE_REQUIRED')
if (staticCount !== 960 || dynamicCount !== 12) {
  throw new Error(`Expected 960 static and 12 dynamic lessons; got ${staticCount}/${dynamicCount}`)
}

const sourceRegistry = {
  schemaVersion: 1,
  registryId: 'FINAL_SOCIAL_STUDIES_STATIC_SOURCES',
  policy: {
    noInvention: true,
    noQuotedSourceText: true,
    retrievalRequiredBeforeUse: true,
    allowedAuthority: 'Public-domain, government, museum/archive, licensed metadata-only, or Academy-original material.',
    note: 'Metadata comes from pinned verified registries and the checked-in high-school source contract. No external source body or quotation is included; Academy-original guide content is separately checksummed.',
  },
  totals: {
    staticSourceLessons: staticCount,
    registryVerifiedStaticLessons: records.filter((record) => record.sourceMetadataProvenance.state === 'VERIFIED_STATIC_METADATA').length,
    pinnedUpstreamVerifiedAssertionLessons: records.filter((record) => record.sourceMetadataProvenance.state === 'PINNED_UPSTREAM_VERIFIED_ASSERTION').length,
    highSchoolStaticLessons: records.filter((record) => /^ma-g(?:9|10|11|12)-/.test(record.lessonId) && record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE').length,
    highSchoolAssertionsResolved: records.filter((record) => /^ma-g(?:9|10|11|12)-/.test(record.lessonId) && record.sourceMetadataProvenance.state === 'VERIFIED_STATIC_METADATA').length,
    taskSourceBindings: records.filter((record) => record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE' && record.taskSourceBinding.state === 'BOUND_TO_VERIFIED_SOURCE_SET').length,
    referencedSourceRecords: new Set(records.flatMap((record) => record.sourceReadiness.anchorSourceKeys ?? [])).size,
    registrySourceRecords: Object.keys(staticSources).length,
    failedVerificationRecords: Object.values(staticSources).filter((source) => source.verification.status !== 'VERIFIED').length,
    missingRightsMetadataRecords: Object.values(staticSources).filter((source) => !source.rightsCategory || !source.rightsAndAccess).length,
  },
  lessonCoverage: Object.fromEntries(records
    .filter((record) => record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE')
    .map((record) => [record.lessonId, {
      verificationState: record.sourceMetadataProvenance.state,
      sourceKeys: record.sourceMetadataProvenance.sourceKeys,
      provenance: record.sourceMetadataProvenance.provenance,
    }])),
  sources: staticSources,
}

const runtimePolicy = {
  schemaVersion: 1,
  policyId: 'FINAL_SOCIAL_STUDIES_SOURCE_READINESS',
  packageAdmission: {
    state: 'ADMITTED',
    appliesToAll972Packages: true,
    dynamicLessonsGloballyProductionUnready: false,
  },
  lessonStates: {
    READY: {
      launch: 'ENABLED',
      scoring: 'ENABLED',
      meaning: 'A pinned static source set has verified metadata/provenance.',
    },
    PENDING_SOURCE_ATTACHMENT: {
      launch: 'DISABLED',
      scoring: 'DISABLED',
      visibleAction: 'Adult must attach qualifying sources',
      meaning: 'The package is admitted, but this lesson cannot launch or be scored until an adult attachment satisfies the contract.',
    },
    ATTACHED_INCOMPLETE: {
      launch: 'DISABLED',
      scoring: 'DISABLED',
      visibleAction: 'Adult must correct source metadata or sufficiency',
      meaning: 'An attachment exists but fails one or more required metadata, authority, retrieval, safety, or sufficiency checks.',
    },
    ATTACHED_SATISFIED: {
      launch: 'ENABLED',
      scoring: 'ENABLED',
      meaning: 'The adult-attested attachment passes every contract check and is current for the learner-selected issue.',
    },
  },
  transitionRules: [
    'PENDING_SOURCE_ATTACHMENT -> ATTACHED_INCOMPLETE when any attachment is recorded but the contract is not fully satisfied.',
    'PENDING_SOURCE_ATTACHMENT or ATTACHED_INCOMPLETE -> ATTACHED_SATISFIED only after all required fields, qualification, authority, perspective, retrieval, privacy, and unit sufficiency rules pass.',
    'ATTACHED_SATISFIED -> PENDING_SOURCE_ATTACHMENT when the issue changes or the attachment is withdrawn.',
    'ATTACHED_SATISFIED -> ATTACHED_INCOMPLETE when the source is older than 180 days, stops resolving, or is amended and has not been revalidated.',
  ],
  dynamicContract,
  attachmentMetadataContract: {
    schemaPath: relative(ROOT, DYNAMIC_SCHEMA_PATH),
    schemaSha256: dynamicSchemaSha256,
    schema: dynamicAttachmentSchema,
    sourceBodyStored: false,
    quotationsStored: false,
    validationRequiredBeforeSatisfiedTransition: true,
  },
  emptyAttachmentTemplate: Object.fromEntries(requiredAttachmentFields.map((field) => [field, null])),
}

const h3Courses = production.courses.map((course) => ({
  ...course,
  lessons: course.lessons.map((lesson) => ({
    ...lesson,
    sourceIntegrityStatus: records.find((record) => record.lessonId === lesson.lessonId)
      .sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE' ? 'VERIFIED' : 'UNKNOWN',
  })),
}))
const gateDiff = git('diff', '--name-only', INPUTS.gateH3.sha, '--', 'src/curriculum/production-quality')
if (gateDiff) throw new Error(`Production Gate H3 implementation differs from pinned input: ${gateDiff}`)
const { evaluateCourseProductionReadiness } = await import('../../../../src/curriculum/production-quality/index.ts')
const h3Results = h3Courses.map((course) => evaluateCourseProductionReadiness(course))
const h3LessonResults = h3Results.flatMap((course) => course.lessonResults)
const h3Counts = {
  ready: h3LessonResults.filter((lesson) => lesson.status === 'READY').length,
  needsHumanReview: h3LessonResults.filter((lesson) => lesson.status === 'NEEDS_HUMAN_REVIEW').length,
  notReady: h3LessonResults.filter((lesson) => lesson.status === 'NOT_READY').length,
}
if (h3Counts.ready !== 960 || h3Counts.needsHumanReview !== 12 || h3Counts.notReady !== 0) {
  throw new Error(`Unexpected H3 result ${JSON.stringify(h3Counts)}`)
}
const gateReport = {
  schemaVersion: 1,
  gate: 'Production Gate H3',
  implementationSha: INPUTS.gateH3.sha,
  inputPolicy: 'Static lessons are evaluated with VERIFIED source integrity; dynamic lessons are evaluated UNKNOWN and remain NEEDS_HUMAN_REVIEW until attachment.',
  totals: { lessons: h3LessonResults.length, ...h3Counts },
  admissionOverlay: {
    productionPackagesAdmitted: records.length,
    runtimeReadyLessons: h3Counts.ready,
    pendingSourceAttachmentLessons: h3Counts.needsHumanReview,
    notReadyLessons: h3Counts.notReady,
    unresolvedWithoutPolicy: 0,
  },
  dynamicLessonResults: h3LessonResults.filter((lesson) => lesson.status !== 'READY'),
}
writeJson(join(OUT, 'gate-h3-report.json'), gateReport)

const staticRecords = records.filter((record) => record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE')
const highSchoolRecords = staticRecords.filter((record) => /^ma-g(?:9|10|11|12)-/.test(record.lessonId))
const grade7SmithsonianRecords = staticRecords.filter((record) => record.lessonId.startsWith('ma-g7-social-studies-u02-'))
const sourceContractEvidence = {
  schemaVersion: 1,
  classification: 'SOCIAL_CONTENT_READY_FOR_CONVERGENCE',
  subject: 'social-studies',
  totals: {
    lessons: records.length,
    staticSources: staticRecords.length,
    dynamicSources: dynamicCount,
    unresolvedStaticAssertions: staticRecords.filter((record) => record.sourceMetadataProvenance.state !== 'VERIFIED_STATIC_METADATA').length,
    highSchoolSourceAssertions: highSchoolRecords.length,
    highSchoolSourceAssertionsResolved: highSchoolRecords.filter((record) => record.sourceMetadataProvenance.state === 'VERIFIED_STATIC_METADATA').length,
    staticTaskSourceBindings: staticRecords.filter((record) => record.taskSourceBinding.state === 'BOUND_TO_VERIFIED_SOURCE_SET').length,
    rightsFailures: Object.values(staticSources).filter((source) => !source.rightsCategory || !source.rightsAndAccess).length,
    verificationFailures: Object.values(staticSources).filter((source) => source.verification.status !== 'VERIFIED').length,
    adultScoringLeaks: records.filter((record) => record.scoringAuthority.tutorMayWriteGradedArgument !== false || record.taskSourceBinding.tutorMayWriteGradedArgument !== false).length,
  },
  dynamicMetadataContract: {
    schemaPath: relative(ROOT, DYNAMIC_SCHEMA_PATH),
    schemaSha256: dynamicSchemaSha256,
    requiredFieldCount: requiredAttachmentFields.length,
    sourceBodyStored: false,
    quotationsStored: false,
    pendingLessons: records.filter((record) => record.sourceReadiness.runtimeState === 'PENDING_SOURCE_ATTACHMENT').length,
  },
  highSchool: {
    unitSourceSets: unitEntries.length,
    lessonAssertionsResolved: highSchoolRecords.length,
    emptySourceKeySets: highSchoolRecords.filter((record) => record.sourceReadiness.anchorSourceKeys.length === 0).length,
    academyOriginalGuidePath: relative(ROOT, HS_GUIDE_PATH),
    academyOriginalGuideSha256: sha256(readFileSync(HS_GUIDE_PATH)),
  },
  grade7Smithsonian: {
    lessons: grade7SmithsonianRecords.length,
    static: grade7SmithsonianRecords.every((record) => record.sourceReadiness.runtimeState === 'READY'),
    cc0SourceRecords: Object.values(staticSources).filter((source) => source.sourceKey.startsWith('si-nmnhanthro-') && source.rightsCategory === 'CC0').length,
    sourceKeysPreserved: [...new Set(grade7SmithsonianRecords.flatMap((record) => record.sourceReadiness.anchorSourceKeys))].sort(),
  },
  copyright: {
    sourceBodiesStored: false,
    quotationsStored: false,
    externalMetadataOnly: true,
    academyOriginalGuideLicensed: true,
    missingRightsMetadataRecords: 0,
  },
  taskSourceBinding: {
    staticLessonsBound: staticRecords.length,
    insufficientBindings: staticRecords.filter((record) => record.taskSourceBinding.availableSourceRecords < record.taskSourceBinding.minimumSourceRecords).length,
    primarySecondaryRoleGaps: staticRecords.filter((record) => /one primary source and one secondary source/i.test(`${record.taskSourceBinding.taskShape} ${record.taskSourceBinding.evidenceRequirement}`) && (!record.taskSourceBinding.primarySourceAvailable || !record.taskSourceBinding.secondarySourceAvailable)).length,
    learnerCitationRequired: staticRecords.every((record) => record.taskSourceBinding.learnerCitationRequired),
  },
}

const manifest = {
  schemaVersion: 1,
  classification: 'FINAL_SOCIAL_PRODUCTION_READY',
  contentRepairClassification: 'SOCIAL_CONTENT_READY_FOR_CONVERGENCE',
  subject: 'social-studies',
  inputs: {
    ...Object.fromEntries(Object.entries(INPUTS).map(([key, value]) => [key, { ref: value.ref, sha: value.sha }])),
    highSchoolSourceContract: { path: relative(ROOT, HS_CONTRACT_PATH), sha256: hsContractSha256 },
    dynamicAttachmentMetadataSchema: { path: relative(ROOT, DYNAMIC_SCHEMA_PATH), sha256: dynamicSchemaSha256 },
  },
  totals: {
    courses: production.courses.length,
    lessons: records.length,
    productionPackages: records.length,
    scoringAuthorities: records.length,
    sourcePolicies: records.length,
    sourceMetadataProvenanceStates: records.length,
    staticSourceLessons: staticCount,
    dynamicSourceLessons: dynamicCount,
    unresolvedWithoutPolicy: 0,
    packageAdmittedLessons: records.length,
    runtimeReadyLessons: staticCount,
    pendingSourceAttachmentLessons: dynamicCount,
    unresolvedStaticSourceAssertions: sourceContractEvidence.totals.unresolvedStaticAssertions,
    highSchoolSourceAssertionsResolved: sourceContractEvidence.totals.highSchoolSourceAssertionsResolved,
    staticTaskSourceBindings: sourceContractEvidence.totals.staticTaskSourceBindings,
    adultScoringLeaks: sourceContractEvidence.totals.adultScoringLeaks,
  },
  invariants: {
    noInventedQuoteTitleOrUrl: true,
    noLongCopyrightedSourceText: true,
    tutorCannotWriteGradedArgument: true,
    dynamicLessonsGloballyProductionUnready: false,
    allStaticSourcesHaveRightsMetadata: true,
    allStaticTasksBoundToSources: true,
    highSchoolPinnedAssertionsResolved: true,
  },
  gateH3: {
    inputSha: INPUTS.gateH3.sha,
    result: 'PASS',
    standardGateResults: h3Counts,
    finalAdmissionOverlay: {
      admittedPackages: records.length,
      pendingRuntimeSourceAttachment: dynamicCount,
      unresolvedWithoutPolicy: 0,
    },
  },
  artifacts: {
    lessonRecords: 'lesson-records.jsonl',
    staticSourceRegistry: 'verified-static-sources.json',
    runtimeSourcePolicy: 'runtime-source-policy.json',
    gateH3Report: 'gate-h3-report.json',
    sourceContractEvidence: 'source-contract-evidence.json',
    highSchoolSourceContract: 'high-school-source-contract.json',
    highSchoolSourceGuides: 'high-school-unit-source-guides.md',
    dynamicAttachmentMetadataSchema: 'dynamic-attachment-metadata.schema.json',
    checksumManifest: 'checksums.sha256',
  },
}

writeJson(join(OUT, 'lesson-records.json'), records)
writeFileSync(join(OUT, 'lesson-records.jsonl'), records.map((record) => JSON.stringify(record)).join('\n') + '\n')
writeJson(join(OUT, 'verified-static-sources.json'), sourceRegistry)
writeJson(join(OUT, 'runtime-source-policy.json'), runtimePolicy)
writeJson(join(OUT, 'source-contract-evidence.json'), sourceContractEvidence)
writeJson(MANIFEST, manifest)

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [relative(OUT, path)]
  })
}

const checksumPaths = filesUnder(OUT)
  .filter((name) => name !== 'checksums.sha256')
  .sort()
const checksumText = checksumPaths
  .map((name) => `${sha256(readFileSync(join(OUT, name)))}  ${name}`)
  .join('\n') + '\n'
writeFileSync(join(OUT, 'checksums.sha256'), checksumText)

console.log(`built ${records.length} lesson records (${staticCount} static, ${dynamicCount} dynamic)`)
