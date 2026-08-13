import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('hosted Study convergence authoritative-input gap evidence', () => {
  it('proves the finalized write RPC has no operation for source attachment, normal completion, or first-link import', async () => {
    const sql = await readFile(new URL('../../../../supabase/migrations/20260813171000_academy_study_cross_device_authority.sql', import.meta.url), 'utf8')
    const operationGate = sql.match(/p_operation not in \(([\s\S]*?)\)\s*or p_payload/)?.[1] ?? ''
    expect(operationGate).toContain("'checkpoint:compare-and-swap'")
    expect(operationGate).toContain("'safety:stop'")
    expect(operationGate).toContain("'safety:clear'")
    expect(operationGate).toContain("'guardian-attestation:attest'")
    expect(operationGate).not.toMatch(/source|completion|assignment|first-link|import/i)
  })

  it('proves hydrate cannot reconstruct audited source, safety-hold, or guardian-attestation records', async () => {
    const sql = await readFile(new URL('../../../../supabase/migrations/20260813171000_academy_study_cross_device_authority.sql', import.meta.url), 'utf8')
    const hydrate = sql.match(/create function public\.academy_study_sync_hydrate_v1\([\s\S]*?\nend;\n\$\$;/)?.[0] ?? ''
    expect(hydrate).toContain("'dynamicSourceReadiness'")
    expect(hydrate).toContain("'guardianAttestation'")
    expect(hydrate).toContain("'safety'")
    expect(hydrate).not.toMatch(/'sourceRef'|'title'|'publisher'|'publishedAt'|'attachedAt'/)
    expect(hydrate).not.toMatch(/'holdRef'|'reasonCode'|'clearedBy'/)
    expect(hydrate).not.toMatch(/'learnerAssertedAt'|'attestedByRef'|'evidenceMode'/)
  })

  it('proves the generic transport protocol is not the finalized DB RPC protocol', async () => {
    const transport = await readFile(new URL('../transport/types.ts', import.meta.url), 'utf8')
    const sql = await readFile(new URL('../../../../supabase/migrations/20260813171000_academy_study_cross_device_authority.sql', import.meta.url), 'utf8')
    expect(transport).toContain("mutation: 'REPLACE_MINIMIZED_STUDY_DOCUMENT'")
    expect(transport).toContain("type StudySyncOperation = 'HYDRATE' | 'PULL' | 'PUSH' | 'ACKNOWLEDGE'")
    expect(sql).not.toContain('REPLACE_MINIMIZED_STUDY_DOCUMENT')
    expect(sql).not.toContain('academy_study_sync_pull_v1')
    expect(sql).not.toContain('academy_study_sync_acknowledge_v1')
  })

  it('proves the audited local and DB checkpoint records are not losslessly interchangeable', async () => {
    const local = await readFile(new URL('../../types.ts', import.meta.url), 'utf8')
    const hosted = await readFile(new URL('../../contracts/persistence/types.ts', import.meta.url), 'utf8')
    const localCheckpoint = local.match(/export interface StudyCheckpoint \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const hostedCheckpoint = hosted.match(/export interface StudyCheckpointRecord \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(localCheckpoint).toContain('completedSegmentRefs')
    expect(localCheckpoint).not.toContain('safeInstructionalCursor')
    expect(localCheckpoint).not.toContain('protectedTutorStateRef')
    expect(hostedCheckpoint).toContain('safeInstructionalCursor')
    expect(hostedCheckpoint).toContain('protectedTutorStateRef')
    expect(hostedCheckpoint).toContain('perSegmentActiveTime')
  })
})
