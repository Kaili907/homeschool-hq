import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const surfacePath = resolve(root, 'src/components/study/studySessionSurface.tsx')
const seamPath = resolve(root, 'src/components/study/productionTutorSeam.ts')
const launchPath = resolve(root, 'src/study/production/tutorLaunchOrdering.ts')
const authorityTests = [
  'src/study/production/hostResultAcceptance.integration.test.tsx',
  'src/study/production/productionImportBoundary.test.ts',
]

function replaceExact(text, search, replacement, expected = 1) {
  const count = text.split(search).length - 1
  if (count !== expected) throw new Error(`expected ${expected} match(es), found ${count}: ${search.slice(0, 80)}`)
  return text.split(search).join(replacement)
}

function replacePattern(text, pattern, replacement, expected = 1) {
  let count = 0
  const result = text.replace(pattern, (...args) => {
    count += 1
    return typeof replacement === 'function' ? replacement(...args) : replacement
  })
  if (count !== expected) throw new Error(`expected ${expected} pattern match(es), found ${count}: ${pattern}`)
  return result
}

function mapTokenAsserts(text, mapper, expected = 3) {
  let count = 0
  const result = text.replace(/          token\.assertCurrent\(\)\r?\n/g, (match) => {
    count += 1
    return mapper(count, match)
  })
  if (count !== expected) throw new Error(`expected ${expected} stopped-branch token assertions, found ${count}`)
  return result
}

function stoppedBranch(source, transform) {
  const start = source.indexOf("        if (result.status === 'stopped')")
  const end = source.indexOf("        if (result.status === 'quarantined')", start)
  if (start < 0 || end < 0) throw new Error('stopped branch not found')
  return source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end)
}

const mutants = [
  {
    id: 'M1',
    label: 'remove post-lock originating-token check',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => mapTokenAsserts(
      branch,
      (index, match) => index === 1 ? '' : match,
    )),
  },
  {
    id: 'M2',
    label: 'reacquire fresh lifecycle token after await',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = mapTokenAsserts(branch, () => '          lifecycle.token().assertCurrent()\n')
      changed = replaceExact(changed, 'runCurrentStudyWork(token,', 'runCurrentStudyWork(lifecycle.token(),')
      return replaceExact(changed, "cancelIfCurrent(token, 'safety-stop')", "cancelIfCurrent(lifecycle.token(), 'safety-stop')")
    }),
  },
  {
    id: 'M3',
    label: 'use learnerRef equality instead of epoch authority',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = mapTokenAsserts(branch, (index) => index === 1
        ? "          const stopAuthority = token.binding.learnerRef === lifecycle.token().binding.learnerRef\n            ? lifecycle.token()\n            : token\n          stopAuthority.assertCurrent()\n"
        : '          stopAuthority.assertCurrent()\n')
      changed = replaceExact(changed, 'runCurrentStudyWork(token,', 'runCurrentStudyWork(stopAuthority,')
      return replaceExact(changed, "cancelIfCurrent(token, 'safety-stop')", "cancelIfCurrent(stopAuthority, 'safety-stop')")
    }),
  },
  {
    id: 'M4',
    label: 'restore unconditional lifecycle cancellation',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => replaceExact(
      branch,
      "lifecycle.cancelIfCurrent(token, 'safety-stop')",
      "lifecycle.cancel('safety-stop')",
    )),
  },
  {
    id: 'M5',
    label: 'swallow stale append error then continue cancellation',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = mapTokenAsserts(branch, (index, match) => index === 1 ? match : '')
      return replaceExact(changed, "lifecycle.cancelIfCurrent(token, 'safety-stop')", "lifecycle.cancel('safety-stop')")
    }),
  },
  {
    id: 'M6',
    label: 'move authority check before await only',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = mapTokenAsserts(branch, () => '')
      changed = replaceExact(
        changed,
        '          await recordLocalSessionSafetyStop({',
        '          token.assertCurrent()\n          await recordLocalSessionSafetyStop({',
      )
      return changed
    }),
  },
  {
    id: 'M7',
    label: 'cancel current lifecycle when originating token is stale',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => mapTokenAsserts(
      branch,
      (index, match) => index === 2 ? "          lifecycle.cancel('safety-stop')\n" : match,
    )),
  },
  {
    id: 'M8',
    label: 'remove positive safety-stop cancellation',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => replacePattern(
      branch,
      /          lifecycle\.cancelIfCurrent\(token, 'safety-stop'\)\r?\n/,
      '',
    )),
  },
  {
    id: 'M9',
    label: 'let stale Epoch A append a safety event after Epoch B becomes current',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = replaceExact(
        branch,
        'await runCurrentStudyWork(token, () => (ports as StudyPortBundle).eventLedger.append(scope, {',
        'await (ports as StudyPortBundle).eventLedger.append(scope, {',
      )
      return replacePattern(
        changed,
        /            \}\)\)\r?\n          \} catch/,
        (match) => match.replace('}))', '})'),
      )
    }),
  },
  {
    id: 'M10',
    label: 'remove unmount and epoch protection',
    files: [surfacePath],
    tests: authorityTests,
    mutate: (source) => stoppedBranch(source, (branch) => {
      let changed = mapTokenAsserts(branch, () => '')
      return replaceExact(changed, "lifecycle.cancelIfCurrent(token, 'safety-stop')", "lifecycle.cancel('safety-stop')")
    }),
  },
  {
    id: 'M11',
    label: 'remove F4 host reparse',
    files: [seamPath],
    tests: ['src/study/production/hostResultAcceptance.integration.test.tsx'],
    mutate: (source) => replaceExact(
      source,
      'const result = acceptStudyTutorResult(raw)',
      'const result = raw as any',
    ),
  },
  {
    id: 'M12',
    label: 'remove HOST_AWAIT',
    files: [launchPath],
    tests: ['src/study/production/tutorLaunchOrdering.integration.test.tsx'],
    mutate: (source) => replacePattern(
      source,
      /  await launch\(\)\r?\n/,
      (match) => match.replace('await launch()', 'void launch()'),
    ),
  },
  {
    id: 'M13',
    label: 'regress completion-only privacy flags',
    files: [surfacePath],
    tests: ['src/study/production/tutorAcceptedTurn.integration.test.tsx'],
    testName: 'writes no learner text to the session row when a completion-only block completes',
    mutate: (source) => replacePattern(
      source,
      /        lastAcceptedEventRef: acceptedEventRef,\r?\n        rawAnswerIncluded: false,/,
      (match) => match.replace('rawAnswerIncluded: false', 'rawAnswerIncluded: true as false'),
    ),
  },
]

const originals = new Map([surfacePath, seamPath, launchPath].map((path) => [path, readFileSync(path)]))
const results = []

for (const mutant of mutants) {
  let status = 'HARNESS_ERROR'
  let exitStatus = null
  try {
    for (const path of mutant.files) {
      const source = originals.get(path)?.toString('utf8')
      if (source === undefined) throw new Error(`missing original for ${path}`)
      const mutated = mutant.mutate(source)
      if (mutated === source) throw new Error('mutation made no byte change')
      writeFileSync(path, mutated, 'utf8')
    }
    const args = ['node_modules/vitest/vitest.mjs', 'run', ...mutant.tests, '--reporter=dot']
    if (mutant.testName) args.push('-t', mutant.testName)
    const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120_000 })
    exitStatus = run.status
    if (run.error || run.status === null) {
      status = 'HARNESS_ERROR'
    } else {
      status = run.status === 0 ? 'SURVIVED' : 'KILLED'
    }
  } catch (error) {
    status = 'HARNESS_ERROR'
    results.push({ id: mutant.id, label: mutant.label, status, exitStatus, error: String(error) })
    continue
  } finally {
    for (const path of mutant.files) writeFileSync(path, originals.get(path))
  }
  const restored = mutant.files.every((path) => readFileSync(path).equals(originals.get(path)))
  if (!restored) status = 'HARNESS_ERROR'
  results.push({ id: mutant.id, label: mutant.label, status, exitStatus, restored })
}

for (const result of results) console.log(JSON.stringify(result))
const counts = Object.fromEntries(['KILLED', 'SURVIVED', 'HARNESS_ERROR'].map((status) => [
  status,
  results.filter((result) => result.status === status).length,
]))
console.log(JSON.stringify({ summary: counts, total: results.length }))
if (counts.SURVIVED > 0 || counts.HARNESS_ERROR > 0 || counts.KILLED !== mutants.length) process.exitCode = 1
