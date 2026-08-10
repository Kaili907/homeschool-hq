# Schema migrations

Every schema version bump is documented here. Rules (from the build spec):

- Existing data is sacred — migrations convert forward, never wipe.
- Before any migration runs on real data, the raw pre-migration payload is
  snapshotted to a timestamped localStorage key (`homeschool-hq:backup:v1:<ts>`).
  Snapshots are downloadable from the Grown-Ups panel.
- Migration logic lives in `src/migration.ts` and is covered by
  `src/migration.test.ts`. Tests run before the migration ever executes in the
  app: `npm test`.

## Supabase: Admin configuration runtime enforcement (2026-08-10)

Tracked migration:
`supabase/migrations/20260810140000_academy_admin_configuration_runtime_enforcement.sql`.

After the durable configuration core and logical TTS profile contract, this
migration advances the eight code-owned registry entries from
`pending_runtime_integration` to `runtime_enforced`. It preserves the immutable
registry trigger, revision history, grants, and trusted-server read boundary;
the read projection reports the effective integration status without exposing
credentials or raw database rows. Canonical LF SHA-256:
`b8833bd7fcaf3cc9a5a0d2744500b98e2a461bf3521aa0099b6890727026a984`.
This migration has not been applied to a hosted Supabase project.

## Supabase: logical TTS voice profile contract (2026-08-09)

Tracked migration:
`supabase/migrations/20260809150000_academy_logical_voice_profile_contract.sql`.

The additive migration reserves the approved timestamp and adds validation only
for tagged `tutor.voiceSelections` values. It accepts bounded logical catalog
references with exact voice versions and separate browser-native voice
selections. Existing `tutor.voiceMap` JSON remains untouched and readable. A
validated check constraint composes this new rule with the existing CAS profile
validator. Canonical LF SHA-256:
`d111cd566a39fb016cade408b5a64adb46d98ec9a8155f1060ac67d62053cd74`.
This migration has not been applied to a hosted Supabase project.

## Supabase: Study Effective Settings V2 (2026-08-10)

Tracked migration:
`supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`.

The additive migration creates typed private Admin-default and safety-policy
singletons plus the authorized `academy_study_effective_settings_v2(uuid,date)`
RPC. The RPC preserves `admin_default < guardian < accommodation < safety`,
keeps Admin `required_break_interval_minutes` separate from guardian
`minimumBreakCount`, returns only `ready`, `manual_review`, or `unavailable`, and
exposes minimized per-field source categories without private content. Both
tables use forced RLS with no application-role table grants; only
`authenticated` can execute the RPC, which derives household access server-side.
V1 remains unchanged. This migration has not been applied to a hosted project.
See `docs/study-effective-settings-v2.md` and
`supabase/study-effective-settings-v2.db.test.ts`.

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

The integrated ADMIN-R1 migration order is:

1. `20260808120000_academy_admin_authorization.sql`
2. `20260808121000_academy_operational_events.sql`
3. `20260808122000_academy_provider_usage_cost_ledger.sql`
4. `20260808123000_academy_admin_safety_operations.sql`
5. `20260809120000_academy_operational_telemetry_foundation.sql`
6. `20260809121000_academy_provider_usage_cost_aggregate.sql`
7. `20260809130000_academy_admin_audit_foundation.sql`
8. `20260809140000_academy_admin_configuration_core.sql`
9. `20260809150000_academy_logical_voice_profile_contract.sql`
10. `20260810120000_academy_provider_pricing_terms.sql`
11. `20260810140000_academy_admin_configuration_runtime_enforcement.sql`
12. `20260810141000_academy_study_provider_cost_accounting.sql`

The manifest is a strict linear chain in filename order. These unique versions
replace the parallel-branch timestamp collision; none has been applied to
hosted Supabase.

## Supabase: operational telemetry foundation (2026-08-09)

Tracked migration:
`supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`.

The additive migration leaves the ADMIN-0 version-2 event vocabulary and the
existing event ledger unchanged. It adds a service-only, authorization-asserting
`academy_aggregate_operational_events_v2` RPC and a range index. Queries are
half-open, limited to 366 days and 4,096 allowlisted groups, and fail instead of
silently truncating. The result contains counts, bounded operational dimensions,
duration summaries, explicit group completeness, and completeness for each
retention class; it contains no event IDs, execution keys, household/learner
identity, raw metadata, or raw rows. Logically expired rows are excluded even if
the bounded purge job has not removed them yet. This migration has not been
applied to a hosted Supabase project.

## Supabase: scalable provider usage cost aggregate (2026-08-09)

Tracked migration:
`supabase/migrations/20260809121000_academy_provider_usage_cost_aggregate.sql`.

The additive migration leaves provider usage rows and ADMIN-3-R2 pricing rules
unchanged. It adds the service-role-only, `costs:read`-asserting
`academy_aggregate_provider_usage_costs_v1` RPC. Queries use half-open ranges,
cover at most 366 days, aggregate every matching ledger row, and return only
fixed daily/engine/provider/logical-tier/cost-kind/billing-disposition groups.
The 384-group ceiling fails explicitly; successful results are never silently
truncated and return no raw ledger rows or identity/provider internals.

All database integer/numeric aggregates cross JSON as decimal strings. Money
remains canonical IntegerMicros and never passes through JavaScript `Number`.
Query coverage is separate from unverified provider-traffic coverage. Retained
TEL-AI accounting-persistence gap evidence is reported separately and never
fabricates usage or cost. This migration seeds no prices and has not been
applied hosted. Architecture is in `docs/admin-costs-contract-v3.md`.

## Admin provider pricing terms foundation (2026-08-10, not applied hosted)

`supabase/migrations/20260810120000_academy_provider_pricing_terms.sql` adds the
private effective-dated pricing-term authority used by new provider ledger rows.
It depends on the exact cost aggregate and ADMIN-15 audit migrations, requires
the legacy catalog/rate tables to be empty, and seeds no provider price.

Terms use the ledger's provider/product/model/logical-tier/usage-unit dimensions,
fixed USD, bigint IntegerMicros, half-open non-overlapping periods, immutable
dimension/rate facts, per-dimension revisions, server-derived Owner authority,
and audited future replacement/end/disable operations. Direct application-role
table access remains denied. Missing terms return `pricing_unconfigured` or
leave billable cost unavailable; old ledger rows are never recomputed.

Anthropic cache-write pricing remains unsupported because current accounting
does not retain a trusted five-minute versus one-hour TTL quantity split. The
migration, Admin API, and database lookup reject that pricing dimension; a
positive cache-write usage row fails closed to unavailable cost.

## Supabase: Study safety provider cost accounting (2026-08-10, not applied hosted)

`supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`
adds the bounded nullable ledger `purpose` dimension and the service-only
`academy_record_provider_usage_v2` RPC. Existing Tutor, Jarvis, and TTS calls
delegate to the unchanged v1 recorder with a null purpose. The only newly
admitted tuple is `engine=study`, `purpose=safety_classification`, and
`provider=anthropic`.

Study billable usage is calculated only by the existing insert-time,
effective-dated provider-pricing trigger. No price is seeded. No matching term
leaves `cost_kind=unavailable` and `cost_micros=null`, including all-zero
billable usage; positive Anthropic
cache-write usage remains unavailable. Immutable component snapshots retain
exact bigint IntegerMicros rates and results, and later terms do not recompute
old rows. The v2 RPC returns the canonical ledger `usageId` so later Provider
Attempt Journal instrumentation can store that linkage without this migration
duplicating journal tables. See `docs/study-provider-cost-accounting.md`.

## Supabase: authorized Admin safety projection (2026-08-08)

Tracked migration:
`supabase/migrations/20260808123000_academy_admin_safety_operations.sql`.

No new safety table or mutation is introduced. The migration adds one bounded,
service-role-only `academy_admin_read_safety_operations_v1` RPC over three
existing durable sources: canonical operational events whose result is exactly
`safety_stop`, minimized Study adult-review proposals, and allowlisted Study
safety-monitoring events. The RPC requires the fixed `safety:read` capability
marker, supports deterministic time/reference pagination and optional verified
household/learner scope, and returns no raw telemetry metadata, monitoring
attributes, conversation, journal, audio, provider body, exception, or private
adult-note content. Provider errors, timeouts, fallbacks, and generic rejections
do not become safety events.

The Netlify endpoint independently resolves current Admin authority before
using service-only database access. Browser roles have no RPC or table access,
and source failure returns only a stable error code. Permanent local validation
is in `supabase/academy-admin-safety-operations.db.test.ts` plus the focused
ADMIN-10B endpoint/reader/UI tests. This migration has not been applied to a
hosted Supabase project.

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
`supabase/migrations/20260808122000_academy_provider_usage_cost_ledger.sql`.

The migration adds immutable, non-overlapping, effective-dated USD pricing
catalogs and rates; a privacy-safe AI/TTS usage ledger; immutable component
rate snapshots; the service-role-only `academy_record_provider_usage` RPC; and
a service-role-only ADMIN-0 v2 projection. Identical execution facts replay;
conflicting facts raise `reconciliation_conflict`. Money is transported as
exact decimal strings, and browser roles receive no table or RPC access. The
migration seeds no production price. Cache read/write separation, identity and
household attribution, optional request-unit components, mixed request/usage
pricing, cost kinds, exact arithmetic, interval boundaries,
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
