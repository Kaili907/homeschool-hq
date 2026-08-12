import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateFamilyPilotReadiness, PILOT_CHECKS } from './readiness.mjs'

const READY = 'READY_FOR_SUPERVISED_PILOT'
const NOT_READY = 'NOT_READY_FOR_SUPERVISED_PILOT'

let workingDirectories: string[] = []

afterEach(async () => {
  await Promise.all(workingDirectories.map((directory) => rm(directory, { recursive: true, force: true })))
  workingDirectories = []
})

async function fixtureRoot() {
  const directory = await mkdtemp(join(tmpdir(), 'family-pilot-readiness-'))
  workingDirectories.push(directory)
  return directory
}

/** Builds a root directory that satisfies every check, then callers punch holes in it. */
async function readyFixtureRoot() {
  const root = await fixtureRoot()

  await writeFile(join(root, 'netlify.toml'), '[build.environment]\n  NODE_VERSION = "22"\n')

  await writeFile(join(root, 'package.json'), JSON.stringify({
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { vite: '^6.0.0' },
  }))
  await mkdir(join(root, 'node_modules'), { recursive: true })

  const mathDir = join(root, 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics')
  await mkdir(mathDir, { recursive: true })
  await writeFile(join(mathDir, 'unit-1.json'), '{}')
  await writeFile(
    join(root, 'curriculum-content/manuel-academy/production-release-registry.json'),
    JSON.stringify({ currentRelease: '1.0.0' }),
  )

  await mkdir(join(root, 'src/curriculum/practice'), { recursive: true })
  await writeFile(join(root, 'src/curriculum/practice/grade5MathPracticeRoute.ts'), 'export {}\n')
  await mkdir(join(root, 'src/components/curriculum'), { recursive: true })
  await writeFile(join(root, 'src/components/curriculum/Grade5MathPractice.tsx'), 'export {}\n')

  await writeFile(join(root, 'src/components/GrownUps.tsx'), 'export {}\n')

  await writeFile(join(root, 'src/appState.ts'), 'export const read = () => localStorage.getItem("x")\n')

  return root
}

describe('evaluateFamilyPilotReadiness', () => {
  it('is READY when every pilot-critical check passes', async () => {
    const root = await readyFixtureRoot()
    const report = evaluateFamilyPilotReadiness({
      rootDirectory: root,
      env: {},
      nodeVersion: 'v22.5.0',
    })
    expect(report.verdict).toBe(READY)
    expect(report.ready).toBe(true)
    expect(report.failedChecks).toEqual([])
    expect(report.checks.every((check) => check.pass)).toBe(true)
  })

  it('reports NOT_READY with the exact failed check when node_modules is missing', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'node_modules'), { recursive: true, force: true })
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.verdict).toBe(NOT_READY)
    expect(report.failedChecks.map((check) => check.id)).toEqual(['local-repo-build-availability'])
  })

  it('fails the Node runtime check below the minimum supported major', async () => {
    const root = await readyFixtureRoot()
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v16.20.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('node-runtime')
  })

  it('passes the Node runtime check above the minimum even when it does not match the hosted pin', async () => {
    const root = await readyFixtureRoot()
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v24.14.1' })
    const nodeCheck = report.checks.find((check) => check.id === 'node-runtime')
    expect(nodeCheck?.pass).toBe(true)
    expect(nodeCheck?.detail).toContain('hosted builds pin Node 22')
  })

  it('fails when the Grade 5 Math static unit directory is empty', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics'), {
      recursive: true,
      force: true,
    })
    await mkdir(join(root, 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics'))
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('grade5-math-static-unit')
  })

  it('fails when the release registry is missing', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'curriculum-content/manuel-academy/production-release-registry.json'), { force: true })
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('grade5-math-static-unit')
  })

  it('fails when neither the student route file nor the practice component exists', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'src/curriculum/practice/grade5MathPracticeRoute.ts'), { force: true })
    await rm(join(root, 'src/components/curriculum/Grade5MathPractice.tsx'), { force: true })
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('student-route-module')
  })

  it('passes the parent supervision check when only one known surface exists', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'src/components/GrownUps.tsx'), { force: true })
    await mkdir(join(root, 'src/components/hub'), { recursive: true })
    await writeFile(join(root, 'src/components/hub/ParentHub.tsx'), 'export {}\n')
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.checks.find((check) => check.id === 'parent-supervision-surface')?.pass).toBe(true)
  })

  it('fails the parent supervision check when no known surface exists', async () => {
    const root = await readyFixtureRoot()
    await rm(join(root, 'src/components/GrownUps.tsx'), { force: true })
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('parent-supervision-surface')
  })

  it('fails local progress support when appState.ts no longer uses localStorage', async () => {
    const root = await readyFixtureRoot()
    await writeFile(join(root, 'src/appState.ts'), 'export const read = () => fetch("/api/state")\n')
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.failedChecks.map((check) => check.id)).toContain('local-progress-session-support')
  })

  it('fails the dependency check when react-dom is missing from package.json', async () => {
    const root = await readyFixtureRoot()
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^6.0.0' },
    }))
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    const check = report.failedChecks.find((entry) => entry.id === 'pilot-dependencies-present')
    expect(check?.detail).toContain('react-dom')
  })

  it('fails production-study-dark when ACADEMY_STUDY_ENABLED is enabled', async () => {
    const root = await readyFixtureRoot()
    const report = evaluateFamilyPilotReadiness({
      rootDirectory: root,
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      nodeVersion: 'v22.5.0',
    })
    expect(report.failedChecks.map((check) => check.id)).toContain('production-study-dark')
  })

  it('treats non-enabled ACADEMY_STUDY_ENABLED values as dark', async () => {
    const root = await readyFixtureRoot()
    for (const value of [undefined, 'false', '0', 'nope']) {
      const env = value === undefined ? {} : { ACADEMY_STUDY_ENABLED: value }
      const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env, nodeVersion: 'v22.5.0' })
      expect(report.checks.find((check) => check.id === 'production-study-dark')?.pass).toBe(true)
    }
  })

  it('never requires an email/SMS credential for pilot readiness', async () => {
    const root = await readyFixtureRoot()
    const report = evaluateFamilyPilotReadiness({ rootDirectory: root, env: {}, nodeVersion: 'v22.5.0' })
    expect(report.checks.find((check) => check.id === 'no-email-sms-required')?.pass).toBe(true)
  })

  it('would catch a future check that requires an email/SMS credential', () => {
    const offendingCheck = { id: 'x', label: 'x', requiredEnvVars: ['SENDGRID_API_KEY'], run: () => ({ pass: true, detail: '' }) }
    PILOT_CHECKS.push(offendingCheck)
    try {
      const report = evaluateFamilyPilotReadiness({ rootDirectory: process.cwd(), env: {}, nodeVersion: 'v22.5.0' })
      expect(report.checks.find((check) => check.id === 'no-email-sms-required')?.pass).toBe(false)
    } finally {
      PILOT_CHECKS.splice(PILOT_CHECKS.indexOf(offendingCheck), 1)
    }
  })

  it('does not throw and fails closed when the root directory does not exist at all', () => {
    const report = evaluateFamilyPilotReadiness({
      rootDirectory: join(tmpdir(), 'family-pilot-readiness-does-not-exist'),
      env: {},
      nodeVersion: 'v22.5.0',
    })
    expect(report.verdict).toBe(NOT_READY)
  })
})
