import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { HOSTED_SYNC_RPC } from './types'

describe('hosted sync R2 client/SQL signature lock', () => {
  it('pins every client method to the function and signature installed by DB R2', async () => {
    const sql = await readFile(new URL('../../../../../supabase/migrations/20260813172000_academy_study_sync_lossless_v2.sql', import.meta.url), 'utf8')
    expect(HOSTED_SYNC_RPC).toEqual({
      firstLink: 'academy_study_sync_first_link_v2',
      resolveMapping: 'academy_study_sync_resolve_mapping_v2',
      hydrate: 'academy_study_sync_hydrate_v2',
      write: 'academy_study_sync_write_v2',
    })
    expect(sql).toContain('academy_study_sync_first_link_v2(\n  text, uuid, uuid, jsonb')
    expect(sql).toContain('academy_study_sync_resolve_mapping_v2(\n  text, uuid, jsonb')
    expect(sql).toContain('academy_study_sync_hydrate_v2(\n  text, uuid, text, text')
    expect(sql).toContain('academy_study_sync_write_v2(\n  text, uuid, text, text, bigint, uuid, text, jsonb')
  })
})
