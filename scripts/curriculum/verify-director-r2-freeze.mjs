import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const manifestRelativePath = 'curriculum/approvals/director-samples-r2-approved.json'
const manifest = JSON.parse(readFileSync(resolve(repoRoot, manifestRelativePath), 'utf8'))
const expectedGrades = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const expectedSubjects = ['Mathematics', 'ELA', 'Science', 'Social Studies']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(resolve(repoRoot, relativePath))).digest('hex')
}

assert(manifest.sampleCount === 36, `Expected sampleCount 36, got ${manifest.sampleCount}.`)
assert(manifest.samples.length === 36, `Expected 36 manifest entries, got ${manifest.samples.length}.`)
assert(manifest.subjectCount === 4, `Expected subjectCount 4, got ${manifest.subjectCount}.`)
assert(JSON.stringify(manifest.subjects) === JSON.stringify(expectedSubjects), 'Subject list does not match the approved scope.')
assert(JSON.stringify(manifest.grades) === JSON.stringify(expectedGrades), 'Grade list does not match the approved scope.')
assert(manifest.grade6Present === false && manifest.grade6Excluded === true, 'Grade 6 must be absent and explicitly excluded.')
assert(manifest.approvalStatus === 'DIRECTOR_APPROVED_FOR_PRODUCTION', 'Manifest approval status is not frozen.')

const ids = new Set()
const paths = []
for (const sample of manifest.samples) {
  assert(!ids.has(sample.sampleId), `Duplicate sample identifier: ${sample.sampleId}.`)
  ids.add(sample.sampleId)
  assert(expectedSubjects.includes(sample.subject), `Unsupported subject in ${sample.sampleId}.`)
  assert(expectedGrades.includes(sample.grade) && sample.grade !== 6, `Unsupported grade in ${sample.sampleId}.`)
  assert(sample.richPlayerCompatible === true, `${sample.sampleId} is not Rich Player compatible.`)
  assert(sample.legacyFallbackRequired === false, `${sample.sampleId} requires legacy fallback.`)
  assert(sample.approvalStatus === 'DIRECTOR_APPROVED_FOR_PRODUCTION', `${sample.sampleId} is not Director-approved.`)
  const actual = sha256(sample.samplePath)
  assert(actual === sample.contentHash, `Content hash mismatch for ${sample.samplePath}: ${actual} != ${sample.contentHash}.`)
  paths.push(sample.samplePath)
}

console.log(`manifest: ${manifestRelativePath}`)
console.log('sample count: 36')
console.log('subject count: 4')
console.log('grades: 3,4,5,7,8,9,10,11,12')
console.log('grade 6: absent')
console.log('legacy fallback: 0')
console.log('content hashes: 36 matched')

const baseRef = process.argv[2]
if (baseRef) {
  const diffStat = execFileSync('git', ['diff', '--stat', baseRef, '--', ...paths], { cwd: repoRoot, encoding: 'utf8' })
  assert(diffStat.trim() === '', `Lesson-substance diff is not empty:\n${diffStat}`)
  console.log(`git diff --stat ${baseRef} -- sample paths: empty`)
}

console.log('DIRECTOR_R2_FREEZE_VERIFIED')
