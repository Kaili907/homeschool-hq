import { describe, expect, it, vi } from 'vitest'
import {
  AdminOperationalAggregateReadError,
  createAdminOperationalAggregateReader,
} from './admin-operational-aggregate-reader.js'

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
    const rpc = vi.fn(() => ({
      abortSignal: vi.fn(async () => ({
        data: null,
        error: { code: '54000', message: 'OPERATIONAL_TELEMETRY_AGGREGATE_GROUP_LIMIT private detail' },
      })),
    }))
    const reader = createAdminOperationalAggregateReader({ client: { rpc } })
    await expect(reader.aggregate({
      start: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
      capability: 'health:read',
    })).rejects.toEqual(expect.objectContaining({
      name: 'AdminOperationalAggregateReadError',
      code: 'source_group_incomplete',
      message: 'source_group_incomplete',
    }))
    await expect(Promise.reject(new AdminOperationalAggregateReadError('source_unavailable')))
      .rejects.not.toHaveProperty('message', expect.stringContaining('private detail'))
  })
})
