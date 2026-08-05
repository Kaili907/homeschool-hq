import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyLocalSafetyStopsSurface } from './StudyLocalSafetyStopsPanel'

describe('Parent Hub local safety panel', () => {
  it('distinguishes a local outage stop from server-captured events', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[{
      schemaVersion: 1, recordId: 'local-safety-stop:test', occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed', captureOrigin: 'local-pre-acceptance-stop',
    }]} />)
    expect(html).toContain('Safety gateway unavailable')
    expect(html).toContain('learner:test')
    expect(html).toContain('Local capture only')
    expect(html).toContain('not server-captured events')
  })
})
