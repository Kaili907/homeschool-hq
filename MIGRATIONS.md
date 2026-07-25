# Schema migrations

Every schema version bump is documented here. Rules (from the build spec):

- Existing data is sacred — migrations convert forward, never wipe.
- Before any migration runs on real data, the raw pre-migration payload is
  snapshotted to a timestamped localStorage key (`homeschool-hq:backup:v1:<ts>`).
  Snapshots are downloadable from the Grown-Ups panel.
- Migration logic lives in `src/migration.ts` and is covered by
  `src/migration.test.ts`. Tests run before the migration ever executes in the
  app: `npm test`.

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
no auxiliary credential JSON, lowercase hexadecimal SHA-256 session digests,
the disjoint raw-token format
`aca_stu_v1_<43-unpadded-base64url-characters>`, capability schema version 1,
issuance-time/expiry/revocation checks, session-version invalidation,
event-specific audit builders with sensitive value/reason rejection, explicit
object grants, and real-role denial probes. Guardian removal means relationship
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
