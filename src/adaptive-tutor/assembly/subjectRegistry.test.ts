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

  it('requires top-level and nested descriptor fields to be own data properties', () => {
    const descriptor = makeDescriptor()
    const inheritedDescriptor = Object.create(descriptor)
    const inheritedProgram = Object.create(descriptor.programs[0])
    const inheritedGradeBand = Object.create(descriptor.programs[0].gradeBand)
    const inheritedProvenance = Object.create(descriptor.provenance)
    const inheritedAvailability = Object.create(descriptor.availability)
    const unavailable = makeDescriptor(undefined, {
      availability: {
        status: 'unavailable',
        failure: { code: 'ARTIFACT_MISSING', safeMessage: 'This subject is unavailable.' },
      },
    })
    if (unavailable.availability.status !== 'unavailable') {
      throw new Error('test fixture is invalid')
    }
    const inheritedFailure = Object.create(unavailable.availability.failure)

    const candidates = [
      inheritedDescriptor,
      { ...descriptor, programs: [inheritedProgram] },
      {
        ...descriptor,
        programs: [{ ...descriptor.programs[0], gradeBand: inheritedGradeBand }],
      },
      { ...descriptor, provenance: inheritedProvenance },
      { ...descriptor, availability: inheritedAvailability },
      {
        ...unavailable,
        availability: { status: 'unavailable', failure: inheritedFailure },
      },
    ]

    for (const candidate of candidates) {
      expect(createSubjectRegistry([candidate])).toMatchObject({
        ok: false,
        failure: { stage: 'registry', code: 'MALFORMED_DESCRIPTOR' },
      })
    }
  })

  it('rejects accessors without invoking their getters', () => {
    const topLevelGetter = vi.fn(() => { throw new Error('HOSTILE_TOP_LEVEL_GETTER') })
    const topLevel = { ...makeDescriptor() }
    Object.defineProperty(topLevel, 'subjectId', {
      enumerable: true,
      get: topLevelGetter,
    })

    const nestedGetter = vi.fn(() => { throw new Error('HOSTILE_NESTED_GETTER') })
    const provenance = { ...makeDescriptor().provenance }
    Object.defineProperty(provenance, 'kind', {
      enumerable: true,
      get: nestedGetter,
    })

    for (const candidate of [topLevel, { ...makeDescriptor(), provenance }]) {
      expect(() => createSubjectRegistry([candidate])).not.toThrow()
      expect(createSubjectRegistry([candidate])).toMatchObject({
        ok: false,
        failure: {
          stage: 'registry',
          code: 'MALFORMED_DESCRIPTOR',
        },
      })
    }
    expect(topLevelGetter).not.toHaveBeenCalled()
    expect(nestedGetter).not.toHaveBeenCalled()
  })

  it('contains hostile descriptor and nested Proxy traps as structured failures', () => {
    const descriptor = makeDescriptor()
    const ownKeysProxy = new Proxy(descriptor, {
      ownKeys: () => { throw new Error('HOSTILE_OWN_KEYS') },
    })
    const descriptorProxy = new Proxy(descriptor, {
      getOwnPropertyDescriptor: () => { throw new Error('HOSTILE_DESCRIPTOR') },
    })
    const getProxy = new Proxy(descriptor, {
      get: (target, property, receiver) => {
        if (property === 'compatibleCoreContractVersion') throw new Error('HOSTILE_GET')
        return Reflect.get(target, property, receiver)
      },
    })
    const nestedProxy = new Proxy(descriptor.provenance, {
      ownKeys: () => { throw new Error('HOSTILE_NESTED_PROXY') },
    })
    const revoked = Proxy.revocable(descriptor, {})
    revoked.revoke()

    for (const candidate of [
      ownKeysProxy,
      descriptorProxy,
      getProxy,
      { ...descriptor, provenance: nestedProxy },
      revoked.proxy,
    ]) {
      expect(() => createSubjectRegistry([candidate])).not.toThrow()
      expect(createSubjectRegistry([candidate])).toMatchObject({
        ok: false,
        failure: { stage: 'registry', code: 'MALFORMED_DESCRIPTOR' },
      })
    }
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
