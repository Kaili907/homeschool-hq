import { describe, expect, it, vi } from 'vitest'
import { createAdminOperationalAggregateReader } from './admin-operational-aggregate-reader.js'

describe('Admin operational aggregate reader', () => {
  it('calls only the bounded aggregate RPC with an asserted Admin capability', async () => {
    const abortSignal = vi.fn(async () => ({
      data: { completeness: { grouping: 'complete' }, totalEventCount: 501, groups: [] },
      error: null,
    }))
    const rpc = vi.fn(() => ({ abortSignal }))
    const reader = createAdminOperationalAggregateReader({ client: { rpc } })
    await expect(reader.aggregate({
      start: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
      engine: 'study', engineVersion: 'study.v2', courseRef: 'math-5', unitRef: 'unit-1',
      capability: 'engines:read',
    })).resolves.toMatchObject({ totalEventCount: 501 })
    expect(rpc).toHaveBeenCalledWith('academy_aggregate_operational_events_v2', {
      p_start: '2026-08-08T00:00:00.000Z',
      p_end: '2026-08-09T00:00:00.000Z',
      p_engine: 'study',
      p_engine_version: 'study.v2',
      p_course_ref: 'math-5',
      p_unit_ref: 'unit-1',
      p_required_capability: 'engines:read',
    })
  })

  it('maps aggregate group overflow to incomplete evidence without exposing database detail', async () => {
    const client = {
      rpc: vi.fn(() => ({
        abortSignal: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '54000', message: 'raw SQL aggregate detail SECRET' },
        }),
      })),
    }
    await expect(createAdminOperationalAggregateReader({ client }).aggregate({
      start: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
      capability: 'health:read',
    })).rejects.toMatchObject({ code: 'source_group_incomplete' })
    await expect(createAdminOperationalAggregateReader({ client }).aggregate({
      start: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
      capability: 'health:read',
    })).rejects.not.toThrow(/SECRET/)
  })
})
