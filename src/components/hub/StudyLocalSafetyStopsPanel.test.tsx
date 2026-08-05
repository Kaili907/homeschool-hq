import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyLocalSafetyStopsSurface } from './StudyLocalSafetyStopsPanel'

describe('Parent Hub local safety panel', () => {
  it('uses parent-readable per-row provenance rather than a false blanket disclaimer', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[{
      schemaVersion: 1, recordId: 'local-safety-stop:test', occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed', captureOrigin: 'local-pre-acceptance-stop',
    }]} />)
    expect(html).toContain('Safety gateway unavailable')
    expect(html).toContain('learner:test')
    expect(html).toContain('Sent, but we could not confirm it was received.')
    expect(html).not.toContain('were not server-captured events')
  })

  it('surfaces failed device storage rather than an empty history', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[]} historyState="unavailable" />)
    expect(html).toContain('This device could not record safety events.')
  })

  it('frames device-local capture honestly and restates the student stop instruction', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[]} historyState="incomplete" />)
    expect(html).toContain('Device-local')
    expect(html).toContain('may be incomplete')
    expect(html).toContain('get an adult')
  })
})
