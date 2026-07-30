# Canonical Contract Decision Record

Session 1 is the sole canonical Study authority. Tutor Core remains frozen instructional authority; Sessions 2–4 retain only their assigned algorithms, UX, and integration behavior behind canonical adapters.

| # | Topic | Exact decision |
|---:|---|---|
| 1 | Packages/versions | Study aggregates use numeric `schemaVersion: 1`. Tutor Core semver is nested instructional provenance. Every `provisional-*.v1` wire authority retires. |
| 2 | IDs | Preserve Session 1 opaque runtime strings byte-for-byte. Map separately to Tutor Core lowercase slug IDs; never normalize canonical IDs. |
| 3 | Grade | Canonical: `elementary-3-5`, `middle-6-8`, `high-9-12`. S2 elementary/middle/high and elementary/middle_school/high_school map respectively. Core `{min,max,label}` remains instructional metadata. |
| 4–6 | Subject/skill/task IDs | Session 1 opaque subject/skill IDs and `StudyTaskType` are canonical. Tutor/S2/S3/S4 labels pass through governed mapping registries only. |
| 7 | Session states | Exactly `planned`, `active`, `paused`, `approved-break`, `student-requested-break`, `technical-interruption`, `completed`, `abandoned`. S2 phases and S4 calendar states are not Study states. |
| 8–10 | Events/version | Exactly Session 1’s 17 hyphenated event types; event ID is opaque and unique, sequence monotonic. Aggregate version is numeric 1; unsupported versions quarantine without mutation. |
| 11–12 | Segment/resume | Canonical ordered `LessonSegment.id`/`segmentSequence`; `ResumePoint={segmentId,elapsedActiveSecondsInSegment,responseDraftRef?}`. Exact refresh adds a versioned sidecar checkpoint, not a new session contract. |
| 13 | Timer | S3 visible→count-down, minimal→progress-bar, hidden→hidden. S4 hidden=true→hidden; false is lossy and requires explicit fallback policy. |
| 14–16 | Break/interruption | S2 break details map to Session 1 request/approved-break reason plus safe `detailCode`; approved breaks never count as failure. Technical interruption remains separate. |
| 17–26 | Evidence | Session 1 `LearningEvidence` is canonical. Tutor Core supplies approved instructional aggregates. Accuracy, completion, independence, reported confidence/effort/frustration, hints, interventions and redirection remain distinct. Raw content is excluded. |
| 27 | Prerequisite | Tutor Core reasons; Session 1 persists `none-observed`, `suspected`, `confirmed`, or `insufficient-evidence`. |
| 28 | Recommendation | Exactly `increase`, `maintain`, `decrease`, `insufficient_data`, `manual_review` as Session 2 algorithm output. It proposes a canonical adjustment; it does not own the profile. |
| 29–30 | Overrides | Session 1 fields/actors/provenance are canonical. Precedence: safety → required accommodation → parent hard maximum → explicit manual override → engine → grade default. |
| 31–32 | Accessibility/accommodation | Session 1 owns settings. Session 3 renders them. Required accommodation outranks parent/engine but never leaks diagnosis. |
| 33–36 | Review/time | Session 1 intervals are canonical. Same-day is `{id:'same-day',days:0}` plus learner-local `nextReviewDate` and household IANA zone; it is not “now.” |
| 37–39 | Calendar/queue/Romeo | Session 4 owns placement/transforms in approved sidecars. Romeo remains credential-free and externally authoritative for assignment completion. |
| 40–42 | Privacy | Private note bodies only in `ParentTeacherPrivateRecord`; Study recommendation/learner projections exclude PII, raw answers/transcripts, diagnosis language, and adult-private notes. |
| 43–44 | Registry/results | Session 1 registry/version inspection runs first. Adapter errors are fixed/non-echoing; Core validation `issue.value` is stripped. |
| 45–48 | Persistence | Append-only events, idempotency, monotonic sequence, revision/CAS, sidecar proposals, and lossless version quarantine are required. |
| 49 | Core requests | Frozen Core is unchanged. Approved external adapters/gateways carry the actionable requests. |
| 50 | Dependencies | R1 compatibility tests use Node built-ins and parse raw ZIP central directories. Browser tests remain package-level evidence, not rerun production proof. |

## Parent precedence and conflicts

The dispatch order is approved. A lower layer cannot weaken a higher layer.

- Minimum duration never overrides a higher-authority maximum; an empty legal range becomes `manual_review`.
- Required breaks cannot be removed by parent or engine settings. Parents may add breaks.
- Break length must fit the intersection of safety, accommodation, and canonical control bounds; empty intersection becomes manual review.
- Hidden timer, reduced motion, and no-audio constrain presentation. No-audio requires text/caption fallback.
- Adult review flags persist until authorized resolution.
- Parent rejection is revision-specific and durable. New evidence may create a new recommendation but cannot silently revive the rejected revision.
- Conflicts resolve to the highest-precedence compatible constraint; irreconcilable conflicts stop automatic application.
