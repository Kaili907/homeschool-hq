# Schema migrations

Every schema version bump is documented here. Rules (from the build spec):

- Existing data is sacred — migrations convert forward, never wipe.
- Before any migration runs on real data, the raw pre-migration payload is
  snapshotted to a timestamped localStorage key (`homeschool-hq:backup:v1:<ts>`).
  Snapshots are downloadable from the Grown-Ups panel.
- Migration logic lives in `src/migration.ts` and is covered by
  `src/migration.test.ts`. Tests run before the migration ever executes in the
  app: `npm test`.

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

The complete intended fresh-project chain is:

1. `20260724074106_academy_profiles_base.sql`
2. `20260724230000_academy_student_identity_foundation.sql`
3. `20260726120000_academy_household_revision_cas.sql`

The latter two remain on their separately reviewed feature branches. They are
not copied into this branch. The permanent database suite resolves the exact
reviewed Git blobs from commits `6138112bda3e395b02ae8d67a1da756f73cd28ed`
and `e5131729f7866553f6bedfd2ca0ec84f0b343126`, verifies their blob identities,
and applies the complete chain in timestamp order. A missing or stale reviewed
blob fails the test instead of silently substituting another migration.

An isolated Supabase CLI 2.109.1 rollback probe proved that `migration up
--db-url` executes one migration file atomically: a forced late failure removed
all earlier objects and the failing ledger entry. The same probe appended a
forced failure after the exact safe-sync migration and confirmed that no CAS
table or function remained, while the earlier committed base migration and
ledger record stayed intact. No repository `supabase/config.toml` was required
for this explicit local `--db-url` path.

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
