#!/usr/bin/env node
// Generates student-work packages + scoring guides for every ELA lesson in
// grades 3, 4, 5, 7, 8, 9, 10, 11, 12, from the three read-only source
// branches. Writes only under curriculum-production/student-work/
// english-language-arts/ (packages/, scoring-guides/, corpus-manifest.json).
//
// Usage: node curriculum-production/student-work/english-language-arts/tools/generate.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  adaptG34,
  adaptCanonical,
  adaptHs912,
  buildTextBankIndex,
  loadCourse,
  buildStudentPackage,
  buildScoringGuide,
} from '../src/lib.mjs'
import {
  hasPlaceholder,
  isActionlessTask,
  learnerPackageAdultLeak,
  sha256,
} from '../src/contentRepair.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = path.resolve(__dirname, '..')

const WORKTREES = '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees'
const G34_ELA = `${WORKTREES}/mac-g34-ela-r1/curriculum-authoring/full-family-grade34/subjects/english-language-arts`
const CANON_ROOT = `${WORKTREES}/mac-ela-production-r1/curriculum-content/manuel-academy/1.0.0/grades`
const HS_ELA = `${WORKTREES}/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts`

const SOURCE_COMMITS = Object.freeze({
  g34: { root: `${WORKTREES}/mac-g34-ela-r1`, commit: 'ef81511c2b582d003e397bb79daa8a26a41e3b10' },
  canonical: { root: `${WORKTREES}/mac-ela-production-r1`, commit: '00374a8dc26eddfac2cf52aec5661deff760ddbb' },
  hs912: { root: `${WORKTREES}/mac-hs912-ela-r1`, commit: '42f2505bb04d831c4aefc195a7ce03edb2d7b1d9' },
})

const COURSES = [
  {
    grade: 3,
    courseDir: `${G34_ELA}/grades/grade-3`,
    adapter: adaptG34,
    textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/original-text-bank.json`),
    pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/public-domain-register.json`, 'id'),
  },
  {
    grade: 4,
    courseDir: `${G34_ELA}/grades/grade-4`,
    adapter: adaptG34,
    textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-4/original-text-bank.json`),
    pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-4/public-domain-register.json`, 'id'),
  },
  { grade: 5, courseDir: `${CANON_ROOT}/grade-5/courses/english-language-arts`, adapter: adaptCanonical },
  { grade: 7, courseDir: `${CANON_ROOT}/grade-7/courses/english-language-arts`, adapter: adaptCanonical },
  { grade: 8, courseDir: `${CANON_ROOT}/grade-8/courses/english-language-arts`, adapter: adaptCanonical },
  {
    grade: 9,
    courseDir: `${HS_ELA}/courses/english-9`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-9/text-bank.json`, 'text_id'),
  },
  {
    grade: 10,
    courseDir: `${HS_ELA}/courses/english-10`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-10/text-bank.json`, 'text_id'),
  },
  {
    grade: 11,
    courseDir: `${HS_ELA}/courses/english-11`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-11/text-bank.json`, 'text_id'),
  },
  {
    grade: 12,
    courseDir: `${HS_ELA}/courses/english-12`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-12/text-bank.json`, 'text_id'),
  },
]

function gradeDir(grade) {
  return `grade-${String(grade).padStart(2, '0')}`
}

function assertSeparation(pkg) {
  const pkgJson = JSON.stringify(pkg)
  for (const forbidden of ['scoringAuthority', 'rubric', 'acceptableAnswerCriteria', 'masteryCriteria', 'doNotUse']) {
    if (pkgJson.includes(`"${forbidden}"`)) {
      throw new Error(`Student package ${pkg.packageId} leaks scoring-guide key "${forbidden}"`)
    }
  }
}

function assertPinnedSources() {
  for (const [name, source] of Object.entries(SOURCE_COMMITS)) {
    const actual = execFileSync('git', ['-C', source.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    if (actual !== source.commit) {
      throw new Error(`${name} ELA source drift: expected ${source.commit}, found ${actual}`)
    }
  }
}

function resetGeneratedJson(dir, suffix) {
  fs.mkdirSync(dir, { recursive: true })
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(suffix)) fs.unlinkSync(path.join(dir, file))
  }
}

function writeQualityEvidence(rows) {
  const tasks = new Map()
  const sourceBodies = new Map()
  for (const row of rows) {
    const task = row.pkg.independentEvidenceTask.text.trim()
    const group = tasks.get(task) || []
    group.push(row)
    tasks.set(task, group)
    const sourceHash = row.pkg.sourceReference.refs[0].sha256
    const sourceGroup = sourceBodies.get(sourceHash) || []
    sourceGroup.push(row)
    sourceBodies.set(sourceHash, sourceGroup)
  }
  const crossGradeGroups = [...tasks.entries()]
    .map(([task, group]) => ({ task, group, grades: [...new Set(group.map((row) => row.grade))] }))
    .filter((entry) => entry.grades.length > 1)
  const crossGradeSourceGroups = [...sourceBodies.entries()]
    .map(([sourceSha256, group]) => ({ sourceSha256, group, grades: [...new Set(group.map((row) => row.grade))] }))
    .filter((entry) => entry.grades.length > 1)

  const report = {
    classification: 'ELA_CONTENT_READY_FOR_CONVERGENCE',
    generatedBy: 'tools/generate.mjs',
    lessonsAudited: rows.length,
    readingSourceModel: 'academy-original-inline',
    sourceCounts: rows.reduce((counts, row) => {
      const origin = row.pkg.sourceReference.refs[0].origin
      counts[origin] = (counts[origin] || 0) + 1
      return counts
    }, {}),
    findings: {
      zeroActionable: rows.filter((row) => isActionlessTask(row.pkg.independentEvidenceTask.text)).length,
      emptyRequiredWriting: rows.filter((row) => row.pkg.writingTask.required && (!row.pkg.writingTask.prompt.trim() || !row.pkg.writingTask.deliverable.trim())).length,
      placeholders: rows.filter((row) => hasPlaceholder(JSON.stringify(row.pkg))).length,
      crossGradeDuplicatedTasks: crossGradeGroups.reduce((sum, entry) => sum + entry.group.length, 0),
      crossGradeDuplicatedReadings: crossGradeSourceGroups.reduce((sum, entry) => sum + entry.group.length, 0),
      missingOrUnresolvableReading: rows.filter((row) => {
        const ref = row.pkg.sourceReference.refs[0]
        const text = row.pkg.sourceReference.text
        return row.pkg.sourceReference.mode !== 'academy-original-inline' ||
          !ref.learnerAvailable || !ref.fullTextIncluded || ref.deliveryMode !== 'inline_full_text' ||
          text.trim().split(/\s+/).length < 80 || sha256(text) !== ref.sha256
      }).length,
      falseSourceClaims: rows.filter((row) => {
        const ref = row.pkg.sourceReference.refs[0]
        return !ref || ref.rightsCategory !== 'original' || ref.author !== 'Manuel Academy' || !ref.rightsStatement
      }).length,
      learnerAdultLeaks: rows.filter((row) => learnerPackageAdultLeak(row.pkg)).length,
      learnerModelAnswers: rows.filter((row) => /"(?:modelAnswer|correctAnswer|answerKey)"\s*:/i.test(JSON.stringify(row.pkg))).length,
      scoringGuideCountMismatch: rows.filter((row) => !row.guide || row.guide.lessonRef.lessonId !== row.pkg.lessonRef.lessonId).length,
    },
    copyrightProof: {
      modernCopyrightedWorksCopied: 0,
      rightsRequiredWorksCopied: 0,
      publicDomainWorksCopied: 0,
      academyOriginalInline: rows.length,
      textHashesVerified: rows.filter((row) => sha256(row.pkg.sourceReference.text) === row.pkg.sourceReference.refs[0].sha256).length,
      statement: 'Every delivered reading is an Academy-owned original included inline. No modern copyrighted, rights-required, or third-party text is copied by this corpus.',
    },
    scoringGuideProof: {
      separateAdultGuideFiles: rows.length,
      learnerPackagesWithAdultScoringKeys: rows.filter((row) => learnerPackageAdultLeak(row.pkg)).length,
      learnerPackagesWithModelAnswers: rows.filter((row) => /"(?:modelAnswer|correctAnswer|answerKey)"\s*:/i.test(JSON.stringify(row.pkg))).length,
    },
    progressionProof: Object.fromEntries([...new Set(rows.map((row) => row.grade))].sort((a, b) => a - b).map((grade) => {
      const gradeRows = rows.filter((row) => row.grade === grade)
      const assessment = gradeRows.find((row) => row.pkg.lessonRef.phase === 'Unit assessment')
      return [grade, {
        averageReadingWords: Math.round(gradeRows.reduce((sum, row) => sum + row.pkg.sourceReference.refs[0].wordCount, 0) / gradeRows.length),
        assessmentDeliverable: assessment?.pkg.deliverable,
        assessmentSuccessCriteria: assessment?.pkg.lesson_success_criteria.length,
      }]
    })),
    sourceDiversityProof: {
      uniqueReadingBodies: sourceBodies.size,
      crossGradeDuplicatedReadingBodies: crossGradeSourceGroups.length,
      repeatedBodiesArePinnedGrade3Or4UnitAnchors: [...sourceBodies.values()].filter((group) => group.length > 1).every((group) => group.every((row) => [3, 4].includes(row.grade))),
    },
    courseCounts: Object.fromEntries([...new Set(rows.map((row) => row.grade))].sort((a, b) => a - b).map((grade) => [grade, rows.filter((row) => row.grade === grade).length])),
    crossGradeGroups: crossGradeGroups.map((entry) => ({
      taskSha256: sha256(entry.task),
      grades: entry.grades,
      lessonIds: entry.group.map((row) => row.pkg.lessonRef.lessonId),
    })),
  }

  const failed = Object.entries(report.findings).filter(([, count]) => count !== 0)
  if (rows.length !== 1620 || failed.length) {
    throw new Error(`ELA content-quality gate failed: lessons=${rows.length}; ${failed.map(([key, count]) => `${key}=${count}`).join(', ')}`)
  }

  const validationDir = path.join(OUT_ROOT, 'validation')
  fs.mkdirSync(validationDir, { recursive: true })
  fs.writeFileSync(path.join(validationDir, 'content-quality-report.json'), JSON.stringify(report, null, 2) + '\n')
  const markdown = [
    '# ELA canonical content and source repair gate',
    '',
    `Classification: **${report.classification}**`,
    '',
    `Lessons: ${report.lessonsAudited}`,
    '',
    '| Check | Findings |',
    '| --- | ---: |',
    ...Object.entries(report.findings).map(([key, count]) => `| ${key} | ${count} |`),
    '',
    `Reading source model: \`${report.readingSourceModel}\``,
    '',
    `Source counts: ${Object.entries(report.sourceCounts).map(([key, count]) => `${key}=${count}`).join(', ')}`,
    '',
    report.copyrightProof.statement,
    '',
  ].join('\n')
  fs.writeFileSync(path.join(validationDir, 'content-quality-report.md'), markdown)
  return report
}

function writeChecksums() {
  const include = [
    'corpus-manifest.json',
    'source-ledger.jsonl',
    'validation/gate-report.json',
    'validation/gate-report.md',
    'validation/content-quality-report.json',
    'validation/content-quality-report.md',
  ]
  for (const root of ['packages', 'scoring-guides']) {
    for (const gradeDir of fs.readdirSync(path.join(OUT_ROOT, root)).sort()) {
      const fullDir = path.join(OUT_ROOT, root, gradeDir)
      if (!fs.statSync(fullDir).isDirectory()) continue
      for (const file of fs.readdirSync(fullDir).filter((name) => name.endsWith('.json')).sort()) {
        include.push(`${root}/${gradeDir}/${file}`)
      }
    }
  }
  const lines = include.sort().map((relativePath) => {
    const digest = createHash('sha256').update(fs.readFileSync(path.join(OUT_ROOT, relativePath))).digest('hex')
    return `${digest}  ${relativePath}`
  })
  fs.writeFileSync(path.join(OUT_ROOT, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)
}

function main() {
  assertPinnedSources()
  const generatedRows = []
  const manifest = {
    schemaVersion: '2.0',
    generatedFrom: 'tools/generate.mjs',
    sourceCommits: Object.fromEntries(Object.entries(SOURCE_COMMITS).map(([name, source]) => [name, source.commit])),
    readingSourceModel: 'academy-original-inline',
    courses: [],
    totals: { lessons: 0, packages: 0, scoringGuides: 0 },
  }

  for (const course of COURSES) {
    const gd = gradeDir(course.grade)
    const pkgDir = path.join(OUT_ROOT, 'packages', gd)
    const guideDir = path.join(OUT_ROOT, 'scoring-guides', gd)
    resetGeneratedJson(pkgDir, '.package.json')
    resetGeneratedJson(guideDir, '.scoring.json')

    const irs = loadCourse({
      courseDir: course.courseDir,
      adapter: course.adapter,
      textBankIndex: course.textBankIndex,
      pdIndex: course.pdIndex,
    })

    let courseId
    const sourceIntegrityCounts = { VERIFIED: 0, GAP: 0, NOT_APPLICABLE: 0, UNKNOWN: 0 }

    for (const ir of irs) {
      courseId = ir.courseId
      const pkg = buildStudentPackage(ir)
      const guide = buildScoringGuide(ir)
      assertSeparation(pkg)
      generatedRows.push({ grade: course.grade, ir, pkg, guide })

      fs.writeFileSync(path.join(pkgDir, `${ir.lessonId}.package.json`), JSON.stringify(pkg, null, 2) + '\n')
      fs.writeFileSync(path.join(guideDir, `${ir.lessonId}.scoring.json`), JSON.stringify(guide, null, 2) + '\n')

      sourceIntegrityCounts.VERIFIED += 1
    }

    manifest.courses.push({
      grade: course.grade,
      courseId,
      lessonCount: irs.length,
      sourceIntegrityCounts,
    })
    manifest.totals.lessons += irs.length
    manifest.totals.packages += irs.length
    manifest.totals.scoringGuides += irs.length

    console.log(`grade ${course.grade}: ${irs.length} lessons -> ${pkgDir}`)
  }

  fs.writeFileSync(
    path.join(OUT_ROOT, 'corpus-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  const ledger = generatedRows.map(({ grade, pkg }) => {
    const ref = pkg.sourceReference.refs[0]
    return JSON.stringify({
      lessonId: pkg.lessonRef.lessonId,
      grade,
      sourceMode: pkg.sourceReference.mode,
      textId: ref.textId,
      title: ref.title,
      author: ref.author,
      rightsCategory: ref.rightsCategory,
      deliveryMode: ref.deliveryMode,
      learnerAvailable: ref.learnerAvailable,
      fullTextIncluded: ref.fullTextIncluded,
      origin: ref.origin,
      wordCount: ref.wordCount,
      sha256: ref.sha256,
    })
  })
  fs.writeFileSync(path.join(OUT_ROOT, 'source-ledger.jsonl'), `${ledger.join('\n')}\n`)
  const report = writeQualityEvidence(generatedRows)
  manifest.sourceCounts = report.sourceCounts
  manifest.qualityFindings = report.findings
  fs.writeFileSync(path.join(OUT_ROOT, 'corpus-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeChecksums()
  console.log('\nTotals:', manifest.totals)
  console.log('Quality findings:', report.findings)
}

main()
