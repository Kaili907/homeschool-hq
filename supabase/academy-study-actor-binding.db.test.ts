import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Actor-bound Study session verification.
 *
 * The production safety server sends the gateway actor it verified out of band as
 * a third RPC argument. Only the database can compare that actor against the
 * durable grant owner (`student_session_grants.issued_by`); a server-side
 * comparison would be comparing a claim against itself. This suite pins the
 * three-argument overload's binding and, just as load-bearing, pins that the
 * two-argument overload it was added alongside is untouched — that overload is
 * still what `study-session-verify` and production readiness call.
 *
 * Written RED before the migration existed. With ACTOR_MIGRATION absent the chain
 * below still applies cleanly, so the RED is a specific, readable set of failures
 * — signature absent, marker absent, actor binding unenforceable — rather than a
 * load error, and the two-argument controls pass on both sides of the change.
 */
const ACTOR_MIGRATION =
  './migrations/20260808120000_academy_study_actor_bound_session_verification.sql'

const chain = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260806120000_academy_study_in_app_receipt_timestamp.sql',
  './migrations/20260806140000_academy_study_c2_operations_contract.sql',
  ACTOR_MIGRATION,
  './tests/study_engine_fixtures.sql',
] as const

const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const VIEWER_A = '00000000-0000-0000-0000-0000000000a3'
const UNRELATED_A = '00000000-0000-0000-0000-0000000000a5'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const MEMBERSHIP_A = '00000000-0000-0000-0000-0000000000a2'
const ACCESS_A = '00000000-0000-0000-0000-0000000001a1'
// Guardian A's second, cross-household relationship. Added so "wrong learner" is
// a real case rather than a restatement of "wrong household": with this in place
// one actor legitimately owns grants for two different learners.
const MEMBERSHIP_A_IN_B = '00000000-0000-0000-0000-0000000000c2'
const ACCESS_A_TO_B = '00000000-0000-0000-0000-0000000001c2'

const CAPABILITY = 'student:progress:read'
const OTHER_CAPABILITY = 'student:attempts:create'
const OUTSIDE_ALLOWLIST = 'study:manage'
const THREE_ARG = 'public.academy_study_verify_session_v1(text,text,uuid)'
const TWO_ARG = 'public.academy_study_verify_session_v1(text,text)'

/** Every denial the gateway can observe is exactly this object. */
const DENIED = {
  schemaVersion: 1,
  status: 'denied',
  code: 'student-session-invalid',
} as const

const sources = Promise.all(chain.map(async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8')
  } catch {
    // Only the not-yet-authored actor migration may be missing; a missing
    // predecessor must still fail loudly.
    if (path === ACTOR_MIGRATION) return ''
    throw new Error(`missing migration source: ${path}`)
  }
}))

let database: PGlite

const ACTOR_MIGRATION_INDEX = chain.indexOf(ACTOR_MIGRATION)

async function actorMigrationSource() {
  return (await sources)[ACTOR_MIGRATION_INDEX]
}

/** The full lineage up to and including C2, with the actor migration withheld. */
async function chainWithoutActorMigration() {
  const candidate = await PGlite.create()
  await candidate.exec(bootstrap)
  const loaded = await sources
  for (let index = 0; index < chain.length; index += 1) {
    if (index === ACTOR_MIGRATION_INDEX || !loaded[index]) continue
    await candidate.exec(loaded[index])
  }
  return candidate
}

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({
    role: role === 'anon' ? 'authenticated' : role,
    ...(subject ? { sub: subject } : {}),
  })
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await operation()
  } finally {
    try {
      await database.exec(`
        reset role;
        select set_config('request.jwt.claim.sub', '', false);
        select set_config('request.jwt.claims', '', false);
        select set_config('request.jwt.claim.role', '', false);
      `)
    } catch {
      // When the operation failed inside an open transaction the session is
      // aborted and this cleanup cannot run. Letting it throw would replace the
      // real failure with "current transaction is aborted" and hide which
      // predicate actually fired — the caller's rollback restores the session.
    }
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []) {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function digestOf(token: string) {
  return createHash('sha256').update(token, 'ascii').digest('hex')
}

async function issue(guardian: string, student: string) {
  return asRole('authenticated', guardian, () => rpc<Record<string, unknown>>(
    'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
    ['academy-student-id', student],
  ))
}

/** The three-argument overload the production safety server calls. */
async function verifyActor(
  digest: string | null,
  actor: string | null,
  capability: string = CAPABILITY,
) {
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_verify_session_v1($1::text, $2::text, $3::uuid) as result',
    [digest, capability, actor],
  ))
}

/** The pre-existing two-argument overload. Must remain exactly as it was. */
async function verifyLegacy(digest: string | null, capability: string = CAPABILITY) {
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_verify_session_v1($1::text, $2::text) as result',
    [digest, capability],
  ))
}

async function tokenFor(guardian: string, student: string) {
  const grant = await issue(guardian, student)
  return { token: String(grant.sessionReference), digest: digestOf(String(grant.sessionReference)), grant }
}

/**
 * The public issuer is an opaque projection — 20260801190000 narrowed it to
 * schemaVersion, status, sessionReference and expiresAt precisely so a browser
 * caller learns no durable identity. Durable identifiers therefore come from the
 * table, never from the issuance envelope.
 */
async function grantIdFor(digest: string) {
  const result = await database.query<{ id: string }>(
    `select id from academy_private.student_session_grants where token_digest = $1`,
    [digest],
  )
  return result.rows[0]?.id
}

/** Runs mutations against shared fixtures and unwinds them. */
async function reverted<T>(operation: () => Promise<T>): Promise<T> {
  await database.exec('begin')
  try {
    return await operation()
  } finally {
    await database.exec('rollback')
  }
}

/**
 * `capabilities` and `expires_at` are immutable on an issued grant — the identity
 * foundation's protection trigger refuses to update either. Cases that need a
 * narrower scope or a past expiry therefore mint the grant that way rather than
 * editing one, which is also closer to what the issuer actually does. Every such
 * case pairs the denial with a positive control minted the same way, so a denial
 * can never be credited to a malformed synthetic row.
 */
const CREDENTIAL_A = '00000000-0000-0000-0000-000000009101'
const ALL_CAPABILITIES = [
  'student:assignments:read',
  'student:attempts:create',
  'student:progress:read',
]

/** One unrevoked guardian Study grant per (learner, actor) is enforced by index. */
async function clearLiveGrants(student: string, guardian: string) {
  await database.exec(`
    update academy_private.student_session_grants
    set revoked_at = now(), revoked_actor_kind = 'trusted_server',
      revocation_reason = 'synthetic actor-binding fixture reset'
    where student_id = '${student}' and issued_by = '${guardian}'
      and grant_purpose = 'study' and revoked_at is null
  `)
}

async function mintGuardianGrant(options: {
  digest: string
  capabilities?: string[]
  issuedAt?: string
  expiresAt?: string
}) {
  const {
    digest,
    capabilities = ALL_CAPABILITIES,
    // expires_at > issued_at is a table constraint, so an already-expired grant
    // must be backdated rather than given a past expiry against a present issue.
    issuedAt = 'now()',
    expiresAt = `now() + interval '15 minutes'`,
  } = options
  await database.query(`
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issued_by, issuing_membership_id, issuing_access_id, issuance_reason,
      correlation_id, issued_at, expires_at, grant_purpose, contract_version,
      session_epoch, authorization_revision
    )
    select $1::uuid, student.id, $2::text, $3::text[], $4::uuid, 1,
      student.session_version, 'guardian_activation', 'guardian', $5::uuid,
      $6::uuid, $7::uuid, 'Synthetic actor-binding grant', gen_random_uuid(),
      ${issuedAt}, ${expiresAt}, 'study', 1, gen_random_uuid(),
      student.session_version
    from public.academy_students as student where student.id = $8::uuid
  `, [
    HOUSEHOLD_A, digest, capabilities, CREDENTIAL_A,
    GUARDIAN_A, MEMBERSHIP_A, ACCESS_A, STUDENT_A,
  ])
  return digest
}

/**
 * A Study grant issued by the credential flow rather than by a guardian, so it
 * carries no issued_by at all. `is_student_session_grant_current` applies its
 * membership and access requirements only to guardian_activation grants, so this
 * row is genuinely current — it simply has no durable owner to bind an actor to.
 */
async function mintOwnerlessStudyGrant(digest: string) {
  await database.query(`
    insert into academy_private.student_session_grants (
      household_id, student_id, token_digest, capabilities, credential_id,
      credential_version, session_version, issuance_flow, issued_actor_kind,
      issuance_reason, correlation_id, issued_at, expires_at, grant_purpose,
      contract_version, session_epoch, authorization_revision
    )
    select $1::uuid, student.id, $2::text, $3::text[], $4::uuid, 1,
      student.session_version, 'student_credential', 'trusted_server',
      'Synthetic ownerless Study grant', gen_random_uuid(),
      now(), now() + interval '15 minutes', 'study', 1, gen_random_uuid(),
      student.session_version
    from public.academy_students as student where student.id = $5::uuid
  `, [HOUSEHOLD_A, digest, ALL_CAPABILITIES, CREDENTIAL_A, STUDENT_A])
  return digest
}

async function regprocedureExists(signature: string) {
  const result = await database.query<{ present: boolean }>(
    `select to_regprocedure($1) is not null as present`,
    [signature],
  )
  return result.rows[0].present
}

async function hasExecute(role: string, signature: string) {
  const result = await database.query<{ allowed: boolean }>(
    `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
    [role, signature],
  )
  return result.rows[0].allowed
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const source of await sources) if (source) await database.exec(source)
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in ('${ACCESS_A}', '00000000-0000-0000-0000-0000000001b1');
    insert into public.academy_household_memberships (
      id, household_id, user_id, member_role, status, activated_at
    ) values (
      '${MEMBERSHIP_A_IN_B}', '${HOUSEHOLD_B}', '${GUARDIAN_A}',
      'guardian', 'active', now()
    );
    insert into public.academy_guardian_student_access (
      id, household_id, student_id, membership_id, permission_level,
      status, granted_by
    ) values (
      '${ACCESS_A_TO_B}', '${HOUSEHOLD_B}', '${STUDENT_B}',
      '${MEMBERSHIP_A_IN_B}', 'identity_manager', 'active', '${GUARDIAN_B}'
    );
  `)
}, 180_000)

afterAll(async () => {
  await database?.close()
})

describe.sequential('actor-bound Study session verification', () => {
  describe('migration surface', () => {
    it('creates the three-argument overload', async () => {
      expect(await regprocedureExists(THREE_ARG)).toBe(true)
    })

    it('leaves the two-argument overload in place alongside it', async () => {
      expect(await regprocedureExists(TWO_ARG)).toBe(true)
    })

    it('records the actor_binding_version marker transition and appends its name', async () => {
      const result = await database.query<{
        actor_binding_version: number
        migration_names: string[]
        manifest: Record<string, unknown>
      }>(`
        select actor_binding_version, migration_names, security_manifest as manifest
        from academy_private.study_persistence_metadata where singleton
      `)
      expect(result.rows[0].actor_binding_version).toBe(1)
      expect(result.rows[0].migration_names)
        .toContain('20260808120000_academy_study_actor_bound_session_verification')
      expect(result.rows[0].manifest).toMatchObject({
        actor_binding_version: 1,
        session_verification_actor_bound: true,
      })
    })

    it('constrains the marker to 0 or 1', async () => {
      await expect(reverted(() => database.exec(`
        update academy_private.study_persistence_metadata
        set actor_binding_version = 2 where singleton
      `))).rejects.toThrow()
    })
  })

  describe('actor binding', () => {
    it('verifies the right actor with a valid grant and an allowed capability', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyActor(digest, GUARDIAN_A)).resolves.toMatchObject({
        schemaVersion: 1,
        status: 'verified',
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        grantId: await grantIdFor(digest),
        contractVersion: 1,
        issuerVersion: 'academy-student-session-issuer.v1',
      })
    })

    it('preserves the verified envelope shape of the two-argument overload', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      const legacy = await verifyLegacy(digest)
      const bound = await verifyActor(digest, GUARDIAN_A)
      expect(Object.keys(bound).sort()).toEqual(Object.keys(legacy).sort())
      expect(bound).toEqual(legacy)
    })

    it('denies a wrong actor holding a genuinely valid token', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyActor(digest, GUARDIAN_B)).resolves.toEqual(DENIED)
      await expect(verifyActor(digest, VIEWER_A)).resolves.toEqual(DENIED)
    })

    it('denies a null actor', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyActor(digest, null)).resolves.toEqual(DENIED)
    })

    /**
     * A Study grant with no durable owner can never be actor-verified.
     *
     * This is what the explicit `p_actor_user_id is null` guard buys. Against the
     * current body the guard is redundant — `issued_by = NULL` is NULL under
     * three-valued logic, so the lookup cannot match a null actor even without
     * it, and removing the guard alone is an equivalent mutation. It stops being
     * redundant the moment the comparison is weakened to a null-tolerant form
     * such as `is not distinct from`, which would otherwise let a null actor
     * match this exact row. Pinned so that pairing is enforced rather than
     * remembered.
     */
    it('never verifies an ownerless Study grant, with or without an actor', async () => {
      await reverted(async () => {
        const ownerless = await mintOwnerlessStudyGrant('4'.repeat(64))
        await expect(verifyActor(ownerless, null)).resolves.toEqual(DENIED)
        await expect(verifyActor(ownerless, GUARDIAN_A)).resolves.toEqual(DENIED)
        // The row really is live: the unbound overload verifies it. The denials
        // above are the actor binding, not an inert fixture.
        await expect(verifyLegacy(ownerless))
          .resolves.toMatchObject({ status: 'verified', studentId: STUDENT_A })
      })
    })

    it('denies an actor from another household identically', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      const otherHousehold = await verifyActor(digest, GUARDIAN_B)
      const sameHouseholdWrongActor = await verifyActor(digest, VIEWER_A)
      const unrelated = await verifyActor(digest, UNRELATED_A)
      expect(otherHousehold).toEqual(DENIED)
      expect(otherHousehold).toEqual(sameHouseholdWrongActor)
      expect(otherHousehold).toEqual(unrelated)
    })

    it('binds each learner separately under one actor', async () => {
      const learnerA = await tokenFor(GUARDIAN_A, STUDENT_A)
      const learnerB = await tokenFor(GUARDIAN_A, STUDENT_B)
      await expect(verifyActor(learnerA.digest, GUARDIAN_A))
        .resolves.toMatchObject({ status: 'verified', studentId: STUDENT_A })
      await expect(verifyActor(learnerB.digest, GUARDIAN_A))
        .resolves.toMatchObject({ status: 'verified', studentId: STUDENT_B })

      // Wrong learner: the actor's relationship to one learner is withdrawn.
      // The other learner's session under the same actor is unaffected.
      await reverted(async () => {
        await database.exec(`
          update public.academy_guardian_student_access
          set status = 'revoked', revoked_at = now(),
            revocation_reason = 'Synthetic actor-binding learner revocation'
          where id = '${ACCESS_A_TO_B}'
        `)
        await expect(verifyActor(learnerB.digest, GUARDIAN_A)).resolves.toEqual(DENIED)
        await expect(verifyActor(learnerA.digest, GUARDIAN_A))
          .resolves.toMatchObject({ status: 'verified', studentId: STUDENT_A })
      })
    })

    it('denies a cross-user replay of a valid reference', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      // Actor A's own call verifies, so the reference is genuinely live at the
      // moment actor B replays it.
      await expect(verifyActor(digest, GUARDIAN_A))
        .resolves.toMatchObject({ status: 'verified' })
      await expect(verifyActor(digest, GUARDIAN_B)).resolves.toEqual(DENIED)
      await expect(verifyActor(digest, GUARDIAN_A))
        .resolves.toMatchObject({ status: 'verified' })
    })
  })

  describe('preserved identity predicate', () => {
    it('denies an expired grant', async () => {
      await reverted(async () => {
        await clearLiveGrants(STUDENT_A, GUARDIAN_A)
        const live = await mintGuardianGrant({ digest: '1'.repeat(64) })
        // Positive control minted the same way: the denial below is expiry, not
        // a defective synthetic row.
        await expect(verifyActor(live, GUARDIAN_A))
          .resolves.toMatchObject({ status: 'verified', studentId: STUDENT_A })
      })
      await reverted(async () => {
        await clearLiveGrants(STUDENT_A, GUARDIAN_A)
        const expired = await mintGuardianGrant({
          digest: '2'.repeat(64),
          issuedAt: `now() - interval '20 minutes'`,
          expiresAt: `now() - interval '5 minutes'`,
        })
        await expect(verifyActor(expired, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })

    it('denies a revoked grant', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await reverted(async () => {
        await database.exec(`
          update academy_private.student_session_grants
          set revoked_at = now(), revoked_actor_kind = 'trusted_server',
            revocation_reason = 'synthetic actor-binding revocation'
          where token_digest = '${digest}'
        `)
        await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })

    it('denies a capability the grant does not carry', async () => {
      await reverted(async () => {
        await clearLiveGrants(STUDENT_A, GUARDIAN_A)
        const narrow = await mintGuardianGrant({
          digest: '3'.repeat(64),
          capabilities: [CAPABILITY],
        })
        // Same grant, same actor: only the requested capability differs.
        await expect(verifyActor(narrow, GUARDIAN_A, CAPABILITY))
          .resolves.toMatchObject({ status: 'verified' })
        await expect(verifyActor(narrow, GUARDIAN_A, OTHER_CAPABILITY))
          .resolves.toEqual(DENIED)
      })
    })

    it('denies a capability outside the allowlist at the guard', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyActor(digest, GUARDIAN_A, OUTSIDE_ALLOWLIST))
        .resolves.toEqual(DENIED)
    })

    it('denies a forged digest of the right shape', async () => {
      await expect(verifyActor('f'.repeat(64), GUARDIAN_A)).resolves.toEqual(DENIED)
    })

    it.each([
      ['too short', 'abc'],
      ['uppercase hex', 'F'.repeat(64)],
      ['non-hex', 'z'.repeat(64)],
      ['over-long', 'a'.repeat(65)],
      ['empty', ''],
      ['null', null],
    ])('denies a malformed digest (%s)', async (_label, digest) => {
      await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
    })

    it('denies after a student session-version bump', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await reverted(async () => {
        await database.exec(`
          update public.academy_students
          set session_version = session_version + 1 where id = '${STUDENT_A}'
        `)
        await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })

    it('denies a revoked membership', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await reverted(async () => {
        await database.exec(`
          update public.academy_household_memberships
          set status = 'revoked', revoked_at = now(),
            revocation_reason = 'Synthetic actor-binding membership revocation'
          where id = '${MEMBERSHIP_A}'
        `)
        await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })

    it('denies when the membership no longer belongs to the issuing actor', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await reverted(async () => {
        // GUARDIAN_B holds no membership in household A, so this reassignment
        // does not collide with the (household_id, user_id) uniqueness that
        // UNRELATED_A's own membership would have tripped.
        await database.exec(`
          update public.academy_household_memberships
          set user_id = '${GUARDIAN_B}' where id = '${MEMBERSHIP_A}'
        `)
        await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })

    it.each([
      ['access revoked', `status = 'revoked', revoked_at = now(),
        revocation_reason = 'Synthetic actor-binding access revocation'`],
      ['permission below identity_manager', `permission_level = 'learning_manager'`],
      ['permission is viewer', `permission_level = 'viewer'`],
    ])('denies when %s', async (_label, mutation) => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await reverted(async () => {
        await database.exec(`
          update public.academy_guardian_student_access
          set ${mutation} where id = '${ACCESS_A}'
        `)
        await expect(verifyActor(digest, GUARDIAN_A)).resolves.toEqual(DENIED)
      })
    })
  })

  describe('denial opacity', () => {
    it('returns one indistinguishable body for every failing predicate', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      const outcomes = [
        await verifyActor(digest, GUARDIAN_B),
        await verifyActor(digest, null),
        await verifyActor('f'.repeat(64), GUARDIAN_A),
        await verifyActor('nope', GUARDIAN_A),
        await verifyActor(digest, GUARDIAN_A, OUTSIDE_ALLOWLIST),
      ]
      for (const outcome of outcomes) expect(outcome).toEqual(DENIED)
      expect(new Set(outcomes.map((value) => JSON.stringify(value))).size).toBe(1)
    })
  })

  describe('two-argument overload is unchanged', () => {
    it('still verifies without any actor argument', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyLegacy(digest)).resolves.toMatchObject({
        schemaVersion: 1,
        status: 'verified',
        householdId: HOUSEHOLD_A,
        studentId: STUDENT_A,
        grantId: await grantIdFor(digest),
      })
    })

    it('still denies a forged reference and an out-of-allowlist capability', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(verifyLegacy('f'.repeat(64))).resolves.toEqual(DENIED)
      await expect(verifyLegacy(digest, OUTSIDE_ALLOWLIST)).resolves.toEqual(DENIED)
    })

    it('is not actor-bound — that is exactly why the overload was added', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      // The same reference actor B cannot use through the bound overload still
      // verifies here. The two-argument function has no actor to bind.
      await expect(verifyLegacy(digest)).resolves.toMatchObject({ status: 'verified' })
      await expect(verifyActor(digest, GUARDIAN_B)).resolves.toEqual(DENIED)
    })
  })

  describe('security boundary', () => {
    it('grants execute on the three-argument overload to service_role only', async () => {
      expect(await hasExecute('service_role', THREE_ARG)).toBe(true)
      expect(await hasExecute('authenticated', THREE_ARG)).toBe(false)
      expect(await hasExecute('anon', THREE_ARG)).toBe(false)
      expect(await hasExecute('public', THREE_ARG)).toBe(false)
    })

    it('leaves the two-argument ACL exactly as the identity migration set it', async () => {
      expect(await hasExecute('service_role', TWO_ARG)).toBe(true)
      expect(await hasExecute('authenticated', TWO_ARG)).toBe(false)
      expect(await hasExecute('anon', TWO_ARG)).toBe(false)
      expect(await hasExecute('public', TWO_ARG)).toBe(false)
    })

    it('is owned by postgres, stable, and security definer with a pinned search_path', async () => {
      const result = await database.query<{
        owner: string
        volatility: string
        security_definer: boolean
        config: string[] | null
      }>(`
        select pg_get_userbyid(proowner) as owner, provolatile as volatility,
          prosecdef as security_definer, proconfig as config
        from pg_proc where oid = to_regprocedure($1)
      `, [THREE_ARG])
      expect(result.rows[0]).toMatchObject({
        owner: 'postgres',
        volatility: 's',
        security_definer: true,
      })
      expect(result.rows[0].config).toContain('search_path=pg_catalog')
    })

    it('raises 42501 for a non-trusted-server caller', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      // service_role privileges, but an end-user JWT subject is present. The
      // gateway actor is data; it must never become the SQL caller identity.
      await expect(asRole('service_role', GUARDIAN_A, () => rpc(
        'select public.academy_study_verify_session_v1($1::text, $2::text, $3::uuid) as result',
        [digest, CAPABILITY, GUARDIAN_A],
      ))).rejects.toThrow(/STUDY_TRUSTED_SERVER_REQUIRED/)
      await database.exec('rollback')
    })

    it('refuses execution to a learner-facing role', async () => {
      const { digest } = await tokenFor(GUARDIAN_A, STUDENT_A)
      await expect(asRole('authenticated', GUARDIAN_A, () => rpc(
        'select public.academy_study_verify_session_v1($1::text, $2::text, $3::uuid) as result',
        [digest, CAPABILITY, GUARDIAN_A],
      ))).rejects.toThrow(/permission denied|STUDY_TRUSTED_SERVER_REQUIRED/)
      await database.exec('rollback')
    })
  })

  /**
   * The predecessor and collision guards, exercised as behavior rather than as
   * source text. Each builds the chain up to C2, perturbs exactly one thing, and
   * then offers the migration — so a guard that has been deleted shows up as a
   * migration that cheerfully applies, not as a diff nobody read.
   */
  describe('predecessor and collision guards', () => {
    it('refuses a second application', async () => {
      const database2 = await chainWithoutActorMigration()
      try {
        await database2.exec(await actorMigrationSource())
        await expect(database2.exec(await actorMigrationSource()))
          .rejects.toThrow(/already applied/)
      } finally {
        await database2.close()
      }
    })

    it('refuses when the three-argument signature already exists', async () => {
      const database2 = await chainWithoutActorMigration()
      try {
        await database2.exec(`
          create function public.academy_study_verify_session_v1(
            p_token_digest text, p_required_capability text, p_actor_user_id uuid
          ) returns jsonb language sql stable as $decoy$
            select '{}'::jsonb
          $decoy$;
        `)
        await expect(database2.exec(await actorMigrationSource()))
          .rejects.toThrow(/object collision/)
      } finally {
        await database2.close()
      }
    })

    it('refuses when the metadata singleton is absent', async () => {
      const database2 = await chainWithoutActorMigration()
      try {
        await database2.exec(
          'delete from academy_private.study_persistence_metadata',
        )
        await expect(database2.exec(await actorMigrationSource()))
          .rejects.toThrow(/predecessor marker mismatch/)
      } finally {
        await database2.close()
      }
    })

    it.each([
      ['the C2 marker version is unset', `
        update academy_private.study_persistence_metadata
        set c2_operations_contract_version = 0 where singleton
      `],
      ['the reconciled C2 manifest fact is absent', `
        update academy_private.study_persistence_metadata
        set security_manifest = security_manifest - 'c2_operations_contract_version'
        where singleton
      `],
      ['a required predecessor name is missing', `
        update academy_private.study_persistence_metadata
        set migration_names = array_remove(
          migration_names, '20260806140000_academy_study_c2_operations_contract'
        ) where singleton
      `],
    ])('refuses when %s', async (_label, perturbation) => {
      const database2 = await chainWithoutActorMigration()
      try {
        await database2.exec(perturbation)
        await expect(database2.exec(await actorMigrationSource()))
          .rejects.toThrow(/predecessor marker mismatch/)
      } finally {
        await database2.close()
      }
    })

    it('refuses when the two-argument predecessor is missing', async () => {
      const database2 = await chainWithoutActorMigration()
      try {
        await database2.exec(
          'drop function public.academy_study_verify_session_v1(text, text)',
        )
        await expect(database2.exec(await actorMigrationSource()))
          .rejects.toThrow(/expected two-argument predecessor missing/)
      } finally {
        await database2.close()
      }
    })
  })

  describe('verified identity readiness', () => {
    it('remains ready with the two-argument privilege intact', async () => {
      await expect(asRole('service_role', null, () => rpc<Record<string, unknown>>(
        'select public.academy_study_verified_identity_readiness_v1() as result',
      ))).resolves.toMatchObject({
        status: 'ready',
        schemaVersion: 1,
        issuerVersion: 'academy-student-session-issuer.v1',
      })
    })

    it('is still driven by the two-argument grant, not the new overload', async () => {
      await reverted(async () => {
        await database.exec(`
          revoke execute on function ${TWO_ARG} from service_role
        `)
        await expect(asRole('service_role', null, () => rpc<Record<string, unknown>>(
          'select public.academy_study_verified_identity_readiness_v1() as result',
        ))).resolves.toMatchObject({ status: 'not-ready' })
      })
    })
  })
})
