import { describe, expect, it } from 'vitest'
import { studySessionTelemetryInvocationReadiness } from './invocation-readiness.js'

const CONFIGURED_ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.example.test',
  SUPABASE_ANON_KEY: 'public-anon-test-key',
  ACADEMY_APP_VERSION: 'deploy.2026.08.10',
  ACADEMY_STUDY_ENGINE_VERSION: 'study.v2',
})

describe('Study session telemetry invocation readiness', () => {
  it('projects only minimized locally knowable readiness', () => {
    const readiness = studySessionTelemetryInvocationReadiness({ env: CONFIGURED_ENV })
    expect(readiness).toEqual({
      schemaVersion: 1,
      workerCode: 'available',
      manualAuthority: 'configured',
      scheduledEntrypoint: 'available',
      schedule: 'not_configured',
      deploymentVersions: 'configured',
      telemetryWriter: 'available',
    })
    expect(JSON.stringify(readiness)).not.toMatch(
      /learner|student|answer|transcript|note|safety|secret|provider|database|key/i,
    )
  })

  it.each([
    [{ ...CONFIGURED_ENV, ACADEMY_APP_VERSION: undefined }],
    [{ ...CONFIGURED_ENV, ACADEMY_STUDY_ENGINE_VERSION: undefined }],
    [{ ...CONFIGURED_ENV, ACADEMY_APP_VERSION: 'latest' }],
    [{ ...CONFIGURED_ENV, ACADEMY_STUDY_ENGINE_VERSION: 'LATEST' }],
  ])('reports missing or mutable deployment versions as not configured', (env) => {
    expect(studySessionTelemetryInvocationReadiness({ env }).deploymentVersions)
      .toBe('not_configured')
  })

  it('reports absent manual authority configuration without exposing configuration values', () => {
    const readiness = studySessionTelemetryInvocationReadiness({
      env: {
        ACADEMY_APP_VERSION: 'deploy.2026.08.10',
        ACADEMY_STUDY_ENGINE_VERSION: 'study.v2',
      },
    })
    expect(readiness.manualAuthority).toBe('not_configured')
    expect(readiness.schedule).toBe('not_configured')
  })
})
