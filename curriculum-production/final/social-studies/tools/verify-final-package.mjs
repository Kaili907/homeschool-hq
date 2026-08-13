#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../../..')
const OUT = join(ROOT, 'curriculum-production/final/social-studies')
const readJson = (name) => JSON.parse(readFileSync(join(OUT, name), 'utf8'))
const fail = (message) => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }

const manifest = readJson('production-manifest.json')
const records = readJson('lesson-records.json')
const registry = readJson('verified-static-sources.json')
const policy = readJson('runtime-source-policy.json')
const gateH3 = readJson('gate-h3-report.json')
const jsonl = readFileSync(join(OUT, 'lesson-records.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)

assert(manifest.classification === 'FINAL_SOCIAL_PRODUCTION_READY', 'classification')
assert(records.length === 972 && jsonl.length === 972, '972/972 lesson records')
assert(new Set(records.map((record) => record.lessonId)).size === 972, 'unique lesson IDs')
assert(records.every((record) => record.productionPackage?.admittedInPackage), 'all packages admitted')
assert(records.every((record) => record.scoringAuthority?.authorityState === 'SCORABLE_CRITERIA_PRESENT'), 'all scoring authorities present')
assert(records.every((record) => record.scoringAuthority?.tutorMayWriteGradedArgument === false), 'tutor boundary')
assert(records.every((record) => record.sourceReadiness?.policy && record.sourceMetadataProvenance?.state), 'source policy/provenance complete')
assert(records.filter((record) => record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE').length === 960, '960 static lessons')
const dynamic = records.filter((record) => record.sourceReadiness.policy === 'DYNAMIC_SOURCE_REQUIRED')
assert(dynamic.length === 12, '12 dynamic lessons')
assert(dynamic.every((record) => record.lessonId.startsWith('ma-g3-social-studies-u09-')), 'dynamic scope')
assert(dynamic.every((record) => record.sourceReadiness.runtimeState === 'PENDING_SOURCE_ATTACHMENT'), 'dynamic pending state')
assert(dynamic.every((record) => record.sourceReadiness.packageAdmission === 'ADMITTED'), 'dynamic package admission')
assert(dynamic.every((record) => record.sourceReadiness.lessonLaunch === 'DISABLED' && record.sourceReadiness.scoring === 'DISABLED'), 'dynamic runtime hold')
assert(records.every((record) => record.sourceReadiness.policy !== 'UNRESOLVED'), 'zero unresolved')
assert(records.filter((record) => record.lessonId.startsWith('ma-g7-social-studies-u02-')).every((record) => record.sourceReadiness.policy === 'STATIC_VERIFIED_SOURCE'), 'Grade 7 Era 1 static')
assert(Object.values(registry.sources).every((source) => source.title && source.url && source.verification.status === 'VERIFIED'), 'verified registry metadata')
assert(Object.values(registry.sources).every((source) => source.quotationStored === false), 'no source text')
assert(Object.keys(registry.lessonCoverage).length === 960, 'static lesson registry coverage')
assert(registry.totals.registryVerifiedStaticLessons === 528, 'registry-verified coverage')
assert(registry.totals.pinnedUpstreamVerifiedAssertionLessons === 432, 'pinned upstream assertion coverage')
assert(policy.dynamicContract.noInvention && policy.emptyAttachmentTemplate, 'dynamic metadata contract')
assert(policy.packageAdmission.dynamicLessonsGloballyProductionUnready === false, 'dynamic global readiness policy')
assert(gateH3.totals.ready === 960 && gateH3.totals.needsHumanReview === 12 && gateH3.totals.notReady === 0, 'H3 standard result')
assert(gateH3.admissionOverlay.productionPackagesAdmitted === 972 && gateH3.admissionOverlay.unresolvedWithoutPolicy === 0, 'H3 admission overlay')

for (const record of records) {
  const blob = execFileSync('git', ['rev-parse', `${record.productionPackage.inputSha}:${record.productionPackage.path}`], { cwd: ROOT, encoding: 'utf8' }).trim()
  assert(blob === record.productionPackage.gitBlobSha1, `package checksum ${record.lessonId}`)
}

for (const line of readFileSync(join(OUT, 'checksums.sha256'), 'utf8').trim().split('\n')) {
  const [expected, name] = line.split(/\s{2}/)
  const actual = createHash('sha256').update(readFileSync(join(OUT, name))).digest('hex')
  assert(actual === expected, `checksum ${name}`)
}

console.log('PASS: FINAL_SOCIAL_PRODUCTION_READY')
console.log('PASS: 972/972 packages, scoring authorities, source policies, and provenance states')
console.log('PASS: 960 STATIC_VERIFIED_SOURCE; 12 DYNAMIC_SOURCE_REQUIRED/PENDING_SOURCE_ATTACHMENT')
console.log('PASS: Production Gate H3 admission overlay; 0 unresolved-without-policy')
console.log('PASS: package blobs and artifact SHA-256 checksums')
