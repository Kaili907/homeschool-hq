import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  VERIFIED_CALENDAR_BLOCK_KEYS,
  VERIFIED_CALENDAR_BLOCK_LIMIT,
  VERIFIED_DASHBOARD_SESSION_KEYS,
  VERIFIED_DASHBOARD_SESSION_LIMIT,
  VERIFIED_STUDY_BLOCK_STATES,
  VERIFIED_STUDY_BLOCK_TYPES,
  VERIFIED_STUDY_IDENTIFIER_PATTERN,
  VERIFIED_STUDY_SESSION_STATES,
} from './verifiedDashboardContracts'

// STUDY-A1-PROD-DASH-1 Phase 2 — the browser contract is the server's contract.
//
// Every enum, key set, identifier rule and row cap below is re-derived from the
// migration text at test time and compared with what the parser enforces. A
// per-value assertion would always be one server change behind; extracting the
// whole list and comparing it as a set is what makes a widened server enum, a
// renamed response key or a raised `limit` fail here.
//
// The extractors themselves are guarded: each one asserts it actually matched
// something, so a migration reformat degrades into a failure rather than into a
// silently empty list that trivially equals an empty expectation.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const migrations = join(repoRoot, 'supabase', 'migrations')

const storageSql = readFileSync(
  join(migrations, '20260801010000_academy_study_engine_storage.sql'),
  'utf8',
)
const runtimeSql = readFileSync(
  join(migrations, '20260801190000_academy_study_final_production_reconciliation.sql'),
  'utf8',
)

function between(source: string, start: string, end: string, what: string): string {
  const from = source.indexOf(start)
  expect(from, `start marker for ${what}`).toBeGreaterThanOrEqual(0)
  const to = source.indexOf(end, from + start.length)
  expect(to, `end marker for ${what}`).toBeGreaterThan(from)
  return source.slice(from, to)
}

/** The quoted values of a `check (<column> in ( ... ))` constraint. */
function checkedValues(table: string, column: string): readonly string[] {
  const marker = `check (${column} in (`
  const from = table.indexOf(marker)
  expect(from, `${column} check constraint`).toBeGreaterThanOrEqual(0)
  const to = table.indexOf('))', from)
  expect(to, `${column} check constraint close`).toBeGreaterThan(from)
  const values = [...table.slice(from + marker.length, to).matchAll(/'([a-z_]+)'/g)].map(([, value]) => value)
  expect(values.length, `${column} check values`).toBeGreaterThan(0)
  return values
}

/** The response keys of a `jsonb_build_object('key', table.column, ...)` row builder. */
function builtKeys(branch: string): readonly string[] {
  const keys = [...branch.matchAll(/'([A-Za-z][A-Za-z0-9]*)',\s*\w+\.\w+/g)].map(([, key]) => key)
  expect(keys.length, 'jsonb_build_object row keys').toBeGreaterThan(0)
  return keys
}

function rowLimit(branch: string): number {
  const match = /limit (\d+)/.exec(branch)
  expect(match, 'row limit').not.toBeNull()
  return Number(match![1])
}

const sessionsTable = between(
  storageSql,
  'create table public.academy_study_sessions (',
  '\ncreate ',
  'academy_study_sessions',
)
const calendarTable = between(
  storageSql,
  'create table public.academy_study_calendar_blocks (',
  '\ncreate ',
  'academy_study_calendar_blocks',
)
const dashboardBranch = between(
  runtimeSql,
  `when 'dashboard:read' then`,
  `when 'calendar:read' then`,
  'dashboard:read branch',
)
const calendarBranch = between(
  runtimeSql,
  `when 'calendar:read' then`,
  `when 'session:begin' then`,
  'calendar:read branch',
)

describe('verified dashboard contracts track the server migrations', () => {
  it('mirrors academy_study_identifier_is_valid exactly', () => {
    const match = /candidate ~ '([^']+)'/.exec(storageSql)
    expect(match).not.toBeNull()
    expect(VERIFIED_STUDY_IDENTIFIER_PATTERN.source).toBe(match![1])
  })

  it('carries every academy_study_sessions.state value and no others', () => {
    expect([...VERIFIED_STUDY_SESSION_STATES].sort())
      .toEqual([...checkedValues(sessionsTable, 'state')].sort())
  })

  it('carries every academy_study_calendar_blocks.block_type value and no others', () => {
    expect([...VERIFIED_STUDY_BLOCK_TYPES].sort())
      .toEqual([...checkedValues(calendarTable, 'block_type')].sort())
  })

  it('carries every academy_study_calendar_blocks.state value and no others', () => {
    expect([...VERIFIED_STUDY_BLOCK_STATES].sort())
      .toEqual([...checkedValues(calendarTable, 'state')].sort())
  })

  it('expects exactly the keys the dashboard:read branch builds', () => {
    expect(builtKeys(dashboardBranch)).toEqual([...VERIFIED_DASHBOARD_SESSION_KEYS])
    expect(dashboardBranch).toContain(`'sessions', coalesce(`)
  })

  it('expects exactly the keys the calendar:read branch builds', () => {
    expect(builtKeys(calendarBranch)).toEqual([...VERIFIED_CALENDAR_BLOCK_KEYS])
    expect(calendarBranch).toContain(`'blocks', coalesce(`)
  })

  it('caps each list at the row limit the server query applies', () => {
    expect(rowLimit(dashboardBranch)).toBe(VERIFIED_DASHBOARD_SESSION_LIMIT)
    expect(rowLimit(calendarBranch)).toBe(VERIFIED_CALENDAR_BLOCK_LIMIT)
  })

  it('sends the request shapes the two branches accept', () => {
    // dashboard:read takes the empty object; calendar:read takes exactly one key.
    expect(dashboardBranch).toContain(`p_request <> '{}'::jsonb`)
    expect(calendarBranch).toContain(`array['cursor']::text[]`)
  })
})
