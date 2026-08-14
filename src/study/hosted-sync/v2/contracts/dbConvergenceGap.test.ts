import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('hosted sync R2 canonical-state/DB convergence blocker', () => {
  it('proves the full local durable document and DB recovery checkpoint are not a lossless bijection', async () => {
    const [state, durable, recovery, sql] = await Promise.all([
      readFile(new URL('./types.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../family-pilot/durable-ports/schema.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../contracts/persistence/types.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../../../supabase/migrations/20260813172000_academy_study_sync_lossless_v2.sql', import.meta.url), 'utf8'),
    ])
    expect(state).toContain('readonly indexedDbDocument: DurableStudyDocumentV1')
    expect(durable).toContain('readonly calendar: readonly DurableCalendarRecordV1[]')
    expect(durable).toContain('readonly preferences: StudyLearnerPreferences | null')
    expect(durable).toContain('readonly outbox: readonly StudyOutboxProposal[]')
    expect(recovery).toContain("contract: 'study-core-bridge.recovery-checkpoint.v1'")
    expect(recovery).toContain('safeInstructionalCursor')
    expect(recovery).toContain('protectedTutorStateRef')
    expect(sql).toContain("'checkpoint', case when checkpoint.id is null then null else")
    expect(sql).not.toContain("'indexedDbDocument'")
  })
})
