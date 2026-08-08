import { describe, expect, it, vi } from 'vitest'
import {
  ACADEMIC_DEPENDENCIES,
  academicDependenciesUnavailable,
  academicDependencyMap,
  combineAcademicReadiness,
  createSupabaseStudyAcademicReadiness,
  parseAcademicReadinessResult,
} from './academic-readiness.js'

function readyResult(overrides = {}) {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    status: 'ready',
    dependencies: Object.fromEntries(
      ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, 'ready']),
    ),
    ...overrides,
  }
}

const ALL_NOT_READY = Object.fromEntries(
  ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, 'not-ready']),
)

describe('academic readiness result contract', () => {
  it('accepts the exact contract and returns only its dependency states', () => {
    const parsed = parseAcademicReadinessResult(readyResult())
    expect(parsed).toEqual(Object.fromEntries(
      ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, 'ready']),
    ))
    expect(Object.keys(parsed)).toEqual([...ACADEMIC_DEPENDENCIES])
  })

  it('carries a single not-ready dependency through unchanged', () => {
    const parsed = parseAcademicReadinessResult(readyResult({
      status: 'not-ready',
      dependencies: { ...readyResult().dependencies, 'review-queue': 'not-ready' },
    }))
    expect(parsed['review-queue']).toBe('not-ready')
    expect(parsed['calendar-adapter']).toBe('ready')
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'ready'],
    ['a number', 1],
    ['an empty object', {}],
    ['a wrong schema version', readyResult({ schemaVersion: 2 })],
    ['a wrong contract version', readyResult({ contractVersion: 2 })],
    ['an unknown aggregate status', readyResult({ status: 'degraded' })],
    ['an extra top-level key', { ...readyResult(), detail: 'relation missing' }],
    ['a missing top-level key', (() => {
      const { contractVersion, ...rest } = readyResult()
      return rest
    })()],
    ['absent dependencies', readyResult({ dependencies: null })],
    ['dependencies as an array', readyResult({ dependencies: [] })],
    ['a missing dependency key', readyResult({
      status: 'not-ready',
      dependencies: (() => {
        const { 'event-ledger': _dropped, ...rest } = readyResult().dependencies
        return rest
      })(),
    })],
    ['an extra dependency key', readyResult({
      dependencies: { ...readyResult().dependencies, 'staff-adapter': 'ready' },
    })],
    ['an unknown dependency state', readyResult({
      status: 'not-ready',
      dependencies: { ...readyResult().dependencies, 'review-queue': 'degraded' },
    })],
    ['an aggregate that disagrees with its parts', readyResult({
      dependencies: { ...readyResult().dependencies, 'review-queue': 'not-ready' },
    })],
    ['a not-ready aggregate over all-ready parts', readyResult({ status: 'not-ready' })],
  ])('fails every dependency closed for %s', (_label, malformed) => {
    expect(parseAcademicReadinessResult(malformed)).toEqual(ALL_NOT_READY)
  })

  /**
   * A partial map is the shape that fails dangerously if read key by key: the
   * dependencies it names would pass while the ones it omits fail, so a truncated
   * result would open a dependency rather than close all of them.
   */
  it.each([
    ['a partial map', { 'review-queue': 'ready' }],
    ['a map missing one dependency', (() => {
      const { 'event-ledger': _dropped, ...rest } = Object.fromEntries(
        ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, 'ready']),
      )
      return rest
    })()],
    ['a map with an extra key', {
      ...Object.fromEntries(ACADEMIC_DEPENDENCIES.map((d) => [d, 'ready'])),
      'staff-adapter': 'ready',
    }],
    ['a map with an unknown state', {
      ...Object.fromEntries(ACADEMIC_DEPENDENCIES.map((d) => [d, 'ready'])),
      'review-queue': 'degraded',
    }],
    ['an empty map', {}],
    ['null', null],
    ['an array', []],
  ])('closes every dependency for %s', (_label, value) => {
    expect(academicDependencyMap(value)).toEqual(ALL_NOT_READY)
  })

  it('accepts and freezes an exact dependency map', () => {
    const exact = Object.fromEntries(ACADEMIC_DEPENDENCIES.map((d) => [d, 'ready']))
    const mapped = academicDependencyMap(exact)
    expect(mapped).toEqual(exact)
    expect(Object.isFrozen(mapped)).toBe(true)
  })

  it('freezes the unavailable record so a caller cannot patch a dependency open', () => {
    const unavailable = academicDependenciesUnavailable()
    expect(Object.isFrozen(unavailable)).toBe(true)
    expect(unavailable).toEqual(ALL_NOT_READY)
  })
})

describe('academic readiness durable probe', () => {
  it('calls the consolidated read-only RPC exactly once, with no parameters', async () => {
    const call = vi.fn(async () => readyResult())
    const probe = createSupabaseStudyAcademicReadiness({
      rpc: { isConfigured: () => true, call },
    })
    await probe.read()
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith('academy_study_academic_readiness_v1')
  })

  it('fails closed when transport is not configured, without calling anything', async () => {
    const call = vi.fn()
    const probe = createSupabaseStudyAcademicReadiness({
      rpc: { isConfigured: () => false, call },
    })
    expect(await probe.read()).toEqual(ALL_NOT_READY)
    expect(call).not.toHaveBeenCalled()
  })

  it('fails closed when the configuration check itself throws', async () => {
    // read() is documented as never throwing. isConfigured is a call into the
    // transport, so a transport that throws while answering it must be caught
    // here rather than relying on a caller further up to have a try of its own.
    const call = vi.fn()
    const probe = createSupabaseStudyAcademicReadiness({
      rpc: {
        isConfigured: () => { throw new Error('service_role_key_unreadable') },
        call,
      },
    })
    await expect(probe.read()).resolves.toEqual(ALL_NOT_READY)
    expect(call).not.toHaveBeenCalled()
  })

  it('fails closed when the call rejects', async () => {
    const probe = createSupabaseStudyAcademicReadiness({
      rpc: {
        isConfigured: () => true,
        call: vi.fn(async () => { throw new Error('durable_port_not_configured') }),
      },
    })
    expect(await probe.read()).toEqual(ALL_NOT_READY)
  })

  it('fails closed on a malformed body', async () => {
    const probe = createSupabaseStudyAcademicReadiness({
      rpc: { isConfigured: () => true, call: vi.fn(async () => ({ status: 'ready' })) },
    })
    expect(await probe.read()).toEqual(ALL_NOT_READY)
  })
})

describe('academic readiness composition', () => {
  it('requires both the operation surface and the durable contract', () => {
    expect(combineAcademicReadiness('ready', 'ready')).toBe('ready')
    expect(combineAcademicReadiness('ready', 'not-ready')).toBe('not-ready')
    expect(combineAcademicReadiness('not-ready', 'ready')).toBe('not-ready')
    expect(combineAcademicReadiness('not-ready', 'not-ready')).toBe('not-ready')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an unknown state', 'unknown'],
    ['degraded from the database side', 'degraded'],
  ])('treats %s from the durable side as not-ready', (_label, databaseState) => {
    expect(combineAcademicReadiness('ready', databaseState)).toBe('not-ready')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an unknown state', 'unknown'],
  ])('treats %s from the operation surface as not-ready', (_label, surfaceState) => {
    expect(combineAcademicReadiness(surfaceState, 'ready')).toBe('not-ready')
  })

  it('preserves a degraded operation surface only when the contract exists', () => {
    expect(combineAcademicReadiness('degraded', 'ready')).toBe('degraded')
    expect(combineAcademicReadiness('degraded', 'not-ready')).toBe('not-ready')
  })
})
