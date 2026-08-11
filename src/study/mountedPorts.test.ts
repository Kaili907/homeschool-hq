import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createStudySessionTransport } from './client/studySessionTransport'
import type { StudySessionGrant } from './contracts/identity/session'
import { createMountedStudyPorts } from './mountedPorts'
import type { MountedStudySafetyPortDeps } from './safety/mountedPort'

// STUDY-A1-AUTH-C — the mounted composition is the only place that can hand the
// App a recovery seam for a refused Study session. Its public parameter must
// therefore be the mounted port's own dependency type, not the narrower client
// one, or the callback cannot be passed without a cast.

const here = dirname(fileURLToPath(import.meta.url))

/** Compile-time: an inline callback object must satisfy the public parameter. */
type MountedStudyPortsDeps = NonNullable<Parameters<typeof createMountedStudyPorts>[0]>
const inlineDeps: MountedStudyPortsDeps = { onSessionAuthorizationFailure: () => {} }
const widened: MountedStudySafetyPortDeps = inlineDeps

function installedTransport() {
  const transport = createStudySessionTransport()
  transport.install({
    schemaVersion: 1,
    status: 'issued',
    sessionReference: 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa',
    expiresAt: '2026-08-06T12:00:00.000Z',
  } as StudySessionGrant)
  return transport
}

describe('mounted Study port composition', () => {
  it('accepts an inline session-authorization callback without a cast', () => {
    expect(typeof inlineDeps.onSessionAuthorizationFailure).toBe('function')
    expect(widened).toBe(inlineDeps)
  })

  it('forwards the callback unchanged to the mounted safety port', async () => {
    const seen: string[] = []
    const { ports } = createMountedStudyPorts({
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
      sessionAuthorization: installedTransport(),
      onSessionAuthorizationFailure: (reason) => { seen.push(reason) },
    })
    expect(ports.safety.mode).toBe('production')
    await expect(ports.safety.evaluate({
      scope: {
        householdRef: 'household:mounted-composition',
        learnerRef: 'learner:mounted-composition',
        sessionRef: 'session:mounted-composition',
      },
      requestRef: 'request:mounted-composition',
      studentRef: { kind: 'legacy-profile-id', value: 'profile-mounted-composition' },
      contentKind: 'learner-input',
      transientText: 'learner input sentinel',
    })).resolves.toEqual({
      outcome: 'invalid',
      mayContinue: false,
      adultHelpState: 'not-confirmed',
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
    })
    expect(seen).toEqual(['study-session-rejected'])
  })

  it('still composes with no dependencies at all, as the App does today', () => {
    const { ports, services } = createMountedStudyPorts()
    expect(ports.safety.mode).toBe('production')
    expect(services).toBeDefined()
  })

  // Phase 7 keeps this file a pure composition seam: it exposes the callback but
  // neither imports nor constructs a lifecycle, which stays the App's job.
  it('neither imports nor constructs a Study lifecycle', () => {
    const source = readFileSync(join(here, 'mountedPorts.ts'), 'utf8')
    expect(source).not.toMatch(/lifecycle/i)
    expect(source).not.toContain('StudyLifecycleBoundary')
  })
})
