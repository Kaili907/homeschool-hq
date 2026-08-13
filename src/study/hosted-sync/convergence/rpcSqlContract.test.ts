import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ACADEMY_STUDY_SYNC_HYDRATE_RPC, ACADEMY_STUDY_SYNC_WRITE_RPC } from './rpcClient'

describe('hosted Study client/SQL signature drift control', () => {
  it('pins the production client to the locally validated migration signatures', async () => {
    const sql = await readFile(new URL('../../../../supabase/migrations/20260813171000_academy_study_cross_device_authority.sql', import.meta.url), 'utf8')
    expect(sql).toContain(`create function public.${ACADEMY_STUDY_SYNC_HYDRATE_RPC}(`)
    expect(sql).toContain(`create function public.${ACADEMY_STUDY_SYNC_WRITE_RPC}(`)
    expect(sql).toMatch(/academy_study_sync_hydrate_v1\(\s*p_student_id uuid,\s*p_assignment_ref text,\s*p_session_id text\s*\)/)
    expect(sql).toMatch(/academy_study_sync_write_v1\(\s*p_token_digest text,\s*p_student_id uuid,\s*p_assignment_ref text,\s*p_session_id text,\s*p_expected_revision bigint,\s*p_client_operation_id uuid,\s*p_operation text,\s*p_payload jsonb\s*\)/)
    expect(sql).toContain("p_operation not in (\n       'checkpoint:compare-and-swap',\n       'safety:stop',\n       'safety:clear',\n       'guardian-attestation:attest'")
  })
})
