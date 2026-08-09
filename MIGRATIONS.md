# Schema migrations

Every schema version bump is documented here. Rules (from the build spec):

- Existing data is sacred — migrations convert forward, never wipe.
- Before any migration runs on real data, the raw pre-migration payload is
  snapshotted to a timestamped localStorage key (`homeschool-hq:backup:v1:<ts>`).
  Snapshots are downloadable from the Grown-Ups panel.
- Migration logic lives in `src/migration.ts` and is covered by
  `src/migration.test.ts`. Tests run before the migration ever executes in the
  app: `npm test`.

## Supabase: Academy Admin authorization foundation (2026-08-08)

Tracked migration:
`supabase/migrations/20260808120000_academy_admin_authorization.sql`.

The migration adds a role-assignment history table backed by existing Supabase
Auth user IDs. Its fixed role vocabulary is `owner`, `admin`, and `viewer`; a
partial unique index permits at most one active assignment per user. Optional
immutable expiry is checked on every lookup. RLS is enabled and forced with no
client policy, and no application role has direct table privileges.

The only readable database boundary is the stable, security-definer
`academy_admin_authorization_v2()` function with `search_path=pg_catalog`. It
accepts no identity or role argument, derives `auth.uid()`, excludes revoked and
expired assignments, and grants execution only to `authenticated`. Assignment
history cannot be deleted or edited; only the one-way, audit-shaped revocation
transition is permitted. Role mutation remains deferred to a separately
reviewed owner-authorized function that must append the canonical Admin audit
event atomically.

The corresponding Netlify helper verifies and pins the Supabase bearer, invokes
the narrow function, derives the ADMIN-0-R1 version-2 canonical capabilities,
and fails closed on missing, revoked, expired, malformed, duplicate, timed-out,
or failed lookups. The browser receives only contract version, safe state, role,
and capabilities. Validate locally with `npm run test:admin-auth`. This migration
has not been applied to a hosted Supabase project.

## Supabase: Academy profiles base (2026-07-24)

Deployment source of truth:
`supabase/migrations/20260724074106_academy_profiles_base.sql`.

The timestamp is the UTC creation time of the original reviewed M6
`supabase/schema.sql` contract. It sorts before both the student-identity
foundation (`20260724230000`) and household CAS (`20260726120000`) migrations.

The migration creates only `public.profiles`:

- `household_id uuid not null default auth.uid()`, referencing
  `auth.users(id)` with `ON DELETE CASCADE`;
- `profile_id text not null`;
- `data jsonb not null`;
- `updated_at timestamptz not null default now()`;
- primary key and only index: `(household_id, profile_id)`;
- owner `postgres`, RLS enabled but not forced, and no user triggers;
- four permissive `PUBLIC` policies whose `USING`/`WITH CHECK` expressions are
  exactly `household_id = auth.uid()`;
- no table privileges for `PUBLIC`, `anon`, or `service_role`;
- direct `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for `authenticated` until
  the later CAS migration revokes direct writes.

No extension is created or required by this migration. It requires the normal
Supabase `auth.users`, `auth.uid()`, `anon`, `authenticated`, and `service_role`
foundation and the exact effective schema privileges below:

| Schema | `PUBLIC` | `anon` | `authenticated` | `service_role` | `postgres` |
| --- | --- | --- | --- | --- | --- |
| `public` | `USAGE` | `USAGE` | `USAGE` | `USAGE` | `CREATE`, `USAGE` |
| `auth` | none | `USAGE` | `USAGE` | `USAGE` | `CREATE`, `USAGE` |

PostgreSQL schemas expose only `CREATE` and `USAGE`, so this matrix enumerates
the complete privilege set. Role entries are effective privileges: direct
grants, inherited role membership, ownership/superuser rights, and
`PUBLIC`-inherited grants all count. Missing privileges and extras both abort
before any `public.profiles` DDL. In particular, `anon` and `authenticated`
must not have schema `CREATE`. `PUBLIC`, `anon`, `authenticated`, and
`service_role` also receive no schema grant options; grantable authority reached
through an inherited role is rejected. `postgres` retains its normal
owner/superuser authority. The migration validates but never repairs, grants,
or revokes platform schema ACLs. Unrelated platform-owner ACL entries remain
outside this application-role matrix and are not modified.

`anon`, `authenticated`, and `service_role` must also retain `EXECUTE` on the
approved `auth.uid()` helper.

An absent table is created. An exact existing definition is verified without
DDL so rows, timestamps, relation identity, policy/index/constraint cardinality,
and unrelated ACLs remain stable. Any incompatible table kind, owner, column,
default, PK/FK, delete action, index, RLS state, policy, ACL, or user trigger
aborts the transaction instead of being silently repaired.

`supabase/schema.sql` remains only a legacy/local reference snapshot for
downstream test setup. It must stay semantically identical to the migration.
Deployment instructions must point to the timestamped migration.

Permanent local validation:

```text
npm run test:academy-profiles-base
```

The permanent suite accepts each target role with no direct `public`-schema
`USAGE` because the required `PUBLIC` grant supplies it effectively. It also
covers inherited helper-role `USAGE` for every `anon`/`authenticated`/
`service_role` and `public`/`auth` pairing without ACL normalization. Missing
`auth`-schema `USAGE` is rejected independently for all three target roles.
Policy validation includes an otherwise exact policy changed from permissive to
restrictive. The combined-chain gate checks authenticated `SELECT`, `INSERT`,
`UPDATE`, and `DELETE` as four independent privileges before later CAS
revocation.

The complete intended fresh-project chain is:

1. `20260724074106_academy_profiles_base.sql`
2. `20260724230000_academy_student_identity_foundation.sql`
3. `20260726120000_academy_household_revision_cas.sql`
4. `20260731120000_academy_gateway_usage.sql`

This integration branch contains the exact independently reviewed migrations
from commits `c84f377d4b73bb1876479bb21a043bf1b21ec328`,
`6138112bda3e395b02ae8d67a1da756f73cd28ed`, and
`e5131729f7866553f6bedfd2ca0ec84f0b343126`. Permanent tests verify the three
approved blob identities and apply the complete chain in timestamp order. A
missing or stale reviewed blob fails instead of silently substituting another
migration.

An isolated Supabase CLI 2.109.1 rollback probe proved that `migration up
--db-url` executes one migration file atomically: a forced late failure removed
all earlier objects and the failing ledger entry. The same probe appended a
forced failure after the exact safe-sync migration and confirmed that no CAS
table or function remained, while the earlier committed base migration and
ledger record stayed intact. No repository `supabase/config.toml` was required
for this explicit local `--db-url` path.

## Supabase: Academy household revision CAS (2026-07-26)

Tracked migration:
`supabase/migrations/20260726120000_academy_household_revision_cas.sql`.
It remains unreleased and unapplied to any hosted project, so the Session 2C-R2
contract and receipt corrections are folded into this single final migration
definition rather than leaving a knowingly vulnerable intermediate migration.

- Adds one server-managed monotonic revision row per authenticated household.
- Adds per-household terminal mutation receipts for both applied and conflict
  results. An identical retry returns the original result without applying
  profiles or incrementing twice. Reusing an ID with a different expected
  revision or JSONB payload is rejected, and conflict resolution uses a new ID.
- Replaces authenticated direct profile writes with a `SECURITY DEFINER` RPC
  that derives household identity from `auth.uid()`, locks the revision row,
  validates the expected revision, transactionally upserts only the supplied
  profile rows, and advances the revision only on success. Omitted existing
  profiles are retained; this migration adds no deletion mechanism.
- Uses a fixed `pg_catalog, pg_temp` search path, schema-qualified application
  objects, `postgres` ownership, no anonymous/PUBLIC execute grant, and the
  narrow authenticated execute grant.
- A stale expected revision returns a typed conflict, writes no profiles, and
  durably records that first result under the household-scoped mutation ID.
- The server validates required Academy profile fields, supported optional
  containers, strict timestamps, JavaScript-finite numbers, recursive reserved
  keys, fixed profile IDs, and bounded JSON structure before a receipt, profile
  write, or revision advance. Shared fixture data is checked by both the
  TypeScript and PostgreSQL validators.
- Existing valid profile rows are preserved and intentionally form a lazy
  revision-zero snapshot. No state row is backfilled. The first successful CAS
  mutation creates/locks the state row and consumes revision zero.

Local PGlite/PostgreSQL-protocol probes cover first run, rerun, shared contract
fixtures, existing-data preservation, lazy revision zero, partial-upsert
semantics, rollback, identity isolation, anonymous/missing auth, grants, and
immutable applied/conflict receipts. PGlite's socket multiplexer is not treated
as independent-backend evidence. The dedicated
`npm run test:academy-cas-postgres` gate starts a development-only embedded
PostgreSQL server, asserts different `pg_backend_pid()` values, and proves
deterministic state-row contention for empty and nonzero revisions plus
concurrent identical retries. The exact Manuel Academy Supabase project is not
yet verified, so the migration has not been applied to any hosted project.
Hosted migration, role/JWT/PostgREST checks, and hosted two-client contention
remain release gates; do not guess a project or paste the SQL manually.

## Supabase: Academy gateway usage ledger (2026-07-31)

Tracked migration:
`supabase/migrations/20260731120000_academy_gateway_usage.sql`.

The migration adds the server-only daily request ledger used by the Academy AI
and TTS gateways:

- `academy_gateway_usage` is keyed by authenticated user, UTC database day,
  and the fixed `anthropic`/`tts` endpoint set; an omitted RPC day is derived
  explicitly from UTC and cannot follow the session timezone;
- RLS is enabled and forced, with all table and function access revoked from
  `PUBLIC`, `anon`, and `authenticated`;
- `service_role` alone receives the table privileges and RPC execution needed
  by the serverless gateways;
- `academy_consume_gateway_usage` is a `SECURITY DEFINER` function with a fixed
  `pg_catalog` search path and one atomic `INSERT ... ON CONFLICT DO UPDATE`;
- the request that reaches the configured cap succeeds, while later requests
  return `false` without incrementing the stored count.

Permanent local validation is in
`supabase/academy-gateway-usage.db.test.ts`. It covers omitted-day UTC pinning
under a deliberately non-UTC session timezone, at-cap acceptance, over-cap
rejection without mutation, UTC day rollover, and denial of direct client-role
table and RPC access.

## Supabase: Academy provider usage cost ledger (2026-08-08)

Tracked migration:
`supabase/migrations/20260808120000_academy_provider_usage_cost_ledger.sql`.

The migration adds immutable, non-overlapping, effective-dated USD pricing
catalogs and rates; a privacy-safe AI/TTS usage ledger; immutable component
rate snapshots; the service-role-only `academy_record_provider_usage` RPC; and
a service-role-only ADMIN-0 v2 projection. Identical execution facts replay;
conflicting facts raise `reconciliation_conflict`. Money is transported as
exact decimal strings, and browser roles receive no table or RPC access. The
migration seeds no production price. Cache read/write separation, identity and
household attribution, cost kinds, exact arithmetic, interval boundaries,
version snapshots, replay/conflict behavior, privacy, and access denial are validated in
`supabase/academy-provider-usage-cost-ledger.db.test.ts`. Operational behavior
and required production pricing configuration are documented in
`docs/academy-ai-cost-accounting.md`.

## v1 → v2 (M1 multi-profile, 2026-07-23)

**Before:** single profile under key `homeschool-hq:profile:v1`
(`{ version: 1, name, createdAt, placementDone, skillStats, totals, lastPracticeDate }`).

**After:** `AppState` under key `homeschool-hq:app:v2`:

- `schemaVersion: 2`, `profiles: Record<id, Profile>`, `activeProfileId`, `parentPin`.
- Five profiles seeded: `p1` (grade 3) … `p5` (grade 12); themes keyed to grade
  (3–4 playful, 6 cool, 10/12 clean).
- The v1 profile becomes `profiles.p1` **unchanged**: every skill's
  `attempts/correct/mastery` copied verbatim (`skillStats` → `skills`, with
  additive `lastSeen`), plus `name`, `createdAt`, `placementDone`, `totals`,
  `lastPracticeDate`. `streaks.best` seeds from `totals.bestStreak`.
- PINs start unset (`''`); each kid chooses hers at first sign-in. Parent PIN
  set on first Grown-Ups open.
- The old `homeschool-hq:profile:v1` key is **left in place** (extra safety) in
  addition to the timestamped snapshot.

Old v1 single-profile export files can still be imported: they restore into
`p1` only, leaving the other four profiles intact.

## v2 additive: M2 Morning Mission (2026-07-23, no version bump)

Non-breaking additions — existing v2 data loads unchanged:

- `Profile.template?: MissionTemplate` (`{ weekday, friday }` item lists).
  `undefined` means "use the grade default" from `src/missions.ts`.
- `Profile.missions` now populated: one `MissionDay` per local calendar date,
  generated from the template on first view of the day (Friday uses the
  light-day variant). History is never rewritten by template edits.
- `Profile.streaks` semantics change: the day streak now increments when a
  mission day is fully completed (once per day), not on practice completion.
  Practice completion flips `auto` mission items instead.
- `isoToday()` switched from UTC to local calendar date so mission days roll
  over at the family's midnight.

## v2 additive: MS Star economy (2026-07-23, no version bump)

Non-breaking additions — existing v2 data loads unchanged (`isAppState` is lenient;
old states have no `stars` keys and fall back to runtime defaults):

- `Profile.stars?: StarState` — the kid's wallet: `{ balance, lifetimeEarned,
  ledger, pendingRedemptions }`. `undefined` until her first star is earned.
  The ledger is APPEND-ONLY; `balance` must always equal the ledger sum. A
  mismatch is surfaced in the Grown-Ups panel and NEVER silently repaired.
- `Profile.coolStars?: boolean` — grade-6 "cool" opt-in (default off/undefined).
  Playful profiles always have stars; teens never do.
- `AppState.stars?: StarsConfig` — the shared `{ prizes, rates }` (prize list +
  Dad-editable earning table). `undefined` = defaults from `src/stars/stars.ts`.

No `schemaVersion` bump (follows the M2/M4/MT-1 additive-optional precedent).
Stars are earned only from practice-session and mission-completion paths — never
from placement or assessments (those stay consequence-free). Export/import
round-trips `StarState` because it lives inside the profile/app-state payload.

## v2 additive: MR reading fluency (2026-07-24, no version bump)

Non-breaking addition — existing v2 data loads unchanged (`isAppState` is lenient;
old profiles have no `reading` key and fall back to `defaultReadingState()`):

- `Profile.reading?: ReadingState` — per-girl read-aloud fluency log:
  `{ sessions, seenPassageIds, calibrations, lastReadDate? }`. `undefined` until
  her first reading session. `sessions` is APPEND-ONLY; each logs
  `{ date, passageId, mode: estimated|assessed|manual, wcpm, wordsPracticed[],
  durationSec }`. WCPM is an ESTIMATE (browser recognition + alignment) unless
  `mode==='manual'` (Dad-counted). `calibrations` holds Dad's ground-truth checks.

No `schemaVersion` bump (follows the M2/M4/MT-1/MS/SE-A additive-optional
precedent). NO AUDIO IS EVER STORED — only transcript alignment results; the
`src/reading/noaudio.test.ts` source scan asserts reading paths touch no
audio-capture/persistence API. Passage content lives in
`src/curriculum/reading/` (original authored text, no imported/copyrighted
material) and is parsed by `src/reading/passages.ts`. The mission auto-check hook
(read-to-self item) is DEFERRED — `src/missions.ts` is owned by another cycle.

## v2 additive: MJ HS voice assistant (2026-07-24, no version bump)

Non-breaking additions — existing v2 data loads unchanged (`isAppState` is lenient;
old profiles have no `assistant` key and fall back to `defaultAssistantState()`):

- `Profile.assistant?: AssistantState` — per-teen HS-assistant state:
  `{ calls[], sessions[], dailyCap?, name?, persona? }`. `undefined` until her
  first use. `calls` is the assistant's OWN call log (separate from the tutor's),
  backing a separate daily cap (default 40) + month meter. `sessions` are
  conversation transcripts; both `calls` and `sessions` auto-prune after 60 days.
  Config (`name` default "Jarvis", `persona` tone-only) is Dad-set in Grown-Ups.
- `VoiceSlot` gains `'assistant'` — the MT-V slot the assistant voice resolves
  through (slot → default → legacy → browser). Purely additive to the enum.
- `AssistantMessage.flagged?` marks a turn that tripped the concerning-content
  safeguard (scripted care line, no API call), surfaced to Dad in the transcript.

No `schemaVersion` bump (follows the M2/M4/MT-1/MS/SE-A/MR additive-optional
precedent). SAFETY: the assistant NEVER produces submittable work or assessment
answers (hardcoded system-prompt must-nots), NEVER sees another profile / journal
text / keys / assessment item content (context is single-profile, status-only),
and every data-changing action requires an explicit Confirm tap. Reuses MT-2's
Anthropic key/model path (shared key), so keyless/offline disables the orb only.
Teens (grades 10/12) only; littles' screens show no assistant.

## Supabase additive: Academy student identity Phase 0 (2026-07-24, unused)

Database-only foundation in
`supabase/migrations/20260724230000_academy_student_identity_foundation.sql`.
It adds new `academy_*` identity, guardian-access, subject-enrollment, lifecycle,
audit, private credential-verifier, and private future-session tables. It does
not alter `public.profiles`, import local profiles, or change application
`schemaVersion` 2.

The hardened Phase-0 contract requires active-household authorization,
immutable student household IDs, history-preserving status/revocation
transitions, canonical unpadded-Base64 Argon2id/scrypt verifier envelopes with
decode/re-encode equality so unused-pad-bit aliases are rejected, no auxiliary
credential JSON, lowercase hexadecimal SHA-256 session digests,
the disjoint raw-token format
`aca_stu_v1_<43-unpadded-base64url-characters>`, capability schema version 1,
issuance-time/expiry/revocation checks, session-version invalidation,
event-specific audit builders with sensitive value/reason and four-digit
raw-PIN rejection, explicit object grants, and real-role denial probes. Guardian
removal means relationship
revocation while the referenced Auth identity is retained; direct Auth deletion
is deferred. Current subject enrollments are idempotent per student, school
year, subject, course, and curriculum version; completed/withdrawn/archived
history permits a reviewed reenrollment.

The migration is not run by the application and must not be applied to
production in this phase. It must run as the Supabase migration owner
`postgres`; security-definer owner, `search_path`, body, and execute ACL are
part of the approved catalog definition. Version-2 metadata stores a full
security manifest after successful creation. A rerun verifies that manifest
before replacing any function, policy, or trigger and aborts on any incompatible
table/column/default/constraint/index/RLS/policy/function/trigger/ACL definition.
An unmarked first-run name collision also aborts.

Validate only in an ephemeral/local Supabase-compatible project in this exact
order:

1. Prepare roles/Auth shims and apply `supabase/schema.sql`.
2. Execute and commit the `ACADEMY SENTINEL PREFLIGHT` section of
   `supabase/tests/academy_student_identity_rls_probes.sql`.
3. Run the migration (Run 1).
4. Run the rollback-only `ACADEMY ROLE PROBES` section (Probe Run 1).
5. Run the migration again (Run 2).
6. Prove the sentinel predates Run 2 and that its schema/table/function ACLs and
   owners are unchanged.
7. Run the role probes again (Probe Run 2).
8. Confirm stable complete manifests/object counts, zero probe failures, zero
   residual fixture rows, and expected rejection of every incompatible-object
   fixture.

Explicit transaction boundaries also make the complete probe file safe as one
`psql`, SQL Editor, or multi-statement batch; do not rely on an external harness
silently splitting it.

`supabase/academy-student-identity.db.test.ts` runs the tracked two-pass
migration/probe sequence and incompatible-object fixtures as part of the normal
`npm test` gate; the identity SQL security contract is not a separately
remembered manual test.

Future profile migration requires a durable import ledger with source IDs and
digests, target IDs, batch/status/retry/error metadata, bounded idempotent
transactions, partial-failure recovery, count/digest validation, and explicit
rollback/cutover gates. Legacy and normalized identity records must never be
dual-written. Trusted provisioning is required; no current profile is imported
or uploaded by Phase 0. Full architecture, verifier/session formats, import
runbook, rollout, and rollback are documented in
`docs/academy-student-identity-phase-0.md`.

PGlite validation does not reproduce PostgREST exposed-schema configuration,
hosted role administration, live extension state, or hosted owner/service-role
bypass behavior. A later separately authorized production session must verify
the exact project, migration history, owner/ACL report, exposed schemas, and
object-name conflicts before applying the independently approved SQL and exact
probes. No dual write or application activation is permitted merely because the
database migration succeeds.
