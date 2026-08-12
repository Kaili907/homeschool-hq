import { describe, expect, it } from 'vitest'
import { isFamilyPilotDiagnosticsEnabled, isFamilyPilotEnabled } from './familyPilotFlag'

describe('Family Pilot feature gate', () => {
  it.each([undefined, '', 'false', 'TRUE', 'True', '1', ' true ', 'yes', 'on'])(
    'defaults disabled for %s',
    (value) => {
      expect(isFamilyPilotEnabled(value)).toBe(false)
    },
  )

  it('enables only exact true', () => {
    expect(isFamilyPilotEnabled('true')).toBe(true)
  })
})

describe('Family Pilot diagnostics isolation', () => {
  it('requires a development build plus both exact flags', () => {
    expect(isFamilyPilotDiagnosticsEnabled({
      developmentBuild: true, pilotFlagValue: 'true', diagnosticsFlagValue: 'true',
    })).toBe(true)
    // A production build must never show diagnostics, however the flags are set.
    expect(isFamilyPilotDiagnosticsEnabled({
      developmentBuild: false, pilotFlagValue: 'true', diagnosticsFlagValue: 'true',
    })).toBe(false)
    expect(isFamilyPilotDiagnosticsEnabled({
      developmentBuild: true, pilotFlagValue: 'true', diagnosticsFlagValue: undefined,
    })).toBe(false)
    expect(isFamilyPilotDiagnosticsEnabled({
      developmentBuild: true, pilotFlagValue: 'false', diagnosticsFlagValue: 'true',
    })).toBe(false)
  })
})
