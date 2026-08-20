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
  './migrations/20260810130000_academy_curriculum_standards_review.sql',
].map((path) => new URL(path, import.meta.url))

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OUTSIDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const REVIEW_KEY = 'csr-1234567890abcdef'
const FINDING_IDS = ['cvf-1234567890abcdef', 'cvf-fedcba0987654321']
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
    ('${OWNER}'), ('${ADMIN}'), ('${VIEWER}'), ('${OUTSIDER}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

interface ReviewInput {
  actor?: string
  status?: 'in_review' | 'approved_mapping' | 'rejected_mapping' | 'needs_evidence'
  expectedRevision?: number
  requestId?: string
  requestDigest?: string
  canonicalStandardId?: string | null
  frameworkVersion?: string | null
  canonicalTitle?: string | null
  evidenceSource?: string | null
  reviewerNote?: string | null
  requiredCapability?: 'curriculum:drafts:write' | 'curriculum:approve'
  findingIds?: readonly string[]
}

async function updateReview(database: PGlite, input: ReviewInput = {}) {
  const status = input.status ?? 'in_review'
  const approved = status === 'approved_mapping'
  await setService(database)
  try {
    const result = await database.query<{ value: any }>(`
      select public.academy_admin_update_curriculum_standard_review_v1(
        $1::uuid, $2, 'published_release', '1.0.0', '2', 5::smallint,
        'ma-g5-physical-education', 'standards.human_review_required', $3::text[],
        $4::integer, $5, $6, $7, $8, $9, $10, $11::bigint,
        $12::uuid, $13, $14
      ) as value
    `, [
      input.actor ?? ADMIN,
      REVIEW_KEY,
      input.findingIds ?? FINDING_IDS,
      (input.findingIds ?? FINDING_IDS).length,
      status,
      Object.hasOwn(input, 'canonicalStandardId') ? input.canonicalStandardId : approved ? 'human-verified-standard-id' : null,
      Object.hasOwn(input, 'frameworkVersion') ? input.frameworkVersion : approved ? 'human-verified-framework-version' : null,
      Object.hasOwn(input, 'canonicalTitle') ? input.canonicalTitle : approved ? 'Human verified standard title' : null,
      Object.hasOwn(input, 'evidenceSource') ? input.evidenceSource : approved ? 'Official evidence reference supplied by the reviewer' : null,
      Object.hasOwn(input, 'reviewerNote') ? input.reviewerNote : approved ? 'Reviewer verified every explicit evidence field.' : null,
      input.expectedRevision ?? 0,
      input.requestId ?? '10000000-0000-4000-8000-000000000001',
      input.requestDigest ?? HASH_A,
      input.requiredCapability ?? (approved ? 'curriculum:approve' : 'curriculum:drafts:write'),
    ])
    return result.rows[0].value
  } finally {
    await reset(database)
  }
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrap)
  for (const url of migrationUrls) {
    try {
      await database.exec(await readFile(url, 'utf8'))
    } catch (error) {
      const detail = error as { message?: string; position?: string; query?: string }
      throw new Error(`Failed migration ${url.pathname}: ${detail.message ?? String(error)} position=${detail.position ?? 'unknown'} queryTail=${detail.query?.slice(-700) ?? 'unknown'}`)
    }
  }
  await database.exec(`
    insert into public.academy_admin_role_assignments (user_id, role, assignment_reason_code)
    values ('${OWNER}', 'owner', 'test.owner'), ('${ADMIN}', 'admin', 'test.admin'), ('${VIEWER}', 'viewer', 'test.viewer');
  `)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum standards review database boundary', () => {
  it('lists with curriculum read, reauthorizes workflow writes, and reserves approvals for owners', async () => {
    const database = databases[0]
    await setService(database)
    await expect(database.query(`select public.academy_admin_list_curriculum_standard_reviews_v1(
      '${VIEWER}', 'published_release', '1.0.0', 'curriculum:read'
    )`)).resolves.toBeDefined()
    await expect(database.query(`select public.academy_admin_list_curriculum_standard_reviews_v1(
      '${OUTSIDER}', 'published_release', '1.0.0', 'curriculum:read'
    )`)).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_REQUIRED')
    await reset(database)

    expect(await updateReview(database)).toMatchObject({
      schemaVersion: 1, replayed: false,
      decision: { status: 'in_review', sourceLabel: '2', affectedCount: 2, revision: 1 },
    })
    await expect(updateReview(database, {
      actor: ADMIN, status: 'approved_mapping', expectedRevision: 1,
      requestId: '10000000-0000-4000-8000-000000000002', requestDigest: HASH_B,
    })).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_REQUIRED')
    const approved = await updateReview(database, {
      actor: OWNER, status: 'approved_mapping', expectedRevision: 1,
      requestId: '10000000-0000-4000-8000-000000000003', requestDigest: HASH_B,
    })
    expect(approved.decision).toMatchObject({
      status: 'approved_mapping', revision: 2,
      canonicalStandardId: 'human-verified-standard-id',
      frameworkVersion: 'human-verified-framework-version',
      canonicalTitle: 'Human verified standard title',
    })
  })

  it('rejects approval without every evidence field and keeps rejected/needs-evidence states unmapped', async () => {
    const database = databases[0]
    for (const missing of ['canonicalStandardId', 'frameworkVersion', 'canonicalTitle', 'evidenceSource', 'reviewerNote'] as const) {
      await expect(updateReview(database, {
        actor: OWNER, status: 'approved_mapping', [missing]: null,
        requestId: crypto.randomUUID(), requestDigest: HASH_A,
      })).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_EVIDENCE_REQUIRED')
    }
    for (const [index, status] of (['rejected_mapping', 'needs_evidence'] as const).entries()) {
      const result = await updateReview(database, {
        status, reviewerNote: 'Repository evidence is not sufficient for approval.',
        expectedRevision: index, requestId: `20000000-0000-4000-8000-00000000000${index + 1}`,
        requestDigest: index ? HASH_B : HASH_A,
      })
      expect(result.decision).toMatchObject({
        status, canonicalStandardId: null, frameworkVersion: null,
        canonicalTitle: null, evidenceSource: null,
      })
    }
  })

  it('provides idempotent replay, digest conflict, identity protection, and revision CAS', async () => {
    const database = databases[0]
    const first = await updateReview(database)
    expect(await updateReview(database)).toEqual({ ...first, replayed: true })
    await expect(updateReview(database, { requestDigest: HASH_B })).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_REPLAY_CONFLICT')
    await expect(updateReview(database, {
      status: 'needs_evidence', reviewerNote: 'More official evidence must be supplied.', expectedRevision: 0,
      requestId: '30000000-0000-4000-8000-000000000001', requestDigest: HASH_B,
    })).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_CAS_CONFLICT')
    await expect(updateReview(database, {
      status: 'in_review', expectedRevision: 1, findingIds: ['cvf-aaaaaaaaaaaaaaaa'],
      requestId: '30000000-0000-4000-8000-000000000002', requestDigest: HASH_B,
    })).rejects.toThrow('CURRICULUM_STANDARDS_REVIEW_IDENTITY_CONFLICT')
  })

  it('appends minimized audit facts and never writes curriculum release or draft content', async () => {
    const database = databases[0]
    const releaseBefore = (await database.query('select * from public.academy_curriculum_releases')).rows
    const draftsBefore = (await database.query('select * from public.academy_curriculum_drafts')).rows
    await updateReview(database)
    const audit = (await database.query<any>(`
      select action, resource_type, previous_value, new_value, reason_code,
        row_to_json(event)::text as raw
      from academy_private.admin_audit_events event
      where action = 'curriculum_standard_review.update'
    `)).rows[0]
    expect(audit).toMatchObject({
      action: 'curriculum_standard_review.update', resource_type: 'curriculum_standard_review',
      previous_value: null, new_value: { status: 'in_review', revision: 1 },
      reason_code: 'curriculum.authored',
    })
    expect(audit.raw).not.toContain('human-verified')
    expect(audit.raw).not.toContain('Official evidence')
    expect((await database.query('select * from public.academy_curriculum_releases')).rows).toEqual(releaseBefore)
    expect((await database.query('select * from public.academy_curriculum_drafts')).rows).toEqual(draftsBefore)
  })

  it('forces RLS and exposes only narrow service RPC execution', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect((await database.query<{ allowed: boolean }>(
        `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`,
        [role, 'public.academy_curriculum_standard_reviews'],
      )).rows[0].allowed, role).toBe(false)
    }
    expect((await database.query<any>(`
      select relrowsecurity, relforcerowsecurity from pg_class
      where oid = 'public.academy_curriculum_standard_reviews'::regclass
    `)).rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
    const signature = 'public.academy_admin_update_curriculum_standard_review_v1(uuid,text,text,text,text,smallint,text,text,text[],integer,text,text,text,text,text,text,bigint,uuid,text,text)'
    for (const role of ['public', 'anon', 'authenticated']) {
      expect((await database.query<{ allowed: boolean }>(
        `select has_function_privilege($1, $2, 'EXECUTE') as allowed`, [role, signature],
      )).rows[0].allowed, role).toBe(false)
    }
    expect((await database.query<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'EXECUTE') as allowed`, [signature],
    )).rows[0].allowed).toBe(true)
    await updateReview(database)
    await expect(database.exec(`delete from public.academy_curriculum_standard_reviews where review_key = '${REVIEW_KEY}'`))
      .rejects.toThrow('cannot be deleted')
    const migrationBytes = (await readFile(migrationUrls.at(-1)!, 'utf8')).replace(/\r\n/gu, '\n')
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-standards-review-migration.json', import.meta.url), 'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})
