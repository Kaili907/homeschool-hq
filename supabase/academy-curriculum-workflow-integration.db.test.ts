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
})
