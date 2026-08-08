import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  decodeVerifiedStudyCalendarResponse,
  decodeVerifiedStudyDashboardResponse,
  type StudyProductionProjectionResult,
} from './dashboardProjection'

const here = dirname(fileURLToPath(import.meta.url))

const DASHBOARD_ROW_KEYS = ['sessionId', 'state', 'lessonId', 'revision', 'updatedAt']
const CALENDAR_ROW_KEYS = [
  'blockId', 'blockType', 'sourceReference',
  'scheduledStart', 'intendedLocalDate', 'state', 'revision',
]

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'ses_01',
    state: 'active',
    lessonId: 'math.r1.lesson.01',
    revision: 3,
    updatedAt: '2026-08-01T19:00:00+00:00',
    ...overrides,
  }
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    blockId: 'blk_01',
    blockType: 'lesson',
    sourceReference: 'math.r1.lesson.01',
    scheduledStart: '2026-08-01T14:30:00+00:00',
    intendedLocalDate: '2026-08-01',
    state: 'scheduled',
    revision: 1,
    ...overrides,
  }
}

function withoutKey(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _removed, ...rest } = row
  return rest
}

function expectFailure<Value>(
  result: StudyProductionProjectionResult<Value>,
  code: string,
  at?: string,
): void {
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.code).toBe(code)
  if (at !== undefined) expect(result.at).toBe(at)
}

describe('verified Study dashboard projection', () => {
  it('projects a minimum valid dashboard response', () => {
    const result = decodeVerifiedStudyDashboardResponse({ sessions: [session()] })
    expect(result).toEqual({
      ok: true,
      value: {
        sessions: [{
          sessionId: 'ses_01',
          state: 'active',
          lessonId: 'math.r1.lesson.01',
          revision: 3,
          updatedAt: '2026-08-01T19:00:00+00:00',
        }],
      },
    })
  })

  it('projects multiple rows in order and an empty dashboard', () => {
    const many = decodeVerifiedStudyDashboardResponse({
      sessions: [
        session({ sessionId: 'ses_01' }),
        session({ sessionId: 'ses_02', state: 'completed' }),
        session({ sessionId: 'ses_03', state: 'student_requested_break' }),
      ],
    })
    expect(many.ok).toBe(true)
    if (!many.ok) return
    expect(many.value.sessions.map((row) => row.sessionId)).toEqual(['ses_01', 'ses_02', 'ses_03'])

    const empty = decodeVerifiedStudyDashboardResponse({ sessions: [] })
    expect(empty).toEqual({ ok: true, value: { sessions: [] } })
  })

  it('accepts every state the session check constraint allows', () => {
    for (const state of [
      'planned', 'active', 'paused', 'approved_break',
      'student_requested_break', 'technical_interruption',
      'completed', 'abandoned',
    ]) {
      expect(decodeVerifiedStudyDashboardResponse({ sessions: [session({ state })] }).ok).toBe(true)
    }
  })

  it('rejects a wrong root type', () => {
    expectFailure(decodeVerifiedStudyDashboardResponse(null), 'response-not-object', 'body')
    expectFailure(decodeVerifiedStudyDashboardResponse(undefined), 'response-not-object')
    expectFailure(decodeVerifiedStudyDashboardResponse('sessions'), 'response-not-object')
    expectFailure(decodeVerifiedStudyDashboardResponse(7), 'response-not-object')
    expectFailure(decodeVerifiedStudyDashboardResponse([session()]), 'response-not-object')
  })

  it('rejects a missing or renamed root collection', () => {
    expectFailure(decodeVerifiedStudyDashboardResponse({}), 'response-keys-unexpected', 'body')
    expectFailure(decodeVerifiedStudyDashboardResponse({ rows: [] }), 'response-keys-unexpected')
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [], nextCursor: null }),
      'response-keys-unexpected',
    )
  })

  it('rejects array and object confusion at the collection', () => {
    expectFailure(decodeVerifiedStudyDashboardResponse({ sessions: {} }), 'rows-not-array', 'body.sessions')
    expectFailure(decodeVerifiedStudyDashboardResponse({ sessions: null }), 'rows-not-array')
    expectFailure(decodeVerifiedStudyDashboardResponse({ sessions: '[]' }), 'rows-not-array')
  })

  it('rejects a wrong row type', () => {
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session(), 'ses_02'] }),
      'row-not-object',
      'body.sessions[1]',
    )
    expectFailure(decodeVerifiedStudyDashboardResponse({ sessions: [null] }), 'row-not-object', 'body.sessions[0]')
    expectFailure(decodeVerifiedStudyDashboardResponse({ sessions: [[]] }), 'row-not-object')
  })

  it('rejects a missing required key and an extra key', () => {
    for (const key of DASHBOARD_ROW_KEYS) {
      expectFailure(
        decodeVerifiedStudyDashboardResponse({ sessions: [withoutKey(session(), key)] }),
        'row-keys-unexpected',
        'body.sessions[0]',
      )
    }
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ subjectId: 'math' })] }),
      'row-keys-unexpected',
    )
  })

  it('rejects a wrong key type', () => {
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ sessionId: 12 })] }),
      'identifier-invalid',
      'body.sessions[0].sessionId',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ lessonId: { id: 'x' } })] }),
      'identifier-invalid',
      'body.sessions[0].lessonId',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ updatedAt: 1754074800000 })] }),
      'timestamp-invalid',
      'body.sessions[0].updatedAt',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ state: 'in_progress' })] }),
      'enumeration-invalid',
      'body.sessions[0].state',
    )
  })

  it('rejects an invalid revision', () => {
    for (const revision of [0, -1, 1.5, '3', Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, null]) {
      expectFailure(
        decodeVerifiedStudyDashboardResponse({ sessions: [session({ revision })] }),
        'revision-invalid',
        'body.sessions[0].revision',
      )
    }
    expect(decodeVerifiedStudyDashboardResponse({ sessions: [session({ revision: 1 })] }).ok).toBe(true)
  })

  it('rejects null in every position the server declares not null', () => {
    for (const key of DASHBOARD_ROW_KEYS) {
      const result = decodeVerifiedStudyDashboardResponse({ sessions: [session({ [key]: null })] })
      expect(result.ok).toBe(false)
    }
  })

  it('rejects an identifier the server column constraint could not hold', () => {
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ sessionId: '' })] }),
      'identifier-invalid',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ sessionId: '_leading' })] }),
      'identifier-invalid',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ lessonId: `a${'b'.repeat(160)}` })] }),
      'identifier-invalid',
    )
  })

  it('rejects a timestamp that is not the wire format the server emits', () => {
    for (const updatedAt of ['2026-08-01', '2026-08-01 19:00:00+00', 'not-a-time', '2026-13-01T19:00:00+00:00']) {
      expectFailure(
        decodeVerifiedStudyDashboardResponse({ sessions: [session({ updatedAt })] }),
        'timestamp-invalid',
      )
    }
    for (const updatedAt of ['2026-08-01T19:00:00Z', '2026-08-01T19:00:00.123456+00:00', '2026-08-01T14:00:00-05:00']) {
      expect(decodeVerifiedStudyDashboardResponse({ sessions: [session({ updatedAt })] }).ok).toBe(true)
    }
  })

  it('rejects more rows than the operation can return', () => {
    const rows = Array.from({ length: 51 }, (_unused, index) => session({ sessionId: `ses_${index}` }))
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: rows }),
      'rows-over-limit',
      'body.sessions',
    )
    expect(decodeVerifiedStudyDashboardResponse({ sessions: rows.slice(0, 50) }).ok).toBe(true)
  })
})

describe('verified Study calendar projection', () => {
  it('projects a minimum valid calendar response', () => {
    const result = decodeVerifiedStudyCalendarResponse({ blocks: [block()] })
    expect(result).toEqual({
      ok: true,
      value: {
        blocks: [{
          blockId: 'blk_01',
          blockType: 'lesson',
          sourceReference: 'math.r1.lesson.01',
          scheduledStart: '2026-08-01T14:30:00+00:00',
          intendedLocalDate: '2026-08-01',
          state: 'scheduled',
          revision: 1,
        }],
      },
    })
  })

  it('projects multiple rows and an empty calendar', () => {
    const many = decodeVerifiedStudyCalendarResponse({
      blocks: [
        block({ blockId: 'blk_01' }),
        block({ blockId: 'blk_02', blockType: 'break', state: 'completed' }),
        block({ blockId: 'blk_03', blockType: 'assessment', state: 'in_progress' }),
      ],
    })
    expect(many.ok).toBe(true)
    if (!many.ok) return
    expect(many.value.blocks.map((row) => row.blockId)).toEqual(['blk_01', 'blk_02', 'blk_03'])

    expect(decodeVerifiedStudyCalendarResponse({ blocks: [] })).toEqual({ ok: true, value: { blocks: [] } })
  })

  it('accepts every block type and state the check constraints allow', () => {
    for (const blockType of ['lesson', 'review', 'resume', 'break', 'assessment']) {
      expect(decodeVerifiedStudyCalendarResponse({ blocks: [block({ blockType })] }).ok).toBe(true)
    }
    for (const state of ['scheduled', 'available', 'in_progress', 'completed', 'cancelled']) {
      expect(decodeVerifiedStudyCalendarResponse({ blocks: [block({ state })] }).ok).toBe(true)
    }
    expectFailure(
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ state: 'active' })] }),
      'enumeration-invalid',
      'body.blocks[0].state',
    )
    expectFailure(
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ blockType: 'practice' })] }),
      'enumeration-invalid',
      'body.blocks[0].blockType',
    )
  })

  it('rejects a wrong root, a missing collection and array/object confusion', () => {
    expectFailure(decodeVerifiedStudyCalendarResponse(null), 'response-not-object', 'body')
    expectFailure(decodeVerifiedStudyCalendarResponse([block()]), 'response-not-object')
    expectFailure(decodeVerifiedStudyCalendarResponse({}), 'response-keys-unexpected')
    expectFailure(decodeVerifiedStudyCalendarResponse({ sessions: [] }), 'response-keys-unexpected')
    expectFailure(decodeVerifiedStudyCalendarResponse({ blocks: {} }), 'rows-not-array', 'body.blocks')
    expectFailure(decodeVerifiedStudyCalendarResponse({ blocks: [[]] }), 'row-not-object', 'body.blocks[0]')
    expectFailure(decodeVerifiedStudyCalendarResponse({ blocks: [null] }), 'row-not-object')
  })

  it('rejects a missing required key, an extra key and null fields', () => {
    for (const key of CALENDAR_ROW_KEYS) {
      expectFailure(
        decodeVerifiedStudyCalendarResponse({ blocks: [withoutKey(block(), key)] }),
        'row-keys-unexpected',
        'body.blocks[0]',
      )
      expect(decodeVerifiedStudyCalendarResponse({ blocks: [block({ [key]: null })] }).ok).toBe(false)
    }
    expectFailure(
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ durationMinutes: 30 })] }),
      'row-keys-unexpected',
    )
  })

  it('rejects an invalid revision and a malformed local date', () => {
    expectFailure(
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ revision: 0 })] }),
      'revision-invalid',
      'body.blocks[0].revision',
    )
    for (const intendedLocalDate of ['2026-8-1', '2026-02-30', '2026-13-01', '2026-08-01T00:00:00Z', 20260801]) {
      expectFailure(
        decodeVerifiedStudyCalendarResponse({ blocks: [block({ intendedLocalDate })] }),
        'local-date-invalid',
        'body.blocks[0].intendedLocalDate',
      )
    }
  })

  it('rejects more rows than the operation can return', () => {
    const rows = Array.from({ length: 101 }, (_unused, index) => block({ blockId: `blk_${index}` }))
    expectFailure(decodeVerifiedStudyCalendarResponse({ blocks: rows }), 'rows-over-limit', 'body.blocks')
    expect(decodeVerifiedStudyCalendarResponse({ blocks: rows.slice(0, 100) }).ok).toBe(true)
  })
})

describe('production projection surface', () => {
  it('invents no title, subject, completion percentage or segment list', () => {
    const dashboard = decodeVerifiedStudyDashboardResponse({ sessions: [session()] })
    const calendar = decodeVerifiedStudyCalendarResponse({ blocks: [block()] })
    expect(dashboard.ok && calendar.ok).toBe(true)
    if (!dashboard.ok || !calendar.ok) return

    const dashboardRow = dashboard.value.sessions[0]
    const calendarRow = calendar.value.blocks[0]
    expect(Object.keys(dashboardRow)).toEqual(DASHBOARD_ROW_KEYS)
    expect(Object.keys(calendarRow)).toEqual(CALENDAR_ROW_KEYS)

    for (const invented of [
      'title', 'subject', 'subjectId', 'requiredWorkCompletionPercent',
      'segments', 'completedSegmentRefs', 'estimatedRemainingMinutes',
      'durationMinutes', 'completionUnits', 'requiredUnits',
      'skillRefs', 'resumePoint', 'timerVisibility', 'householdTimeZone',
    ]) {
      expect(Object.hasOwn(dashboardRow, invented)).toBe(false)
      expect(Object.hasOwn(calendarRow, invented)).toBe(false)
    }
  })

  it('projects no student, household, grant or membership identity', () => {
    const calendar = decodeVerifiedStudyCalendarResponse({ blocks: [block()] })
    expect(calendar.ok).toBe(true)
    if (!calendar.ok) return
    const serialised = JSON.stringify(calendar.value)
    for (const authority of [
      'student', 'household', 'learner', 'grant',
      'membership', 'relationship', 'authorizationRevision', 'sessionEpoch',
    ]) {
      expect(serialised).not.toContain(authority)
    }

    // The same keys are refused on the way in, so a server that started sending
    // caller authority could not deposit it in application state either.
    expectFailure(
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ studentId: 'stu_01' })] }),
      'row-keys-unexpected',
    )
    expectFailure(
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ householdId: 'hh_01' })] }),
      'row-keys-unexpected',
    )
  })

  it('does not alias, spread or retain the untrusted response object', () => {
    const row = session()
    const response = { sessions: [row] }
    const result = decodeVerifiedStudyDashboardResponse(response)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.sessions[0]).not.toBe(row)
    expect(result.value.sessions).not.toBe(response.sessions)
    expect(Object.isFrozen(result.value)).toBe(true)
    expect(Object.isFrozen(result.value.sessions)).toBe(true)
    expect(Object.isFrozen(result.value.sessions[0])).toBe(true)

    row.state = 'abandoned'
    response.sessions.push(session({ sessionId: 'ses_99' }))
    expect(result.value.sessions).toHaveLength(1)
    expect(result.value.sessions[0].state).toBe('active')
  })

  it('is total: no malformed response throws', () => {
    const hostile: unknown[] = [
      undefined, null, 0, '', true, [], {},
      { sessions: [{ __proto__: { polluted: true }, ...session() }] },
      { sessions: [session({ sessionId: '../../etc/passwd' })] },
      { blocks: [block({ revision: '1' })] },
      new Map(), new Date(), () => undefined,
    ]
    for (const value of hostile) {
      expect(() => decodeVerifiedStudyDashboardResponse(value)).not.toThrow()
      expect(() => decodeVerifiedStudyCalendarResponse(value)).not.toThrow()
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('reports a typed failure that echoes no part of the server payload', () => {
    const marker = 'SERVER-SUPPLIED-MARKER-9f3c'
    const results = [
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ state: marker })] }),
      decodeVerifiedStudyDashboardResponse({ sessions: [session({ [marker]: marker })] }),
      decodeVerifiedStudyCalendarResponse({ blocks: [block({ sourceReference: `${marker} ${marker}` })] }),
      decodeVerifiedStudyCalendarResponse({ blocks: marker }),
      decodeVerifiedStudyCalendarResponse(marker),
    ]
    for (const result of results) {
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(Object.keys(result)).toEqual(['ok', 'code', 'at'])
      expect(JSON.stringify(result)).not.toContain(marker)
      expect(Object.isFrozen(result)).toBe(true)
    }
  })

  it('stays independent of the preview Study data contracts', () => {
    const source = readFileSync(join(here, 'dashboardProjection.ts'), 'utf8')
    for (const previewContract of [
      'StudyCalendarEntry', 'StudyPortBundle', 'StudyDashboardPorts',
      'StudyCalendarPort', 'StudySessionSnapshot', 'StudySubject',
    ]) {
      expect(source).not.toContain(previewContract)
    }
    // The projection imports nothing at all, so no preview contract can reach it.
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\brequire\s*\(/)
  })

  it('makes no unchecked assertion at the response boundary', () => {
    const source = readFileSync(join(here, 'dashboardProjection.ts'), 'utf8')
    expect(source).not.toMatch(/\bas\s+(?!const\b)[A-Z]/)
    expect(source).not.toMatch(/\bas\s+unknown\b/)
    expect(source).not.toMatch(/\bany\b/)
    expect(source).not.toMatch(/@ts-(?:ignore|expect-error|nocheck)/)
  })
})
