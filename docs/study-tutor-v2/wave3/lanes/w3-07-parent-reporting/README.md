# W3-07 Commercial Parent Reporting

Status: ready for Wave 3 convergence.

This lane extends the Wave 2 Parent Why safety model into a minimized Parent
Hub report. It aggregates closed, structured records that Study has explicitly
approved for parent reporting. It does not accept Tutor/provider prose, query a
provider, make a Study decision, apply a Study decision, or deliver a report.

## Boundary

`buildMinimizedParentHubReport` is exported from
`adaptive-tutor/study-engine/tutor-v2/parent-reporting`. Its exact request,
evidence, report, summary, and result schemas are exported from the same local
entrypoint.

Every request is bound to one household and one authorized/selected learner,
plus exactly one of:

- a session reference; or
- a reporting-period reference with inclusive start and end timestamps.

Every evidence record repeats that scope in Study provenance. Household,
learner, scope kind, session or reporting-period reference, and period bounds
must match exactly. Reporting-period evidence must also have a `recordedAt`
inside the inclusive period. Cross-child, cross-household, cross-session,
cross-period, invalid-period, and out-of-period inputs fail closed without
returning submitted references.

## Study-approved reporting evidence

The request accepts exact structured records only. Each record requires:

- `producer: study-engine`;
- `reportingApproval: study-approved-for-parent-reporting`;
- opaque evidence, source-event, and policy references;
- an ISO recording timestamp;
- the repeated report scope; and
- one closed reason and reviewed status combination.

The reporting approval says only that Study permits the structured record to
appear in Parent Hub. It is deliberately separate from instructional decision
status.

Duplicate evidence or source-event references reject the complete request so
repeated records cannot inflate counts. Evidence policy must match report
policy, and an evidence timestamp cannot postdate report generation. Accepted
reports remove evidence and source-event references and expose only aggregate
occurrence counts.

## Closed report vocabulary

Study observations use the `Study recorded` label and have a `null`
`decisionStatus`:

| Reason | Minimized meaning |
| --- | --- |
| `practice-completed` | Study recorded completed practice. |
| `support-level-used` | Study recorded use of an approved support level. |
| `independent-evidence-observed` | Study recorded approved independent evidence. |
| `time-on-task-under-15-minutes` | Trusted Study metadata selected the under-15-minute bucket. |
| `time-on-task-15-to-30-minutes` | Trusted Study metadata selected the 15-to-30-minute bucket. |
| `time-on-task-31-to-60-minutes` | Trusted Study metadata selected the 31-to-60-minute bucket. |
| `time-on-task-over-60-minutes` | Trusted Study metadata selected the over-60-minute bucket. |

Instructional proposals and decisions use one of three non-interchangeable
statuses:

| Status | Parent Hub meaning |
| --- | --- |
| `tutor-proposed` | Tutor proposed or requested a step; Study has not approved or applied it. |
| `study-approved` | Study approved the step; approval does not claim application. |
| `study-applied` | Study recorded that the approved step was applied. |

The closed decision reasons are `review-requested`, `prerequisite-review`,
`reteach`, and `study-decision`. Each allowed reason/status pair binds exact
reviewed literals for `statusLabel`, `title`, and `explanation`. For example,
the three reteach summaries remain separate aggregate rows; they cannot be
collapsed into a single “recommended” or “used” row. Observation reasons paired
with a decision status, decision reasons paired with `null`, and unknown future
reasons all fail closed.

## Minimized report

An accepted report contains only:

- version, Parent Hub audience, and `explanatory-only` authority;
- the opaque household/learner/session or reporting-period scope;
- ordered reviewed summary rows with occurrence counts;
- a fixed authority disclaimer; and
- Study report provenance with report/policy references, generation time, and
  the number of source evidence records.

No raw Tutor transcript, raw answer, answer key, diagnosis, emotion label,
personality judgment, provider prose, sibling data, credential, raw duration,
or arbitrary narrative can enter the exact input or output contracts. Time on
task is reportable only through the four reviewed buckets; raw seconds or
minutes are rejected.

The fixed disclaimer is:

> This report explains Study-approved records. Tutor may propose a step, but only Study can approve or apply it. This report does not make or change a learning decision.

There is no email, SMS, push, notification, provider, persistence, or Parent Hub
UI wiring in this lane.
