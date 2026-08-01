import { describe, expect, it, vi } from 'vitest'
import { productionAdaptiveTutorRegistry } from './productionRegistry'
import { createSubjectRegistry } from './subjectRegistry'
import { makeDescriptor, TEST_PROGRAM_ID, TEST_SUBJECT_ID } from './testSupport'

describe('Adaptive Tutor subject registry', () => {
  it('registers one valid subject without mutating or freezing the input', () => {
    const input = makeDescriptor()
    const result = createSubjectRegistry([input])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.listSubjects()).toHaveLength(1)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(result.value.listSubjects()[0])).toBe(true)
  })

  it('rejects duplicate subject IDs transactionally', () => {
    const result = createSubjectRegistry([makeDescriptor(), makeDescriptor()])
    expect(result).toMatchObject({ ok: false, failure: { code: 'DUPLICATE_SUBJECT_ID' } })
  })

  it('rejects duplicate program IDs within and across subjects', () => {
    const within = makeDescriptor(undefined, {
      programs: [
        makeDescriptor().programs[0],
        makeDescriptor().programs[0],
      ],
    })
    expect(createSubjectRegistry([within])).toMatchObject({
      ok: false,
      failure: { code: 'DUPLICATE_PROGRAM_ID' },
    })
    const other = makeDescriptor(undefined, { subjectId: 'other-subject' })
    expect(createSubjectRegistry([makeDescriptor(), other])).toMatchObject({
      ok: false,
      failure: { code: 'DUPLICATE_PROGRAM_ID' },
    })
  })

  it('rejects unsupported Core versions even when TypeScript is bypassed', () => {
    const candidate = { ...makeDescriptor(), compatibleCoreContractVersion: '0.3.0' }
    expect(createSubjectRegistry([candidate])).toMatchObject({
      ok: false,
      failure: { code: 'UNSUPPORTED_CORE_VERSION' },
    })
  })

  it.each([
    ['bad subject id', { subjectId: '../math' }],
    ['bad semver', { packageVersion: 'latest' }],
    ['bad hash', { provenance: { kind: 'frozen-artifact', artifactName: 'x.zip', sha256: 'bad' } }],
    ['reversed band', { programs: [{ ...makeDescriptor().programs[0], gradeBand: { min: 6, max: 4, label: 'bad' } }] }],
  ])('rejects malformed descriptors: %s', (_label, override) => {
    expect(createSubjectRegistry([{ ...makeDescriptor(), ...override }])).toMatchObject({
      ok: false,
      failure: { code: 'MALFORMED_DESCRIPTOR' },
    })
  })

  it('rejects a missing loader', () => {
    const candidate = { ...makeDescriptor(), loader: undefined }
    expect(createSubjectRegistry([candidate])).toMatchObject({
      ok: false,
      failure: { code: 'LOADER_UNAVAILABLE' },
    })
  })

  it('fails closed for unavailable, unknown-subject, and unknown-program resolution', () => {
    const loader = vi.fn(() => makeDescriptor())
    const unavailable = createSubjectRegistry([makeDescriptor(loader, {
      availability: {
        status: 'unavailable',
        failure: { code: 'ARTIFACT_MISSING', safeMessage: 'This subject is unavailable.' },
      },
    })])
    expect(unavailable.ok).toBe(true)
    if (unavailable.ok) {
      expect(unavailable.value.resolve(TEST_SUBJECT_ID, TEST_PROGRAM_ID)).toMatchObject({
        ok: false,
        failure: { code: 'SUBJECT_UNAVAILABLE' },
      })
      expect(loader).not.toHaveBeenCalled()
    }
    const registry = createSubjectRegistry([makeDescriptor()])
    expect(registry.ok).toBe(true)
    if (!registry.ok) return
    expect(registry.value.resolve('unknown-subject', TEST_PROGRAM_ID)).toMatchObject({
      ok: false,
      failure: { code: 'UNKNOWN_SUBJECT' },
    })
    expect(registry.value.resolve(TEST_SUBJECT_ID, 'unknown-program')).toMatchObject({
      ok: false,
      failure: { code: 'UNKNOWN_PROGRAM' },
    })
  })

  it('keeps the production registry empty and does not register Math', () => {
    expect(productionAdaptiveTutorRegistry.listSubjects()).toEqual([])
  })
})
