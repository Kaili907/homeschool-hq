import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { defaultAppState } from '../src/migration'

const MIGRATIONS = [
  '20260724074106_academy_profiles_base.sql',
  '20260724230000_academy_student_identity_foundation.sql',
  '20260726120000_academy_household_revision_cas.sql',
  '20260809120000_academy_auth_server_foundation.sql',
] as const

const HOUSEHOLD = '10000000-0000-4000-8000-000000000001'
const MANAGER = '00000000-0000-4000-8000-00000000000a'
const MANAGER_B = '00000000-0000-4000-8000-00000000000e'
const ORDINARY_GUARDIAN = '00000000-0000-4000-8000-00000000000b'
const REVOKED_MEMBER = '00000000-0000-4000-8000-00000000000c'
const REVOKED_CAPABILITY = '00000000-0000-4000-8000-00000000000d'
const MEMBERSHIP_MANAGER = '20000000-0000-4000-8000-00000000000a'
const MEMBERSHIP_ORDINARY = '20000000-0000-4000-8000-00000000000b'
const MEMBERSHIP_REVOKED = '20000000-0000-4000-8000-00000000000c'
const MEMBERSHIP_REVOKED_CAPABILITY =
  '20000000-0000-4000-8000-00000000000d'
const MEMBERSHIP_MANAGER_B = '20000000-0000-4000-8000-00000000000e'
const CAPABILITY_CLAIM = '30000000-0000-4000-8000-00000000000a'
const CAPABILITY_RECOVER = '30000000-0000-4000-8000-00000000000b'
const CAPABILITY_RECOVER_B = '30000000-0000-4000-8000-00000000000e'
const STUDENT = '40000000-0000-4000-8000-000000000001'
const INSTALLATION_A = '50000000-0000-4000-8000-000000000001'
const INSTALLATION_B = '50000000-0000-4000-8000-000000000002'
const DATASET_A = '60000000-0000-4000-8000-000000000001'
const DATASET_B = '60000000-0000-4000-8000-000000000002'
const CORRELATION_A = '70000000-0000-4000-8000-000000000001'
const CORRELATION_B = '70000000-0000-4000-8000-000000000002'
const LOCAL_ENROLLMENT = '80000000-0000-4000-8000-000000000001'

function digest(raw: string) {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function profileRow() {
  const profile = structuredClone(defaultAppState().profiles.p1)
  if (!profile) throw new Error('Missing synthetic profile fixture')
  profile.name = 'Synthetic Sync V2 Learner'
  return {
    profile_id: 'p1',
    data: profile,
    updated_at: '2026-08-09T12:00:00Z',
  }
}

describe('Academy auth server foundation migration', () => {
  let database: PGlite

  async function asAuthenticated<T>(
    actorId: string,
    operation: () => Promise<T>,
  ) {
    await database.exec(`
      select set_config('request.jwt.claim.sub', '${actorId}', false);
      set role authenticated;
    `)
    try {
      return await operation()
    } finally {
      await database.exec(`
        reset role;
        select set_config('request.jwt.claim.sub', '', false);
      `)
    }
  }

  async function issueGrant({
    actor = MANAGER,
    installationId = INSTALLATION_A,
    datasetEpoch = DATASET_A,
    purpose = 'first_claim',
    tokenDigest = digest('synthetic-grant-a'),
  } = {}) {
    return asAuthenticated(actor, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(
        `select public.academy_parent_issue_installation_grant_v1(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::text,
          $5::text,
          $6::uuid
        ) as result`,
        [
          HOUSEHOLD,
          installationId,
          datasetEpoch,
          purpose,
          tokenDigest,
          CORRELATION_A,
        ],
      )
      return result.rows[0].result
    })
  }

  async function claim({
    actor = MANAGER,
    installationId = INSTALLATION_A,
    datasetEpoch = DATASET_A,
    purpose = 'first_claim',
    tokenDigest = digest('synthetic-grant-a'),
  } = {}) {
    return asAuthenticated(actor, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(
        `select public.academy_parent_claim_installation_v1(
          $1::uuid,
          $2::uuid,
          $3::text,
          $4::text,
          $5::uuid
        ) as result`,
        [
          installationId,
          datasetEpoch,
          purpose,
          tokenDigest,
          CORRELATION_B,
        ],
      )
      return result.rows[0].result
    })
  }

  async function claimInstallation(
    installationId = INSTALLATION_A,
    datasetEpoch = DATASET_A,
  ) {
    const tokenDigest = digest(`claim:${installationId}:${datasetEpoch}`)
    await issueGrant({ installationId, datasetEpoch, tokenDigest })
    return claim({ installationId, datasetEpoch, tokenDigest })
  }

  async function recover({
    actor = MANAGER,
    tokenDigest,
    localCredentialEnrollmentId = LOCAL_ENROLLMENT,
    correlationId = CORRELATION_B,
  }: {
    actor?: string
    tokenDigest: string
    localCredentialEnrollmentId?: string
    correlationId?: string
  }) {
    return asAuthenticated(actor, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(
        `select public.academy_parent_recover_installation_v1(
          $1::uuid, $2::uuid, $3::text, $4::uuid, $5::uuid
        ) as result`,
        [
          INSTALLATION_A,
          DATASET_A,
          tokenDigest,
          localCredentialEnrollmentId,
          correlationId,
        ],
      )
      return result.rows[0].result
    })
  }

  async function syncPersistenceState() {
    const result = await database.query<{
      profiles: unknown[]
      revisions: unknown[]
      receipts: unknown[]
    }>(`
      select
        coalesce((
          select jsonb_agg(to_jsonb(profile) order by household_id, profile_id)
          from public.profiles as profile
        ), '[]'::jsonb) as profiles,
        coalesce((
          select jsonb_agg(to_jsonb(state) order by household_id)
          from public.academy_household_sync_state as state
        ), '[]'::jsonb) as revisions,
        coalesce((
          select jsonb_agg(
            to_jsonb(receipt) order by household_id, mutation_id
          )
          from public.academy_household_sync_mutations as receipt
        ), '[]'::jsonb) as receipts
    `)
    return result.rows[0]
  }

  async function recoveryState() {
    const result = await database.query<{
      binding_revision: string
      session_generation: string
      grants: unknown[]
    }>(`
      select
        binding.binding_revision::text as binding_revision,
        binding.session_generation::text as session_generation,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'tokenDigest', grant_row.token_digest,
              'status', grant_row.status,
              'consumedAt', grant_row.consumed_at,
              'revokedAt', grant_row.revoked_at
            ) order by grant_row.token_digest
          )
          from academy_private.parent_installation_grants as grant_row
          where grant_row.installation_id = binding.installation_id
        ), '[]'::jsonb) as grants
      from academy_private.parent_installation_bindings as binding
      where binding.installation_id = $1::uuid
        and binding.status = 'active'
    `, [INSTALLATION_A])
    return result.rows[0]
  }

  beforeAll(async () => {
    database = await PGlite.create()
    await database.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;

      create schema auth authorization postgres;
      create table auth.users (id uuid primary key);
      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(
          current_setting('request.jwt.claim.sub', true),
          ''
        )::uuid
      $$;

      revoke all on schema auth from public;
      grant usage on schema auth to anon, authenticated, service_role;
      revoke all on function auth.uid() from public;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      revoke all on schema public from public, anon, authenticated, service_role;
      grant usage on schema public to public, anon, authenticated, service_role;
    `)

    for (const migration of MIGRATIONS) {
      await database.exec(await readFile(
        new URL(`./migrations/${migration}`, import.meta.url),
        'utf8',
      ))
    }

    await database.exec(`
      insert into auth.users (id) values
        ('${MANAGER}'),
        ('${MANAGER_B}'),
        ('${ORDINARY_GUARDIAN}'),
        ('${REVOKED_MEMBER}'),
        ('${REVOKED_CAPABILITY}');

      insert into public.academy_households (
        id,
        name,
        status,
        created_by
      ) values (
        '${HOUSEHOLD}',
        'Synthetic Parent Installation Household',
        'active',
        '${MANAGER}'
      );

      insert into public.academy_household_memberships (
        id,
        household_id,
        user_id,
        status,
        activated_at,
        revoked_at,
        revocation_reason
      ) values
        (
          '${MEMBERSHIP_MANAGER}', '${HOUSEHOLD}', '${MANAGER}',
          'active', now(), null, null
        ),
        (
          '${MEMBERSHIP_ORDINARY}', '${HOUSEHOLD}', '${ORDINARY_GUARDIAN}',
          'active', now(), null, null
        ),
        (
          '${MEMBERSHIP_MANAGER_B}', '${HOUSEHOLD}', '${MANAGER_B}',
          'active', now(), null, null
        ),
        (
          '${MEMBERSHIP_REVOKED}', '${HOUSEHOLD}', '${REVOKED_MEMBER}',
          'revoked', now(), now(), 'security test revocation'
        ),
        (
          '${MEMBERSHIP_REVOKED_CAPABILITY}', '${HOUSEHOLD}',
          '${REVOKED_CAPABILITY}', 'active', now(), null, null
        );

      insert into public.academy_students (
        id,
        household_id,
        legacy_profile_id,
        display_name,
        current_grade_level,
        lifecycle_status,
        created_by
      ) values (
        '${STUDENT}', '${HOUSEHOLD}', 'p1', 'Synthetic Student',
        '4', 'active', '${MANAGER}'
      );

      insert into public.academy_guardian_student_access (
        household_id,
        student_id,
        membership_id,
        permission_level,
        status,
        granted_by
      ) values (
        '${HOUSEHOLD}', '${STUDENT}', '${MEMBERSHIP_ORDINARY}',
        'identity_manager', 'active', '${MANAGER}'
      );

      insert into academy_private.parent_installation_capabilities (
        id,
        household_id,
        membership_id,
        actor_user_id,
        capability,
        status,
        revoked_at
      ) values
        (
          '${CAPABILITY_CLAIM}', '${HOUSEHOLD}', '${MEMBERSHIP_MANAGER}',
          '${MANAGER}', 'parent_installation:claim', 'active', null
        ),
        (
          '${CAPABILITY_RECOVER}', '${HOUSEHOLD}', '${MEMBERSHIP_MANAGER}',
          '${MANAGER}', 'parent_installation:recover', 'active', null
        ),
        (
          '${CAPABILITY_RECOVER_B}', '${HOUSEHOLD}', '${MEMBERSHIP_MANAGER_B}',
          '${MANAGER_B}', 'parent_installation:recover', 'active', null
        ),
        (
          '30000000-0000-4000-8000-00000000000c', '${HOUSEHOLD}',
          '${MEMBERSHIP_REVOKED}', '${REVOKED_MEMBER}',
          'parent_installation:claim', 'active', null
        ),
        (
          '30000000-0000-4000-8000-00000000000d', '${HOUSEHOLD}',
          '${MEMBERSHIP_REVOKED_CAPABILITY}', '${REVOKED_CAPABILITY}',
          'parent_installation:claim', 'revoked', now()
        );
    `)
  }, 120_000)

  beforeEach(async () => {
    await database.exec(`
      delete from academy_private.parent_installation_grants;
      delete from academy_private.parent_installation_bindings;
      delete from public.academy_household_sync_mutations;
      delete from public.academy_household_sync_state;
      delete from public.profiles;
      update academy_private.parent_installation_capabilities
         set authority_revision = 1,
             updated_at = now()
       where id in (
         '${CAPABILITY_CLAIM}', '${CAPABILITY_RECOVER}',
         '${CAPABILITY_RECOVER_B}'
       );
      update academy_private.academy_sync_protocol_control
         set current_protocol = 2,
             minimum_supported_protocol = 1,
             mode = 'normal',
             credential_policy = 'legacy_compatible',
             legacy_rpc_enabled = true,
             updated_at = now()
       where singleton;
    `)
  })

  afterAll(async () => {
    await database?.close()
  })

  it('requires explicit live installation-manager authority', async () => {
    await expect(issueGrant()).resolves.toMatchObject({
      schemaVersion: 1,
      status: 'issued',
      purpose: 'first_claim',
      capability: 'parent_installation:claim',
      installationId: INSTALLATION_A,
      datasetEpoch: DATASET_A,
    })

    await expect(issueGrant({
      actor: ORDINARY_GUARDIAN,
      tokenDigest: digest('ordinary-guardian'),
    })).rejects.toThrow(/denied/i)
    await expect(issueGrant({
      actor: REVOKED_MEMBER,
      tokenDigest: digest('revoked-membership'),
    })).rejects.toThrow(/denied/i)
    await expect(issueGrant({
      actor: REVOKED_CAPABILITY,
      tokenDigest: digest('revoked-capability'),
    })).rejects.toThrow(/denied/i)

    const ordinaryPermission = await database.query<{ permission_level: string }>(
      `select permission_level
         from public.academy_guardian_student_access
        where membership_id = $1::uuid`,
      [MEMBERSHIP_ORDINARY],
    )
    expect(ordinaryPermission.rows[0].permission_level).toBe('identity_manager')
  })

  it('stores a digest only and enforces expiry without consuming the grant', async () => {
    const rawGrant = `pit_v1_${'A'.repeat(43)}`
    const tokenDigest = digest(rawGrant)
    await issueGrant({ tokenDigest })

    const stored = await database.query<{
      row: Record<string, unknown>
    }>(`
      select to_jsonb(value) as row
      from academy_private.parent_installation_grants as value
      where token_digest = $1
    `, [tokenDigest])
    expect(stored.rows[0].row.token_digest).toBe(tokenDigest)
    expect(JSON.stringify(stored.rows[0].row)).not.toContain(rawGrant)
    expect(Object.keys(stored.rows[0].row)).not.toContain('pin')
    expect(Object.keys(stored.rows[0].row)).not.toContain('token')

    await database.exec(`
      update academy_private.parent_installation_grants
         set issued_at = now() - interval '20 minutes',
             expires_at = now() - interval '10 minutes'
       where token_digest = '${tokenDigest}'
    `)
    await expect(claim({ tokenDigest })).rejects.toThrow(/denied/i)
    const expired = await database.query<{
      status: string
      consumed_at: string | null
    }>(`
      select status, consumed_at
      from academy_private.parent_installation_grants
      where token_digest = $1
    `, [tokenDigest])
    expect(expired.rows[0]).toMatchObject({
      status: 'issued',
      consumed_at: null,
    })
  })

  it('rejects wrong installation, wrong dataset epoch, and replay atomically', async () => {
    const tokenDigest = digest('bound-inputs-and-replay')
    await issueGrant({ tokenDigest })

    await expect(claim({
      tokenDigest,
      installationId: INSTALLATION_B,
    })).rejects.toThrow(/denied/i)
    await expect(claim({
      tokenDigest,
      datasetEpoch: DATASET_B,
    })).rejects.toThrow(/denied/i)

    const beforeClaim = await database.query<{ status: string }>(`
      select status
      from academy_private.parent_installation_grants
      where token_digest = $1
    `, [tokenDigest])
    expect(beforeClaim.rows[0].status).toBe('issued')

    await expect(claim({ tokenDigest })).resolves.toMatchObject({
      status: 'active',
      installationId: INSTALLATION_A,
      datasetEpoch: DATASET_A,
      bindingRevision: '1',
      sessionGeneration: '1',
    })
    await expect(claim({ tokenDigest })).rejects.toThrow(/denied/i)

    const consumed = await database.query<{
      status: string
      consumed: boolean
      binding_count: number
    }>(`
      select
        grant_row.status,
        grant_row.consumed_at is not null as consumed,
        (
          select count(*)::integer
          from academy_private.parent_installation_bindings
          where installation_id = $1::uuid
            and status = 'active'
        ) as binding_count
      from academy_private.parent_installation_grants as grant_row
      where grant_row.token_digest = $2
    `, [INSTALLATION_A, tokenDigest])
    expect(consumed.rows[0]).toEqual({
      status: 'consumed',
      consumed: true,
      binding_count: 1,
    })
  })

  it('invalidates an issued grant when installation authority changes', async () => {
    const tokenDigest = digest('authority-revision-changed')
    await issueGrant({ tokenDigest })
    await database.exec(`
      update academy_private.parent_installation_capabilities
         set authority_revision = authority_revision + 1,
             updated_at = now()
       where id = '${CAPABILITY_CLAIM}'
    `)

    await expect(claim({ tokenDigest })).rejects.toThrow(/denied/i)
    const grant = await database.query<{
      status: string
      consumed_at: string | null
    }>(`
      select status, consumed_at
      from academy_private.parent_installation_grants
      where token_digest = $1
    `, [tokenDigest])
    expect(grant.rows[0]).toEqual({ status: 'issued', consumed_at: null })

    await database.exec(`
      update academy_private.parent_installation_capabilities
         set authority_revision = 1,
             updated_at = now()
       where id = '${CAPABILITY_CLAIM}'
    `)
  })

  it('enforces one active binding for each non-secret installation UUID', async () => {
    await claimInstallation()
    await expect(issueGrant({
      tokenDigest: digest('second-live-claim'),
    })).rejects.toThrow(/denied/i)

    await expect(database.exec(`
      insert into academy_private.parent_installation_bindings (
        installation_id,
        household_id,
        dataset_epoch,
        bound_by
      ) values (
        '${INSTALLATION_A}',
        '${HOUSEHOLD}',
        '${DATASET_B}',
        '${MANAGER}'
      )
    `)).rejects.toThrow()
  })

  it('recovers with a one-time grant and rotates binding/session generations', async () => {
    await claimInstallation()
    const recoveryDigest = digest('recovery-grant')
    await expect(issueGrant({
      purpose: 'recovery',
      tokenDigest: recoveryDigest,
    })).resolves.toMatchObject({
      status: 'issued',
      purpose: 'recovery',
      capability: 'parent_installation:recover',
    })

    const issuedEpoch = await database.query<{
      expected_binding_revision: string
      expected_session_generation: string
    }>(`
      select
        expected_binding_revision::text,
        expected_session_generation::text
      from academy_private.parent_installation_grants
      where token_digest = $1
    `, [recoveryDigest])
    expect(issuedEpoch.rows[0]).toEqual({
      expected_binding_revision: '1',
      expected_session_generation: '1',
    })

    const recovered = await asAuthenticated(MANAGER, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(
        `select public.academy_parent_recover_installation_v1(
          $1::uuid,
          $2::uuid,
          $3::text,
          $4::uuid,
          $5::uuid
        ) as result`,
        [
          INSTALLATION_A,
          DATASET_A,
          recoveryDigest,
          LOCAL_ENROLLMENT,
          CORRELATION_B,
        ],
      )
      return result.rows[0].result
    })
    expect(recovered).toMatchObject({
      status: 'active',
      bindingRevision: '2',
      sessionGeneration: '2',
    })

    const binding = await database.query<{
      enrollment_id: string
      binding_revision: string
      session_generation: string
    }>(`
      select
        last_local_credential_enrollment_id::text as enrollment_id,
        binding_revision::text,
        session_generation::text
      from academy_private.parent_installation_bindings
      where installation_id = $1::uuid
        and status = 'active'
    `, [INSTALLATION_A])
    expect(binding.rows[0]).toEqual({
      enrollment_id: LOCAL_ENROLLMENT,
      binding_revision: '2',
      session_generation: '2',
    })

    await expect(asAuthenticated(MANAGER, () => database.query(
      `select public.academy_parent_recover_installation_v1(
        $1::uuid, $2::uuid, $3::text, $4::uuid, $5::uuid
      )`,
      [
        INSTALLATION_A,
        DATASET_A,
        recoveryDigest,
        LOCAL_ENROLLMENT,
        CORRELATION_B,
      ],
    ))).rejects.toThrow(/denied/i)
  })

  it('rejects a recovery grant after its binding generation becomes stale', async () => {
    await claimInstallation()
    const staleDigest = digest('stale-generation-recovery')
    await issueGrant({ purpose: 'recovery', tokenDigest: staleDigest })

    await database.exec(`
      update academy_private.parent_installation_bindings
         set binding_revision = binding_revision + 1,
             session_generation = session_generation + 1,
             updated_at = now()
       where installation_id = '${INSTALLATION_A}'
         and status = 'active'
    `)
    const before = await recoveryState()

    await expect(recover({ tokenDigest: staleDigest }))
      .rejects.toThrow(/denied/i)
    expect(await recoveryState()).toEqual(before)
    expect(before).toMatchObject({
      binding_revision: '2',
      session_generation: '2',
    })
    expect(before.grants).toHaveLength(2)
    expect(before.grants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tokenDigest: staleDigest,
        status: 'issued',
        consumedAt: null,
        revokedAt: null,
      }),
      expect.objectContaining({ status: 'consumed' }),
    ]))
  })

  it('lets only one manager recover an authorization epoch', async () => {
    await claimInstallation()
    const managerADigest = digest('manager-a-recovery')
    const managerBDigest = digest('manager-b-recovery')
    await issueGrant({ purpose: 'recovery', tokenDigest: managerADigest })
    await issueGrant({
      actor: MANAGER_B,
      purpose: 'recovery',
      tokenDigest: managerBDigest,
    })

    await expect(recover({ tokenDigest: managerADigest })).resolves.toMatchObject({
      bindingRevision: '2',
      sessionGeneration: '2',
    })
    const afterFirstRecovery = await recoveryState()
    expect(afterFirstRecovery.grants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tokenDigest: managerADigest,
        status: 'consumed',
      }),
      expect.objectContaining({
        tokenDigest: managerBDigest,
        status: 'revoked',
      }),
    ]))

    await expect(recover({
      actor: MANAGER_B,
      tokenDigest: managerBDigest,
    })).rejects.toThrow(/denied/i)
    expect(await recoveryState()).toEqual(afterFirstRecovery)
  })

  it('revokes the binding, live grants, and prior session generation', async () => {
    await claimInstallation()
    const recoveryDigest = digest('recovery-revoked-with-binding')
    await issueGrant({ purpose: 'recovery', tokenDigest: recoveryDigest })

    const revoked = await asAuthenticated(MANAGER, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(
        `select public.academy_parent_revoke_installation_v1(
          $1::uuid, $2::uuid, $3::uuid, $4::uuid
        ) as result`,
        [HOUSEHOLD, INSTALLATION_A, DATASET_A, CORRELATION_B],
      )
      return result.rows[0].result
    })
    expect(revoked).toMatchObject({
      status: 'revoked',
      bindingRevision: '2',
      sessionGeneration: '2',
    })

    const state = await database.query<{
      binding_status: string
      grant_status: string
    }>(`
      select
        binding.status as binding_status,
        grant_row.status as grant_status
      from academy_private.parent_installation_bindings as binding
      join academy_private.parent_installation_grants as grant_row
        on grant_row.installation_id = binding.installation_id
       and grant_row.token_digest = $1
      where binding.installation_id = $2::uuid
    `, [recoveryDigest, INSTALLATION_A])
    expect(state.rows[0]).toEqual({
      binding_status: 'revoked',
      grant_status: 'revoked',
    })
  })

  it('accepts protocol v2 while retaining staged legacy credential compatibility', async () => {
    const payload = JSON.stringify([profileRow()])
    const result = await asAuthenticated(MANAGER, async () => {
      return database.query<{ result: Record<string, unknown> }>(
        `select public.academy_apply_profile_mutation_v2(
          2, 0, 'sync-v2-accepted', $1::jsonb
        ) as result`,
        [payload],
      )
    })
    expect(result.rows[0].result).toMatchObject({
      status: 'applied',
      revision: '1',
      syncProtocolVersion: 2,
    })
    expect(profileRow().data.pin).toBeTypeOf('string')

    const snapshot = await asAuthenticated(MANAGER, () => database.query<{
      result: { rows: unknown[]; syncProtocolVersion: number }
    }>('select public.academy_sync_snapshot_v2(2) as result'))
    expect(snapshot.rows[0].result.syncProtocolVersion).toBe(2)
    expect(snapshot.rows[0].result.rows).toHaveLength(1)

    await asAuthenticated(ORDINARY_GUARDIAN, () => database.query(
      `select public.academy_apply_profile_mutation_v2(
        2, 0, 'cross-household-row', $1::jsonb
      )`,
      [JSON.stringify([profileRow()])],
    ))
    const isolated = await asAuthenticated(MANAGER, () => database.query<{
      result: { rows: Array<{ profile_id: string }> }
    }>('select public.academy_sync_snapshot_v2(2) as result'))
    expect(isolated.rows[0].result.rows).toHaveLength(1)
    expect(isolated.rows[0].result.rows[0].profile_id).toBe('p1')
  })

  it('authenticates snapshots before every protocol or maintenance response', async () => {
    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set minimum_supported_protocol = 2,
             mode = 'normal'
       where singleton
    `)
    await expect(database.query(
      'select public.academy_sync_snapshot_v2(1)',
    )).rejects.toThrow(/authenticated household/i)

    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set mode = 'maintenance'
       where singleton
    `)
    await expect(database.query(
      'select public.academy_sync_snapshot_v2(2)',
    )).rejects.toThrow(/authenticated household/i)

    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set mode = 'normal'
       where singleton
    `)
    await expect(database.query(
      'select public.academy_sync_snapshot_v2(2)',
    )).rejects.toThrow(/authenticated household/i)

    const authenticated = await asAuthenticated(MANAGER, () => database.query<{
      result: Record<string, unknown>
    }>('select public.academy_sync_snapshot_v2(1) as result'))
    expect(authenticated.rows[0].result).toMatchObject({
      status: 'update-required',
      syncProtocolVersion: 2,
      minimumSupportedSyncVersion: 2,
    })
  })

  it('authenticates mutations before gate, policy, receipt, CAS, or writes', async () => {
    const cases = [
      {
        control: `minimum_supported_protocol = 1, mode = 'normal',
          credential_policy = 'legacy_compatible', legacy_rpc_enabled = true`,
        protocol: 0,
        mutationId: 'unauthenticated-unsupported',
        payload: null,
      },
      {
        control: `minimum_supported_protocol = 1, mode = 'maintenance',
          credential_policy = 'legacy_compatible', legacy_rpc_enabled = true`,
        protocol: 2,
        mutationId: 'unauthenticated-maintenance',
        payload: null,
      },
      {
        control: `minimum_supported_protocol = 1, mode = 'normal',
          credential_policy = 'reject_legacy_credentials',
          legacy_rpc_enabled = false`,
        protocol: 2,
        mutationId: 'unauthenticated-credential-policy',
        payload: JSON.stringify([profileRow()]),
      },
      {
        control: `minimum_supported_protocol = 1, mode = 'normal',
          credential_policy = 'legacy_compatible', legacy_rpc_enabled = true`,
        protocol: 2,
        mutationId: 'unauthenticated-valid-protocol',
        payload: JSON.stringify([profileRow()]),
      },
    ]

    for (const testCase of cases) {
      await database.exec(`
        update academy_private.academy_sync_protocol_control
           set ${testCase.control}
         where singleton
      `)
      const before = await syncPersistenceState()
      await expect(database.query(
        `select public.academy_apply_profile_mutation_v2(
          $1::integer, 0, $2::text, $3::jsonb
        )`,
        [testCase.protocol, testCase.mutationId, testCase.payload],
      )).rejects.toThrow(/authenticated household/i)
      expect(await syncPersistenceState()).toEqual(before)
    }
  })

  it('rejects unsupported and maintenance writes before any receipt work', async () => {
    const before = await syncPersistenceState()
    const unsupported = await asAuthenticated(MANAGER, () => database.query<{
      result: Record<string, unknown>
    }>(`
      select public.academy_apply_profile_mutation_v2(
        0, 0, 'unsupported-before-receipt', null
      ) as result
    `))
    expect(unsupported.rows[0].result).toMatchObject({
      status: 'update-required',
      syncProtocolVersion: 2,
      minimumSupportedSyncVersion: 1,
    })

    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set minimum_supported_protocol = 2,
             mode = 'maintenance'
       where singleton
    `)
    const maintenance = await asAuthenticated(MANAGER, () => database.query<{
      result: Record<string, unknown>
    }>(`
      select public.academy_apply_profile_mutation_v2(
        2, 0, 'maintenance-before-receipt', null
      ) as result
    `))
    expect(maintenance.rows[0].result).toMatchObject({
      status: 'maintenance',
      minimumSupportedSyncVersion: 2,
    })

    const floor = await asAuthenticated(MANAGER, () => database.query<{
      result: Record<string, unknown>
    }>(`
      select public.academy_apply_profile_mutation_v2(
        1, 0, 'floor-before-receipt', null
      ) as result
    `))
    expect(floor.rows[0].result.status).toBe('update-required')

    const receipts = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_household_sync_mutations
      where mutation_id in (
        'unsupported-before-receipt',
        'maintenance-before-receipt',
        'floor-before-receipt'
      )
    `)
    expect(receipts.rows[0].count).toBe(0)
    expect(await syncPersistenceState()).toEqual(before)
  })

  it('provides a credential rejection seam before receipts without activating it', async () => {
    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set credential_policy = 'reject_legacy_credentials',
             legacy_rpc_enabled = false
       where singleton
    `)
    const before = await syncPersistenceState()
    await expect(asAuthenticated(MANAGER, () => database.query(
      `select public.academy_apply_profile_mutation_v2(
        2, 0, 'credential-before-receipt', $1::jsonb
      )`,
      [JSON.stringify([profileRow()])],
    ))).rejects.toThrow(/credential-bearing/i)

    const receipt = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_household_sync_mutations
      where mutation_id = 'credential-before-receipt'
    `)
    expect(receipt.rows[0].count).toBe(0)
    expect(await syncPersistenceState()).toEqual(before)
  })

  it('leaves the currently deployed legacy sync path intentionally unaffected', async () => {
    await database.exec(`
      update academy_private.academy_sync_protocol_control
         set minimum_supported_protocol = 2,
             mode = 'maintenance'
       where singleton
    `)
    const legacy = await asAuthenticated(MANAGER, () => database.query<{
      result: Record<string, unknown>
    }>(`
      select public.academy_apply_profile_mutation(
        0,
        'legacy-production-unaffected',
        $1::jsonb
      ) as result
    `, [JSON.stringify([profileRow()])]))
    expect(legacy.rows[0].result).toMatchObject({
      status: 'applied',
      revision: '1',
    })
  })

  it('keeps private storage closed and Parent RPCs separated from Study/Admin', async () => {
    const privileges = await database.query<{
      table_name: string
      authenticated_access: boolean
      service_access: boolean
    }>(`
      select
        relation.relname as table_name,
        has_table_privilege(
          'authenticated', relation.oid, 'select,insert,update,delete'
        ) as authenticated_access,
        has_table_privilege(
          'service_role', relation.oid, 'select,insert,update,delete'
        ) as service_access
      from pg_class as relation
      join pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'academy_private'
        and relation.relname in (
          'academy_sync_protocol_control',
          'parent_installation_capabilities',
          'parent_installation_bindings',
          'parent_installation_grants'
        )
      order by relation.relname
    `)
    expect(privileges.rows).toHaveLength(4)
    expect(privileges.rows.every(
      (row) => !row.authenticated_access && !row.service_access,
    )).toBe(true)

    const definitions = await database.query<{
      name: string
      definition: string
      config: string
      security_definer: boolean
      anon_execute: boolean
      authenticated_execute: boolean
    }>(`
      select
        procedure.proname as name,
        pg_get_functiondef(procedure.oid) as definition,
        coalesce(array_to_string(procedure.proconfig, ','), '') as config,
        procedure.prosecdef as security_definer,
        has_function_privilege('anon', procedure.oid, 'execute')
          as anon_execute,
        has_function_privilege('authenticated', procedure.oid, 'execute')
          as authenticated_execute
      from pg_proc as procedure
      join pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and (
          procedure.proname like 'academy_parent_%'
          or procedure.proname in (
            'academy_sync_protocol_status_v1',
            'academy_sync_snapshot_v2',
            'academy_apply_profile_mutation_v2'
          )
        )
      order by procedure.proname
    `)
    expect(definitions.rows).toHaveLength(8)
    const applicationRelations = [
      'academy_sync_protocol_control',
      'parent_installation_capabilities',
      'parent_installation_bindings',
      'parent_installation_grants',
      'academy_household_memberships',
      'academy_households',
      'academy_household_sync_state',
      'academy_household_sync_mutations',
      'profiles',
    ]
    for (const definition of definitions.rows) {
      const sqlWithoutComments = definition.definition.replace(/--.*$/gm, '')
      expect(definition.security_definer).toBe(true)
      expect(definition.config).toContain('search_path=pg_catalog, pg_temp')
      expect(definition.anon_execute).toBe(false)
      expect(definition.authenticated_execute).toBe(true)
      expect(definition.definition).not.toMatch(/academy_study|admin|staff/i)
      for (const relation of applicationRelations) {
        expect(sqlWithoutComments).not.toMatch(new RegExp(
          `\\b(?:from|join|update|insert\\s+into|delete\\s+from)\\s+${relation}\\b`,
          'i',
        ))
      }
    }

    const privateDefinitions = await database.query<{
      name: string
      definition: string
      config: string
      security_definer: boolean
      anon_execute: boolean
      authenticated_execute: boolean
      service_execute: boolean
    }>(`
      select
        procedure.proname as name,
        pg_get_functiondef(procedure.oid) as definition,
        coalesce(array_to_string(procedure.proconfig, ','), '') as config,
        procedure.prosecdef as security_definer,
        has_function_privilege('anon', procedure.oid, 'execute')
          as anon_execute,
        has_function_privilege('authenticated', procedure.oid, 'execute')
          as authenticated_execute,
        has_function_privilege('service_role', procedure.oid, 'execute')
          as service_execute
      from pg_proc as procedure
      join pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'academy_private'
        and procedure.proname in (
          'parent_installation_uuid_is_v4',
          'current_parent_installation_capability',
          'academy_sync_v2_gate',
          'academy_sync_payload_has_legacy_credentials',
          'consume_parent_installation_grant'
        )
      order by procedure.proname
    `)
    expect(privateDefinitions.rows).toHaveLength(5)
    for (const definition of privateDefinitions.rows) {
      const sqlWithoutComments = definition.definition.replace(/--.*$/gm, '')
      expect(definition.security_definer).toBe(true)
      expect(definition.config).toContain('search_path=pg_catalog')
      expect(definition.anon_execute).toBe(false)
      expect(definition.authenticated_execute).toBe(false)
      expect(definition.service_execute).toBe(false)
      for (const relation of applicationRelations) {
        expect(sqlWithoutComments).not.toMatch(new RegExp(
          `\\b(?:from|join|update|insert\\s+into|delete\\s+from)\\s+${relation}\\b`,
          'i',
        ))
      }
    }

    const consumeDefinition = privateDefinitions.rows.find(
      (definition) => definition.name === 'consume_parent_installation_grant',
    )?.definition.toLowerCase() ?? ''
    expect(consumeDefinition.indexOf(
      'from academy_private.parent_installation_bindings',
    )).toBeLessThan(consumeDefinition.indexOf(
      'from academy_private.parent_installation_grants',
    ))
    expect(consumeDefinition).toContain('for update')
    expect(consumeDefinition).toContain('expected_binding_revision')
    expect(consumeDefinition).toContain('expected_session_generation')
  })
})
