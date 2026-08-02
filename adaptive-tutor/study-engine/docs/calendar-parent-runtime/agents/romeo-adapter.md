# Romeo Virtual Academy adapter agent report

## Scope

This audit was limited to the local Wave 2 Romeo runtime, its focused tests,
and its adapter documentation. No Wave 1 package, production integration,
calendar, dashboard, credential system, network boundary, or persistence
surface was changed.

## DEC-018 conformance audit

The existing adapter already conformed to the material Card 5 and Card 8
requirements:

- versioned input and updates (`schemaVersion: 1`);
- stable provider plus external assignment identity;
- opaque, public-safe `hostLaunchRef`;
- real date-only `dueDate` with no synthesized midnight instant;
- title, course, estimated duration, explicit external completion state, and
  explicit-offset `lastCheckedAt`;
- separate parent-entered and student-entered progress records;
- discriminated `skill | lesson` Manuel Academy target plus
  `VersionedReference<StudyPlanId>` support-plan fallback;
- adapter-private resume note and validated HTTPS reference;
- `manual`, `approved-import`, and `browser-assisted-reference` provenance;
- recursive, cycle-safe credential rejection on unknown nested input;
- no login, credential request/storage, browser operation, scraping, network
  request, persistence, production sync, or production-calendar write;
- allowlisted public and calendar projections that omit the private URL and
  resume body;
- idempotent calendar insertion keyed by learner, provider, external
  assignment ID, and root continuation identity.

The Card 5 machine decision remains `approved-with-required-change`, and the
lab remains `PASS_WITH_BLOCKER`: TC-P18 cannot verify whether Tutor Core v0.2
offers a more specific support reference. The adapter therefore remains
explicitly not production-approved and not authorized for final assembly.

## Changes made

Two meaningful gaps were closed:

1. `RomeoCalendarSchedule` now forwards the Card 5 explicit placement pair
   `scheduledStart` and `intendedLocalDate` to the calendar runtime alongside
   `scheduledLocalStart`. A DST-overlap test proves the chosen offset instant
   and intended learner-local date survive projection exactly.
2. A focused update test now directly proves that credential-shaped material
   hidden at multiple unknown nesting levels is rejected before any assignment
   change. The original assignment remains unchanged.

Documentation now identifies the explicit placement seam as the production
path and the local-time-only resolver as a lab compatibility fallback.

## Validation

The focused Romeo suite passes all 16 tests, and `npm run typecheck` passes.
The lab `npm test` command also ran the complete calendar-parent-runtime suite;
all Romeo tests passed, while an unrelated manifest test reported that
`@types/node` is pinned as `24.13.3` but expects a `^24.x` range. That package
manifest is outside this agent's exclusive scope and was not edited.

The root integration agent should re-run the complete suite and browser build
after all concurrent Wave 2 edits settle.
