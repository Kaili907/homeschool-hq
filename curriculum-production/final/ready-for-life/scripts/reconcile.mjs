import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import {
  CORPUS_ROOT,
  EXPECTED_LESSONS_PER_GRADE,
  SUPPORTED_GRADES,
  buildDuplicateReport,
  buildProgressionReport,
  expectedLessonIds,
  gradeCounts,
  loadCorpusEntries,
  sha256,
  stableStringify,
  validateCorpus,
  walk,
} from './corpus.mjs'

const INPUTS = Object.freeze([
  {
    branch: 'mac/rfl-production-g3-r4',
    sha: 'cea2658af2693fdbce0c25f6d44dd0c76907d30b',
    grade: 3,
    roots: ['curriculum-production/student-work/ready-for-life-batches/grade-03'],
  },
  {
    branch: 'mac/rfl-production-g4-r4',
    sha: 'ca8fe7855cae5152a4d1e19b795c62639251c2ff',
    grade: 4,
    roots: [
      'curriculum-production/student-work/ready-for-life-batches/grade-04',
      'curriculum-production/student-work/ready-for-life-full',
    ],
  },
  {
    branch: 'mac/rfl-production-g5-r4',
    sha: '65ba10c31b1928bcf959e37a5d8f3a81f263e4bf',
    grade: 5,
    roots: ['curriculum-production/student-work/ready-for-life-batches/grade-05'],
  },
  {
    branch: 'mac/rfl-production-g7-r4',
    sha: '91f578a99a2d10e60116d22ccda6d31088a444ce',
    grade: 7,
    roots: ['curriculum-production/student-work/ready-for-life-full'],
  },
  {
    branch: 'mac/rfl-production-g8-r4',
    sha: '982a8d53854ad1ded53a2a319d33e05e512f7c86',
    grade: 8,
    roots: ['curriculum-production/student-work/ready-for-life-batches/grade-08'],
  },
  {
    branch: 'mac/rfl-production-g9-r4',
    sha: 'c9036e6865c671561045073efb6750782d7b8d84',
    grade: 9,
    roots: ['curriculum-production/student-work/ready-for-life-full'],
  },
  {
    branch: 'mac/rfl-production-g10-r4',
    sha: 'fbd3e2132303aa19e0e38dd0df2dca4285a3960a',
    grade: 10,
    roots: ['curriculum-production/student-work/ready-for-life-full'],
  },
  {
    branch: 'mac/rfl-production-g11-r4',
    sha: 'bad2ea1358ed2efcbe174854a1dd103562083c35',
    grade: 11,
    roots: ['curriculum-production/student-work/ready-for-life-full'],
  },
  {
    branch: 'mac/rfl-production-g12-r4',
    sha: '8f32d71698d45a270db093e6354e9b16c29a233e',
    grade: 12,
    roots: ['curriculum-production/student-work/ready-for-life-batches/grade-12'],
  },
])

const GATE_INPUT = Object.freeze({
  branch: 'mac/curriculum-production-gate-h3',
  sha: '49b3c4b86cc7764627bd4cfbd752222849831abf',
})

const GENERATED_DIRECTORIES = ['packages', 'scoring', 'schemas', 'projections', 'reports']
const EXPECTED_TOTAL = SUPPORTED_GRADES.length * EXPECTED_LESSONS_PER_GRADE

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trim()
}

function gitRaw(args) {
  return execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 })
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function readGitJson(sha, path) {
  const raw = gitRaw(['show', `${sha}:${path}`])
  return { raw, value: JSON.parse(raw.toString('utf8')) }
}

function sourceRootForPackage(path) {
  return path.slice(0, path.indexOf('/packages/'))
}

function semanticPackageHash(pkg) {
  const content = structuredClone(pkg)
  delete content.integrity
  return sha256(stableStringify(content))
}

function resolveInputs() {
  for (const input of [...INPUTS, GATE_INPUT]) {
    const actual = git(['rev-parse', input.branch])
    if (actual !== input.sha) throw new Error(`${input.branch} moved: expected ${input.sha}, found ${actual}`)
  }
}

function resetGeneratedArtifacts() {
  const expectedSuffix = 'curriculum-production/final/ready-for-life'
  if (!CORPUS_ROOT.endsWith(expectedSuffix)) throw new Error(`refusing generated cleanup outside ${expectedSuffix}`)
  for (const directory of GENERATED_DIRECTORIES) {
    const target = join(CORPUS_ROOT, directory)
    if (existsSync(target)) rmSync(target, { recursive: true })
    mkdirSync(target, { recursive: true })
  }
  for (const file of ['manifest.json', 'SHA256SUMS']) {
    const target = join(CORPUS_ROOT, file)
    if (existsSync(target)) rmSync(target)
  }
}

function sourceFiles(input) {
  return git(['ls-tree', '-r', '--name-only', input.sha, '--', 'curriculum-production'])
    .split('\n')
    .filter(Boolean)
}

function copySources() {
  const ledgerLessons = []
  const manifestLessons = []
  const schemaEvidence = []
  const branchRows = []
  let canonicalTaskSchema = null
  let canonicalScoringSchema = null

  for (const input of INPUTS) {
    const files = sourceFiles(input)
    const packagePaths = files.filter((path) => path.endsWith('.package.json') && path.includes('swk-rfl-'))
    const candidatesById = new Map()
    for (const path of packagePaths) {
      const source = readGitJson(input.sha, path)
      const pkg = source.value
      if (pkg.lessonRef?.grade !== input.grade || pkg.lessonRef?.subject !== 'ready-for-life') continue
      const id = pkg.integrity?.sourceLessonId ?? pkg.lessonRef.lessonId
      const sourceRoot = sourceRootForPackage(path)
      const scoringPath = `${sourceRoot}/${pkg.scoringRef}`
      if (!files.includes(scoringPath)) throw new Error(`${input.branch}:${path} points to missing ${scoringPath}`)
      const scoring = readGitJson(input.sha, scoringPath)
      const candidates = candidatesById.get(id) ?? []
      candidates.push({
        path,
        sourceRoot,
        packageRaw: source.raw,
        pkg,
        scoringPath,
        scoringRaw: scoring.raw,
        scoring: scoring.value,
        packageSha256: sha256(source.raw),
        scoringSha256: sha256(scoring.raw),
        packageSemanticSha256: semanticPackageHash(pkg),
        scoringSemanticSha256: sha256(stableStringify(scoring.value)),
      })
      candidatesById.set(id, candidates)
    }

    const selected = []
    for (const lessonId of expectedLessonIds(input.grade)) {
      const candidates = candidatesById.get(lessonId) ?? []
      let winner = null
      for (const root of input.roots) {
        winner = candidates.find((candidate) => candidate.path.startsWith(`${root}/packages/`))
        if (winner) break
      }
      if (!winner) throw new Error(`${input.branch} has no selected production package for ${lessonId}`)
      selected.push(winner)

      const gradeDirectory = `grade-${String(input.grade).padStart(2, '0')}${input.grade >= 9 ? '-hs' : ''}`
      if (!winner.pkg.scoringRef.startsWith('scoring/') || winner.pkg.scoringRef.includes('..')) {
        throw new Error(`${input.branch}:${winner.path} has unsafe scoringRef ${winner.pkg.scoringRef}`)
      }
      const packageRelativePath = `packages/ready-for-life/${gradeDirectory}/${winner.pkg.packageId}.package.json`
      const scoringRelativePath = winner.pkg.scoringRef
      const packageTarget = join(CORPUS_ROOT, packageRelativePath)
      const scoringTarget = join(CORPUS_ROOT, scoringRelativePath)
      mkdirSync(dirname(packageTarget), { recursive: true })
      mkdirSync(dirname(scoringTarget), { recursive: true })
      writeFileSync(packageTarget, winner.packageRaw)
      writeFileSync(scoringTarget, winner.scoringRaw)

      const discarded = candidates.filter((candidate) => candidate.path !== winner.path)
      ledgerLessons.push({
        lessonId,
        grade: input.grade,
        sourceBranch: input.branch,
        sourceSha: input.sha,
        selectedPackagePath: winner.path,
        selectedScoringPath: winner.scoringPath,
        canonicalPackagePath: packageRelativePath,
        canonicalScoringPath: scoringRelativePath,
        packageSha256: winner.packageSha256,
        scoringSha256: winner.scoringSha256,
        candidateResolution: {
          candidateCount: candidates.length,
          rule: 'Select the grade session authored root in configured order; retain compatibility mirrors only as provenance evidence.',
          discardedCandidates: discarded.map((candidate) => ({
            packagePath: candidate.path,
            scoringPath: candidate.scoringPath,
            packageSha256: candidate.packageSha256,
            scoringSha256: candidate.scoringSha256,
            packageContentEquivalent: candidate.packageSemanticSha256 === winner.packageSemanticSha256,
            scoringContentEquivalent: candidate.scoringSemanticSha256 === winner.scoringSemanticSha256,
          })),
        },
      })
      manifestLessons.push({
        lessonId,
        packageId: winner.pkg.packageId,
        courseId: winner.pkg.lessonRef.courseId,
        grade: input.grade,
        unitNumber: winner.pkg.lessonRef.unitNumber,
        dayInUnit: winner.pkg.lessonRef.dayInUnit,
        title: winner.pkg.lessonRef.title,
        completionAuthority: winner.pkg.completionAuthority,
        realWorldAction: winner.pkg.realWorldAction,
        fictionalSimulation: winner.pkg.isFictionalSimulation,
        packagePath: packageRelativePath,
        scoringPath: scoringRelativePath,
        packageSha256: winner.packageSha256,
        scoringSha256: winner.scoringSha256,
        sourceBranch: input.branch,
        sourceSha: input.sha,
      })
    }
    if (selected.length !== EXPECTED_LESSONS_PER_GRADE) throw new Error(`grade ${input.grade} selected ${selected.length} lessons`)
    branchRows.push({ branch: input.branch, sha: input.sha, grade: input.grade, selectedLessons: selected.length, authoredRootOrder: input.roots })

    const schemaRoot = input.roots[0]
    for (const [kind, filename] of [['task', 'task-sheet.schema.json'], ['scoring', 'scoring-record.schema.json']]) {
      const path = `${schemaRoot}/schema/${filename}`
      if (!files.includes(path)) throw new Error(`${input.branch} lacks ${path}`)
      const source = readGitJson(input.sha, path)
      const semantic = sha256(stableStringify(source.value))
      schemaEvidence.push({ branch: input.branch, sha: input.sha, grade: input.grade, kind, path, sha256: sha256(source.raw), semanticSha256: semantic })
      if (kind === 'task') {
        canonicalTaskSchema ??= source.raw
      } else {
        canonicalScoringSchema ??= source.raw
      }
    }
  }

  writeFileSync(join(CORPUS_ROOT, 'schemas/task-sheet.schema.json'), canonicalTaskSchema)
  writeFileSync(join(CORPUS_ROOT, 'schemas/scoring-record.schema.json'), canonicalScoringSchema)
  return { ledgerLessons, manifestLessons, schemaEvidence, branchRows }
}

function buildArtifacts(source) {
  const entries = loadCorpusEntries()
  const counts = gradeCounts(entries)
  const duplicateReport = buildDuplicateReport(entries)
  const progressionReport = buildProgressionReport(entries)
  const validationIssues = validateCorpus(entries)
  const guardianEntries = entries.filter((entry) => entry.pkg.completionAuthority === 'guardian')
  const learnerEntries = entries.filter((entry) => entry.pkg.completionAuthority === 'learner')

  const manifest = {
    schemaVersion: '1.0',
    corpusId: 'manuel-academy-ready-for-life-final-r1',
    classification: 'FINAL_RFL_PRODUCTION_READY',
    subject: 'ready-for-life',
    supportedGrades: SUPPORTED_GRADES,
    expectedLessonsPerGrade: EXPECTED_LESSONS_PER_GRADE,
    lessonCount: entries.length,
    gradeCounts: counts,
    packageCount: entries.length,
    scoringRecordCount: entries.length,
    schemas: {
      studentPackage: 'schemas/task-sheet.schema.json',
      adultScoringRecord: 'schemas/scoring-record.schema.json',
    },
    projections: {
      runtimeCatalog: 'projections/runtime-catalog.json',
      completionAuthority: 'projections/completion-authority.json',
    },
    reports: {
      sourceBranchLedger: 'reports/source-branch-ledger.json',
      gateH3: 'reports/gate-report.json',
      attestationRollup: 'reports/attestation-rollup.json',
      duplicateCheck: 'reports/duplicate-report.json',
      progression: 'reports/progression-report.json',
    },
    lessons: source.manifestLessons,
  }
  writeJson(join(CORPUS_ROOT, 'manifest.json'), manifest)

  writeJson(join(CORPUS_ROOT, 'reports/source-branch-ledger.json'), {
    schemaVersion: '1.0',
    reconciliationPolicy: 'Source lesson ID and authored content, never directory-tree union.',
    gateInput: GATE_INPUT,
    sourceBranches: source.branchRows,
    schemaEvidence: source.schemaEvidence,
    lessonCount: source.ledgerLessons.length,
    lessons: source.ledgerLessons,
  })

  writeJson(join(CORPUS_ROOT, 'projections/runtime-catalog.json'), {
    schemaVersion: '1.0',
    corpusId: manifest.corpusId,
    subject: 'ready-for-life',
    lessonCount: entries.length,
    lessons: source.manifestLessons.map((lesson) => ({
      lessonId: lesson.lessonId,
      packageId: lesson.packageId,
      courseId: lesson.courseId,
      grade: lesson.grade,
      unitNumber: lesson.unitNumber,
      dayInUnit: lesson.dayInUnit,
      title: lesson.title,
      studentPackagePath: lesson.packagePath,
      adultScoringRecordPath: lesson.scoringPath,
      completionAuthority: lesson.completionAuthority,
    })),
  })

  writeJson(join(CORPUS_ROOT, 'projections/completion-authority.json'), {
    schemaVersion: '1.0',
    learnerCompletionRule: 'A learner assertion certifies only learner-authority lessons.',
    guardianCompletionRule: 'A learner assertion records progress but cannot certify a guardian-authority lesson; a distinct adult attestation is required.',
    lessons: entries.map((entry) => ({
      lessonId: entry.pkg.lessonRef.lessonId,
      packageId: entry.pkg.packageId,
      completionAuthority: entry.pkg.completionAuthority,
      learnerAssertionCanCertify: entry.pkg.completionAuthority === 'learner',
      adultAttestationRequired: entry.pkg.completionAuthority === 'guardian',
      simulationAlternativeAvailable: Boolean(entry.pkg.simulationAlternative?.present),
      identifiablePhotoRequired: entry.pkg.signOff?.identifiablePhotoRequired ?? false,
    })),
  })

  const authorityByGrade = Object.fromEntries(SUPPORTED_GRADES.map((grade) => {
    const gradeEntries = entries.filter((entry) => entry.pkg.lessonRef.grade === grade)
    return [String(grade), {
      total: gradeEntries.length,
      guardian: gradeEntries.filter((entry) => entry.pkg.completionAuthority === 'guardian').length,
      learner: gradeEntries.filter((entry) => entry.pkg.completionAuthority === 'learner').length,
    }]
  }))
  writeJson(join(CORPUS_ROOT, 'reports/attestation-rollup.json'), {
    status: 'PASS',
    totalLessons: entries.length,
    guardianAuthorityCount: guardianEntries.length,
    learnerAuthorityCount: learnerEntries.length,
    byGrade: authorityByGrade,
    guardianLessonIds: guardianEntries.map((entry) => entry.pkg.lessonRef.lessonId),
    invariants: {
      guardianHasCorrectSignoff: guardianEntries.every((entry) => entry.pkg.signOff?.certifyingActor === 'household-authorized guardian' && entry.pkg.signOff?.studentSelfReport === 'recorded-but-not-certifying'),
      guardianHasSimulationAlternative: guardianEntries.every((entry) => entry.pkg.simulationAlternative?.present === true),
      learnerHasNoSignoff: learnerEntries.every((entry) => entry.pkg.signOff === null),
      noMediaProofRequired: entries.every((entry) => entry.pkg.signOff?.identifiablePhotoRequired !== true),
    },
  })
  writeJson(join(CORPUS_ROOT, 'reports/duplicate-report.json'), duplicateReport)
  writeJson(join(CORPUS_ROOT, 'reports/progression-report.json'), progressionReport)

  const coveragePass = entries.length === EXPECTED_TOTAL && SUPPORTED_GRADES.every((grade) => counts[String(grade)] === EXPECTED_LESSONS_PER_GRADE)
  const checks = {
    sourceCoverage: { status: coveragePass ? 'PASS' : 'FAIL', expected: EXPECTED_TOTAL, actual: entries.length, gradeCounts: counts },
    uniqueIdsAndNoOrphans: { status: validationIssues.some((item) => ['unique-source-lesson-id', 'unique-package-id', 'unique-scoring-record', 'orphan-scoring-record', 'package-scoring-link'].includes(item.rule)) ? 'FAIL' : 'PASS' },
    substantiveRubrics: { status: validationIssues.some((item) => item.rule === 'substantive-rubric') ? 'FAIL' : 'PASS' },
    noFakeAnswerKeys: { status: validationIssues.some((item) => ['no-answer-leakage', 'no-fake-answer-key'].includes(item.rule)) ? 'FAIL' : 'PASS' },
    privacy: { status: validationIssues.some((item) => ['household-access-privacy', 'privacy-sensitive-request'].includes(item.rule)) ? 'FAIL' : 'PASS' },
    noMediaProof: { status: validationIssues.some((item) => item.rule === 'no-media-proof') ? 'FAIL' : 'PASS' },
    equalCreditSimulation: { status: validationIssues.some((item) => item.rule === 'equal-credit-simulation') ? 'FAIL' : 'PASS' },
    completionAuthority: { status: validationIssues.some((item) => ['completion-authority-match', 'guardian-authority-shape', 'learner-authority-no-attestation'].includes(item.rule)) ? 'FAIL' : 'PASS' },
    progression: { status: progressionReport.status },
    duplicateCollapse: { status: duplicateReport.status },
  }
  writeJson(join(CORPUS_ROOT, 'reports/gate-report.json'), {
    schemaVersion: '1.0',
    corpusId: manifest.corpusId,
    status: Object.values(checks).every((check) => check.status === 'PASS') && validationIssues.length === 0 ? 'PASS' : 'FAIL',
    lessonCount: entries.length,
    gradeCounts: counts,
    checks,
    validationIssueCount: validationIssues.length,
    validationIssues,
    h3: null,
  })
}

function runH3AndRecord() {
  const testPath = join(CORPUS_ROOT, 'tests/gate-h3.test.ts')
  const configPath = join(CORPUS_ROOT, 'tooling/vitest.config.mts')
  execFileSync('npx', ['vitest', 'run', '--config', configPath, testPath, '--reporter=verbose'], {
    cwd: join(CORPUS_ROOT, '../../..'),
    env: { ...process.env, RFL_WRITE_GATE_REPORT: '1' },
    stdio: 'inherit',
  })
}

function writeChecksums() {
  const rows = walk(CORPUS_ROOT, (path) => !path.endsWith('/SHA256SUMS') && !path.includes('/.DS_Store') && !path.includes('/node_modules/'))
    .map((path) => `${sha256(readFileSync(path))}  ${relative(CORPUS_ROOT, path)}`)
    .sort()
  writeFileSync(join(CORPUS_ROOT, 'SHA256SUMS'), `${rows.join('\n')}\n`)
}

function verifyChecksums() {
  const checksumPath = join(CORPUS_ROOT, 'SHA256SUMS')
  const rows = readFileSync(checksumPath, 'utf8').trim().split('\n').filter(Boolean)
  const recorded = new Map(rows.map((row) => [row.slice(66), row.slice(0, 64)]))
  const actualFiles = walk(CORPUS_ROOT, (path) => path !== checksumPath && !path.includes('/.DS_Store') && !path.includes('/node_modules/'))
    .map((path) => relative(CORPUS_ROOT, path))
    .sort()
  if (recorded.size !== actualFiles.length) throw new Error(`checksum coverage mismatch: ${recorded.size} recorded, ${actualFiles.length} files`)
  for (const path of actualFiles) {
    const expected = recorded.get(path)
    const actual = sha256(readFileSync(join(CORPUS_ROOT, path)))
    if (!expected || expected !== actual) throw new Error(`checksum mismatch for ${path}`)
  }
}

function verify() {
  const entries = loadCorpusEntries()
  const manifest = JSON.parse(readFileSync(join(CORPUS_ROOT, 'manifest.json'), 'utf8'))
  const ledger = JSON.parse(readFileSync(join(CORPUS_ROOT, 'reports/source-branch-ledger.json'), 'utf8'))
  const gate = JSON.parse(readFileSync(join(CORPUS_ROOT, 'reports/gate-report.json'), 'utf8'))
  const attestation = JSON.parse(readFileSync(join(CORPUS_ROOT, 'reports/attestation-rollup.json'), 'utf8'))
  const duplicate = buildDuplicateReport(entries)
  const progression = buildProgressionReport(entries)
  const issues = validateCorpus(entries)
  const counts = gradeCounts(entries)

  if (entries.length !== EXPECTED_TOTAL || manifest.lessonCount !== EXPECTED_TOTAL || ledger.lessonCount !== EXPECTED_TOTAL) throw new Error('324-lesson coverage invariant failed')
  for (const grade of SUPPORTED_GRADES) if (counts[String(grade)] !== EXPECTED_LESSONS_PER_GRADE) throw new Error(`grade ${grade} does not contain 36 lessons`)
  if (issues.length) throw new Error(`corpus validation produced ${issues.length} issue(s): ${JSON.stringify(issues.slice(0, 5))}`)
  if (gate.status !== 'PASS' || gate.h3?.status !== 'READY' || gate.h3?.readyCount !== EXPECTED_TOTAL || gate.h3?.notReadyCount !== 0 || gate.h3?.needsHumanReviewCount !== 0) throw new Error('recorded Production Gate H3 result is not 324/324 READY')
  if (duplicate.status !== 'PASS' || progression.status !== 'PASS') throw new Error('duplicate/progression validation failed')
  if (attestation.guardianAuthorityCount + attestation.learnerAuthorityCount !== EXPECTED_TOTAL) throw new Error('attestation rollup does not cover all lessons')
  if (!attestation.invariants.guardianHasCorrectSignoff || !attestation.invariants.guardianHasSimulationAlternative || !attestation.invariants.learnerHasNoSignoff || !attestation.invariants.noMediaProofRequired) throw new Error('attestation invariant failed')
  for (const row of ledger.lessons) {
    const packageHash = sha256(readFileSync(join(CORPUS_ROOT, row.canonicalPackagePath)))
    const scoringHash = sha256(readFileSync(join(CORPUS_ROOT, row.canonicalScoringPath)))
    if (packageHash !== row.packageSha256 || scoringHash !== row.scoringSha256) throw new Error(`source preservation hash mismatch for ${row.lessonId}`)
  }
  verifyChecksums()
  return {
    status: 'PASS',
    lessons: entries.length,
    gradeCounts: counts,
    guardianAuthorityCount: attestation.guardianAuthorityCount,
    learnerAuthorityCount: attestation.learnerAuthorityCount,
    h3: `${gate.h3.readyCount}/${gate.h3.totalLessons} READY`,
    duplicateCheck: duplicate.status,
  }
}

function main() {
  const mode = process.argv[2]
  if (!['--write', '--verify'].includes(mode)) throw new Error('usage: reconcile.mjs --write|--verify')
  if (mode === '--write') {
    resolveInputs()
    resetGeneratedArtifacts()
    const source = copySources()
    buildArtifacts(source)
    runH3AndRecord()
    const reportPath = join(CORPUS_ROOT, 'reports/gate-report.json')
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    report.status = report.status === 'PASS' && report.h3?.status === 'READY' && report.h3?.readyCount === EXPECTED_TOTAL ? 'PASS' : 'FAIL'
    writeJson(reportPath, report)
    writeChecksums()
  }
  console.log(JSON.stringify(verify(), null, 2))
}

main()
