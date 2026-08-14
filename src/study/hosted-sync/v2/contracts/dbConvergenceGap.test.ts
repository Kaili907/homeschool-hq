import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('hosted sync R2 canonical-state/DB convergence repair', () => {
  it('keeps the normalized checkpoint and adds exact bounded reconstruction authority', async () => {
    const [state, durable, recovery, legacySql, repairSql] = await Promise.all([
      readFile(new URL('./types.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../family-pilot/durable-ports/schema.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../contracts/persistence/types.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../../../supabase/migrations/20260813172000_academy_study_sync_lossless_v2.sql', import.meta.url), 'utf8'),
      readFile(new URL('../../../../../supabase/migrations/20260813173000_academy_study_sync_lossless_checkpoint_r1.sql', import.meta.url), 'utf8'),
    ])
    expect(state).toContain('readonly indexedDbDocument: DurableStudyDocumentV1')
    expect(durable).toContain('readonly calendar: readonly DurableCalendarRecordV1[]')
    expect(durable).toContain('readonly preferences: StudyLearnerPreferences | null')
    expect(durable).toContain('readonly outbox: readonly StudyOutboxProposal[]')
    expect(recovery).toContain("contract: 'study-core-bridge.recovery-checkpoint.v1'")
    expect(recovery).toContain('safeInstructionalCursor')
    expect(recovery).toContain('protectedTutorStateRef')
    expect(legacySql).toContain("'checkpoint', case when checkpoint.id is null then null else")
    expect(legacySql).not.toContain("'indexedDbDocument'")
    expect(repairSql).toContain('study_sync_authority_checkpoints_r1')
    expect(repairSql).toContain("'authorityCheckpoint'")
    expect(repairSql).toContain('2097152')
    expect(repairSql).toContain('study_sync_authority_checkpoint_shape_valid_r1')
    expect(repairSql).toContain("'authority-checkpoint:compare-and-swap'")
  })
})
