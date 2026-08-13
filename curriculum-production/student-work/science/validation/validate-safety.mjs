/**
 * Safety gate for the Science student-work packages.
 *
 *   node curriculum-production/student-work/science/validation/validate-safety.mjs
 *
 * Loads every package, its rendered sheets, and the pinned source lesson it was
 * built from, then runs `checks.mjs`. Exits non-zero if any check reports a
 * problem. `--json` prints the report instead of writing it, which is how
 * `mutation-test.mjs` drives it.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHECKS } from './checks.mjs'
import {
  ROOT,
  loadAllPackages,
  loadCorrectnessKeys,
  loadManifest,
  loadSafetyFloor,
  loadSharedBlocks,
  readPinnedSource,
  scoringSheet,
  studentSheet,
} from './packages.mjs'

export function runSafetyGate(overrides = {}) {
  const manifest = overrides.manifest ?? loadManifest()
  const floor = overrides.floor ?? loadSafetyFloor()
  const blocks = overrides.blocks ?? loadSharedBlocks()
  const allPackages = overrides.packages ?? loadAllPackages()
  const correctness = overrides.correctness ?? loadCorrectnessKeys()

  const sheets = new Map()
  const scoring = new Map()
  for (const pkg of allPackages) {
    sheets.set(pkg.lesson_id, pkg.__sheet ?? studentSheet(pkg))
    scoring.set(pkg.lesson_id, pkg.__scoring ?? scoringSheet(pkg))
  }

  // Pinned source lessons, read straight from git rather than from the build.
  const sources = new Map()
  const loaded = new Set()
  for (const pkg of allPackages) {
    const key = `${pkg.source.commit}:${pkg.source.path}`
    if (loaded.has(key)) continue
    loaded.add(key)
    for (const line of readPinnedSource(pkg.source.commit, pkg.source.path).split('\n')) {
      if (!line.trim()) continue
      const record = JSON.parse(line)
      sources.set(record.lesson_id, record)
    }
  }

  const context = {
    packages: allPackages,
    sheets,
    scoring,
    sources,
    floor,
    blocks,
    manifest,
    correctness,
  }
  const results = CHECKS.map((check) => {
    const problems = check.run(context)
    return {
      id: check.id,
      description: check.description,
      status: problems.length === 0 ? 'PASS' : 'FAIL',
      problemCount: problems.length,
      problems: problems.slice(0, 10),
    }
  })

  const failed = results.filter((result) => result.status === 'FAIL')
  return {
    gate: 'science student-work safety gate',
    totalLessons: allPackages.length,
    checks: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    results,
  }
}

const isMain = process.argv[1]?.endsWith('validate-safety.mjs')
if (isMain) {
  const report = runSafetyGate()
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    writeFileSync(
      join(ROOT, 'reports/safety-gate.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )
    const lines = [
      '# Safety gate — Science student work',
      '',
      `${report.totalLessons} lessons · ${report.checks} checks · **${report.status}** ` +
        `(${report.passed} passed, ${report.failed} failed)`,
      '',
      '| Check | Status | Problems |',
      '| --- | --- | --- |',
      ...report.results.map(
        (result) => `| \`${result.id}\` | ${result.status} | ${result.problemCount} |`,
      ),
      '',
      '## What each check proves',
      '',
      ...report.results.map((result) => `- \`${result.id}\` — ${result.description}`),
      '',
    ]
    for (const result of report.results.filter((entry) => entry.status === 'FAIL')) {
      lines.push(`## FAIL — \`${result.id}\``, '')
      for (const problem of result.problems) lines.push(`- ${problem}`)
      if (result.problemCount > result.problems.length) {
        lines.push(`- …and ${result.problemCount - result.problems.length} more`)
      }
      lines.push('')
    }
    writeFileSync(join(ROOT, 'reports/safety-gate.md'), lines.join('\n'), 'utf8')
    console.log(
      `safety gate: ${report.status} — ${report.passed}/${report.checks} checks over ` +
        `${report.totalLessons} lessons`,
    )
  }
  process.exit(report.status === 'PASS' ? 0 : 1)
}
