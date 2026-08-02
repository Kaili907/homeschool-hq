import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationDirectory = new URL('./migrations/', import.meta.url)

const historicalMigrations = {
  '20260724074106_academy_profiles_base.sql':
    '8b1947fe2ce5d605e143b93b1ad8784d1d52095e83a4f8c63b8689f22462725d',
  '20260724230000_academy_student_identity_foundation.sql':
    '1700d95a8630214b49834dcb05c80358718128675389fb032669ebfa2644b829',
  '20260726120000_academy_household_revision_cas.sql':
    '40e9916322181fb19f9c58feeb90cf81a7e942e6b47199e05dc126bee43cd24d',
} as const

const studyMigrations = [
  '20260801010000_academy_study_engine_storage.sql',
  '20260801011000_academy_study_engine_authorization.sql',
  '20260801012000_academy_study_engine_production_reconciliation.sql',
] as const

const productionCompositionMigrations = [
  '20260801160000_academy_study_verified_identity.sql',
] as const

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = pg_catalog
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub',
        ''
      )::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function createIdentityDatabase() {
  const database = await PGlite.create()
  await database.exec(bootstrap)
  for (const path of [
    './schema.sql',
    './migrations/20260724230000_academy_student_identity_foundation.sql',
  ]) {
    await database.exec(await readFile(new URL(path, import.meta.url), 'utf8'))
  }
  return database
}

describe.sequential('Study Engine migration chain', () => {
  it('keeps historical migration bytes unchanged', async () => {
    for (const [name, expected] of Object.entries(historicalMigrations)) {
      const bytes = await readFile(new URL(name, migrationDirectory))
      const actual = createHash('sha256').update(bytes).digest('hex')
      expect(actual, name).toBe(expected)
    }
  })

  it('orders the additive Study migrations after the historical chain', async () => {
    const names = (await readdir(migrationDirectory))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort()
    expect(names).toEqual([
      ...Object.keys(historicalMigrations),
      ...studyMigrations,
      ...productionCompositionMigrations,
    ])
  })

  it('applies storage before authorization in a fresh database', async () => {
    const database = await createIdentityDatabase()
    try {
      for (const path of studyMigrations.map((name) => `./migrations/${name}`)) {
        await database.exec(await readFile(new URL(path, import.meta.url), 'utf8'))
      }
      const result = await database.query<{
        storage_version: number
        authorization_version: number
        migration_names: string[]
      }>(`
        select storage_version, authorization_version, migration_names
        from academy_private.study_persistence_metadata
        where singleton
      `)
      expect(result.rows).toEqual([{
        storage_version: 1,
        authorization_version: 1,
        migration_names: studyMigrations.map((name) => name.replace(/\.sql$/, '')),
      }])
    } finally {
      await database.close()
    }
  })

  it('rejects an unmarked authorization function without replacing it', async () => {
    const database = await createIdentityDatabase()
    try {
      await database.exec(await readFile(
        new URL(studyMigrations[0], migrationDirectory),
        'utf8',
      ))
      await database.exec(`
        create function public.academy_study_outbox_status(uuid)
        returns jsonb language sql immutable as $$ select '{"sentinel":true}'::jsonb $$
      `)
      await expect(database.exec(await readFile(
        new URL(studyMigrations[1], migrationDirectory),
        'utf8',
      ))).rejects.toThrow(/authorization function collision/)
      await database.exec('rollback')
      const result = await database.query<{
        authorization_version: number
        sentinel: boolean
      }>(`
        select metadata.authorization_version,
          public.academy_study_outbox_status(gen_random_uuid()) ->> 'sentinel' = 'true'
            as sentinel
        from academy_private.study_persistence_metadata as metadata
        where metadata.singleton
      `)
      expect(result.rows).toEqual([{ authorization_version: 0, sentinel: true }])
    } finally {
      await database.close()
    }
  })

  it('rolls back every Study object after a late storage DDL conflict', async () => {
    const database = await createIdentityDatabase()
    try {
      await database.exec(`
        create index academy_study_sessions_student_state_idx
        on public.profiles (household_id)
      `)
      await expect(database.exec(await readFile(
        new URL(studyMigrations[0], migrationDirectory),
        'utf8',
      ))).rejects.toThrow(/already exists/)
      await database.exec('rollback')
      const result = await database.query<{
        study_table: string | null
        study_metadata: string | null
        sentinel_index: string | null
      }>(`
        select
          to_regclass('public.academy_study_sessions')::text as study_table,
          to_regclass('academy_private.study_persistence_metadata')::text
            as study_metadata,
          to_regclass(
            'public.academy_study_sessions_student_state_idx'
          )::text as sentinel_index
      `)
      expect(result.rows).toEqual([{
        study_table: null,
        study_metadata: null,
        sentinel_index: 'academy_study_sessions_student_state_idx',
      }])
    } finally {
      await database.close()
    }
  })
})
