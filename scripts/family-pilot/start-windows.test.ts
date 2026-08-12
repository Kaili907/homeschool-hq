import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(new URL('./start-windows.ps1', import.meta.url))

const describeOnWindows = platform === 'win32' ? describe : describe.skip

async function makeFixtureRoot({ nodeModules = false, envLocal = null }: {
  nodeModules?: boolean
  envLocal?: string | null
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'family-pilot-launcher-'))
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'homeschool-hq' }))
  await mkdir(join(root, '.git'))
  await writeFile(
    join(root, 'netlify.toml'),
    '[build.environment]\n  NODE_VERSION = "22"\n',
  )
  if (nodeModules) await mkdir(join(root, 'node_modules'))
  if (envLocal !== null) await writeFile(join(root, '.env.local'), envLocal)
  return root
}

function runLauncher(repoRoot: string, extraArgs: string[] = []) {
  return spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-RepoRoot', repoRoot,
    ...extraArgs,
  ], { encoding: 'utf8' })
}

describeOnWindows('start-windows.ps1', () => {
  let fixtureRoots: string[] = []

  beforeEach(() => {
    fixtureRoots = []
  })

  afterEach(async () => {
    await Promise.all(fixtureRoots.map((root) => rm(root, { recursive: true, force: true })))
  })

  it('blocks and reports PILOT_LAUNCH_BLOCKER when the repo checkout is wrong', async () => {
    const root = await mkdtemp(join(tmpdir(), 'family-pilot-launcher-'))
    fixtureRoots.push(root)
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'not-the-right-repo' }))

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(2)
    expect(result.stdout).toMatch(/PILOT_LAUNCH_BLOCKER/)
    expect(result.stdout).toMatch(/not a homeschool-hq checkout/)
  })

  it('blocks and reports PILOT_LAUNCH_BLOCKER when dependencies are not installed', async () => {
    const root = await makeFixtureRoot({ nodeModules: false })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(2)
    expect(result.stdout).toMatch(/PILOT_LAUNCH_BLOCKER/)
    expect(result.stdout).toMatch(/dependencies are not installed/)
    expect(result.stdout).toMatch(/npm ci/)
  })

  it('passes -Check and starts no service once the repo and dependencies are in place', async () => {
    const root = await makeFixtureRoot({ nodeModules: true })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/checks PASSED/)
    expect(result.stdout).toMatch(/no service was started/)
    expect(result.stdout).not.toMatch(/Running: npm run (dev|build|preview)/)
  })

  it('reports configured .env.local keys without ever printing their values', async () => {
    const secretValue = 'sk-ant-super-secret-pilot-value-should-never-appear'
    const root = await makeFixtureRoot({
      nodeModules: true,
      envLocal: `ANTHROPIC_API_KEY=${secretValue}\nVITE_SUPABASE_URL=https://example.supabase.co\n`,
    })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/ANTHROPIC_API_KEY/)
    expect(result.stdout).toMatch(/VITE_SUPABASE_URL/)
    expect(result.stdout).not.toContain(secretValue)
  })

  it('flags ACADEMY_STUDY_ENABLED as present without touching it', async () => {
    const root = await makeFixtureRoot({
      nodeModules: true,
      envLocal: 'ACADEMY_STUDY_ENABLED=true\n',
    })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/never reads, sets, or clears it/)
  })

  it('emits exactly one JSON document with status PASS in -Format json -Check mode', async () => {
    const root = await makeFixtureRoot({ nodeModules: true })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check', '-Format', 'json'])

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.status).toBe('PASS')
    expect(parsed.launcher).toBe('start-windows.ps1')
    expect(Array.isArray(parsed.checks)).toBe(true)
    expect(parsed.checks.length).toBeGreaterThan(0)
  })

  it('emits exactly one JSON document with status FAIL and blockers when blocked', async () => {
    const root = await makeFixtureRoot({ nodeModules: false })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check', '-Format', 'json'])

    expect(result.status).toBe(2)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.status).toBe('FAIL')
    expect(parsed.blockers.some((b: string) => b.includes('dependencies are not installed'))).toBe(true)
  })

  it('never includes secret .env.local values in JSON mode', async () => {
    const secretValue = 'sk-ant-super-secret-pilot-value-should-never-appear'
    const root = await makeFixtureRoot({
      nodeModules: true,
      envLocal: `ANTHROPIC_API_KEY=${secretValue}\n`,
    })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check', '-Format', 'json'])

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(secretValue)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.environment.envLocalKeys).toContain('ANTHROPIC_API_KEY')
  })

  it('leaves default text output unchanged when -Format is omitted', async () => {
    const root = await makeFixtureRoot({ nodeModules: true })
    fixtureRoots.push(root)

    const result = runLauncher(root, ['-Check'])

    expect(result.status).toBe(0)
    expect(() => JSON.parse(result.stdout)).toThrow()
    expect(result.stdout).toMatch(/checks PASSED/)
  })
})
