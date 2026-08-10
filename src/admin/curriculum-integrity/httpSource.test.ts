import { describe, expect, it, vi } from 'vitest'
import { CurriculumIntegrityError } from './contracts'
import { createCurriculumIntegrityHttpSource } from './httpSource'

describe('curriculum integrity HTTP source', () => {
  it('uses one credentialed GET and sends no client authority or mutation body', async () => {
    const report = { schemaVersion: 1, status: 'UNAVAILABLE', subjects: [], evidenceGaps: [], readOnly: true }
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => report }))
    await expect(createCurriculumIntegrityHttpSource(fetchImpl, async () => 'token').readIntegrity())
      .resolves.toEqual(report)
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/curriculum/integrity', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer token' },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/role|capabilit|body/i)
  })

  it.each([[401, 'unauthenticated'], [403, 'forbidden'], [503, 'unavailable']] as const)(
    'maps HTTP %s to %s', async (status, code) => {
      const source = createCurriculumIntegrityHttpSource(
        vi.fn(async () => ({ ok: false, status, json: async () => ({}) })),
        async () => 'token',
      )
      await expect(source.readIntegrity()).rejects.toMatchObject({ code } satisfies Partial<CurriculumIntegrityError>)
    },
  )
})
