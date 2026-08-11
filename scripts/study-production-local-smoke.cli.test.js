import { describe, expect, it } from 'vitest'
import {
  renderStudyProductionLocalSmokeSummary,
  runStudyProductionLocalSmoke,
  STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION,
  STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX,
} from './study-production-local-smoke.mjs'

describe('Study production local smoke command', () => {
  it('prints deterministic machine and operator reports for a passing local authority path', async () => {
    const report = await runStudyProductionLocalSmoke()
    console.log(`${STUDY_PRODUCTION_LOCAL_SMOKE_JSON_PREFIX}${JSON.stringify(report)}`)
    console.log(renderStudyProductionLocalSmokeSummary(report))

    expect(report.classification).toBe(STUDY_PRODUCTION_LOCAL_SMOKE_CLASSIFICATION)
    expect(report.status).toBe('pass')
    expect(report.externalContact).toEqual({ allowed: false, attempts: 0, status: 'PASS' })
  })
})
