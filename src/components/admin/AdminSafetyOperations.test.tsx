import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_SAFETY_READ_CAPABILITY,
  SAFETY_OPERATIONS_SCHEMA_VERSION,
  SAFETY_OPERATIONS_EVENT_LIMIT,
  adaptOperationalSafetyEvent,
  buildSafetyOperationsModel,
  filterSafetyOperationsEvents,
  readAuthorizedSafetyOperations,
  type AdminSafetyReadAuthorization,
  type SafetyOperationsEventV1,
  type SafetyOperationsSnapshotV1,
} from '../../admin/safetyOperationsModel'
import type { AdminOperationalEvent } from '../../telemetry/operationalTelemetry'
import { AdminSafetyOperations } from './AdminSafetyOperations'

const AUTHORIZED: AdminSafetyReadAuthorization = {
  status: 'authorized',
  role: 'viewer',
  capabilities: [ADMIN_SAFETY_READ_CAPABILITY],
}

const OPEN_STOP: SafetyOperationsEventV1 = {
  schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
  eventRef: 'safety-event:open-1',
  source: 'study-safety-stops',
  learner: { reference: 'learner:one', displayName: 'Learner One' },
  occurredAt: '2026-08-08T14:00:00.000Z',
  engine: 'study',
  evidenceCategory: 'safety-stop',
  reasonCode: 'gateway-503',
  state: 'open',
  resolution: { state: 'unresolved' },
  history: [{ occurredAt: '2026-08-08T14:00:00.000Z', state: 'open', reasonCode: 'gateway-503' }],
}

function metric(value: number) {
  return { status: 'available' as const, value }
}

function summary(overrides: Partial<SafetyOperationsSnapshotV1['summary']> = {}): SafetyOperationsSnapshotV1['summary'] {
  return {
    openSafetyStops: metric(0),
    resolvedSafetyStops: metric(0),
    adultReviewPending: metric(0),
    failClosedEvents: metric(0),
    safetyStopEvents: metric(0),
    fallbackRejectionEvents: metric(0),
    unresolvedSafetyConditions: metric(0),
    ...overrides,
  }
}

function snapshot(events: readonly SafetyOperationsEventV1[] = [], overrides: Partial<SafetyOperationsSnapshotV1> = {}): SafetyOperationsSnapshotV1 {
  return {
    schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
    observedAt: '2026-08-08T15:00:00.000Z',
    summary: summary(),
    sources: [
      { source: 'study-safety-stops', status: 'available' },
      { source: 'study-adult-review', status: 'available' },
      { source: 'study-safety-monitoring', status: 'available' },
    ],
    operationalTelemetry: { status: 'available' },
    events,
    page: { limit: 50, nextCursor: null },
    ...overrides,
  }
}

function render(snapshotValue: SafetyOperationsSnapshotV1): string {
  return renderToStaticMarkup(<AdminSafetyOperations authorization={AUTHORIZED} readState={{ status: 'ready', snapshot: snapshotValue }} />)
}

describe('ADMIN-10 read-only Safety Operations', () => {
  it('adapts only canonical safety stops and preserves operational version evidence', () => {
    const operational: AdminOperationalEvent = {
      schemaVersion: 2,
      eventId: 'event:safety:one',
      occurredAt: '2026-08-08T14:00:00.000Z',
      scope: 'household',
      householdRef: 'household:one',
      learnerRef: 'learner:one',
      engine: 'assessment',
      appVersion: 'app-1',
      engineVersion: 'assessment-2',
      curriculumVersion: 'curriculum-1',
      courseRef: null,
      unitRef: null,
      lessonRef: null,
      skillRef: null,
      eventType: 'safety.classification',
      result: 'safety_stop',
      durationMs: 12,
      metadata: { reason_code: 'safety-uncertain-danger-v1' },
    }
    const adapted = adaptOperationalSafetyEvent(operational)
    expect(adapted?.engine).toBe('assessment')
    expect(adapted?.versionSnapshot).toEqual({
      appVersion: 'app-1', engineVersion: 'assessment-2', curriculumVersion: 'curriculum-1',
    })
    expect(adaptOperationalSafetyEvent({ ...operational, result: 'provider_error' })).toBeNull()
    const html = render(snapshot(adapted ? [adapted] : []))
    expect(html).toContain('assessment-2')
    expect(html).toContain('curriculum-1')
  })

  it('displays an open safety stop and its bounded drilldown', () => {
    const value = snapshot([OPEN_STOP], { summary: summary({ openSafetyStops: metric(1), unresolvedSafetyConditions: metric(1) }) })
    const html = render(value)
    expect(html).toContain('Open safety stops</dt><dd>1')
    expect(html).toContain('Learner One')
    expect(html).toContain('gateway-503')
    expect(html).toContain('A safety dependency failed closed and paused the Study session.')
    expect(html).toContain('Unresolved')
  })

  it('displays a resolved safety state with existing authorized-adult metadata', () => {
    const resolved: SafetyOperationsEventV1 = {
      ...OPEN_STOP,
      eventRef: 'safety-event:resolved-1',
      state: 'resolved',
      resolution: {
        state: 'resolved',
        resolvedAt: '2026-08-08T14:30:00.000Z',
        authorizedAdultRef: 'authorized-adult:operator-7',
      },
      history: [
        ...OPEN_STOP.history,
        { occurredAt: '2026-08-08T14:30:00.000Z', state: 'resolved' },
      ],
    }
    const value = snapshot([resolved], { summary: summary({ resolvedSafetyStops: metric(1) }) })
    const html = render(value)
    expect(html).toContain('Resolved safety stops</dt><dd>1')
    expect(html).toContain('Authorized adult reference')
    expect(html).toContain('authorized-adult:operator-7')
  })

  it('displays a pending adult review without claiming delivery', () => {
    const pending: SafetyOperationsEventV1 = {
      ...OPEN_STOP,
      eventRef: 'adult-review:pending-1',
      source: 'study-adult-review',
      evidenceCategory: 'adult-review',
      reasonCode: 'safety-provider-uncertain-v1',
      state: 'pending-review',
      resolution: { state: 'pending-adult-review' },
    }
    const value = snapshot([pending], { summary: summary({ adultReviewPending: metric(1) }) })
    const html = render(value)
    expect(html).toContain('Adult review pending</dt><dd>1')
    expect(html).toContain('Pending adult review')
    expect(html.toLowerCase()).not.toContain('adult was notified')
  })

  it('renders a legitimate zero only when the authorized snapshot reports zero', () => {
    const html = render(snapshot())
    expect(html).toContain('No safety events in the authorized range')
    expect(html).toContain('legitimate zero state')
    expect(html.match(/<dd>0<\/dd>/g)).toHaveLength(7)
  })

  it('distinguishes unavailable sources and metrics from zero', () => {
    const value = snapshot([], {
      sources: [{ source: 'study-safety-monitoring', status: 'unavailable' }],
      summary: {
        openSafetyStops: { status: 'unavailable' },
        resolvedSafetyStops: { status: 'unavailable' },
        adultReviewPending: { status: 'unavailable' },
        failClosedEvents: { status: 'unavailable' },
        safetyStopEvents: { status: 'unavailable' },
        fallbackRejectionEvents: { status: 'unavailable' },
        unresolvedSafetyConditions: { status: 'unavailable' },
      },
    })
    const html = render(value)
    expect(html).toContain('Unavailable')
    expect(html).toContain('Unavailable sources are never counted as zero')
    expect(html).toContain('Only canonical safety evidence is projected')
    expect(html).toContain('Missing evidence is not treated as zero')
    expect(html).not.toContain('legitimate zero state')

    const unavailable = renderToStaticMarkup(<AdminSafetyOperations authorization={AUTHORIZED} readState={{ status: 'unavailable', reasonCode: 'source_unavailable' }} />)
    expect(unavailable).toContain('Safety evidence is unavailable')
    expect(unavailable).not.toContain('Safety overview')
  })

  it('degrades an unknown reason code to fixed generic copy', () => {
    const unknownCode = 'Database exploded: secret exception body'
    const html = render(snapshot([{ ...OPEN_STOP, reasonCode: unknownCode }]))
    expect(html).toContain('unknown-safety-condition')
    expect(html).toContain('Raw details are intentionally not shown.')
    expect(html).not.toContain(unknownCode)
  })

  it('uses vetted presentation for a known canonical safety reason code', () => {
    const html = render(snapshot([{ ...OPEN_STOP, reasonCode: 'safety-urgent-immediate-danger-v1' }]))
    expect(html).toContain('safety-urgent-immediate-danger-v1')
    expect(html).toContain('An urgent safety rule paused the Study session for adult review.')
  })

  it('never renders arbitrary backend exception fields', () => {
    const sentinel = 'SUPABASE RAW EXCEPTION: credential=do-not-render'
    const unsafe = { ...OPEN_STOP, rawException: sentinel, backendBody: sentinel } as SafetyOperationsEventV1
    const html = render(snapshot([unsafe]))
    expect(html).not.toContain(sentinel)
  })

  it('never renders conversation, journal, audio, or diagnostic payload fields', () => {
    const sentinels = ['RAW TUTOR CONVERSATION', 'PRIVATE JOURNAL TEXT', 'STUDENT AUDIO BYTES', 'DIAGNOSTIC EMOTIONAL LABEL']
    const unsafe = {
      ...OPEN_STOP,
      conversation: sentinels[0],
      journalText: sentinels[1],
      studentAudio: sentinels[2],
      diagnosticInference: sentinels[3],
    } as SafetyOperationsEventV1
    const html = render(snapshot([unsafe]))
    sentinels.forEach((sentinel) => expect(html).not.toContain(sentinel))
  })

  it('hides all safety data while authorization is unresolved or lacks the canonical grant', async () => {
    const unresolvedHtml = renderToStaticMarkup(<AdminSafetyOperations authorization={{ status: 'resolving' }} readState={{ status: 'ready', snapshot: snapshot([OPEN_STOP]) }} />)
    expect(unresolvedHtml).toContain('Verifying safety access')
    expect(unresolvedHtml).not.toContain('Learner One')

    const guardianOnly = { status: 'authorized', householdGuardian: true } as unknown as AdminSafetyReadAuthorization
    const guardianHtml = renderToStaticMarkup(<AdminSafetyOperations authorization={guardianOnly} readState={{ status: 'ready', snapshot: snapshot([OPEN_STOP]) }} />)
    expect(guardianHtml).toContain('Household guardian membership does not grant Admin access')
    expect(guardianHtml).not.toContain('Learner One')

    const read = vi.fn()
    await readAuthorizedSafetyOperations({ status: 'resolving' }, { read })
    expect(read).not.toHaveBeenCalled()
  })

  it('offers retry for a transient authorized safety read failure', () => {
    const html = renderToStaticMarkup(
      <AdminSafetyOperations authorization={AUTHORIZED} readState={{ status: 'unavailable', reasonCode: 'source_unavailable' }} onRetry={() => undefined} />,
    )
    expect(html).toContain('Try again')
    expect(html).toContain('type="button"')
  })

  it('contains no safety mutation controls', () => {
    const html = render(snapshot([OPEN_STOP]))
    expect(html).not.toMatch(/<button/i)
    expect(html).not.toMatch(/>Clear<|>Override<|>Resume<|>Acknowledge<|>Keep paused<|>Change safety state</i)
    expect(html).toContain('Read only')
  })

  it('supports read-only filtering and event navigation', () => {
    const resolved = { ...OPEN_STOP, eventRef: 'safety-event:resolved-2', engine: 'gateway' as const, state: 'resolved' as const, resolution: { state: 'resolved' as const } }
    expect(filterSafetyOperationsEvents([OPEN_STOP, resolved], { state: 'resolved', engine: 'gateway', category: 'all' })).toEqual([resolved])
    expect(filterSafetyOperationsEvents([OPEN_STOP, resolved], { state: 'open', engine: 'gateway', category: 'all' })).toEqual([])

    const html = render(snapshot([OPEN_STOP, resolved]))
    expect(html).toContain('Filter safety events')
    expect(html).toContain('href="#safety-event-safety-event:open-1"')
    expect(html).toContain('id="safety-event-safety-event:open-1"')
  })

  it('states explicitly when the authorized safety page is incomplete', () => {
    const html = render(snapshot([OPEN_STOP], { page: { limit: 50, nextCursor: 'cursor:next' } }))
    expect(html).toContain('More safety events exist')
    expect(html).toContain('This page is incomplete')
    expect(html).not.toContain('All safety events')
  })

  it('provides accessible landmarks, labels, table semantics, times, and drilldowns', () => {
    const html = render(snapshot([OPEN_STOP]))
    expect(html).not.toContain('<main')
    expect(html).toContain('<h2>Safety</h2>')
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend>Filter safety events</legend>')
    expect(html).toContain('aria-controls="safety-events-results"')
    expect(html).toContain('<caption>')
    expect(html).toContain('<th scope="col"')
    expect(html).toContain('<time dateTime="2026-08-08T14:00:00.000Z"')
    expect(html).toContain('<details')
    expect(html).toContain('<summary>')
    expect(html).toContain('aria-label="Privacy boundary"')
  })

  it('sanitizes invalid counts and drops malformed events at the model boundary', () => {
    const malformed = { ...OPEN_STOP, eventRef: 'event ref with spaces', learner: { reference: 'bad reference with spaces' } }
    const value = snapshot([malformed], { summary: summary({ openSafetyStops: { status: 'available', value: -1 } }) })
    const model = buildSafetyOperationsModel(value)
    expect(model.summary.openSafetyStops).toEqual({ status: 'unavailable' })
    expect(model.events).toEqual([])
  })

  it('bounds the authorized event list and rejects a misbound display value', () => {
    const events = Array.from({ length: SAFETY_OPERATIONS_EVENT_LIMIT + 5 }, (_, index) => ({
      ...OPEN_STOP,
      eventRef: `safety-event:bounded-${index}`,
      learner: { reference: `learner:${index}`, displayName: index === 0 ? 'Error: password=sentinel' : `Learner ${index}` },
    }))
    const model = buildSafetyOperationsModel(snapshot(events))
    expect(model.events).toHaveLength(SAFETY_OPERATIONS_EVENT_LIMIT)
    expect(model.events.find((event) => event.eventRef === 'safety-event:bounded-0')?.learner?.displayName).toBeUndefined()
  })
})
