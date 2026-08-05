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

  // A6-5-C — one Safety panel shows both kinds of stop, each with its own
  // provenance. A server-answered stop must not borrow an outage's wording.
  it('renders a server-answered stop alongside an outage stop, with distinct provenance', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[
      { schemaVersion: 2, recordId: 'local-safety-stop:answered', occurredAt: '2026-08-05T14:00:00.000Z', studentRef: 'learner:kid', sessionRef: 'block-1:session', serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' },
      { schemaVersion: 2, recordId: 'local-safety-stop:outage', occurredAt: '2026-08-05T13:00:00.000Z', studentRef: 'learner:kid', sessionRef: 'block-1:session', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed', captureOrigin: 'local-pre-acceptance-stop' },
    ]} />)
    expect(html).toContain('Lesson stopped by a safety check')
    expect(html).toContain('The safety service answered and stopped the lesson.')
    expect(html).toContain('Safety gateway unavailable')
    expect(html).toContain('Sent, but we could not confirm it was received.')
    // The always-visible best-effort disclosure survives the added row type.
    expect(html).toContain('Device-local')
    expect(html).toContain('may be incomplete')
    // A6-4's honesty condition: never claimed complete or authoritative.
    expect(html.toLowerCase()).not.toContain('complete record')
    expect(html.toLowerCase()).not.toContain('all safety')
  })

  it('still renders a stop whose capture status it does not recognise', () => {
    const html = renderToStaticMarkup(<StudyLocalSafetyStopsSurface records={[{
      schemaVersion: 2, recordId: 'local-safety-stop:future', occurredAt: '2026-08-05T14:00:00.000Z', studentRef: 'learner:kid', sessionRef: 'block-1:session', serverCaptureStatus: 'status-from-a-newer-build', captureOrigin: 'local-session-stop',
    }]} />)
    expect(html).toContain('learner:kid')
    expect(html).toContain('The safety service capture status is unknown.')
  })
})
