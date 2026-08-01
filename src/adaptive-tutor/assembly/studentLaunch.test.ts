import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../migration'
import { validateProfileForSync } from '../../sync/provenance'
import { createSubjectRegistry } from './subjectRegistry'
import {
  createAdaptiveTutorLaunchCoordinator,
  gradeIsWithinBand,
  launchAdaptiveTutor,
} from './studentLaunch'
import {
  makeCoreAdapter,
  makeDescriptor,
  makeProgram,
  TEST_PROGRAM_ID,
  TEST_SUBJECT_ID,
} from './testSupport'
import type { TutorProgramLoader } from './types'

function registryWith(loader: TutorProgramLoader) {
  const result = createSubjectRegistry([makeDescriptor(loader)])
  if (!result.ok) throw new Error('test registry failed')
  return result.value
}

const profile = () => ({ id: 'p1', grade: '4' as const })
const request = () => ({
  activeProfile: profile(),
  subjectId: TEST_SUBJECT_ID,
  programId: TEST_PROGRAM_ID,
})

describe('Adaptive Tutor student launch contract', () => {
  it('does not load or construct without the existing active profile guard', async () => {
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    const result = await launchAdaptiveTutor(registryWith(loader), core.adapter, {
      ...request(),
      activeProfile: null,
    })
    expect(result).toMatchObject({ ok: false, failure: { code: 'NO_ACTIVE_PROFILE' } })
    expect(loader).not.toHaveBeenCalled()
    expect(core.calls.construction).toBe(0)
  })

  it('does not silently substitute an unknown subject or program', async () => {
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    const registry = registryWith(loader)
    expect(await launchAdaptiveTutor(registry, core.adapter, {
      ...request(), subjectId: 'unknown-subject',
    })).toMatchObject({ ok: false, failure: { code: 'UNKNOWN_SUBJECT' } })
    expect(await launchAdaptiveTutor(registry, core.adapter, {
      ...request(), programId: 'unknown-program',
    })).toMatchObject({ ok: false, failure: { code: 'UNKNOWN_PROGRAM' } })
    expect(loader).not.toHaveBeenCalled()
  })

  it('passes no profile identity to the loader and keeps runtime in memory', async () => {
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    const result = await launchAdaptiveTutor(registryWith(loader), core.adapter, request())
    expect(result.ok).toBe(true)
    expect(loader).toHaveBeenCalledWith(Object.freeze({
      subjectId: TEST_SUBJECT_ID,
      programId: TEST_PROGRAM_ID,
    }))
    if (!result.ok) return
    expect(result.value.instructionalGrade).toBe(4)
    expect('getAdultReview' in result.value.runtime).toBe(false)
    expect('getSnapshot' in result.value.runtime).toBe(false)
  })

  it('preserves Grade 5 in Core band math without changing host identity', async () => {
    expect(gradeIsWithinBand(5, { min: 4, max: 6, label: 'Grades 4–6' })).toBe(true)
    const storedProfile = emptyProfile('p1', 'Ada', '4')
    expect(validateProfileForSync('p1', storedProfile)).toBe(true)
    Object.defineProperty(storedProfile, 'grade', { value: '5', configurable: true })
    expect(validateProfileForSync('p1', storedProfile)).toBe(false)

    const active = profile()
    Object.defineProperty(active, 'grade', { value: '5', configurable: true })
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    const result = await launchAdaptiveTutor(registryWith(loader), core.adapter, {
      ...request(), activeProfile: active,
    })
    expect(result).toMatchObject({ ok: false, failure: { code: 'PROFILE_GRADE_UNSUPPORTED' } })
    expect(loader).not.toHaveBeenCalled()
    expect(core.calls.construction).toBe(0)
  })

  it('rejects a supported host grade outside the exact program band before construction', async () => {
    const loader = vi.fn(() => makeProgram())
    const core = makeCoreAdapter()
    const result = await launchAdaptiveTutor(registryWith(loader), core.adapter, {
      ...request(), activeProfile: { id: 'p1', grade: '3' },
    })
    expect(result).toMatchObject({ ok: false, failure: { code: 'GRADE_OUTSIDE_PROGRAM_BAND' } })
    expect(core.calls.construction).toBe(0)
  })

  it('cancels a pending profile launch before engine construction', async () => {
    let resolveLoader: ((value: unknown) => void) | undefined
    const deferred = new Promise<unknown>((resolve) => { resolveLoader = resolve })
    const loader = vi.fn(() => deferred)
    const core = makeCoreAdapter()
    const coordinator = createAdaptiveTutorLaunchCoordinator(registryWith(loader), core.adapter)
    const pending = coordinator.launch(request())
    coordinator.cancel()
    resolveLoader?.(makeProgram())
    const result = await pending
    expect(result).toMatchObject({ ok: false, failure: { code: 'STALE_LAUNCH' } })
    expect(core.calls.construction).toBe(0)
  })

  it('allows only the latest out-of-order launch to become active', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    const firstProgram = new Promise<unknown>((resolve) => { resolveFirst = resolve })
    const secondProgramId = 'second-program'
    const loader = vi.fn((loadRequest: { programId: string }) =>
      loadRequest.programId === TEST_PROGRAM_ID
        ? firstProgram
        : makeProgram({ id: secondProgramId }))
    const descriptor = makeDescriptor(loader, {
      programs: [
        makeDescriptor().programs[0],
        {
          ...makeDescriptor().programs[0],
          programId: secondProgramId,
          displayName: 'Second Program',
        },
      ],
    })
    const built = createSubjectRegistry([descriptor])
    if (!built.ok) throw new Error('registry failed')
    const core = makeCoreAdapter()
    const coordinator = createAdaptiveTutorLaunchCoordinator(built.value, core.adapter)
    const first = coordinator.launch(request())
    const second = await coordinator.launch({ ...request(), programId: secondProgramId })
    expect(second.ok).toBe(true)
    resolveFirst?.(makeProgram())
    expect(await first).toMatchObject({ ok: false, failure: { code: 'STALE_LAUNCH' } })
    expect(core.calls.construction).toBe(1)
  })

  it('disposes the current in-memory runtime on cancel/exit', async () => {
    const core = makeCoreAdapter()
    const coordinator = createAdaptiveTutorLaunchCoordinator(
      registryWith(vi.fn(() => makeProgram())),
      core.adapter,
    )
    const launched = await coordinator.launch(request())
    expect(launched.ok).toBe(true)
    if (!launched.ok) return
    coordinator.cancel()
    expect(launched.value.runtime.status).toBe('disposed')
  })
})
