# CYCLE — SESSION C (SE-B)

Wave: School-Essentials-Pack, Session C / SE-B.
Branch: `se-b-essentials`  ·  Worktree: `../hq-seb`  ·  Port: 5185
Base: master @ 3eece14 (14 tags; SE-A `typing` field present).

## Scope (SE card items 1, 2, 4)
1. **Attendance** (invisible to kids): mission-day-complete auto-records an
   attendance day per profile; hours estimated from template block count with a
   Dad-editable per-girl hrs/day override; append-only log, monthly + YTD counts,
   CSV export. Self-contained (MP absorbs later).
2. **Service hours** (teens only): log on the teen home — date, org, hours, note;
   Dad approval checkbox in Grown-Ups locks an entry; YTD total; CSV export.
3. **Mission template defaults**: update defaults + a per-girl one-click "apply new
   defaults" that respects existing Dad edits.
   - grades 3/4: + Typing (auto → Profile.typing) + Handwriting ✋ (Tue/Thu)
   - grade 6: + Typing (auto) + Japanese ✋ + Current events ✋ (1×/wk)
   - teens: + Current events ✋ (1×/wk)
   - senior (12): additionally + SAT prep ✋ (3×/wk, fall template only)
4. **Leave hooks** (documented, unwired) for reading + mindset auto-items — wired
   at merge if MR/MM modules are present on master post-rebase.

## Ownership
- **EXCLUSIVELY owns `src/missions.ts`** this wave. Sessions A (MR) and B (MM) are
  forbidden from touching it. SE-B merges LAST.
- Out of scope: MR, MM, MP, typing module internals, assessments.

## Merge protocol (do NOT merge here — end at report)
- Remove this file before merge (claim files never reach master).
- Re-run gates + live run after rebase over MR/MM.
