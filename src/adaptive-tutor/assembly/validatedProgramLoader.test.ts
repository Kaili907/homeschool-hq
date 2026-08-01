import { describe, expect, it, vi } from 'vitest'
import {
  createSubjectRegistry,
  type AdaptiveTutorSubjectRegistry,
  type ResolvedProgramRegistration,
} from './subjectRegistry'
import { makeCoreAdapter, makeDescriptor, makeProgram, TEST_PROGRAM_ID, TEST_SUBJECT_ID } from './testSupport'
import type { AssemblyResult } from './types'
import { loadValidatedProgram } from './validatedProgramLoader'

function registryWith(loader: () => unknown | Promise<unknown>) {
  const result = createSubjectRegistry([makeDescriptor(loader)])
  if (!result.ok) throw new Error('test registry failed')
  return result.value
}

const request = { subjectId: TEST_SUBJECT_ID, programId: TEST_PROGRAM_ID }

describe('validated Tutor Core v0.2 program loader', () => {
  it('accepts a valid program, freezes an isolated clone, and preserves Grade 5 in band 4–6', async () => {
    const source = makeProgram()
    const core = makeCoreAdapter()
    const result = await loadValidatedProgram(registryWith(() => source), core.adapter, request)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.program).not.toBe(source)
    expect(Object.isFrozen(result.value.program)).toBe(true)
    expect(result.value.gradeBand).toEqual({ min: 4, max: 6, label: 'Grades 4–6' })
    expect(result.value.gradeBand.min).toBeLessThanOrEqual(5)
    expect(result.value.gradeBand.max).toBeGreaterThanOrEqual(5)
    expect(Object.isFrozen(source)).toBe(false)
  })

  it('never constructs an engine and returns sanitized diagnostics when Core validation fails', async () => {
    const core = makeCoreAdapter({
      validatorIssue: {
        path: '/SECRET_PATH/value',
        message: 'SECRET_MESSAGE',
        value: 'SECRET_VALUE',
      },
    })
    const result = await loadValidatedProgram(registryWith(() => makeProgram()), core.adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'CORE_VALIDATION_FAILED' } })
    expect(core.calls.construction).toBe(0)
    expect(JSON.stringify(result)).not.toContain('SECRET_')
    expect(result).toMatchObject({ failure: { issues: [{ path: '/' }] } })
  })

  it('does not silently coerce a string grade', async () => {
    const program = makeProgram({ gradeBand: { min: '4', max: 6, label: 'Grades 4–6' } })
    const result = await loadValidatedProgram(registryWith(() => program), makeCoreAdapter().adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'CORE_VALIDATION_FAILED' } })
    expect((program.gradeBand as { min: string }).min).toBe('4')
  })

  it.each([
    ['id', { id: 'another-program' }, 'PROGRAM_ID_MISMATCH'],
    ['version', { version: '2.0.0' }, 'PROGRAM_VERSION_MISMATCH'],
    ['subject', { subject: 'math' }, 'PROGRAM_SUBJECT_MISMATCH'],
    ['band', { gradeBand: { min: 3, max: 6, label: 'Grades 3–6' } }, 'PROGRAM_GRADE_BAND_MISMATCH'],
  ])('rejects a loaded program %s mismatch', async (_label, override, code) => {
    const result = await loadValidatedProgram(
      registryWith(() => makeProgram(override)),
      makeCoreAdapter().adapter,
      request,
    )
    expect(result).toMatchObject({ ok: false, failure: { code } })
  })

  it('contains loader exceptions without exposing their messages', async () => {
    const loader = vi.fn(() => { throw new Error('SECRET_CHILD_CONTENT') })
    const result = await loadValidatedProgram(registryWith(loader), makeCoreAdapter().adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'SUBJECT_LOADER_FAILED' } })
    expect(JSON.stringify(result)).not.toContain('SECRET_CHILD_CONTENT')
  })

  it('rejects uncloneable subject data and does not mutate the source', async () => {
    const source = makeProgram({ uncloneable: () => undefined })
    const result = await loadValidatedProgram(registryWith(() => source), makeCoreAdapter().adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'PROGRAM_SNAPSHOT_FAILED' } })
    expect(typeof source.uncloneable).toBe('function')
  })

  it('creates distinct immutable snapshots when a loader reuses one mutable object', async () => {
    const source = makeProgram()
    const registry = registryWith(() => source)
    const core = makeCoreAdapter()
    const first = await loadValidatedProgram(registry, core.adapter, request)
    const second = await loadValidatedProgram(registry, core.adapter, request)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.program).not.toBe(second.value.program)
    source.safety = { changed: true }
    expect(first.value.program).not.toEqual(source)
  })

  it('fails closed for a forged registry object', async () => {
    const forged: AdaptiveTutorSubjectRegistry = {
      listSubjects: () => [],
      resolve: (): AssemblyResult<ResolvedProgramRegistration> => ({
        ok: false,
        failure: {
          stage: 'registry',
          code: 'UNKNOWN_SUBJECT',
          safeMessage: 'forged',
        },
      }),
    }
    const result = await loadValidatedProgram(forged, makeCoreAdapter().adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'UNVALIDATED_REGISTRY' } })
  })

  it('fails before calling the loader when Core contract versions mismatch', async () => {
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    Object.defineProperty(core.adapter, 'contractVersion', { value: '0.1.0' })
    const result = await loadValidatedProgram(registryWith(loader), core.adapter, request)
    expect(result).toMatchObject({ ok: false, failure: { code: 'UNSUPPORTED_CORE_VERSION' } })
    expect(loader).not.toHaveBeenCalled()
  })
})
