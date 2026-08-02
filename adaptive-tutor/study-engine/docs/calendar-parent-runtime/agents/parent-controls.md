# Parent Controls Agent report

Status: working local runtime; Card 5 `POLICY_VERSION=1` reconciled  
Scope: Card 8 calendar/parent runtime lab only  
Network, credentials, production storage, authentication, and production UI: not used

## Outcome

The parent-controls slice is implemented in:

- `integration-labs/calendar-parent-runtime/parent-runtime.ts`
- `integration-labs/calendar-parent-runtime/card5-duration-policy.ts`
- `integration-labs/calendar-parent-runtime/privacy.ts`
- `tests/calendar-parent-runtime/parent-runtime.test.ts`

The runtime models all ten required actions:

1. Accept recommendation
2. Reject recommendation
3. Set maximum work duration
4. Set break duration
5. Hide timers
6. Add accommodation
7. Reschedule incomplete work
8. Mark an outside or technical interruption
9. Add an adult-private note
10. Request teacher or tutor review

Every action has a caller-supplied stable event ID. Replaying an event ID is an
idempotent no-op. Recommendation, accommodation, reschedule, interruption,
private-note, review-request, block, evidence, control-set, student, and private
record references are preserved byte-for-byte.

Canonical callers also supply `expectedRevision`. The runtime applies the
command only when that value matches the current control-set revision and
records the expected, source, and resulting revisions in its safe action log.
A stale command is rejected with `stale-revision` and leaves settings, history,
and logs unchanged. For local-demo compatibility, the first write to a setting
may omit the revision; every later write to the same duration, break, timer, or
RecommendationId target requires compare-and-swap. Duplicate replay is checked
first, so retrying an already-applied event remains an idempotent no-op rather
than becoming a false stale conflict.

Recommendation decisions are append-only. Rejecting an increase leaves the
recommendation and evidence in history, makes that recommendation ineligible,
and uses the neutral text: “Parent chose not to apply this recommendation. It
remains available in history.”

A rejection is scoped to exactly one `RecommendationId`; it does not suppress
a separately accepted recommendation.

## Canonical boundary observations

The Card 1 canonical parent-control, private-record, focus-profile, runtime
schema, and fixture files were inspected read-only. The Session 4 parent
contracts, controls, privacy adapter, tests, and documentation were also
inspected read-only. No Wave 1 or Session 4 file was changed.

The lab mirrors the canonical separation:

- Public state holds operational settings, decisions, functional
  accommodations, reschedules, interruptions, review requests, stable
  references, and safe audit messages.
- `privateRecordRef` is the only public link to adult-private storage.
- A private-note action returns a transient `AdultPrivateNoteWrite`.
- `writeAdultPrivateNote` requires matching learner, actor, and write
  authorization.
- `projectAuthorizedAdultPrivateNotes` requires explicit read authorization.
- The public runtime and mobile view model cannot accept an
  `AdultPrivateRecord`.

For final canonical assembly, preserve these mappings:

| Lab field                               | Canonical field                                        |
| --------------------------------------- | ------------------------------------------------------ |
| `controlSetId`                          | `ParentTeacherControls.id`                             |
| `studentRef`                            | `studentId`                                            |
| runtime revision/timestamps             | canonical header revision/timestamps                   |
| resolved effective maximum              | `maximumWorkDurationMinutes`                           |
| effective break                         | `breakDuration.defaultMinutes` within canonical bounds |
| hidden timer                            | `timerVisibility: "hidden"`                            |
| visible milestone timer                 | `timerVisibility: "milestones-only"`                   |
| action event ID                         | canonical decision/override audit ID                   |
| recommendation ID and decision          | `recommendationDecisions`                              |
| functional accommodation ID/text/source | `accommodations`                                       |
| reschedule ID/block reference/times     | `rescheduling`                                         |
| adult review request and evidence IDs   | `reviewRequests`                                       |
| `privateRecordRef`                      | `privateRecordRef`                                     |
| private record/note IDs                 | canonical private record/note IDs                      |

A `manual-review` or `quarantine` duration has a `null` target and must not be
projected as a canonical automatic maximum. The integration assembler must
hold the existing authorized value and route the policy outcome for adult
review or quarantine handling.

## Card 5 reconciled duration policy

The verified source consumed read-only is
`reconciliation/probes/policy.mjs`, exporting `POLICY_VERSION=1` and
`resolveDurationPolicy`. `card5-duration-policy.ts` is the typed Card 8
boundary over that JavaScript probe. No Card 5 file was edited or copied.

The former first-configured-source implementation was removed. Duration now
follows Card 5 constraint reduction:

1. Gate on supported policy version, input integrity, and actor authorization.
2. Compute the lower bound as the greatest safety or active required
   accommodation minimum.
3. Compute the upper bound as the least safety maximum, active required
   accommodation maximum, and active authorized adult hard maximum.
4. Return `manual-review` and no target for a safety veto or empty constraint
   intersection.
5. Choose a candidate from active manual target/hold/reduce, accepted
   recommendation, established target, then grade-band default.
6. Clamp the candidate into the feasible interval.
7. Return `quarantine` and no target for unsupported version, failed
   integrity, unauthorized actor, invalid input, or an unrecognized result.

`Card5DurationResolution` exposes:

- canonical policy ID and version;
- canonical `resolved | manual-review | quarantine` status;
- fixed Card 5 reason code;
- pre-clamp source and candidate minutes;
- effective target or `null`;
- lower and upper feasible bounds;
- Card 5 applied markers;
- candidate provenance with stable recommendation/override references and
  eligibility;
- every safety, required-accommodation, and adult hard constraint with stable
  reference, active state, and binding state;
- a user-facing effective winner, value, and reason.

The normal test vector proves that an active manual target is selected ahead of
an accepted engine recommendation and then clamped through safety bounds, two
required accommodations, and two active adult hard maxima, including the most
restrictive maximum.

Accepting or rejecting a recommendation only appends its decision and changes
candidate eligibility. It does not rewrite `adultHardMaximums` or
`parentHardMaximumWorkDurationMinutes`.

Repeated hard-maximum actions from the same adult supersede that adult’s prior
active maximum while preserving the earlier record and action log. Maxima from
other authorized adults remain active; Card 5 receives every active record and
computes the most restrictive bound.

Conflicting adult updates do not use implicit last-write-wins. Stale parent or
teacher commands are rejected at the expected-revision gate. A current command
may proceed, preserving actor and revision provenance. Preloaded hard maxima
and manual overrides validate parent/teacher actor authority, stable IDs,
offset timestamps, bounded durations, and functional reasons before policy
resolution.

Required break and presentation accommodations remain obligations, not
duration candidates. Their traces use the reconciled Card 5 policy ID:
required breaks compose to the longest required duration, and hidden timer
presentation is effective if a required accommodation needs it. This is
functional scheduling behavior, not diagnosis inference.

Accommodation effects are typed fields. The runtime never parses
`functionalDescription` or `studentMessage` to infer a duration, break, timer,
diagnosis, or learner trait. Only enabled, required accommodations participate
in constraint reduction; optional typed effects remain available but do not
silently become requirements. Preloaded and newly added accommodation text
passes the same non-diagnostic, non-blaming validation.

## Privacy and minimization

`projectParentRecommendation` is an allow-list boundary. It retains only:

- recommendation ID, timestamp, direction, safe summary;
- suggested maximum work and break duration;
- parent-visible evidence ID, safe description, timestamp, and source.

Unknown fields are excluded. Sensitive paths are reported without copying
their values. Unsafe public summary or evidence text is replaced with neutral
language. Checks cover identifying fields, contact/birth identifiers, raw
answers or responses, transcripts, diagnosis text, hidden behavioral scores,
credentials, and blame language.

`auditParentRecommendationProjection` audits the minimized result.
`auditPrivateNoteIsolation` verifies that no adult-private note body appears in
a public value.

Accommodation text must describe a functional action in supportive language.
Diagnostic, surveillance, hidden-score, and blaming text is rejected. An
adult-private note may hold sensitive context because it is a separate
authorized projection; it is never copied to a recommendation, action log,
runtime state, or mobile model.

## Mobile parent behavior

`buildMobileParentViewModel` emits a browser-safe card/list model with:

- one-column baseline and no data tables;
- long-text wrapping;
- 44-pixel minimum touch targets;
- full-width actions on narrow screens;
- all ten controls;
- effective setting values and winner/reason summaries;
- Card 5 status, reason code, feasible bounds, and constraint references;
- timer presentation honoring the winning hidden-timer obligation;
- only the private record reference and authorization label, never note bodies.

The module uses no Node APIs, browser storage, network calls, identity service,
or credentials.

## Validation

Focused command:

```text
npm test -- --run adaptive-tutor/study-engine/tests/calendar-parent-runtime/parent-runtime.test.ts
```

Result: **1 file passed, 15 tests passed**.

A strict TypeScript audit passed with `strict`,
`noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled for the
three runtime modules and focused test.

Coverage includes all ten controls, Card 5 candidate selection and clamping,
all constraint provenance, most-restrictive adult maximum, infeasible
constraint manual review, version/integrity/authorization quarantine,
winner/reason traces, stale and missing expected-revision rejection, successful
current-revision replacement, RecommendationId-scoped rejection, rejected
recommendation history, proof that decisions do not rewrite hard maxima,
typed-only functional accommodations, preloaded-text validation, PII
exclusion, parent-only private projection, mobile-safe behavior, and
deterministic duplicate-event handling.

After the parallel adapter callers were reconciled, the assembled Card 8
tests and lab-wide strict typechecking passed. No Romeo, review, shared demo,
or root-owned file was changed by this agent.
