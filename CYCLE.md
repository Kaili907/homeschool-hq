# CYCLE — Calendar Core and Daily Planner · Session 1

**Branch:** `feature/calendar-core-daily-planner`
**Base:** `origin/master` @ `15644974628ead6704c1e97e959cdbd801fdd1b3`

## Scope

Add an optional, serialization-safe planner domain with recurring family schedule
templates, per-date overrides, per-profile block-instance progress, deterministic
daily derivation, mission and curriculum adapters, a Parent Hub `Daily Plan` tab,
and a student-facing `My Day` sequence.

The existing 36-week Calendar, school-year/off-week math, curriculum pointers,
mission completion authority, mastery/assessment state, attendance rules, identity,
sync, and database boundaries remain unchanged.

## Gates

`npm install` · `npm run typecheck` · `npm test` · `npm run build` · focused live
browser validation at desktop and approximately 320px wide.

No database migration, no merge — end at a committed report.
