import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationUrls = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810130000_academy_curriculum_standards_review.sql',
  './migrations/20260810140000_academy_curriculum_human_approval.sql',
  './migrations/20260810141500_academy_curriculum_draft_collaborators.sql',
  './migrations/20260810150000_academy_curriculum_release_staging.sql',
  './migrations/20260810160000_academy_curriculum_privacy_hardening.sql',
].map((path) => new URL(path, import.meta.url))

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
`

const expectedWorkflowFunctions = [
  'academy_admin_add_curriculum_draft_collaborator_v1',
  'academy_admin_create_curriculum_draft_entity_v1',
  'academy_admin_create_curriculum_draft_v1',
  'academy_admin_decide_curriculum_approval_v1',
  'academy_admin_list_curriculum_draft_collaborators_v1',
  'academy_admin_list_curriculum_drafts_v1',
  'academy_admin_list_curriculum_standard_reviews_v1',
  'academy_admin_read_curriculum_approval_v1',
  'academy_admin_read_curriculum_draft_entity_v1',
  'academy_admin_read_curriculum_draft_v1',
  'academy_admin_read_curriculum_staging_v1',
  'academy_admin_record_curriculum_validation_v1',
  'academy_admin_revoke_curriculum_draft_collaborator_v1',
  'academy_admin_stage_curriculum_release_v1',
  'academy_admin_tombstone_curriculum_draft_entity_v1',
  'academy_admin_update_curriculum_draft_entity_v1',
  'academy_admin_update_curriculum_standard_review_v1',
]

describe('Curriculum pre-publish migration assembly', () => {
  it('applies every frozen migration in timestamp order without losing sibling feature vocabulary', async () => {
    const database = new PGlite()
    try {
      await database.exec(bootstrap)
      for (const migrationUrl of migrationUrls) {
        await database.exec(await readFile(migrationUrl, 'utf8'))
      }

      const functions = await database.query<{ proname: string }>(`
        select proname
        from pg_catalog.pg_proc
        where pronamespace = 'public'::regnamespace
          and proname = any($1::text[])
        order by proname
      `, [expectedWorkflowFunctions])
      expect(functions.rows.map((row) => row.proname)).toEqual([...expectedWorkflowFunctions].sort())

      const exposedUnscoped = await database.query<{ count: number }>(`
        select count(*)::integer as count
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
        join pg_catalog.aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as grant_row on true
        join pg_catalog.pg_roles as grantee on grantee.oid = grant_row.grantee
        where namespace.nspname = 'public'
          and procedure.proname like '%curriculum%unscoped_v1'
          and grantee.rolname = 'service_role'
          and grant_row.privilege_type = 'EXECUTE'
      `)
      expect(exposedUnscoped.rows[0].count).toBe(0)

      const hardeningMigration = await readFile(migrationUrls.at(-1)!)
      const custody = JSON.parse(await readFile(
        new URL('../docs/admin-console/curriculum-privacy-hardening-migration.json', import.meta.url),
        'utf8',
      ))
      expect(createHash('sha256').update(hardeningMigration).digest('hex')).toBe(custody.sha256)

      const actionConstraint = await database.query<{ definition: string }>(`
        select pg_catalog.pg_get_constraintdef(oid) as definition
        from pg_catalog.pg_constraint
        where conname = 'admin_audit_events_action_check'
      `)
      expect(actionConstraint.rows).toHaveLength(1)
      for (const action of [
        'curriculum_draft.create',
        'curriculum_entity.update',
        'curriculum_standard_review.update',
        'curriculum_approval.approve',
        'curriculum_draft.collaborator.add',
        'curriculum_draft.collaborator.revoke',
        'curriculum_release.stage',
      ]) {
        expect(actionConstraint.rows[0].definition).toContain(action)
      }
    } finally {
      await database.close()
    }
  })

  it('enforces collaborator scope at standards, validation, approval, and staging RPCs', async () => {
    const creator = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const ownerReviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const viewerReviewer = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const hash = 'a'.repeat(64)
    const database = new PGlite()
    try {
      await database.exec(bootstrap)
      await database.exec(`insert into auth.users (id) values ('${creator}'), ('${ownerReviewer}'), ('${viewerReviewer}')`)
      for (const migrationUrl of migrationUrls) {
        await database.exec(await readFile(migrationUrl, 'utf8'))
      }
      await database.exec(`
        insert into public.academy_admin_role_assignments (user_id, role, assignment_reason_code)
        values
          ('${creator}', 'admin', 'privacy.creator'),
          ('${ownerReviewer}', 'owner', 'privacy.owner-reviewer'),
          ('${viewerReviewer}', 'viewer', 'privacy.viewer-reviewer');
        set role service_role;
        select set_config('request.jwt.claim.role', 'service_role', false);
      `)
      const draft = (await database.query<{ value: { draftId: string } }>(`
        select public.academy_admin_create_curriculum_draft_v1(
          $1, '1.0.0', '2.0.0-draft.1', '2.0.0',
          '10000000-0000-4000-8000-000000000001', $2,
          'curriculum:drafts:write'
        ) as value
      `, [creator, hash])).rows[0].value

      for (const statement of [
        `select public.academy_admin_list_curriculum_standard_reviews_v1(
          '${ownerReviewer}', 'draft', '${draft.draftId}', 'curriculum:read')`,
        `select public.academy_admin_read_curriculum_approval_v1(
          '${ownerReviewer}', '${draft.draftId}', 'curriculum:read')`,
        `select public.academy_admin_read_curriculum_staging_v1(
          '${ownerReviewer}', '${draft.draftId}', 'curriculum:read')`,
      ]) await expect(database.query(statement)).rejects.toThrow('CURRICULUM_COLLABORATION_REQUIRED')

      await database.query(`select public.academy_admin_add_curriculum_draft_collaborator_v1(
        $1, $2, $3, 'reviewer', 1,
        '20000000-0000-4000-8000-000000000001', $4,
        'curriculum:drafts:write'
      )`, [creator, draft.draftId, ownerReviewer, hash])
      await database.query(`select public.academy_admin_add_curriculum_draft_collaborator_v1(
        $1, $2, $3, 'reviewer', 2,
        '20000000-0000-4000-8000-000000000002', $4,
        'curriculum:drafts:write'
      )`, [creator, draft.draftId, viewerReviewer, hash])

      await expect(database.query(`select public.academy_admin_list_curriculum_standard_reviews_v1(
        '${ownerReviewer}', 'draft', '${draft.draftId}', 'curriculum:read')`)).resolves.toBeDefined()
      await expect(database.query(`select public.academy_admin_read_curriculum_approval_v1(
        '${ownerReviewer}', '${draft.draftId}', 'curriculum:read')`)).resolves.toBeDefined()
      await expect(database.query(`select public.academy_admin_read_curriculum_staging_v1(
        '${ownerReviewer}', '${draft.draftId}', 'curriculum:read')`)).resolves.toBeDefined()

      for (const statement of [
        `select public.academy_admin_record_curriculum_validation_v1(
          '${ownerReviewer}', '${draft.draftId}', 3, 'curriculum-validation-v2', '${hash}',
          'valid', true, 0, 0, 0, 'curriculum:read')`,
        `select public.academy_admin_decide_curriculum_approval_v1(
          '${ownerReviewer}', '${draft.draftId}', 3, 'changes_requested', 'changes.other', null,
          '30000000-0000-4000-8000-000000000001', '${hash}', 'curriculum:approve')`,
        `select public.academy_admin_stage_curriculum_release_v1(
          '${ownerReviewer}', '${draft.draftId}', 3, null, null, '{}'::jsonb, '{}', '[]'::jsonb,
          '${hash}', '${hash}', '${hash}', '30000000-0000-4000-8000-000000000002', '${hash}',
          'curriculum:publish')`,
        `select public.academy_admin_update_curriculum_standard_review_v1(
          '${ownerReviewer}', 'csr-aaaaaaaaaaaaaaaa', 'draft', '${draft.draftId}', 'Legacy', 5::smallint,
          'course:math-5', 'standards.human_review_required', array['cvf-one'], 1, 'in_review',
          null, null, null, null, null, 0::bigint, '30000000-0000-4000-8000-000000000003', '${hash}',
          'curriculum:drafts:write')`,
      ]) await expect(database.query(statement)).rejects.toThrow('CURRICULUM_COLLABORATION_REQUIRED')

      await expect(database.query(`select public.academy_admin_record_curriculum_validation_v1(
        '${viewerReviewer}', '${draft.draftId}', 3, 'curriculum-validation-v2', '${hash}',
        'valid', true, 0, 0, 0, 'curriculum:read')`)).rejects.toThrow('CURRICULUM_AUTHORING_REQUIRED')
    } finally {
      await database.close()
    }
  })
})
