import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyLocalSafetyStopsSurface } from '../../../src/components/hub/StudyLocalSafetyStopsPanel'

// PILOT ACCEPTANCE: "observe a safety/hold condition when one exists."
//
// The pilot's only always-reachable safety surface is the device-local Safety
// tab (StudyLocalSafetyStopsPanel). This pins the pilot-facing minimum: when
// the pilot learner's session was stopped, the supervised adult can see that
// it happened, on which learner, and that the record is honestly framed as
// best-effort rather than a guaranteed complete history. Detailed per-status
// wording is already covered by StudyLocalSafetyStopsPanel.test.tsx; this
// test states only what the pilot depends on.
describe('pilot adult can observe a safety hold on the pilot learner', () => {
  it('shows a server-answered stop for the pilot learner, without claiming a resolved/cleared state', () => {
    const html = renderToStaticMarkup(createElement(StudyLocalSafetyStopsSurface, {
      records: [{
        schemaVersion: 2,
        recordId: 'local-safety-stop:pilot-learner-1',
        occurredAt: '2026-08-12T15:00:00.000Z',
        studentRef: 'learner:pilot-family-kid',
        sessionRef: 'block-pilot:session-1',
        serverCaptureStatus: 'server-answered-stop',
        captureOrigin: 'local-session-stop',
      }],
    }))

    expect(html).toContain('learner:pilot-family-kid')
    expect(html).toContain('The safety service answered and stopped the lesson.')
    // The pilot must never be offered a way to resolve/clear this stop from
    // here, since that parent-side action does not exist yet (see
    // WAITING_ON_MAC_PARENT_OUTPUT) — this panel is observation-only.
    expect(html.toLowerCase()).not.toContain('resolved')
    expect(html).not.toContain('<button')
  })

  it('tells the pilot adult when this device could not record safety events, rather than showing a false all-clear', () => {
    const html = renderToStaticMarkup(createElement(StudyLocalSafetyStopsSurface, {
      records: [],
      historyState: 'unavailable',
    }))
    expect(html).toContain('This device could not record safety events.')
    expect(html).not.toContain('No safety stops have been recorded on this device.')
  })
})
