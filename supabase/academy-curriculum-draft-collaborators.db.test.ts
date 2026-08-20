import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationUrls = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810141500_academy_curriculum_draft_collaborators.sql',
].map((path) => new URL(path, import.meta.url))

const CREATOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SECOND_EDITOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ADMIN_REVIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const VIEWER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OUTSIDER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const databases: PGlite[] = []

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
    ('${CREATOR}'), ('${SECOND_EDITOR}'), ('${ADMIN_REVIEWER}'),
    ('${VIEWER}'), ('${OUTSIDER}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

async function createDraft(database: PGlite) {
  await setService(database)
  try {
    const result = await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', '2.0.0-draft.1', '2.0.0',
        '10000000-0000-4000-8000-000000000001', $2,
        'curriculum:drafts:write'
      ) as value
    `, [CREATOR, HASH_A])
    return result.rows[0].value
  } finally {
    await reset(database)
  }
}

async function addCollaborator(
  database: PGlite,
  draftId: string,
  principal: string,
  responsibility: 'editor' | 'reviewer',
  expectedRevision: number,
  requestId: string,
  digest = HASH_A,
  actor = CREATOR,
) {
  await setService(database)
  try {
    const result = await database.query<{ value: any }>(`
      select public.academy_admin_add_curriculum_draft_collaborator_v1(
        $1, $2, $3, $4, $5, $6, $7, 'curriculum:drafts:write'
      ) as value
    `, [actor, draftId, principal, responsibility, expectedRevision, requestId, digest])
    return result.rows[0].value
  } finally {
    await reset(database)
  }
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrap)
  for (const url of migrationUrls) await database.exec(await readFile(url, 'utf8'))
  await database.exec(`
    insert into public.academy_admin_role_assignments (
      user_id, role, assignment_reason_code
    ) values
      ('${CREATOR}', 'admin', 'test.creator'),
      ('${SECOND_EDITOR}', 'admin', 'test.editor'),
      ('${ADMIN_REVIEWER}', 'admin', 'test.reviewer'),
      ('${VIEWER}', 'viewer', 'test.viewer');
  `)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum draft collaborator database boundary', () => {
  it('makes the verified creator the initial editor and scopes draft discovery', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await setService(database)
    const creatorList = (await database.query<{ value: any }>(`
      select public.academy_admin_list_curriculum_draft_collaborators_v1(
        $1, $2, 'curriculum:read'
      ) as value
    `, [CREATOR, draft.draftId])).rows[0].value
    const reviewerDrafts = (await database.query<{ value: any }>(`
      select public.academy_admin_list_curriculum_drafts_v1(
        $1, 'curriculum:read'
      ) as value
    `, [ADMIN_REVIEWER])).rows[0].value
    expect(creatorList).toMatchObject({
      schemaVersion: 1,
      draftId: draft.draftId,
      draftRevision: 1,
      currentResponsibility: 'editor',
      collaborators: [{ principalRef: CREATOR, responsibility: 'editor', status: 'active' }],
    })
    expect(reviewerDrafts.drafts).toEqual([])
    await expect(database.query(`
      select public.academy_admin_read_curriculum_draft_v1(
        '${ADMIN_REVIEWER}', '${draft.draftId}', 'curriculum:read'
      )
    `)).rejects.toThrow('CURRICULUM_COLLABORATION_REQUIRED')
    await reset(database)
  })

  it('adds only eligible verified principals and never elevates a viewer into editing', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await expect(addCollaborator(
      database, draft.draftId, VIEWER, 'editor', 1,
      '20000000-0000-4000-8000-000000000001',
    )).rejects.toThrow('CURRICULUM_COLLABORATOR_PRINCIPAL_INVALID')
    await expect(addCollaborator(
      database, draft.draftId, OUTSIDER, 'reviewer', 1,
      '20000000-0000-4000-8000-000000000002',
    )).rejects.toThrow('CURRICULUM_COLLABORATOR_PRINCIPAL_INVALID')
    const added = await addCollaborator(
      database, draft.draftId, VIEWER, 'reviewer', 1,
      '20000000-0000-4000-8000-000000000003',
    )
    expect(added).toMatchObject({
      replayed: false,
      draftRevision: 2,
      collaborator: { principalRef: VIEWER, responsibility: 'reviewer', status: 'active' },
    })
    await setService(database)
    await expect(database.query(`
      select public.academy_admin_create_curriculum_draft_entity_v1(
        '${VIEWER}', '${draft.draftId}', 'course', 'course:math-5',
        'draft_created', 1, '{}'::jsonb, '${HASH_A}', 2,
        gen_random_uuid(), '${HASH_A}', 'curriculum:drafts:write'
      )
    `)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    await expect(database.query(`
      select public.academy_admin_read_curriculum_draft_v1(
        '${VIEWER}', '${draft.draftId}', 'curriculum:read'
      )
    `)).resolves.toBeDefined()
    await reset(database)
  })

  it('requires both global write capability and an editor assignment for every mutation', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await addCollaborator(
      database, draft.draftId, ADMIN_REVIEWER, 'reviewer', 1,
      '30000000-0000-4000-8000-000000000001',
    )
    await setService(database)
    await expect(database.query(`
      select public.academy_admin_add_curriculum_draft_collaborator_v1(
        '${ADMIN_REVIEWER}', '${draft.draftId}', '${SECOND_EDITOR}', 'editor', 2,
        '30000000-0000-4000-8000-000000000002', '${HASH_A}',
        'curriculum:drafts:write'
      )
    `)).rejects.toThrow('CURRICULUM_COLLABORATION_REQUIRED')
    await expect(database.query(`
      select public.academy_admin_add_curriculum_draft_collaborator_v1(
        '${OUTSIDER}', '${draft.draftId}', '${SECOND_EDITOR}', 'editor', 2,
        '30000000-0000-4000-8000-000000000003', '${HASH_A}',
        'curriculum:drafts:write'
      )
    `)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    await reset(database)
  })

  it('uses workspace CAS and exact replay while appending bounded add/revoke audit', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const request = '40000000-0000-4000-8000-000000000001'
    const added = await addCollaborator(
      database, draft.draftId, SECOND_EDITOR, 'editor', 1, request,
    )
    const replay = await addCollaborator(
      database, draft.draftId, SECOND_EDITOR, 'editor', 1, request,
    )
    expect(replay).toEqual({ ...added, replayed: true })
    await expect(addCollaborator(
      database, draft.draftId, ADMIN_REVIEWER, 'reviewer', 2, request, HASH_B,
    )).rejects.toThrow('CURRICULUM_REPLAY_CONFLICT')
    await expect(addCollaborator(
      database, draft.draftId, ADMIN_REVIEWER, 'reviewer', 1,
      '40000000-0000-4000-8000-000000000002',
    )).rejects.toThrow('CURRICULUM_CAS_CONFLICT')

    await setService(database)
    const revoked = (await database.query<{ value: any }>(`
      select public.academy_admin_revoke_curriculum_draft_collaborator_v1(
        $1, $2, $3, 2, '40000000-0000-4000-8000-000000000003',
        $4, 'curriculum:drafts:write'
      ) as value
    `, [CREATOR, draft.draftId, SECOND_EDITOR, HASH_A])).rows[0].value
    expect(revoked).toMatchObject({
      replayed: false,
      draftRevision: 3,
      collaborator: { principalRef: SECOND_EDITOR, responsibility: 'editor', status: 'revoked' },
    })
    await reset(database)
    const audits = (await database.query<any>(`
      select action, previous_value, new_value
      from academy_private.admin_audit_events
      where action like 'curriculum_draft.collaborator.%'
      order by occurred_at, event_id
    `)).rows
    expect(audits).toEqual([
      {
        action: 'curriculum_draft.collaborator.add',
        previous_value: null,
        new_value: { collaborator_ref: SECOND_EDITOR, role: 'editor', status: 'active' },
      },
      {
        action: 'curriculum_draft.collaborator.revoke',
        previous_value: { collaborator_ref: SECOND_EDITOR, role: 'editor', status: 'active' },
        new_value: { collaborator_ref: SECOND_EDITOR, role: 'editor', status: 'revoked' },
      },
    ])
    await setService(database)
    await expect(database.query(`
      select public.academy_admin_read_curriculum_draft_v1(
        '${SECOND_EDITOR}', '${draft.draftId}', 'curriculum:read'
      )
    `)).rejects.toThrow('CURRICULUM_COLLABORATION_REQUIRED')
    await reset(database)
  })

  it('prevents deletion, revival, and removal of the final editor', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    await setService(database)
    await expect(database.query(`
      select public.academy_admin_revoke_curriculum_draft_collaborator_v1(
        '${CREATOR}', '${draft.draftId}', '${CREATOR}', 1,
        '50000000-0000-4000-8000-000000000001', '${HASH_A}',
        'curriculum:drafts:write'
      )
    `)).rejects.toThrow('CURRICULUM_COLLABORATOR_LAST_EDITOR')
    await reset(database)
    await expect(database.exec(`
      delete from public.academy_curriculum_draft_collaborators
      where draft_id = '${draft.draftId}'
    `)).rejects.toThrow('history cannot be deleted')
  })

  it('keeps direct tables private and stores no email, name, payload, learner, or secret fields', async () => {
    const database = databases[0]
    await createDraft(database)
    const columns = (await database.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'academy_curriculum_draft_collaborators'
      order by ordinal_position
    `)).rows.map((row) => row.column_name)
    expect(columns).not.toEqual(expect.arrayContaining([
      'email', 'name', 'payload', 'notes', 'learner_id', 'student_id', 'token', 'secret',
    ]))
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const privilege = await database.query<{ allowed: boolean }>(
        `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`,
        [role, 'public.academy_curriculum_draft_collaborators'],
      )
      expect(privilege.rows[0].allowed, role).toBe(false)
    }
    const migrationBytes = (await readFile(migrationUrls.at(-1)!, 'utf8')).replace(/\r\n/gu, '\n')
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-draft-collaborators-migration.json', import.meta.url),
      'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})
