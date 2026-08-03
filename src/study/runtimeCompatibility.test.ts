import { describe, expect, it } from 'vitest'
import { inspectRuntimeHealth } from '../../adaptive-tutor/study-engine/runtime/src/health.ts'
import { assertAcceptedStudyRuntime } from './runtimeCompatibility'

describe('accepted RC1 runtime compatibility', () => {
  it('accepts the frozen RC1 component matrix', () => {
    expect(assertAcceptedStudyRuntime().release.version).toBe('1.0.0-rc.1')
  })

  it('quarantines unsupported Study and bridge versions', () => {
    const health = inspectRuntimeHealth()
    expect(() => assertAcceptedStudyRuntime({ ...health, compatibility: { ...health.compatibility, studySchemaVersion: 2 as 1 } })).toThrow(/quarantined/i)
    expect(() => assertAcceptedStudyRuntime({ ...health, components: { ...health.components, tutorCoreBridge: '2.0.0' as '1.0.1' } })).toThrow(/quarantined/i)
  })
})
