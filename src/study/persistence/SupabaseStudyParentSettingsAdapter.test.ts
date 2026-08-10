import { describe, expect, it, vi } from 'vitest'
import { SupabaseStudyParentSettingsAdapter } from './SupabaseStudyParentSettingsAdapter'
import type { StudySupabaseClient } from './supabaseShared'

const STUDENT_ID = '00000000-0000-0000-0000-000000000101'
const EFFECTIVE_DATE = '2026-08-10'

function client(data: unknown): StudySupabaseClient {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'synthetic-token' } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data, error: null })),
  }
}

describe('SupabaseStudyParentSettingsAdapter V2 effective settings', () => {
  it('uses only the authorized V2 RPC and returns its typed minimized result', async () => {
    const projection = {
      schemaVersion: 2,
      status: 'ready',
      studentId: STUDENT_ID,
      effectiveDate: EFFECTIVE_DATE,
      settings: {
        timerMode: 'visible',
        maximumWorkMinutes: 30,
        breakMinimumMinutes: 5,
        breakMaximumMinutes: 15,
        minimumBreakCount: 0,
        requiredBreakIntervalMinutes: 30,
        reducedMotion: false,
        noAudio: false,
        largeText: false,
        readAloud: false,
        speechInputAllowed: false,
      },
      provenance: {
        timerMode: ['admin_default'],
        maximumWorkMinutes: ['admin_default'],
        breakMinimumMinutes: ['admin_default'],
        breakMaximumMinutes: ['admin_default'],
        minimumBreakCount: [],
        requiredBreakIntervalMinutes: ['admin_default'],
        reducedMotion: ['admin_default'],
        noAudio: ['admin_default'],
        largeText: ['admin_default'],
        readAloud: ['admin_default'],
        speechInputAllowed: ['admin_default'],
      },
    }
    const supabase = client(projection)
    const result = await new SupabaseStudyParentSettingsAdapter(supabase)
      .effectiveSettings(STUDENT_ID, EFFECTIVE_DATE)

    expect(result).toEqual(projection)
    expect(supabase.rpc).toHaveBeenCalledWith('academy_study_effective_settings_v2', {
      p_student_id: STUDENT_ID,
      p_effective_date: EFFECTIVE_DATE,
    })
  })

  it('fails closed as unavailable when the database projection is malformed', async () => {
    const result = await new SupabaseStudyParentSettingsAdapter(client({
      schemaVersion: 2,
      status: 'ready',
      privateNote: 'must-not-pass',
    })).effectiveSettings(STUDENT_ID, EFFECTIVE_DATE)

    expect(result).toEqual({
      schemaVersion: 2,
      status: 'unavailable',
      studentId: STUDENT_ID,
      effectiveDate: EFFECTIVE_DATE,
      reasonCode: 'authoritative_source_unavailable',
    })
  })
})
