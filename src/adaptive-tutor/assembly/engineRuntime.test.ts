import { describe, expect, it } from 'vitest'
import { assembleAdaptiveTutorRuntime } from './engineRuntime'
import { createSubjectRegistry } from './subjectRegistry'
import {
  makeCoreAdapter,
  makeDescriptor,
  makeProgram,
  makeResponse,
  TestEngine,
  TEST_PROGRAM_ID,
  TEST_SUBJECT_ID,
} from './testSupport'
import type { ValidatedProgramHandle } from './validatedProgramLoader'
import { loadValidatedProgram } from './validatedProgramLoader'

async function loadHandle(core = makeCoreAdapter(), source = makeProgram()) {
  const registry = createSubjectRegistry([makeDescriptor(() => source)])
  if (!registry.ok) throw new Error('test registry failed')
  const loaded = await loadValidatedProgram(
    registry.value,
    core.adapter,
    { subjectId: TEST_SUBJECT_ID, programId: TEST_PROGRAM_ID },
  )
  if (!loaded.ok) throw new Error('test loader failed')
  return { core, handle: loaded.value }
}

describe('Adaptive Tutor engine assembly and isolation', () => {
  it('rejects a forged, unvalidated handle before engine construction', () => {
    const core = makeCoreAdapter()
    const forged: ValidatedProgramHandle = {
      subjectId: TEST_SUBJECT_ID,
      programId: TEST_PROGRAM_ID,
      programVersion: '1.0.0',
      coreSubject: 'general',
      gradeBand: { min: 4, max: 6, label: 'Grades 4–6' },
      program: makeProgram(),
    }
    expect(assembleAdaptiveTutorRuntime(core.adapter, forged)).toMatchObject({
      ok: false,
      failure: { code: 'CORE_VALIDATION_FAILED' },
    })
    expect(core.calls.construction).toBe(0)
  })

  it('does not construct an engine when semantic program validation fails', async () => {
    const core = makeCoreAdapter()
    const registry = createSubjectRegistry([makeDescriptor(() =>
      makeProgram({ semanticGraphValid: false }))])
    expect(registry.ok).toBe(true)
    if (!registry.ok) return
    const loaded = await loadValidatedProgram(registry.value, core.adapter, {
      subjectId: TEST_SUBJECT_ID,
      programId: TEST_PROGRAM_ID,
    })
    expect(loaded).toMatchObject({ ok: false, failure: { code: 'CORE_VALIDATION_FAILED' } })
    expect(core.calls.construction).toBe(0)
  })

  it('creates a distinct engine and isolated program clone per runtime', async () => {
    const { core, handle } = await loadHandle()
    const first = assembleAdaptiveTutorRuntime(core.adapter, handle, { createLaunchId: () => 'launch-1' })
    const second = assembleAdaptiveTutorRuntime(core.adapter, handle, { createLaunchId: () => 'launch-2' })
    expect(first.ok && second.ok).toBe(true)
    expect(core.engines).toHaveLength(2)
    expect(core.engines[0]).not.toBe(core.engines[1])
    expect(core.constructedPrograms[0]).not.toBe(core.constructedPrograms[1])
    expect(core.constructedPrograms[0]).not.toBe(handle.program)
    if (!first.ok || !second.ok) return
    expect(first.value.start()).toMatchObject({ ok: true })
    expect(core.engines[0].count).toBe(1)
    expect(core.engines[1].count).toBe(0)
  })

  it('rejects repeated start and resets by replacing the engine', async () => {
    const { core, handle } = await loadHandle()
    const assembled = assembleAdaptiveTutorRuntime(core.adapter, handle)
    if (!assembled.ok) throw new Error('runtime failed')
    expect(assembled.value.start()).toMatchObject({ ok: true })
    expect(assembled.value.start()).toMatchObject({
      ok: false,
      failure: { code: 'RUNTIME_INVALID_STATE' },
    })
    const firstEngine = core.engines[0]
    expect(assembled.value.reset()).toEqual({ ok: true, value: undefined })
    expect(core.engines).toHaveLength(2)
    expect(core.engines[1]).not.toBe(firstEngine)
    expect(core.engines[1].count).toBe(0)
    expect(assembled.value.status).toBe('ready')
  })

  it('disposes idempotently and rejects all later operations', async () => {
    const { core, handle } = await loadHandle()
    const assembled = assembleAdaptiveTutorRuntime(core.adapter, handle)
    if (!assembled.ok) throw new Error('runtime failed')
    assembled.value.dispose()
    assembled.value.dispose()
    expect(assembled.value.status).toBe('disposed')
    expect(assembled.value.start()).toMatchObject({ ok: false, failure: { code: 'RUNTIME_DISPOSED' } })
    expect(assembled.value.reset()).toMatchObject({ ok: false, failure: { code: 'RUNTIME_DISPOSED' } })
  })

  it('validates learner input before Core submit', async () => {
    const { core, handle } = await loadHandle()
    const assembled = assembleAdaptiveTutorRuntime(core.adapter, handle)
    if (!assembled.ok) throw new Error('runtime failed')
    assembled.value.start()
    const countBefore = core.engines[0].count
    expect(assembled.value.submit({ raw: 42 })).toMatchObject({
      ok: false,
      failure: { code: 'RUNTIME_INPUT_INVALID' },
    })
    expect(core.engines[0].count).toBe(countBefore)
  })

  it('projects child-safe responses without answer keys or snapshots', async () => {
    const { core, handle } = await loadHandle()
    const assembled = assembleAdaptiveTutorRuntime(core.adapter, handle)
    if (!assembled.ok) throw new Error('runtime failed')
    const result = assembled.value.start()
    expect(result.ok).toBe(true)
    expect(JSON.stringify(result)).not.toContain('SECRET_')
    expect('getSnapshot' in assembled.value).toBe(false)
  })

  it('supports the exact R1 teaching-turn bridge but not adult-review continuation', async () => {
    const { core, handle } = await loadHandle()
    const assembled = assembleAdaptiveTutorRuntime(core.adapter, handle)
    if (!assembled.ok) throw new Error('runtime failed')
    assembled.value.start()
    assembled.value.submit({ raw: 'attempt' })
    const teaching = assembled.value.continueLesson()
    expect(teaching).toMatchObject({
      ok: true,
      value: { phase: 'teach-visually', expectedInput: 'answer', assessmentPrompt: null },
    })
    expect(assembled.value.continueLesson()).toMatchObject({ ok: true })

    const adultCore = makeCoreAdapter({
      createEngine: (program) => {
        const engine = new TestEngine(program)
        engine.startResponse = makeResponse({
          phase: 'escalated',
          expectedInput: 'adult-review',
          assessment: false,
        })
        return engine
      },
    })
    const adultLoaded = await loadHandle(adultCore)
    const adult = assembleAdaptiveTutorRuntime(adultCore.adapter, adultLoaded.handle)
    if (!adult.ok) throw new Error('adult runtime failed')
    adult.value.start()
    const countBefore = adultCore.engines[0].count
    expect(adult.value.continueLesson()).toMatchObject({
      ok: false,
      failure: { code: 'RUNTIME_INVALID_STATE' },
    })
    expect(adultCore.engines[0].count).toBe(countBefore)
  })

  it('disposes after an invalid Core output or operation exception', async () => {
    const invalidCore = makeCoreAdapter({
      createEngine: (program) => {
        const engine = new TestEngine(program)
        engine.startResponse = makeResponse({ schemaValid: false })
        return engine
      },
    })
    const invalidLoaded = await loadHandle(invalidCore)
    const invalid = assembleAdaptiveTutorRuntime(invalidCore.adapter, invalidLoaded.handle)
    if (!invalid.ok) throw new Error('invalid runtime failed')
    expect(invalid.value.start()).toMatchObject({
      ok: false,
      failure: { code: 'RUNTIME_OUTPUT_INVALID' },
    })
    expect(invalid.value.status).toBe('disposed')

    const throwingCore = makeCoreAdapter({
      createEngine: (program) => {
        const engine = new TestEngine(program)
        engine.start = () => { throw new Error('SECRET_CHILD_INPUT') }
        return engine
      },
    })
    const throwingLoaded = await loadHandle(throwingCore)
    const throwing = assembleAdaptiveTutorRuntime(throwingCore.adapter, throwingLoaded.handle)
    if (!throwing.ok) throw new Error('throwing runtime failed')
    const result = throwing.value.start()
    expect(result).toMatchObject({ ok: false, failure: { code: 'ENGINE_OPERATION_FAILED' } })
    expect(JSON.stringify(result)).not.toContain('SECRET_CHILD_INPUT')
    expect(throwing.value.status).toBe('disposed')
  })
})
