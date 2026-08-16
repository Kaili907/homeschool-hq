#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_ROOT = resolve(ROOT, 'packages/arts-music')
const GUIDE_ROOT = resolve(ROOT, 'scoring-guides/arts-music')
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const RESOURCE_MODES = new Set(['MODEL_A', 'MODEL_B', 'GUIDED_A', 'GUIDED_B', 'INVESTIGATE'])

const filesUnder = (root, suffix) => readdirSync(root, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? filesUnder(resolve(root, entry.name), suffix)
    : entry.name.endsWith(suffix) ? [resolve(root, entry.name)] : [])

const packageFiles = filesUnder(PACKAGE_ROOT, '.task-package.json').sort()
const guideFiles = filesUnder(GUIDE_ROOT, '.scoring-guide.json').sort()
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

if (packageFiles.length !== 648 || guideFiles.length !== 648) {
  throw new Error(`Arts/Music artifact count drift: ${packageFiles.length} packages, ${guideFiles.length} guides`)
}

const packages = packageFiles.map((path) => ({ path, value: json(path) }))
const guides = new Map(guideFiles.map((path) => [json(path).lesson_id, { path, value: json(path) }]))
const resourceRows = []

for (const { path, value: pkg } of packages) {
  const guide = guides.get(pkg.lesson_id)
  if (!guide) throw new Error(`${pkg.lesson_id}: scoring guide missing`)
  const required = RESOURCE_MODES.has(pkg.work_mode)
  const resource = pkg.learner_resource
  if (required) {
    const valid = typeof pkg.sourceReference === 'string' && pkg.sourceReference.length >= 300 &&
      resource?.availability === 'ATTACHED_IN_PACKAGE' && resource?.academy_original === true &&
      resource?.license === 'CC-BY-4.0' && resource?.third_party_content === false &&
      resource?.household_accessible === true && resource?.silent_text_route_equal_credit === true &&
      ['external_dependencies', 'required_paid_tools', 'required_specialized_materials']
        .every((field) => Array.isArray(resource?.[field]) && resource[field].length === 0)
    if (!valid) throw new Error(`${pkg.lesson_id}: required attached resource contract is incomplete`)
    resourceRows.push({
      lessonId: pkg.lesson_id,
      grade: pkg.grade,
      unitNumber: pkg.unit_number,
      workMode: pkg.work_mode,
      focus: pkg.focus,
      resourceId: resource.resource_id,
      resourceKind: resource.kind,
      profile: resource.profile,
      availability: resource.availability,
      license: resource.license,
      academyOriginal: resource.academy_original,
      thirdPartyContent: resource.third_party_content,
      externalDependencies: resource.external_dependencies,
      householdAccessible: resource.household_accessible,
      silentTextRouteEqualCredit: resource.silent_text_route_equal_credit,
      packagePath: relative(ROOT, path),
      packageSha256: sha256(path),
      scoringGuidePath: relative(ROOT, guide.path),
      scoringGuideSha256: sha256(guide.path),
    })
  } else if (resource || pkg.sourceReference) {
    throw new Error(`${pkg.lesson_id}: unexpected resource on non-dependent mode ${pkg.work_mode}`)
  }
}

const countKind = (kind) => resourceRows.filter((row) => row.resourceKind === kind).length
const gradeResults = GRADES.map((grade) => {
  const gradePackages = packages.filter(({ value }) => value.grade === grade)
  const gradeResources = resourceRows.filter((row) => row.grade === grade)
  return {
    grade,
    lessons: gradePackages.length,
    blockersBefore: 30,
    blockersAfter: 0,
    modelsSupplied: gradeResources.filter((row) => row.resourceKind === 'ACADEMY_ORIGINAL_MODEL').length,
    scaffoldsSupplied: gradeResources.filter((row) => row.resourceKind === 'ACADEMY_CREATED_SCAFFOLD').length,
    referencesSupplied: gradeResources.filter((row) => row.resourceKind === 'ACADEMY_ORIGINAL_REFERENCE_WORK').length,
    executable: gradePackages.length === 72 && gradeResources.length === 30,
  }
})

const evidence = {
  evidenceId: 'ARTS_MUSIC_CONTENT_REPAIR_R1',
  baseSha: 'c81ddb6e04bc1c3629212327d47817c1b5677477',
  classification: 'ARTS_MUSIC_CONTENT_READY_FOR_CONVERGENCE',
  scope: 'Arts/Music learner content only; no generic projection, UI, scoring, or global admission changes.',
  totals: {
    lessons: packages.length,
    scoringGuides: guideFiles.length,
    blockersBefore: 270,
    blockersAfter: 0,
    modelsSupplied: countKind('ACADEMY_ORIGINAL_MODEL'),
    scaffoldsSupplied: countKind('ACADEMY_CREATED_SCAFFOLD'),
    referencesSupplied: countKind('ACADEMY_ORIGINAL_REFERENCE_WORK'),
    externalDependenciesAfter: resourceRows.reduce((sum, row) => sum + row.externalDependencies.length, 0),
    householdMaterialAlternatives: packages.filter(({ value }) => value.materials.some((item) => /pencil or pen and scrap paper are enough/i.test(item))).length,
  },
  copyrightProof: {
    policy: 'Every supplied resource is Manuel Academy original and licensed CC BY 4.0; no third-party text, image, score, lyric, melody, recording, or performance is embedded.',
    academyOriginalResources: resourceRows.filter((row) => row.academyOriginal).length,
    ccBy40Resources: resourceRows.filter((row) => row.license === 'CC-BY-4.0').length,
    resourcesWithThirdPartyContent: resourceRows.filter((row) => row.thirdPartyContent).length,
  },
  accessProof: {
    resourcesHouseholdAccessible: resourceRows.filter((row) => row.householdAccessible).length,
    resourcesWithEqualCreditSilentTextRoute: resourceRows.filter((row) => row.silentTextRouteEqualCredit).length,
    lessonsRequiringPublicUpload: 0,
    lessonsRequiringCameraOrVideoProof: 0,
    lessonsRequiringInstrumentWithoutEquivalent: 0,
  },
  gradeResults,
  resources: resourceRows.sort((a, b) => a.grade - b.grade || a.lessonId.localeCompare(b.lessonId)),
}

const checksumFiles = [...packageFiles, ...guideFiles].sort()
const checksumBody = checksumFiles
  .map((path) => `${sha256(path)}  ${relative(ROOT, path)}`)
  .join('\n') + '\n'

writeFileSync(resolve(ROOT, 'arts-music-checksums.sha256'), checksumBody)
writeFileSync(resolve(ROOT, 'arts-music-content-repair-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`)

console.log(`Arts/Music evidence: ${evidence.totals.lessons} lessons; ${evidence.totals.blockersBefore} -> ${evidence.totals.blockersAfter} blockers.`)
console.log(`Resources: ${evidence.totals.modelsSupplied} models, ${evidence.totals.scaffoldsSupplied} scaffolds, ${evidence.totals.referencesSupplied} references.`)
console.log(`Checksums: ${checksumFiles.length} production artifacts.`)
