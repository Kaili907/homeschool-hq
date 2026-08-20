import { describe, expect, it, vi } from 'vitest'
import { CurriculumIntegrityError } from './contracts'
import { createCurriculumIntegrityHttpSource, parseCurriculumIntegrityReport } from './httpSource'

function incompleteReport() {
  return {
    schemaVersion: 1, status: 'INCOMPLETE', readOnly: true,
    subjects: [{
      subjectId: 'published:1.0.0', kind: 'published', version: '1.0.0', state: 'PUBLISHED',
      status: 'INCOMPLETE', packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      baseReleaseVersion: null, schemaSetVersion: null, manifestStatus: 'VERIFIED',
      packageStatus: 'UNVERIFIED', metadataStatus: 'VERIFIED',
      artifacts: { status: 'VERIFIED', expectedCount: 10, observedCount: 10, verifiedCount: 10 },
      provenance: {
        status: 'INCOMPLETE',
        links: [
          { kind: 'draft', label: 'Draft revision', status: 'UNVERIFIED', identity: null, detail: 'raw internal note' },
          { kind: 'validation', label: 'Validation', status: 'UNVERIFIED', identity: null, detail: null },
          { kind: 'approval', label: 'Approval', status: 'UNVERIFIED', identity: null, detail: null },
          { kind: 'staging', label: 'Staging', status: 'UNVERIFIED', identity: null, detail: null },
          { kind: 'published', label: 'Published release', status: 'VERIFIED', identity: '1.0.0', detail: null },
        ],
      },
      mismatches: [],
      evidenceGaps: [{ code: 'package_hash_unavailable', message: 'private filesystem exception' }],
    }],
    evidenceGaps: [],
  }
}

describe('curriculum integrity HTTP source', () => {
  it('uses one credentialed GET and sends no client authority or mutation body', async () => {
    const report = { schemaVersion: 1, status: 'UNAVAILABLE', subjects: [], evidenceGaps: [], readOnly: true }
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => report }))
    await expect(createCurriculumIntegrityHttpSource(fetchImpl, async () => 'token').readIntegrity())
      .resolves.toEqual(report)
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/curriculum/integrity', expect.objectContaining({
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer token' },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    }))
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

  it('rejects false VERIFIED aggregate metadata and unexpected success keys', () => {
    const report = incompleteReport()
    const subject = report.subjects[0]
    expect(parseCurriculumIntegrityReport({
      ...report,
      status: 'VERIFIED',
      subjects: [{ ...subject, status: 'VERIFIED' }],
    })).toBeNull()
    expect(parseCurriculumIntegrityReport({ ...report, rawException: 'private database body' })).toBeNull()
  })

  it('normalizes server text so exception-shaped evidence cannot reach the UI', () => {
    const report = parseCurriculumIntegrityReport(incompleteReport())
    expect(report?.status).toBe('INCOMPLETE')
    expect(JSON.stringify(report)).not.toMatch(/private|filesystem|internal note/i)
    expect(report?.subjects[0].evidenceGaps[0].code).toBe('package_hash_unavailable')
  })

  it('accepts old and expanded governed-grade package identities and rejects unsupported grades', () => {
    const report = incompleteReport()
    const subject = report.subjects[0]
    const expanded = 'manuel-academy-grades-3-4-5-7-8-9-10-11-12-curriculum-v1'

    expect(parseCurriculumIntegrityReport({
      ...report, subjects: [{ ...subject, packageId: expanded }],
    })?.subjects[0].packageId).toBe(expanded)
    expect(parseCurriculumIntegrityReport({
      ...report, subjects: [{ ...subject, packageId: 'manuel-academy-grades-5-6-7-curriculum-v1' }],
    })).toBeNull()
  })

  it('maps malformed 200 responses to bounded unavailability', async () => {
    const source = createCurriculumIntegrityHttpSource(
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'VERIFIED' }) })),
      async () => 'token',
    )
    await expect(source.readIntegrity()).rejects.toEqual(new CurriculumIntegrityError('unavailable'))
  })
})
