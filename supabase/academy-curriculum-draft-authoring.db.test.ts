import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationUrls = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
].map((path) => new URL(path, import.meta.url))

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const VIEWER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OUTSIDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const databases: PGlite[] = []

const course = {
  schema_set_version: '2.0.0',
  course_id: 'course:math-5',
  grade: 5,
  subject: 'mathematics',
  title: 'Mathematics 5',
  description: 'A complete fifth grade mathematics course.',
  days: 180,
  order: 1,
  unit_refs: ['unit:math-5-1'],
  standards: [{ framework_ref: 'framework:legacy', legacy_label: '5.NBT', mapping_status: 'human-review' }],
}

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema academy_private;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create function academy_private.operational_is_trusted_server()
  returns boolean language sql stable set search_path = pg_catalog as $$
    select auth.uid() is null
      and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('role', true), '')) = 'service_role';
  $$;
  insert into auth.users (id) values
    ('${ADMIN}'), ('${VIEWER}'), ('${OUTSIDER}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

async function createDraft(database: PGlite, actor = ADMIN, request = '10000000-0000-4000-8000-000000000001') {
  await setService(database)
  try {
    const result = await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', '2.0.0-draft.1', '2.0.0', $2, $3, 'curriculum:drafts:write'
      ) as value
    `, [actor, request, HASH_A])
    return result.rows[0].value
  } finally {
    await reset(database)
  }
}

async function createEntity(database: PGlite, draftId: string, request = '20000000-0000-4000-8000-000000000001') {
  await setService(database)
  try {
    const result = await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_entity_v1(
        $1, $2, 'course', 'course:math-5', 'base_override', 10,
        $3::jsonb, $4, 1, $5, $6, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, draftId, JSON.stringify(course), HASH_A, request, HASH_A])
    return result.rows[0].value
  } finally {
    await reset(database)
  }
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrap)
  for (const [index, url] of migrationUrls.entries()) {
    if (index === migrationUrls.length - 1) {
      await database.exec(`
        create function academy_private.preexisting_service_helper()
        returns boolean language sql stable as $$ select true; $$;
        revoke all on function academy_private.preexisting_service_helper() from public;
        grant execute on function academy_private.preexisting_service_helper() to service_role;
      `)
    }
    try {
      await database.exec(await readFile(url, 'utf8'))
    } catch (error) {
      const detail = error as { message?: string; position?: string; query?: string }
      throw new Error(`Failed migration ${url.pathname}: ${detail.message ?? String(error)} position=${detail.position ?? 'unknown'} queryTail=${detail.query?.slice(-500) ?? 'unknown'}`)
    }
  }
  await database.exec(`
    insert into public.academy_admin_role_assignments (
      user_id, role, assignment_reason_code
    ) values
      ('${ADMIN}', 'admin', 'test.admin'),
      ('${VIEWER}', 'viewer', 'test.viewer');
  `)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('ADMIN-16B curriculum draft authoring database boundary', () => {
  it('creates a replay-safe draft explicitly bound to immutable release 1.0.0', async () => {
    const database = databases[0]
    const first = await createDraft(database)
    const replay = await createDraft(database)
    expect(first).toMatchObject({ schemaVersion: 1, replayed: false, draftRevision: 1 })
    expect(replay).toEqual({ ...first, replayed: true })
    const row = (await database.query<any>(`
      select draft.*, release.version as base_version
      from public.academy_curriculum_drafts draft
      join public.academy_curriculum_releases release on release.release_id = draft.base_release_id
    `)).rows[0]
    expect(row).toMatchObject({
      base_version: '1.0.0', target_version: '2.0.0-draft.1',
      authoring_schema_version: '2.0.0', lifecycle_state: 'draft', revision: 1,
      created_by: ADMIN, updated_by: ADMIN,
    })
    expect((await database.query('select count(*)::integer as count from academy_private.admin_audit_events')).rows[0])
      .toEqual({ count: 1 })
    await setService(database)
    await expect(database.query(`select public.academy_admin_create_curriculum_draft_v1(
      '${ADMIN}', '1.0.0', '2.0.0-draft.2', '2.0.0',
      '10000000-0000-4000-8000-000000000001', '${HASH_B}', 'curriculum:drafts:write'
    )`)).rejects.toThrow('CURRICULUM_REPLAY_CONFLICT')
    await reset(database)
  })

  it('authorizes viewer reads, rejects viewer/outsider writes, and ignores forged capability markers', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await setService(database)
    await expect(database.query(`select public.academy_admin_list_curriculum_drafts_v1(
      '${VIEWER}', 'curriculum:read'
    )`)).resolves.toBeDefined()
    await expect(database.query(`select public.academy_admin_create_curriculum_draft_v1(
      '${VIEWER}', '1.0.0', '2.0.0-draft.2', '2.0.0',
      '10000000-0000-4000-8000-000000000002', '${HASH_A}', 'curriculum:drafts:write'
    )`)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    await expect(database.query(`select public.academy_admin_read_curriculum_draft_v1(
      '${OUTSIDER}', '${draft.draftId}', 'curriculum:read'
    )`)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    await expect(database.query(`select public.academy_admin_list_curriculum_drafts_v1(
      '${ADMIN}', 'curriculum:drafts:write'
    )`)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    await reset(database)
  })

  it('creates and updates entities with workspace/entity CAS and atomic audit append', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const created = await createEntity(database, draft.draftId)
    expect(created).toMatchObject({
      replayed: false, draftRevision: 2,
      entity: { entityType: 'course', entityRef: 'course:math-5', revision: 1, tombstoned: false },
    })
    const changed = { ...course, title: 'Advanced Mathematics 5' }
    await setService(database)
    const updated = (await database.query<{ value: any }>(`
      select public.academy_admin_update_curriculum_draft_entity_v1(
        $1, $2, 'course', 'course:math-5', 11, $3::jsonb, $4,
        1, 2, '30000000-0000-4000-8000-000000000001', $5, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, draft.draftId, JSON.stringify(changed), HASH_B, HASH_B])).rows[0].value
    expect(updated).toMatchObject({ draftRevision: 3, entity: { revision: 2, position: 11, digest: HASH_B } })
    await expect(database.query(`select public.academy_admin_update_curriculum_draft_entity_v1(
      '${ADMIN}', '${draft.draftId}', 'course', 'course:math-5', 12,
      '${JSON.stringify(changed).replaceAll("'", "''")}'::jsonb, '${HASH_B}',
      1, 3, '30000000-0000-4000-8000-000000000002', '${HASH_A}', 'curriculum:drafts:write'
    )`)).rejects.toThrow('CURRICULUM_CAS_CONFLICT')
    await reset(database)
    const actions = (await database.query<any>('select action from academy_private.admin_audit_events order by occurred_at, event_id')).rows.map((row) => row.action)
    expect(actions).toEqual(['curriculum_draft.create', 'curriculum_entity.create', 'curriculum_entity.update'])
  })

  it('tombstones without deleting payload history and rejects later mutation', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await createEntity(database, draft.draftId)
    await setService(database)
    const value = (await database.query<{ value: any }>(`
      select public.academy_admin_tombstone_curriculum_draft_entity_v1(
        $1, $2, 'course', 'course:math-5', 1, 2,
        '40000000-0000-4000-8000-000000000001', $3, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, draft.draftId, HASH_A])).rows[0].value
    expect(value).toMatchObject({ draftRevision: 3, entity: { revision: 2, tombstoned: true } })
    await reset(database)
    await expect(database.exec(`delete from public.academy_curriculum_draft_entities where draft_id = '${draft.draftId}'`))
      .rejects.toThrow('tombstones')
    const row = (await database.query<any>('select payload, tombstoned from public.academy_curriculum_draft_entities')).rows[0]
    expect(row.payload).toEqual(course)
    expect(row.tombstoned).toBe(true)
  })

  it('rejects protected/system types and malformed Schema v2 top-level state in the database', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await setService(database)
    for (const type of ['policy_set', 'standard_framework', 'schedule', 'assessment_protected_interpretation']) {
      await expect(database.query(`select public.academy_admin_create_curriculum_draft_entity_v1(
        '${ADMIN}', '${draft.draftId}', '${type}', 'protected:item', 'draft_created', 1,
        '{"schema_set_version":"2.0.0"}'::jsonb, '${HASH_A}', 1,
        gen_random_uuid(), '${HASH_A}', 'curriculum:drafts:write'
      )`)).rejects.toThrow('CURRICULUM_ENTITY_INPUT_INVALID')
    }
    const injected = { ...course, actorUserRef: OUTSIDER }
    await expect(database.query(`select public.academy_admin_create_curriculum_draft_entity_v1(
      $1, $2, 'course', 'course:math-5', 'draft_created', 1,
      $3::jsonb, $4, 1, gen_random_uuid(), $5, 'curriculum:drafts:write'
    )`, [ADMIN, draft.draftId, JSON.stringify(injected), HASH_A, HASH_A])).rejects.toThrow('CURRICULUM_ENTITY_INPUT_INVALID')
    await reset(database)
  })

  it('preserves published immutability and exposes no direct application-role table access', async () => {
    const database = databases[0]
    await expect(database.exec("update public.academy_curriculum_releases set version = '9.9.9' where version = '1.0.0'"))
      .rejects.toThrow('immutable')
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      const privileges = await database.query<{ allowed: boolean }>(
        `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`,
        [role, 'public.academy_curriculum_draft_entities'],
      )
      expect(privileges.rows[0].allowed, role).toBe(false)
    }
    const rls = await database.query<any>(`
      select relrowsecurity, relforcerowsecurity from pg_class
      where oid = 'public.academy_curriculum_draft_entities'::regclass
    `)
    expect(rls.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
    for (const role of ['public', 'anon', 'authenticated']) {
      const privilege = await database.query<{ allowed: boolean }>(
        `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
        [role, 'public.academy_admin_create_curriculum_draft_v1(uuid,text,text,text,uuid,text,text)'],
      )
      expect(privilege.rows[0].allowed, role).toBe(false)
    }
    const servicePrivilege = await database.query<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'EXECUTE') as allowed`,
      ['public.academy_admin_create_curriculum_draft_v1(uuid,text,text,text,uuid,text,text)'],
    )
    expect(servicePrivilege.rows[0].allowed).toBe(true)
    const preservedPrivilege = await database.query<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'EXECUTE') as allowed`,
      ['academy_private.preexisting_service_helper()'],
    )
    expect(preservedPrivilege.rows[0].allowed).toBe(true)

    const migrationBytes = (await readFile(migrationUrls.at(-1)!, 'utf8')).replace(/\r\n/gu, '\n')
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-draft-authoring-migration.json', import.meta.url),
      'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})
