import { describe, expect, it, vi } from 'vitest'
import { readAdminCurriculumValidation } from './httpSource'

describe('authorized curriculum validation source', () => {
  it('sends only a bearer to the GET-only server seam and builds vetted output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        curriculumManifest: { package_id: 'manuel-academy', version: '1.0.0' },
        validation: { overall: 'PASS', curriculum_version: '1.0.0', checks: [] },
      }),
    })
    const model = await readAdminCurriculumValidation({
      fetchImpl,
      getAccessToken: async () => 'access-token',
    })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/curriculum/validation', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
    }))
    expect(model?.curriculumVersion).toBe('1.0.0')
  })

  it('fails closed without a token or on server failure', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminCurriculumValidation({ fetchImpl, getAccessToken: async () => null })).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(readAdminCurriculumValidation({
      fetchImpl: vi.fn().mockResolvedValue({ status: 503, json: async () => ({ raw: 'secret' }) }),
      getAccessToken: async () => 'token',
    })).resolves.toBeNull()
  })
})
