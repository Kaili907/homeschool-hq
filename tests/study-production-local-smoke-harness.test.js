import { describe, expect, it } from 'vitest'
import {
  renderStudyProductionLocalSmokeSummary,
  runStudyProductionLocalSmoke,
  STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION,
  STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX,
} from '../scripts/study-production-local-smoke.mjs'

describe.sequential('Study production local smoke harness', () => {
  it('is logically identical across two isolated runs and covers every required probe', async () => {
    const first = await runStudyProductionLocalSmoke()
    const second = await runStudyProductionLocalSmoke()

    expect(first).toEqual(second)
    expect(first.classification).toBe(STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION)
    expect(first.status).toBe('pass')
    expect(first.scenario).toMatchObject({
      fixture: 'synthetic-authorized-learner-v1',
      releaseVersion: '1.0.0',
      terminalState: 'completed',
      syntheticDataOnly: true,
    })
    expect(first.isolation).toEqual({
      database: 'in-memory-pglite',
      persistedOutsideHarness: false,
    })
    expect(first.steps.map(({ id }) => id)).toEqual([
      'settings',
      'release-authority',
      'enrollment',
      'authorized-learner',
      'session-begin',
      'immutable-release-binding',
      'bound-content',
      'transition',
      'checkpoint',
      'resume',
      'completion',
      'external-contact',
    ])
    expect(first.negativeCases.map(({ id }) => id).sort()).toEqual([
      'content-membership-mismatch',
      'duplicate-replay',
      'forged-authority',
      'legacy-ambiguous-session',
      'malformed-dto',
      'manifest-mismatch',
      'settings-unavailable',
      'stale-revision',
      'unpublished-release',
      'wrong-enrollment',
    ])
    expect([...first.steps, ...first.negativeCases]
      .every(({ status }) => status === 'PASS')).toBe(true)
  })

  it('renders one parseable JSON line and a stable operator checklist without private values', async () => {
    const report = await runStudyProductionLocalSmoke()
    const jsonLine = `${STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX}${JSON.stringify(report)}`
    const parsed = JSON.parse(jsonLine.slice(STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX.length))
    const summary = renderStudyProductionLocalSmokeSummary(report)

    expect(parsed).toEqual(report)
    expect(summary).toContain('settings PASS')
    expect(summary).toContain('release authority PASS')
    expect(summary).toContain('session begin PASS')
    expect(summary).toContain('bound content PASS')
    expect(summary).toContain('checkpoint PASS')
    expect(summary).toContain('resume PASS')
    expect(summary).toContain(`classification ${STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION}`)
    expect(`${jsonLine}\n${summary}`).not.toMatch(
      /aca_stu_v1_|local-only-test-token|tokenDigest|guardianId|studentId|householdId/i,
    )
  })
})
