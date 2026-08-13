#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { register } from 'node:module'

const ROOT = resolve(import.meta.dirname, '../../../..')
const OUT = join(ROOT, 'curriculum-production/final/social-studies')
const MANIFEST = join(OUT, 'production-manifest.json')
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

function sourceEntry(source, sourceKey, provenanceSha, provenancePath) {
  const verification = source.verification ?? {}
  const status = source.status ?? verification.status
  const url = source.url ?? source.publicUrl
  if (!source.title || !url || status !== 'VERIFIED') {
    throw new Error(`Static source ${sourceKey} lacks a verified title/URL record`)
  }
  return {
    sourceKey,
    repository: source.repository,
    kind: source.kind,
    title: source.title,
    sourceDate: source.date ?? null,
    createdPublished: source.createdPublished ?? null,
    creators: source.creators ?? null,
    url,
    rightsAndAccess: source.rightsAndAccess ?? source.rights ?? source.metadataAccess ?? null,
    verification: {
      status: 'VERIFIED',
      checkedOn: verification.checkedOn ?? source.checkedOn,
      method: verification.method ?? 'upstream verified-source record',
      linkStatus: source.linkCheck?.status ?? 'RESOLVED_UPSTREAM',
    },
    provenance: { inputSha: provenanceSha, path: provenancePath, sourceKey },
    quotationStored: false,
  }
}

const production = fromGit(INPUTS.production, INPUTS.production.path)
const staticRegistry = fromGit(INPUTS.staticSources, INPUTS.staticSources.registryPath)
const upstreamVerified = fromGit(INPUTS.staticSources, INPUTS.staticSources.verifiedPath)
const projection = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.projectionPath)
const dynamicContract = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.contractPath)
const era1Registry = fromGit(INPUTS.dynamicSources, INPUTS.dynamicSources.era1Path)
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

const requiredAttachmentFields = dynamicContract.evidenceMetadata.required.map(({ field }) => field)
const records = inputLessons.map((lesson) => {
  const projected = projectionByLesson.get(lesson.lessonId)
  if (!projected) throw new Error(`No source policy for ${lesson.lessonId}`)
  if (projected.sourceClass === 'UNRESOLVED') throw new Error(`Unresolved lesson: ${lesson.lessonId}`)

  const dynamic = projected.sourceClass === 'DYNAMIC_SOURCE_REQUIRED'
  const registryVerified = projected.sourceClass === 'STATIC_VERIFIED_SOURCE'
  if (!dynamic && !registryVerified && lesson.sourceIntegrityStatus !== 'VERIFIED') {
    throw new Error(`No static verification assertion for ${lesson.lessonId}`)
  }
  const anchorSourceKeys = projected.anchorSourceKeys ?? []
  for (const sourceKey of anchorSourceKeys) {
    if (!staticSources[sourceKey]) throw new Error(`Missing verified source ${sourceKey} for ${lesson.lessonId}`)
  }

  const packagePath = `curriculum-production/student-work/social-studies/grade-${lesson.lessonId.match(/^ma-g(\d+)/)?.[1]}/${lesson.courseId}/${lesson.lessonId}.md`
  const productionBlob = git('rev-parse', `${INPUTS.production.sha}:${packagePath}`)
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
          state: registryVerified ? 'VERIFIED_STATIC_METADATA' : 'PINNED_UPSTREAM_VERIFIED_ASSERTION',
          sourceKeys: anchorSourceKeys,
          inventedMetadataPermitted: false,
          quotedSourceTextStored: false,
          provenance: registryVerified
            ? anchorSourceKeys.map((sourceKey) => staticSources[sourceKey].provenance)
            : [{
                inputSha: INPUTS.production.sha,
                path: INPUTS.production.path,
                assertion: 'sourceIntegrityStatus=VERIFIED',
                independentlyRecheckedByFinalLane: false,
              }],
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
    note: 'Metadata is copied from the two pinned verified registries. No source body or quotation is included.',
  },
  totals: {
    staticSourceLessons: staticCount,
    registryVerifiedStaticLessons: records.filter((record) => record.sourceMetadataProvenance.state === 'VERIFIED_STATIC_METADATA').length,
    pinnedUpstreamVerifiedAssertionLessons: records.filter((record) => record.sourceMetadataProvenance.state === 'PINNED_UPSTREAM_VERIFIED_ASSERTION').length,
    referencedSourceRecords: new Set(records.flatMap((record) => record.sourceReadiness.anchorSourceKeys ?? [])).size,
    registrySourceRecords: Object.keys(staticSources).length,
    failedVerificationRecords: Object.values(staticSources).filter((source) => source.verification.status !== 'VERIFIED').length,
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

const manifest = {
  schemaVersion: 1,
  classification: 'FINAL_SOCIAL_PRODUCTION_READY',
  subject: 'social-studies',
  inputs: Object.fromEntries(Object.entries(INPUTS).map(([key, value]) => [key, { ref: value.ref, sha: value.sha }])),
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
  },
  invariants: {
    noInventedQuoteTitleOrUrl: true,
    noLongCopyrightedSourceText: true,
    tutorCannotWriteGradedArgument: true,
    dynamicLessonsGloballyProductionUnready: false,
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
    checksumManifest: 'checksums.sha256',
  },
}

writeJson(join(OUT, 'lesson-records.json'), records)
writeFileSync(join(OUT, 'lesson-records.jsonl'), records.map((record) => JSON.stringify(record)).join('\n') + '\n')
writeJson(join(OUT, 'verified-static-sources.json'), sourceRegistry)
writeJson(join(OUT, 'runtime-source-policy.json'), runtimePolicy)
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
