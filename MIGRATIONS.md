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
