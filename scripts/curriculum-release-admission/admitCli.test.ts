import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCandidateFixture,
  buildCanonicalCandidateFixture,
} from '../../src/curriculum/release-admission/index.ts'
import { formatOperatorResult, parseAdmitCliArguments, runAdmitCli } from './admitCli.node.ts'

const CLI = resolve(import.meta.dirname, 'admitCli.node.ts')
const GENERATED_AT = '2026-08-12T00:00:00.000Z'

function options(overrides: Partial<ReturnType<typeof parseAdmitCliArguments>> = {}) {
  return {
    format: 'json' as const,
    candidatePath: null,
    fixture: 'minimal' as const,
    generatedAt: GENERATED_AT,
    ...overrides,
  }
}

/** Runs the CLI the way an operator does, so the strip-types entry stays proven. */
function runCli(args: readonly string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync(process.execPath, ['--experimental-strip-types', CLI, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout }
  } catch (error) {
    const failure = error as { status?: number; stdout?: string }
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '' }
  }
}

describe('parseAdmitCliArguments', () => {
  const now = () => GENERATED_AT

  it('accepts a candidate file and a fixture, but never both or neither', () => {
    expect(parseAdmitCliArguments(['--format', 'json', '--candidate', 'a.json'], now)).toEqual({
      format: 'json',
      candidatePath: 'a.json',
      fixture: null,
      generatedAt: GENERATED_AT,
    })
    expect(parseAdmitCliArguments(['--format', 'operator', '--fixture', 'canonical'], now).fixture).toBe(
      'canonical',
    )
    expect(() => parseAdmitCliArguments(['--format', 'json'], now)).toThrow(/exactly one/u)
    expect(() =>
      parseAdmitCliArguments(['--format', 'json', '--candidate', 'a.json', '--fixture', 'minimal'], now),
    ).toThrow(/exactly one/u)
  })

  it('rejects a missing format, an unknown flag, and a dangling value', () => {
    expect(() => parseAdmitCliArguments(['--fixture', 'minimal'], now)).toThrow(/Usage/u)
    expect(() => parseAdmitCliArguments(['--format', 'json', '--wat', 'x'], now)).toThrow(/Unknown flag/u)
    expect(() => parseAdmitCliArguments(['--format'], now)).toThrow(/needs a value/u)
  })

  it('defaults the evidence stamp to the caller-supplied clock', () => {
    expect(parseAdmitCliArguments(['--format', 'json', '--fixture', 'minimal'], now).generatedAt).toBe(
      GENERATED_AT,
    )
  })
})

describe('runAdmitCli', () => {
  it('builds all three artifacts for an admitted candidate', () => {
    const result = runAdmitCli(options(), buildCanonicalCandidateFixture())
    expect(result.status).toBe('ADMITTED')
    if (result.status !== 'ADMITTED') return
    expect(result.registry_entry.grades).toHaveLength(9)
    expect(result.readiness_evidence.ready).toBe(true)
    expect(result.readiness_evidence.generated_at).toBe(GENERATED_AT)
    expect(result.browser_catalog_projection.courses).toHaveLength(9)
  })

  it('builds no artifacts for a rejected candidate', () => {
    const result = runAdmitCli(options(), buildCandidateFixture({ grades: [6] }))
    expect(result.status).toBe('REJECTED')
    expect(result).not.toHaveProperty('browser_catalog_projection')
    expect(result).not.toHaveProperty('registry_entry')
  })

  it('names every rejection in the operator report', () => {
    const result = runAdmitCli(options(), buildCandidateFixture({ grades: [5], graduationComplete: true }))
    const report = formatOperatorResult(result)
    expect(report).toContain('Status: REJECTED')
    expect(report).toContain('RELEASE_GRADUATION_CLAIM_FALSE')
  })
})

describe('admitCli entry point', () => {
  it('admits the canonical fixture and exits 0', () => {
    const { status, stdout } = runCli(['--format', 'json', '--fixture', 'canonical'])
    expect(status).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.status).toBe('ADMITTED')
    expect(result.registry_entry.grades.map((grade: { grade: number }) => grade.grade)).toEqual([
      3, 4, 5, 7, 8, 9, 10, 11, 12,
    ])
  })

  it('exits 2 on a rejected candidate file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-admission-'))
    const path = join(directory, 'candidate.json')
    writeFileSync(path, JSON.stringify(buildCandidateFixture({ grades: [6] })), 'utf8')
    const { status, stdout } = runCli(['--format', 'operator', '--candidate', path])
    expect(status).toBe(2)
    expect(stdout).toContain('RELEASE_GRADE_UNSUPPORTED')
  })

  it('rejects a malformed candidate file instead of crashing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-admission-'))
    const path = join(directory, 'candidate.json')
    writeFileSync(path, JSON.stringify({ candidate_id: 'nonsense' }), 'utf8')
    const { status, stdout } = runCli(['--format', 'operator', '--candidate', path])
    expect(status).toBe(2)
    expect(stdout).toContain('Status: REJECTED')
    expect(stdout).toContain('RELEASE_SCHEMA_MISMATCH')
  })

  it('exits 1 on bad usage', () => {
    expect(runCli(['--format', 'json']).status).toBe(1)
  })
})
