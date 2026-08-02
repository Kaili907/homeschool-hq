# HOMESCHOOL HQ — PARENT HUB ADDENDUM (Spec v2.6)
**Adds milestone MP (Parent Hub) — SUPERSEDES AND ABSORBS Build-Spec-v2 §M5. Build order: after MM (both rework the Grown-Ups surface; serial, one session).**

## What MP is
The Grown-Ups panel graduates from control room to command center: a parent-PIN-gated hub with four views — **Today · Calendar · Plans · Status** — answering, at a glance: what should each girl be doing right now, where is she against the plan, and what does Dad teach this week.

## The pacing engine (the core idea — build this first)
```ts
interface SchoolYear { startDate: ISODate; totalWeeks: number;      // 36
  quarterBreaks: number[];                                          // after wks 9,18,27
  offWeeks: ISODate[]; }                                            // Mondays of travel/vacation weeks
// per profile:
interface Pacing { [subjectId: string]: { weekPointer: number } }   // optional field, runtime default
```
- Calendar weeks map to scope weeks by counting **non-off** weeks since startDate. Marking a travel week "off" shifts every subsequent week's expectation — no guilt math, the plan just breathes.
- Each girl × subject has a **weekPointer** (defaults to the calendar-derived week). Dad can nudge any pointer ±: a girl reteaching fractions sits at math wk 4 while her writing runs wk 6. Pointers are the truth the whole hub renders from.
- Nothing auto-advances pointers except the calendar default; manual pointer moves are logged (date + old→new) for the year-end record.

## Curriculum content pipeline
- New repo folder `curriculum/` holding the plan documents as markdown with a light convention: `## Week N` headings per subject section (existing docs already close to this). A build-time parser turns them into `{girl/grade → subject → week → items[]}`.
- Ship v1 with everything that exists: 3rd grade Q1 scope, Week 1 packet, Japanese Year 1, Competitor's Mind (schedule only — content stays in MM), Personal Finance, Life Skills & Electives. Missing scopes (4th/6th/teens post-assessment) render as "awaiting placement results" placeholders — the hub must be useful at partial content, since content arrives per-girl as assessments complete.
- Adding a plan later = drop a new md into `curriculum/`, no code change.

## The four views
**Today** — the morning screen: five columns (one per girl): her mission status live, and under it today's teaching items derived from (weekPointer × day-of-week) — e.g. "Math: Rounding to nearest 10 (wk 2) · Spelling: Tue = introduce list". Dad-taught items marked ✋ distinct from independent/app items. A girl on an off-week shows "Travel week 🧳".
**Calendar** — the year at a glance: 36 scope weeks laid over real dates, quarter breaks and off-weeks visible, today highlighted; tap a week → per-girl summary of that week across subjects. Controls: set startDate, toggle off-weeks (this is the travel button), view pointer drift (any subject whose pointer ≠ calendar week gets a small ± badge).
**Plans** — the binder: girl → subject → full week-by-week scope rendered from `curriculum/`, current pointer week highlighted, prev/next navigation, and the pointer nudge control lives here (with reason field, logged). Printable per week.
**Status** — absorbs M5 wholesale: mission completion + streaks per girl, math mastery heat map (green/yellow/red at the gradebook thresholds 90/75), last-7-days activity, Needs-Dad flags surfaced here too, and the manual **mastery snapshot** entry panel for paper subjects (Dad types levels after grade cards so the picture is whole). Read-only for kids; everything behind the parent PIN.

## Boundaries (unchanged principles)
The hub reads and plans; it does not grade — the Excel gradebooks remain the permanent record, and the hub links out to nothing that pretends otherwise. Kid-facing screens are untouched by this milestone except zero-impact data reads. All new fields optional, no schemaVersion bump. Off-weeks affect *expectations only* — no student data is ever modified by calendar changes.

## Acceptance criteria
Pacing math: off-week insertion shifts derived weeks correctly across quarter boundaries (unit-tested against a table of dates). Pointer nudge changes Plans highlight + Today items for that subject only, and logs the move. Today view renders all five girls with correct day-of-week items from current pointers; travel week renders the badge and no items. Parser round-trips the shipped curriculum docs (every `## Week N` lands in the right girl/subject/week; count-verified per doc). Missing-scope subjects show the placeholder, not errors. Status view shows live mission/streak/mastery truth and accepts snapshot entry. Print of a single week is clean. All existing suites green; kid flows byte-identical.
