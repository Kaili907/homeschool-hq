import { describe, expect, it } from 'vitest'
import {
  resolveStudyEffectiveSettingsV2,
  sanitizeStudyEffectiveSettingsResult,
  type ResolveStudyEffectiveSettingsV2Input,
  type StudyEffectiveAdminDefaultsV2,
  type StudyEffectiveSafetyConstraintsV2,
} from './effectiveSettings'

const STUDENT_ID = '00000000-0000-0000-0000-000000000101'
const EFFECTIVE_DATE = '2026-08-10'

const adminDefaults: StudyEffectiveAdminDefaultsV2 = Object.freeze({
  timerMode: 'visible',
  maximumWorkMinutes: 45,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  requiredBreakIntervalMinutes: 30,
  reducedMotion: false,
  noAudio: false,
  largeText: false,
  readAloud: false,
  speechInputAllowed: false,
})

const safetyConstraints: StudyEffectiveSafetyConstraintsV2 = Object.freeze({})

function input(
  overrides: Partial<ResolveStudyEffectiveSettingsV2Input> = {},
): ResolveStudyEffectiveSettingsV2Input {
  return {
    studentId: STUDENT_ID,
    effectiveDate: EFFECTIVE_DATE,
    adminDefaults,
    guardianSettings: null,
    accommodations: [],
    safetyConstraints,
    ...overrides,
  }
}

describe('Study Effective Settings V2 resolver', () => {
  it('uses Admin defaults only to fill otherwise absent settings', () => {
    const result = resolveStudyEffectiveSettingsV2(input())

    expect(result).toMatchObject({
      schemaVersion: 2,
      status: 'ready',
      settings: {
        timerMode: 'visible',
        maximumWorkMinutes: 45,
        minimumBreakCount: 0,
        requiredBreakIntervalMinutes: 30,
      },
    })
    if (result.status !== 'ready') throw new Error('expected ready settings')
    expect(result.provenance.maximumWorkMinutes).toEqual(['admin_default'])
    expect(result.provenance.minimumBreakCount).toEqual([])
  })

  it('lets guardian settings override Admin defaults without a silent Admin overwrite', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      guardianSettings: {
        timerMode: 'count_up',
        maximumWorkMinutes: 60,
        breakMinimumMinutes: 8,
        breakMaximumMinutes: 20,
        minimumBreakCount: 2,
        reducedMotion: true,
        noAudio: true,
        largeText: true,
        readAloud: true,
        speechInputAllowed: true,
      },
    }))

    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        timerMode: 'count_up',
        maximumWorkMinutes: 60,
        breakMinimumMinutes: 8,
        breakMaximumMinutes: 20,
        minimumBreakCount: 2,
        requiredBreakIntervalMinutes: 30,
      },
    })
    if (result.status !== 'ready') throw new Error('expected ready settings')
    expect(result.provenance.maximumWorkMinutes).toEqual(['guardian'])
    expect(result.provenance.requiredBreakIntervalMinutes).toEqual(['admin_default'])
  })

  it('preserves a guardian maximum that is stricter than the Admin default', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      adminDefaults: { ...adminDefaults, maximumWorkMinutes: 90 },
      guardianSettings: { maximumWorkMinutes: 25 },
    }))

    expect(result).toMatchObject({ status: 'ready', settings: { maximumWorkMinutes: 25 } })
  })

  it('applies required accommodations as higher-authority functional constraints', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      accommodations: [{
        maximumWorkMinutes: 20,
        requiredBreakIntervalMinutes: 15,
        requiredBreakDurationMinutes: 10,
        timerVisibility: 'hidden',
        presentation: { reducedMotion: true, speechInputAllowed: false },
      }],
    }))

    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 20,
        breakMinimumMinutes: 10,
        requiredBreakIntervalMinutes: 15,
        timerMode: 'hidden',
        reducedMotion: true,
        speechInputAllowed: false,
      },
    })
    if (result.status !== 'ready') throw new Error('expected ready settings')
    expect(result.provenance.maximumWorkMinutes).toEqual(['accommodation'])
    expect(result.provenance.timerMode).toEqual(['accommodation'])
  })

  it('applies safety constraints last and does not let Admin weaken them', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      adminDefaults: {
        ...adminDefaults,
        maximumWorkMinutes: 120,
        requiredBreakIntervalMinutes: 90,
      },
      safetyConstraints: {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 12,
        breakMinimumMinutes: 9,
        timerVisibility: 'hidden',
        noAudio: true,
      },
    }))

    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 12,
        breakMinimumMinutes: 9,
        timerMode: 'hidden',
        noAudio: true,
      },
    })
    if (result.status !== 'ready') throw new Error('expected ready settings')
    expect(result.provenance.maximumWorkMinutes).toEqual(['safety'])
    expect(result.provenance.requiredBreakIntervalMinutes).toEqual(['safety'])
  })

  it('retains guardian minimumBreakCount alongside interval-based break policy', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      guardianSettings: { minimumBreakCount: 3 },
      accommodations: [{ requiredBreakIntervalMinutes: 20 }],
    }))

    expect(result).toMatchObject({
      status: 'ready',
      settings: { minimumBreakCount: 3, requiredBreakIntervalMinutes: 20 },
    })
    if (result.status !== 'ready') throw new Error('expected ready settings')
    expect(result.provenance.minimumBreakCount).toEqual(['guardian'])
    expect(result.provenance.requiredBreakIntervalMinutes).toEqual(['accommodation'])
  })

  it('routes an empty legal range to manual review without inventing a setting', () => {
    const result = resolveStudyEffectiveSettingsV2(input({
      accommodations: [{ requiredBreakDurationMinutes: 16 }],
    }))

    expect(result).toEqual({
      schemaVersion: 2,
      status: 'manual_review',
      studentId: STUDENT_ID,
      effectiveDate: EFFECTIVE_DATE,
      reasonCodes: ['break_duration_conflict'],
      sourceCategories: ['admin_default', 'accommodation'],
    })
    expect(JSON.stringify(result)).not.toMatch(/note|conversation|emotion|diagnos/i)
  })

  it('returns unavailable when an authoritative layer or required gap filler is absent', () => {
    expect(resolveStudyEffectiveSettingsV2(input({ adminDefaults: null }))).toMatchObject({
      status: 'unavailable', reasonCode: 'admin_defaults_unavailable',
    })
    expect(resolveStudyEffectiveSettingsV2(input({ safetyConstraints: null }))).toMatchObject({
      status: 'unavailable', reasonCode: 'safety_constraints_unavailable',
    })
    expect(resolveStudyEffectiveSettingsV2(input({
      adminDefaults: { ...adminDefaults, requiredBreakIntervalMinutes: undefined },
    }))).toMatchObject({
      status: 'unavailable', reasonCode: 'required_settings_unavailable',
    })
  })

  it('fails closed on malformed layer values and malformed authoritative projections', () => {
    expect(resolveStudyEffectiveSettingsV2(input({
      adminDefaults: { ...adminDefaults, requiredBreakIntervalMinutes: Number.NaN },
    }))).toMatchObject({
      status: 'manual_review', reasonCodes: ['malformed_admin_default'],
    })
    expect(resolveStudyEffectiveSettingsV2(input({
      guardianSettings: { minimumBreakCount: -1 },
    }))).toMatchObject({
      status: 'manual_review', reasonCodes: ['malformed_guardian_setting'],
    })
    expect(resolveStudyEffectiveSettingsV2(input({
      accommodations: [{ maximumWorkMinutes: 12.5 }],
    }))).toMatchObject({
      status: 'manual_review', reasonCodes: ['malformed_accommodation'],
    })
    expect(resolveStudyEffectiveSettingsV2(input({
      safetyConstraints: { requiredBreakIntervalMinutes: 0 },
    }))).toMatchObject({
      status: 'manual_review', reasonCodes: ['malformed_safety_constraint'],
    })
    expect(sanitizeStudyEffectiveSettingsResult({ schemaVersion: 2, status: 'ready' })).toBeNull()
  })

  it('is reproducible regardless of accommodation input order', () => {
    const accommodations = [
      {
        maximumWorkMinutes: 24,
        requiredBreakIntervalMinutes: 20,
        presentation: { reducedMotion: false, largeText: true },
      },
      {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 25,
        presentation: { reducedMotion: true, largeText: false },
      },
    ] as const
    const forward = resolveStudyEffectiveSettingsV2(input({ accommodations }))
    const reverse = resolveStudyEffectiveSettingsV2(input({
      accommodations: [...accommodations].reverse(),
    }))

    expect(reverse).toEqual(forward)
    expect(forward).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 20,
        reducedMotion: true,
        largeText: true,
      },
    })
  })
})
