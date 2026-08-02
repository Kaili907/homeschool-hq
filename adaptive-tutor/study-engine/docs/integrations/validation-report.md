# Study integrations validation report

**Validation date:** July 28, 2026

**Scope:** CARD 4 owned integration, parent, integration-test, and integration
documentation paths

**Status:** Provisional implementation complete; production integration not
performed

## Outcome

The owned packages provide executable mock demonstrations and provisional
contracts for the requested calendar, review queue, Romeo Virtual Academy, and
parent-insights surfaces. Automated validation covers functional behavior,
privacy constraints, mobile presentation, time-zone boundaries, duplicate
prevention, parent overrides, and static separation from forbidden production
areas.

No production calendar, database, authentication, identity, storage, Supabase,
GitHub, or deployment system was changed or contacted.

## Requirements traceability

| Requirement | Implementation / demo | Automated validation |
| --- | --- | --- |
| All 13 daily block types | `DAILY_CALENDAR_BLOCK_TYPES`; calendar mock | `calendar-transformation.test.ts` |
| Estimated and actual duration | Segment estimates and accumulated active minutes | transformation and partial/resume tests |
| Segment completion | Ordered segment transitions and block view | partial/resume tests |
| Pause/resume | Explicit state transitions and events | partial/resume tests |
| Partial completion | Fractions mock: 3 of 6 | partial/resume and boundary tests |
| Automatic continuation | Remaining-segment continuation with backlink | partial/resume tests |
| Drag/drop and parent edits | Reschedule method and parent edit event | transformation tests |
| Approved/outside/technical interruptions | Explicit pause reasons | partial/resume tests |
| Daily/weekly completion bars | Duration-weighted local-date aggregation | transformation tests |
| Same-day/future/overdue review | Calendar-date classifier and queue partitions | `review-queue.test.ts` |
| Reteaching and prerequisite remediation | Exhaustive review kinds | review demo test |
| Review deferral | Immutable structured deferral | review queue tests |
| Daily limits, priority, overload prevention | Item/minute caps, stable priority, held reasons | review overload tests |
| All Romeo assignment fields | Typed normalized assignment | `external-assignment-adapter.test.ts` |
| No Romeo credentials | Runtime key and URL rejection | external assignment and privacy tests |
| Parent TODAY / LEARNING / STUDY HABITS | Working React mock and fixed data | `parent-dashboard.test.tsx` |
| All parent controls | Immutable command reducer and interactive mock | dashboard and override tests |
| Mobile parent dashboard | Mobile-first cards/CSS, viewport, touch targets | `mobile-parent-dashboard.test.tsx` |
| Parent overrides | Accept/reject and later explicit setting authority | `parent-overrides.test.ts` |
| Parent-visible evidence | Evidence contracts and privacy audit | dashboard and privacy tests |
| Supportive language | Validation and payload scan | review, parent, and privacy tests |
| Minimal data / prohibited surveillance | Minimized types, no sensor or persistence API | `privacy-contract.test.ts` |
| Forbidden-area isolation | Static resolved-import scan | `validation-boundary.test.ts` |
| Time-zone-safe scheduling | Offset timestamps, IANA zones, date guard, DST test | `calendar-timezone-duplicates.test.ts` |
| Duplicate calendar entries | Stable logical identity and revision precedence | time-zone/duplicate and Romeo tests |

## Test inventory

- `calendar-transformation.test.ts`
- `calendar-partial-resume.test.ts`
- `calendar-timezone-duplicates.test.ts`
- `external-assignment-adapter.test.ts`
- `review-queue.test.ts`
- `parent-dashboard.test.tsx`
- `parent-overrides.test.ts`
- `mobile-parent-dashboard.test.tsx`
- `privacy-contract.test.ts`
- `validation-boundary.test.ts`

Final focused result:

```text
Test Files  10 passed (10)
Tests       55 passed (55)
```

The owned implementation and the eight browser-safe behavioral test files
passed a standalone strict TypeScript no-emit check. The two static audit tests
use `node:fs`, `node:path`, and `node:url`; they execute successfully through
Vitest, but a separate standalone check for those two files requires
`@types/node`, which is not installed in this shared repository and was not
added outside this session's ownership.

## Static validation

The static boundary suite recursively inspects integration and parent
TypeScript/TSX source and fails if:

- A public `readonly` field introduces surveillance, diagnosis, hidden behavior
  scoring, permanent labeling, raw-response, or credential data
- Source calls browser media, network, browser persistence, database, or
  authentication APIs
- A relative import resolves into forbidden core, subject, contract, schema,
  engine, or study UI directories

This complements behavioral tests; it does not replace review of a future host
adapter.

## Ownership and forbidden-path audit

The implementation/test/document inventory produced by this session is limited
to the four assigned roots:

- `study-engine/integrations/**`
- `study-engine/parent/**`
- `study-engine/tests/integrations/**`
- `study-engine/docs/integrations/**`

`validation-boundary.test.ts` resolves every relative import from the
integration and parent implementations and fails if it enters
`adaptive-tutor/core/**`, `adaptive-tutor/subjects/**`, or the forbidden
study-engine contract, schema, engine, or UI roots. The check passes.

A scoped `git status --short` audit was also run. The shared coordinated
workspace already contains untracked contract, schema, engine, and UI
directories owned by other sessions, so global untracked status cannot prove
per-agent provenance. This session did not edit, import, copy, or package those
directories. No change was made under `adaptive-tutor/core/**` or
`adaptive-tutor/subjects/**`.

## Behavioral validation highlights

- The Fractions Lesson reports 3 of 6 sections complete, 16 estimated minutes
  remaining, and resumes at Guided Practice.
- Active minutes exclude paused time and persist across approved, outside, and
  technical interruptions.
- A local revision survives a repeated fresh calendar import.
- UTC date boundaries and the New York DST overlap retain the intended local
  date/instant behavior.
- The review demo schedules 2 due items, holds 2 to protect the daily limit and
  priority, and keeps 2 future/deferred items visible.
- Romeo parent and student progress remain separate; the demo effective
  progress is explicit rather than inferred.
- Parent recommendation acceptance applies suggested settings, while a later
  explicit parent duration remains authoritative.
- Timer hiding changes the responsive dashboard projection.
- Private note text never appears in the snapshot or rendered dashboard.

## Validation command

Run from the repository root:

```powershell
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/integrations --configLoader runner
```

Result on the final combined run: 10 test files passed and all 55 tests passed.

## Known limitations and integration gates

1. Contracts are provisional and have not been promoted to shared production
   contract/schema ownership.
2. Mocks are in memory; authorization, persistence, retention, concurrency,
   audit storage, and notification behavior are not implemented.
3. The Romeo adapter validates supplied metadata but does not define a
   production source or approved-host allowlist.
4. Mobile tests validate the supplied responsive markup and CSS; device/browser
   acceptance testing remains a later integration activity.
5. Parent language guards cover specified unsafe patterns but are not a
   substitute for editorial/content policy.
6. No full production application build or deployment is claimed by this
   integration-only report.

## Core change status

No core change was made. Future integration requests are documented in
[core-change-requests.md](./core-change-requests.md) and require dispatch,
owner, privacy, and security review.
