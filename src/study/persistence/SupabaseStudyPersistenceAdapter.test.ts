import { describe, expect, it, vi } from 'vitest'
import { SupabaseStudyPersistenceAdapter } from './SupabaseStudyPersistenceAdapter'
import type { StudySupabaseClient } from './supabaseShared'

const STUDENT_ID = '00000000-0000-0000-0000-000000000101'
const BINDING = Object.freeze({
  schemaVersion: 1,
  status: 'bound',
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256:
    '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b',
})

function client(results: readonly unknown[]): StudySupabaseClient {
  let index = 0
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'synthetic-token' } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data: results[index++], error: null })),
  }
}

describe('Supabase Study immutable curriculum binding adapter', () => {
  it('resolves authority separately and sends only the requested version on create', async () => {
    const supabase = client([
      BINDING,
      { status: 'created', sessionId: 'session-a', revision: 1, curriculumBinding: BINDING },
    ])
    const adapter = new SupabaseStudyPersistenceAdapter(supabase)

    await expect(adapter.resolveCurriculumBinding({
      studentId: STUDENT_ID,
      subjectId: 'math',
      intendedLocalDate: '2026-08-10',
      requestedReleaseVersion: '1.0.0',
    })).resolves.toEqual(BINDING)
    await expect(adapter.createSession({
      id: 'session-a',
      schemaVersion: 1,
      studentId: STUDENT_ID,
      lessonId: 'lesson-a',
      subjectId: 'math',
      studyPlanId: null,
      state: 'active',
      startedAt: '2026-08-10T15:00:00.000Z',
      completedAt: null,
      intendedLocalDate: '2026-08-10',
      curriculumReleaseVersion: '1.0.0',
    }, 'session-a-create')).resolves.toMatchObject({
      status: 'created',
      curriculumBinding: BINDING,
    })

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      'academy_study_resolve_curriculum_binding_v1',
      {
        p_student_id: STUDENT_ID,
        p_subject_id: 'math',
        p_intended_local_date: '2026-08-10',
        p_requested_release_version: '1.0.0',
      },
    )
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      'academy_study_create_session',
      expect.objectContaining({
        p_session: expect.objectContaining({
          curriculum_release_version: '1.0.0',
        }),
      }),
    )
    expect(JSON.stringify((supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[1][1]))
      .not.toMatch(/release_id|manifest_sha/i)
  })

  it('preserves bounded unavailable results and rejects fabricated binding projections', async () => {
    const unavailable = {
      schemaVersion: 1,
      status: 'unavailable',
      reasonCode: 'curriculum-release-mismatch',
    }
    await expect(new SupabaseStudyPersistenceAdapter(client([unavailable]))
      .resolveCurriculumBinding({
        studentId: STUDENT_ID,
        subjectId: 'math',
        intendedLocalDate: '2026-08-10',
        requestedReleaseVersion: '2.0.0',
      })).resolves.toEqual(unavailable)

    await expect(new SupabaseStudyPersistenceAdapter(client([{
      ...BINDING,
      curriculumManifestSha256: 'not-a-digest',
    }])).resolveCurriculumBinding({
      studentId: STUDENT_ID,
      subjectId: 'math',
      intendedLocalDate: '2026-08-10',
      requestedReleaseVersion: '1.0.0',
    })).rejects.toThrow(/curriculum_binding_contract/)

    await expect(new SupabaseStudyPersistenceAdapter(client([{
      status: 'unexpected',
      curriculumBinding: BINDING,
    }])).createSession({
      id: 'session-invalid-response',
      schemaVersion: 1,
      studentId: STUDENT_ID,
      lessonId: 'lesson-invalid-response',
      subjectId: 'math',
      studyPlanId: null,
      state: 'active',
      startedAt: '2026-08-10T15:00:00.000Z',
      completedAt: null,
      intendedLocalDate: '2026-08-10',
      curriculumReleaseVersion: '1.0.0',
    }, 'session-invalid-response-create')).rejects.toThrow(/curriculum_binding_contract/)
  })
})
