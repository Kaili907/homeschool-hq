import { describe, expect, it } from 'vitest'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { StudyLearnerScope } from '../../types'
import {
  FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION,
  SUPPORTED_CALENDAR_BLOCK_SCHEMA_VERSION,
  emptyDurableStudyDocument,
  parseDurableStudyDocument,
} from './schema'

// The versioning contract a future build has to keep. The rule that matters is
// the asymmetry: a document from a NEWER build is reported as ahead so the
// caller can refuse without overwriting, while anything else unreadable is
// reported as such so the caller can preserve it and stop.

const SCOPE: StudyLearnerScope = { householdRef: 'household:pilot', learnerRef: 'learner:pilot-ada' }
const NOW = SYNTHETIC_NOW.toISOString()

/** Storage only ever hands back JSON, so every fixture goes through JSON. */
function stored(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

function empty(): Record<string, unknown> {
  return stored(emptyDurableStudyDocument(SCOPE, NOW)) as Record<string, unknown>
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SUPPORTED_CALENDAR_BLOCK_SCHEMA_VERSION,
    internalBlockId: 'block:one',
    learnerRef: SCOPE.learnerRef,
    sourceIdentity: { source: 'manuel_academy', externalItemId: 'host:one' },
    lineage: { rootInternalBlockId: 'block:one', continuationKey: 'root', completedBeforeOccurrence: [] },
    segments: [],
    ...overrides,
  }
}

function plan(): Record<string, unknown> {
  return {
    lessonRef: 'pilot:grade5:math:schema',
    title: 'Grade 5 math study block',
    subject: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
    masteryAuthority: 'tutor-core',
    source: 'manuel-academy',
    segments: [{ segmentRef: 'segment:one', title: 'Warm up', taskType: 'retrieval-practice', estimatedMinutes: 5, required: true }],
  }
}

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scope: { ...SCOPE, sessionRef: 'session:one' },
    lessonRef: 'pilot:grade5:math:schema',
    segmentRef: 'segment:one',
    status: 'active',
    updatedAt: NOW,
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

describe('durable Study document schema', () => {
  it('round-trips an empty document', () => {
    const outcome = parseDurableStudyDocument(empty(), SCOPE)
    expect(outcome.status).toBe('current')
    if (outcome.status !== 'current') return
    expect(outcome.document.schemaVersion).toBe(FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION)
    expect(outcome.document.scope).toEqual(SCOPE)
    expect(outcome.document.calendar).toEqual([])
    expect(outcome.document.preferences).toBeNull()
  })

  it('reports a newer document schema as ahead rather than unreadable', () => {
    expect(parseDurableStudyDocument(
      { ...empty(), schemaVersion: FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION + 1 },
      SCOPE,
    )).toEqual({ status: 'unreadable', reasonCode: 'schema-version-ahead' })
    // Not a version number at all is not "ahead"; it is simply not ours.
    for (const schemaVersion of [0, -1, '1', null, {}]) {
      expect(parseDurableStudyDocument({ ...empty(), schemaVersion }, SCOPE))
        .toEqual({ status: 'unreadable', reasonCode: 'schema-unreadable' })
    }
  })

  it('reports a newer Study Engine calendar record as ahead', () => {
    expect(parseDurableStudyDocument({
      ...empty(),
      calendar: [{ block: block({ schemaVersion: 'calendar-parent-runtime.v2' }), plan: plan() }],
    }, SCOPE)).toEqual({ status: 'unreadable', reasonCode: 'calendar-schema-ahead' })
  })

  it('accepts a well-formed calendar record and keeps the engine block verbatim', () => {
    const record = { block: block({ extraEngineFieldThisBuildIgnores: 7 }), plan: plan() }
    const outcome = parseDurableStudyDocument({ ...empty(), calendar: [record] }, SCOPE)
    expect(outcome.status).toBe('current')
    if (outcome.status !== 'current') return
    // Nothing is re-derived and nothing is stripped: the engine owns its record.
    expect(outcome.document.calendar[0].block).toEqual(record.block)
  })

  it('refuses anything but the literal false minimization markers', () => {
    for (const claim of [{ rawAnswerIncluded: true }, { transcriptIncluded: true }, { rawAnswerIncluded: 'false' }]) {
      expect(parseDurableStudyDocument({ ...empty(), sessions: [session(claim)] }, SCOPE))
        .toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
    }
  })

  it('refuses a record belonging to another student or household', () => {
    expect(parseDurableStudyDocument({
      ...empty(),
      sessions: [session({ scope: { ...SCOPE, learnerRef: 'learner:pilot-bea', sessionRef: 'session:one' } })],
    }, SCOPE)).toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
    expect(parseDurableStudyDocument({
      ...empty(),
      calendar: [{ block: block({ learnerRef: 'learner:pilot-bea' }), plan: plan() }],
    }, SCOPE)).toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
    // And a whole document whose own scope disagrees with the key it sits under.
    expect(parseDurableStudyDocument(empty(), { ...SCOPE, learnerRef: 'learner:pilot-bea' }))
      .toEqual({ status: 'unreadable', reasonCode: 'schema-unreadable' })
  })

  it('refuses duplicate authority records instead of picking one', () => {
    expect(parseDurableStudyDocument({
      ...empty(),
      calendar: [{ block: block(), plan: plan() }, { block: block(), plan: plan() }],
    }, SCOPE)).toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
    expect(parseDurableStudyDocument({ ...empty(), sessions: [session(), session({ status: 'paused' })] }, SCOPE))
      .toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
  })

  it('refuses an event payload field outside the accepted allowlist', () => {
    expect(parseDurableStudyDocument({
      ...empty(),
      events: [{
        sessionRef: 'session:one',
        eventRef: 'event:one',
        semanticKey: 'session:one|checkpoint-saved|event:one',
        event: {
          eventRef: 'event:one',
          occurredAt: NOW,
          type: 'checkpoint-saved',
          payload: { checkpointRef: 'checkpoint:one', revision: 1, extra: 'not allowed' },
        },
      }],
    }, SCOPE)).toEqual({ status: 'unreadable', reasonCode: 'record-unreadable' })
  })

  it('never throws, whatever it is handed', () => {
    for (const value of [null, undefined, 0, '', 'text', [], [1, 2], { schemaVersion: 1 }, new Map()]) {
      expect(() => parseDurableStudyDocument(value, SCOPE)).not.toThrow()
      expect(parseDurableStudyDocument(value, SCOPE).status).toBe('unreadable')
    }
  })
})
