import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationDirectory = new URL('./migrations/', import.meta.url)

const historicalMigrations = {
  '20260724074106_academy_profiles_base.sql':
    '16c609d24efb9b9694b410a2313e5f2f7228db5118e2ccc4fa779f03c1d53c51',
  '20260724230000_academy_student_identity_foundation.sql':
    '2c7825ba957b68a39413a1e2da81aebaa72fb35dde7abeeba6ea8a493ecf3bde',
  '20260726120000_academy_household_revision_cas.sql':
    '0d5556db9f1dc406234e08180051e8d54807870084223b25db18017b1648c268',
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
      const source = await readFile(new URL(name, migrationDirectory), 'utf8')
      const actual = createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
      expect(actual, name).toBe(expected)
    }
  })

  it('orders the additive Study migrations after the historical chain', async () => {
    const names = (await readdir(migrationDirectory))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort()
    const manifest = JSON.parse(await readFile(
      new URL('../docs/study-engine-final-production/migration-manifest.json', import.meta.url),
      'utf8',
    )) as { migrations: Array<{ filename: string }> }
    expect(names).toEqual(manifest.migrations.map((entry) => entry.filename))
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
