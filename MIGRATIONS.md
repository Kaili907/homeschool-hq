# Schema migrations

Every schema version bump is documented here. Rules (from the build spec):

- Existing data is sacred — migrations convert forward, never wipe.
- Before any migration runs on real data, the raw pre-migration payload is
  snapshotted to a timestamped localStorage key (`homeschool-hq:backup:v1:<ts>`).
  Snapshots are downloadable from the Grown-Ups panel.
- Migration logic lives in `src/migration.ts` and is covered by
  `src/migration.test.ts`. Tests run before the migration ever executes in the
  app: `npm test`.

## Supabase: Academy household revision CAS (2026-07-26)

Tracked migration:
`supabase/migrations/20260726120000_academy_household_revision_cas.sql`.

- Adds one server-managed monotonic revision row per authenticated household.
- Adds per-household mutation receipts so retrying the same mutation ID returns
  the original result without applying profiles or incrementing twice.
- Replaces authenticated direct profile writes with a `SECURITY DEFINER` RPC
  that derives household identity from `auth.uid()`, locks the revision row,
  validates the expected revision, writes the complete profile set in one
  transaction, and advances the revision only on success.
- Uses a fixed `pg_catalog, pg_temp` search path, schema-qualified application
  objects, `postgres` ownership, no anonymous/PUBLIC execute grant, and the
  narrow authenticated execute grant.
- A stale expected revision returns a typed conflict and writes no profiles.

Local PGlite/PostgreSQL-protocol probes cover first run, migration rerun,
two-client same-revision contention, empty-cloud creation, rollback, identity
isolation, anonymous/missing auth, grants, and idempotent retry. PGlite's socket
multiplexer is not equivalent to two independently hosted PostgreSQL backends.
The exact Manuel Academy Supabase project is not yet verified, so the migration
has not been applied to any hosted project. Hosted migration and real
two-client contention validation are release gates; do not guess a project or
paste the SQL manually.

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
