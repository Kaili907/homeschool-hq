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

/**
 * The quoted values of a `check (<column> in ( ... ))` constraint.
 *
 * STUDY-A1-PROD-DASH-H2 Phase 6 — this used to collect `/'([a-z_]+)'/g` from the
 * clause text, which silently dropped any value the charset did not cover. A
 * server enum widened to `'level2'` or `'inProgress'` would have been extracted
 * as nothing at all, the extracted set would still have equalled the browser's
 * unchanged enum, and this file would have reported no drift — the exact failure
 * it exists to prevent.
 *
 * So the list is now scanned to its matching close paren and then consumed
 * whole, as SQL string literals and separators and nothing else. A value this
 * extractor cannot account for fails the test instead of vanishing from it,
 * because a partial extraction and a correct one are indistinguishable at the
 * call site: both are just a shorter list.
 */
function checkedValues(table: string, column: string): readonly string[] {
  const marker = `check (${column} in (`
  const from = table.indexOf(marker)
  expect(from, `${column} check constraint`).toBeGreaterThanOrEqual(0)

  // Walk to the paren closing the `in (` list. Quote state is tracked so a
  // literal containing a paren cannot end the scan early.
  const start = from + marker.length
  let index = start
  let depth = 1
  let quoted = false
  while (index < table.length && depth > 0) {
    const char = table[index]!
    if (quoted) {
      // '' is an escaped quote inside a SQL string literal, not its end.
      if (char === "'") {
        if (table[index + 1] === "'") index += 1
        else quoted = false
      }
    } else if (char === "'") quoted = true
    else if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    index += 1
  }
  expect(depth, `${column} check constraint close`).toBe(0)
  const list = table.slice(start, index - 1)

  // Sticky, so each literal must begin exactly where the previous one ended:
  // an unparsed gap cannot be skipped over, only reported.
  const literal = /\s*'((?:[^']|'')*)'\s*(,)?/y
  const values: string[] = []
  while (literal.lastIndex < list.length) {
    const match = literal.exec(list)
    if (!match) break
    values.push(match[1]!.replaceAll("''", "'"))
    if (!match[2]) break
  }
  expect(
    list.slice(literal.lastIndex).trim(),
    `unparsed remainder of the ${column} check list`,
  ).toBe('')
  expect(values.length, `${column} check values`).toBeGreaterThan(0)
  return values
}

/**
 * The response keys of a `jsonb_build_object('key', table.column, ...)` row
 * builder.
 *
 * The key charset is deliberately unrestricted for the same reason as above: a
 * key this pattern could not match would be dropped rather than reported. What
 * anchors the match is the `table.column` value form, and a key whose value
 * stopped taking that form drops the count, which the exact comparison at the
 * call site fails on.
 */
function builtKeys(branch: string): readonly string[] {
  const keys = [...branch.matchAll(/'([^']+)',\s*\w+\.\w+/g)].map(([, key]) => key)
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

// STUDY-A1-PROD-DASH-H2 Phase 6 — the extractor is what every assertion in the
// next block depends on, so it is exercised against clauses the real migrations
// do not contain yet. A digit or a capital in a future server enum is the case
// that used to pass silently; each one below now either comes out of the
// extractor or stops the test.
describe('the CHECK extractor derives values instead of pattern-matching them', () => {
  it('reads the single-line form', () => {
    expect(checkedValues(`check (state in ('scheduled', 'available'))`, 'state'))
      .toEqual(['scheduled', 'available'])
  })

  it('reads the multi-line, indented form the sessions table uses', () => {
    expect(checkedValues(
      "check (state in (\n      'planned', 'active',\n      'approved_break'\n    ))",
      'state',
    )).toEqual(['planned', 'active', 'approved_break'])
  })

  it.each([
    ['a digit', `check (state in ('active', 'level2'))`, ['active', 'level2']],
    ['a capital', `check (state in ('active', 'inProgress'))`, ['active', 'inProgress']],
    ['a hyphen', `check (state in ('active', 'in-progress'))`, ['active', 'in-progress']],
    ['a space', `check (state in ('active', 'needs review'))`, ['active', 'needs review']],
    ['an escaped quote', `check (state in ('active', 'it''s'))`, ['active', "it's"]],
  ])('derives a future enum value containing %s', (_name, clause, expected) => {
    // Every one of these was invisible to the old `[a-z_]+` collector, which
    // would have returned only `['active']` and matched an unchanged browser
    // enum without complaint.
    expect(checkedValues(clause, 'state')).toEqual(expected)
  })

  it('reads a value containing a parenthesis without ending the scan early', () => {
    expect(checkedValues(`check (state in ('active', 'paused (adult)'))`, 'state'))
      .toEqual(['active', 'paused (adult)'])
  })

  it.each([
    ['a function call among the values', `check (state in ('active', lower('B')))`],
    ['a subquery', `check (state in (select code from public.states))`],
    ['a column reference', `check (state in ('active', legacy_state))`],
    ['an unterminated list', `check (state in ('active', 'paused'`],
  ])('fails loudly on %s rather than returning what it understood', (_name, clause) => {
    expect(() => checkedValues(clause, 'state')).toThrow()
  })

  it('fails when the named column has no check constraint at all', () => {
    expect(() => checkedValues(`check (block_type in ('lesson'))`, 'state')).toThrow()
  })

  it('reports a widened enum as a different list, which is what drift detection needs', () => {
    const before = checkedValues(`check (state in ('active', 'paused'))`, 'state')
    const after = checkedValues(`check (state in ('active', 'paused', 'level2'))`, 'state')
    expect(after).not.toEqual(before)
    expect(after).toContain('level2')
  })
})

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
