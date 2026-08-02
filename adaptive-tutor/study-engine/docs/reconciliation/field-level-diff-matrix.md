# Field-Level Diff Matrix

`S1` is the Session 1 canonical boundary. `S2`, `S3`, and `S4` are authoritative only for the scopes stated in the dispatch. `Core` means the actual Tutor Core v0.2 package; it was unavailable, so every Core column entry is unverified.

| Field/concept | S1 | S2 | S3 | S4 | Core | Reconciled result |
|---|---|---|---|---|---|---|
| Package/version | `schemaVersion:1`; no manifest | Provisional strings; no manifest | Prototype manifest `0.1.0` | Provisional strings; no manifest | UNVERIFIED | Logical IDs only; Core exact manifest BLOCKER |
| Opaque IDs | 1–128 chars; slash allowed; preserve bytes | Narrower validators | Fixture/runtime IDs | Narrower review/calendar validators | UNVERIFIED | Widen adapters; never normalize |
| Grade band | `elementary-3-5`, `middle-6-8`, `high-9-12` | Two provisional vocabularies | Display ranges | No alternate authority | UNVERIFIED | S1 values persisted |
| Exact grade | Namespaced extension possible | Band only | Display range can cross bands | Display/projection | UNVERIFIED | Add typed grade/applicability metadata |
| Subject | `subjectId` | `subjectKey`/`subject` | `math`/`reading` fixtures | Subject/course display text | UNVERIFIED | Plan/catalog ID only |
| Skill | `SkillId` | Provisional skill fields | Missing from fixtures | `skillRef` | UNVERIFIED | Exact plan/Core ID; BLOCKER |
| Task/segment | `LessonSegment.id`; `StudyTaskType` | Phase-based | Six fixture slugs | Segment projection | UNVERIFIED item/substep | No parallel `TaskId`; bind real segments |
| Session state | Eight canonical states | Orchestrator phases | Screens/break state | Calendar execution | UNVERIFIED | S1 only in aggregate |
| Session event | Kebab-case ledger | Snake-case runtime events | UI/local intents | Projection audit events | UNVERIFIED outcomes | S1 only; adapters/projections link source |
| Event version | Aggregate v1 + event ID/sequence | No canonical envelope | Local dedupe | Calendar dedupe; parent events lack IDs | UNVERIFIED | Command envelope + CAS + append replay rule |
| Resume | Segment/time/draft ref | Runtime cursor | Screen/timer/raw workspace | Continuation projection | UNVERIFIED substep refs | Canonical ResumePoint + versioned ref-only checkpoint |
| Timer | Hidden plus four metrics | Pacing inputs | visible/minimal/hidden | shown/hidden | UNVERIFIED | Split visibility and metric |
| Break | Lifecycle + reason | Seven activity types | Activities/resume UI | Pause/continuation | UNVERIFIED safety interaction | Keep activity and reason orthogonal |
| Evidence | Low-detail typed fields | Proportions/numeric measures | Raw answers/reflection/transcript | Free-text parent descriptions | UNVERIFIED | Lossless mapping only; refs, never bodies |
| Mastery | Categorical | Numeric/boolean/guessed directive | Must not infer | Queue assumes Core purpose | UNVERIFIED | Core-only BLOCKER |
| Prerequisite | Structured status/IDs/basis/action | Boolean | No authority | Review projection | UNVERIFIED | Core-only; no boolean expansion |
| Misconception/uncertainty | Partial low-detail outcome surface | Misconception detail discarded; `inconclusive` | No authority | Parent text risk | UNVERIFIED | Opaque Core ref + approved minimized projection |
| Recommendation | Decision/review records | Five dispositions | Display/interaction | Accept/reject mutates settings | UNVERIFIED basis | Separate disposition/lifecycle; acceptance never changes hard cap |
| Precedence | Hard controls/accommodations | Hold-before-cap defect | Effective preference UI | Adult events | UNVERIFIED safety | Gate → constraints → candidate → clamp |
| Accessibility | Canonical accessibility fields | No typed constraints | Captions/audio/motion/text scale | Free-form accommodation action | UNVERIFIED media/input | Typed catalog; controls source, focus/UX projection |
| Review interval | Named 0/1/3/7/14/30/custom | Pacing authority | Review UX | Derived queue views | UNVERIFIED basis/priority | S2 algorithm → S1 wire |
| Retry window | No exact time | Same-day possible | No authority | Placement needs a slot | UNVERIFIED safety | Support + break/session boundary; no invented time |
| Time zone/date | IANA/local date | Scheduler `timeZone` | Browser zone not authoritative | `zoneId`/`timeZone` | UNVERIFIED | One authorized household source; snapshot |
| Calendar | Plans/reviews are sources | Timing, not placement | Display | Placement authority | UNVERIFIED purpose | Idempotent projection with source links |
| Review queue | `StudentSkillReview` | Scheduler authority | Review session UX | Create/defer; no result return | UNVERIFIED outcome/priority | Add occurrence/result saga |
| Romeo | No root contract | StudyPlan can support | Display | Credential-free adapter but untyped support/arbitrary URI | UNVERIFIED support ref | Typed StudyPlan link, date stays date, opaque launch ref |
| Adult-private | Separate private record/ref | No note authority | Must never receive body | Duplicates body; narrower `parent_only` | UNVERIFIED adult evidence | Separate audience-aware private repository |
| Sensitive data | Low-detail intent; extension loophole | Free-text coach and unknown-state preservation | Raw local workspace | Free-text/credential scan weaknesses | UNVERIFIED transcript API | Allowlisted structured projections only |
| Registry/validation | Strict registry/result/quarantine | Provisional one-error adapters | Shallow hydrate/reset | Exception/provisional/restamp | UNVERIFIED | S1 gate plus audience capability |
| Persistence | Append-only sidecar proposal | Pure algorithms | localStorage prototype | Calendar dedupe/whole-state reducer | UNVERIFIED replay | CAS, append ledgers, outbox, separate private store |
| Node/browser | ES2022 dependency-free | ES2022/no DOM | React/Vite/jsdom/Playwright | Light adapters/Node audit | UNVERIFIED manifest | Plain-JSON sidecar; no direct Core import yet |

The loss-aware machine form, including a classification for every row, is [`field-diff-matrix.v1.json`](../../reconciliation/field-diff-matrix.v1.json).

