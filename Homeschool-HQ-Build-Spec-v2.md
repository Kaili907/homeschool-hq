# HOMESCHOOL HQ — MASTER BUILD SPEC v2
**Handoff for Claude Code · Project: C:\Users\Empower Gaming\homeschool-hq · July 2026**

## Vision & non-negotiables

One app, five students: grades 3, 4, 6, 10 (sophomore), 12 (senior). Each girl signs in daily, sees her Morning Mission, does her practice, watches her mastery grow. Dad sees everything.

Principles that constrain every milestone:
1. **The app drills and tracks; Dad teaches; the Excel gradebook is the permanent record.** Never build the app as system-of-record for grades.
2. **70% paper/hands-on, 30% screen.** The app is ~30–45 min of each girl's day, max.
3. **Ship in milestones.** Each milestone below is independently usable. Never break a working feature to start the next one.
4. **Existing v1 data is sacred.** The 3rd grader's profile migrates forward at every schema change; never wipe.
5. Local-first through M5. Backend (M6) only when multi-device need is real.

---

## M1 — Multi-Profile Core (build first, before school starts)

**Refactor from single profile to five.**

Data model:
```ts
interface AppState {
  schemaVersion: number;          // bump on every breaking change
  profiles: Record<string, Profile>;
  activeProfileId: string | null;
  parentPin: string;              // gates the Grown-Ups panel
}
interface Profile {
  id: string; name: string; grade: "3"|"4"|"6"|"10"|"12";
  pin: string;                    // 4-digit, kid-chosen
  theme: "playful"|"cool"|"clean"; // 3rd–4th playful, 6th cool, HS clean
  skills: Record<SkillId, SkillState>;   // mastery 0–100, attempts, lastSeen
  missions: Record<ISODate, MissionDay>;
  streaks: { current: number; best: number; lastActiveDate: ISODate };
  createdAt: string;
}
```

Requirements:
- **Migration function**: on load, detect v1 single-profile localStorage → convert to `profiles["p1"]` (3rd grader) untouched, create empty profiles for the other four. Write migration test before running on real data.
- **Picker screen**: app opens to five name cards → tap → 4-digit PIN pad → her home. Big, friendly, fast.
- **Grown-Ups panel** becomes parent-PIN-gated and global: manage all profiles, export/import now backs up ALL profiles in one JSON, per-profile reset with double confirm.
- Theming: three visual skins keyed to `theme`. The teens must NOT get Comic Sans and confetti — clean sans-serif, muted palette, no cheer messages (a subtle ✓ is enough). Same components, different tokens.

**Accept when:** 3rd grader's real mastery data survives migration byte-for-byte; all five can sign in/out; export contains all profiles; teen theme renders without kid styling.

## M2 — Morning Mission (the daily front door)

Per-girl daily checklist generated from a schedule template. Templates (editable in Grown-Ups panel):

| Girl | Default mission items |
|---|---|
| 3rd | Math lesson w/ Dad ✋ · Math practice (auto ✓ when 15-q session done) · Read aloud 15 min ✋ · Read to self 15 min ✋ · Writing OR Spelling ✋ · Science/Social Studies ✋ |
| 4th | Same shape as 3rd, her subjects |
| 6th | Same shape + independent-work flavor |
| 10th | Geometry block 45 min · English · Science · Social Studies · Elective ✋ (mostly manual checks) |
| 12th | **Math block 60–75 min pinned first** · English · Gov/Econ · Science · College-app task of the day ✋ |

- ✋ = manual checkbox (she taps when done); auto items flip when the linked in-app activity completes.
- Day complete → streak++, gentle celebration (theme-appropriate).
- Mission history stored per date; Dad can see any past day.
- Friday template variant (light day) per the family schedule.

**Accept when:** each girl lands on today's mission after sign-in; auto-check fires from practice completion; streaks track per profile; Dad can edit templates.

## M3 — Grade 4 & Grade 6 Math Trainers

Reuse the existing engine + generators architecture wholesale; what's new is two skill trees and their generators.

**Grade 4 skills (CCSS):** multi-digit multiplication (2×2, up to 4×1) · long division (1-digit divisor, with remainders) · factors, multiples & prime · place value to 1,000,000 & rounding · fraction equivalence & comparison · add/subtract like-denominator fractions · fraction × whole number · decimal notation & comparison (tenths/hundredths) · measurement conversion (larger→smaller) · angles & line types · multi-step word problems.

**Grade 6 skills (CCSS):** ratios & unit rates · percents of a quantity · fraction ÷ fraction · decimal operation fluency (all four) · integers, opposites & absolute value · 4-quadrant coordinate plane · evaluate & write expressions (incl. distributive) · one-step equations · area of triangles & composite figures · volume & surface area · mean/median/mode.

- Each tree gets its own 20-question adaptive Placement Quest (same staircase engine) — **this replaces nothing**: the paper placement tests already given remain the official baseline; the in-app quest seeds the app's mastery model.
- Generators: procedural with randomized values, shuffled choices, session dedupe — same standards as grade 3. SVG visuals where they earn their keep (number lines for integers, coordinate grids, fraction bars, ratio tables).
- Word problems can use template banks with slot-filled numbers/names.

**Accept when:** both girls can run placement + daily practice end-to-end with zero repeated questions in a session and no console errors; difficulty staircase verified per tree.

## M4 — High School Mode (different animal)

For the teens the app is a **practice + progress companion**, not the curriculum — Dad + textbook teach; the app drills and tracks.

- **Geometry practice sets** (both girls take Geometry this year): units for angle relationships & parallel lines · triangle congruence · similarity · right triangles & Pythagorean · trig ratios (SOH-CAH-TOA) · quadrilaterals · circles · area & volume · coordinate geometry. Generators are very feasible here (numeric answers, randomized figures via SVG).
- **Algebra I maintenance deck**: 5-question daily warm-up drawn from equation solving, slope, factoring — keeps the foundation warm all year (critical for the senior heading into Algebra II at week 17).
- **Timed quiz mode**: 10 questions, countdown — SAT-style pacing practice.
- **Course progress tracker**: manual unit checklist per course (English, science, etc. — Dad or the girl ticks units complete) so their home screen shows whole-year progress across all subjects, not just math.
- **Senior extras**: her Morning Mission's "college-app task" pulls from a Dad-editable checklist (essay draft, FAFSA, each application) with due dates. Overdue = top of her mission in red.

**Accept when:** a full Geometry practice session runs clean per unit; timed mode works; senior's deadline list sorts by date and flags overdue; teen theme throughout.

## M5 — Parent Dashboard

One screen, five columns: today's mission status per girl · current streaks · math mastery heat map (skills × mastery color scale, mirroring the Excel gradebook's green/yellow/red thresholds: ≥90 / 75–89 / <75) · last-7-days activity. Plus a **"mastery snapshot" entry panel**: after each paper grade card, Dad types updated levels for paper subjects so the dashboard shows the whole picture, not just app-tracked math. Read-only for kids; lives behind parent PIN.

**Accept when:** dashboard reflects real-time state of all five profiles and manual snapshots persist.

## M6 — Sync & Real Logins (only when needed)

Trigger: the teens genuinely working from their own devices. Stack: **Supabase** free tier — email/password auth for the two teens + Dad, anonymous-style device profiles for the littles (they stay on the family machine). Postgres mirrors the Profile schema; local-first with sync (write local, push async, last-write-wins per field is fine at this scale). Migration: one-time "push local profiles to cloud" from Grown-Ups panel. Keep JSON export working forever regardless.

**Do not start M6 before M1–M5 are in daily real use.**

---

## Build order & discipline

M1 → M2 ship together before the school year starts (these are the daily experience). M3 next (the 4th/6th graders' trainers), then M4, then M5. Initialize git NOW if not done; commit per feature; tag each milestone (`v2.0-m1` etc.). Add a `MIGRATIONS.md` documenting every schema version. Before any migration runs on real data: export a backup automatically to a timestamped JSON.

## Out of scope (deliberately)

No grades stored in-app (gradebook Excel owns that) · no reading/spelling modules yet (roadmap after M5, per original plan) · no video content · no public deployment/accounts beyond the family · no AI-generated question APIs at runtime (procedural generators only — deterministic, free, offline).
