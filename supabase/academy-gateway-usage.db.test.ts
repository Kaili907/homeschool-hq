import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const DAY_ONE = '2026-07-31'
const DAY_TWO = '2026-08-01'
const databases: PGlite[] = []

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth authorization postgres;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values ('${USER_ID}');
  `)
  const migration = await readFile(
    new URL('./migrations/20260731120000_academy_gateway_usage.sql', import.meta.url),
    'utf8',
  )
  await database.exec(migration)
  return database
}

async function consume(database: PGlite, endpoint: 'anthropic' | 'tts', limit: number, day: string) {
  const result = await database.query<{ accepted: boolean }>(
    `select public.academy_consume_gateway_usage($1, $2, $3, $4) as accepted`,
    [USER_ID, endpoint, limit, day],
  )
  return result.rows[0].accepted
}

async function consumeWithDefaultDay(database: PGlite, endpoint: 'anthropic' | 'tts', limit: number) {
  const result = await database.query<{ accepted: boolean }>(
    `select public.academy_consume_gateway_usage($1, $2, $3) as accepted`,
    [USER_ID, endpoint, limit],
  )
  return result.rows[0].accepted
}

beforeEach(async () => {
  await createDatabase()
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy gateway usage ledger', () => {
  it('uses the UTC date when p_day is omitted under a non-UTC session timezone', async () => {
    const database = databases[0]
    const clock = await database.query<{ utc_hour: number }>(`
      select extract(hour from now() at time zone 'utc')::integer as utc_hour
    `)
    const sessionTimeZone = clock.rows[0].utc_hour < 10 ? 'Pacific/Honolulu' : 'Pacific/Kiritimati'
    await database.query(`select set_config('TimeZone', $1, false)`, [sessionTimeZone])

    const expected = await database.query<{ session_day: string; utc_day: string }>(`
      select
        current_date::text as session_day,
        (now() at time zone 'utc')::date::text as utc_day
    `)
    expect(expected.rows[0].session_day).not.toBe(expected.rows[0].utc_day)

    expect(await consumeWithDefaultDay(database, 'anthropic', 1)).toBe(true)
    const usage = await database.query<{ day: string }>(`
      select day::text as day
      from public.academy_gateway_usage
      where user_id = '${USER_ID}' and endpoint = 'anthropic'
    `)
    expect(usage.rows).toEqual([{ day: expected.rows[0].utc_day }])
  })

  it('allows the request that reaches the cap', async () => {
    const database = databases[0]
    expect(await consume(database, 'anthropic', 2, DAY_ONE)).toBe(true)
    expect(await consume(database, 'anthropic', 2, DAY_ONE)).toBe(true)
    const count = await database.query<{ count: number }>(`
      select count from public.academy_gateway_usage
      where user_id = '${USER_ID}' and day = '${DAY_ONE}' and endpoint = 'anthropic'
    `)
    expect(count.rows[0].count).toBe(2)
  })

  it('rejects requests over cap without incrementing the ledger', async () => {
    const database = databases[0]
    expect(await consume(database, 'tts', 1, DAY_ONE)).toBe(true)
    expect(await consume(database, 'tts', 1, DAY_ONE)).toBe(false)
    expect(await consume(database, 'tts', 1, DAY_ONE)).toBe(false)
    const count = await database.query<{ count: number }>(`
      select count from public.academy_gateway_usage
      where user_id = '${USER_ID}' and day = '${DAY_ONE}' and endpoint = 'tts'
    `)
    expect(count.rows[0].count).toBe(1)
  })

  it('starts a fresh counter after the UTC database day rolls over and denies client roles', async () => {
    const database = databases[0]
    expect(await consume(database, 'anthropic', 1, DAY_ONE)).toBe(true)
    expect(await consume(database, 'anthropic', 1, DAY_ONE)).toBe(false)
    expect(await consume(database, 'anthropic', 1, DAY_TWO)).toBe(true)

    await database.exec('set role authenticated;')
    await expect(database.query('select * from public.academy_gateway_usage')).rejects.toThrow()
    await expect(
      database.query(`select public.academy_consume_gateway_usage('${USER_ID}', 'tts', 1, '${DAY_TWO}')`),
    ).rejects.toThrow()
    await database.exec('reset role;')
  })
})
