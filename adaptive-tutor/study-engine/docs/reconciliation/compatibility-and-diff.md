# Exact Contract Diff and Tutor Core Compatibility

Machine-readable field, enum, event, version and retirement mappings are in `reconciliation/exact-mappings.json`.

## Field-level differences

| Boundary | Source shape | Canonical target | Resolution |
|---|---|---|---|
| Envelope | S2/S3/S4 string provisional versions; Core semver | S1 `{kind,schemaVersion:1,id,revision,createdAt,updatedAt}` | Retire provisional wire authority; preserve Core semver as nested provenance. |
| IDs | Core lowercase slug; S2/S4 locally validated refs; S3 hardcoded segment keys | S1 opaque, branded runtime strings preserved byte-for-byte | Governed registry; never normalize S1 IDs. |
| Session | S2 phase/cycle/history | S1 eight-state `StudySession` | Phase is checkpoint diagnostic only. |
| Resume | S3 current segment, lesson countdown, inline answers | S1 segment ID, segment active seconds, protected draft ref | Versioned Study checkpoint/sidecar; inline raw draft excluded. |
| Evidence | Core evaluation/confidence; S2 local classifier inputs | S1 aggregate `LearningEvidence` | Approved projection only; Core raw input/transcript never crosses. |
| Parent private | S4 private note body in control state/action log | S1 separate authorized private record + controls ref | Move body to private store; general controls/events retain ref only. |
| Review | S2 day recommendation; S4 queue item | S1 skill review/interval/attempt | S1 persists cadence; S4 queue sidecar owns capacity/placement. |
| Calendar/Romeo | S4 provisional aggregates | No S1 aggregate | Approved sidecars; never competing Study authority. |

## Exact enum decisions

- Grade: S2 `elementary|middle|high` and `elementary|middle_school|high_school` map to S1 `elementary-3-5|middle-6-8|high-9-12`.
- S2 `correct|reteach` is not a Tutor Core wire enum and must retire. Tutor phases remain instructional only.
- Timer: S3 `visible|minimal|hidden` maps to S1 `count-down|progress-bar|hidden`. S4 `false` is lossy and requires an explicit non-hidden fallback.
- Review day sequence `0,1,3,7,14,30` maps exactly to `same-day,one-day,three-day,seven-day,fourteen-day,thirty-day`; other nonnegative values map to `custom`.
- S4 review kind maps to SessionResult next action: review→review, reteaching→reteach, prerequisite_remediation→prerequisite-remediation.
- Romeo completion has no S1 target and remains external-sidecar state.

## Exact event decisions

Session 1’s hyphenated event union is canonical. S2/S3 underscore events never persist directly.

- Phase/segment completions map to `active-response-recorded` and/or `segment-completed` only with canonical segment/evidence data.
- `pacing_disposition_recorded:break` initiates `break-requested`, then approval/start events only when required approval data exists.
- `break_resume_confirmed` maps to `break-ended` plus `session-resumed`.
- S3 refresh maps to `technical-interruption-started`; successful recovery maps to `technical-interruption-ended` plus `session-resumed`.
- Review scheduling updates `StudentSkillReview`; save/exit updates the checkpoint. Neither fabricates a Study session event.

## Tutor Core compatibility

| Area | Finding | Classification |
|---|---|---|
| Assessment/mastery | Core remains authoritative; multi-evidence mastery is positive. S1 persists canonical outcome. | SAFE ADAPTER |
| Misconceptions/prerequisites | Core detailed hypotheses/reasoning remain instructional/adult evidence. S1 stores bounded prerequisite outcome/evidence refs. | SAFE ADAPTER |
| Confidence | Core statistical confidence is not S1 sourced 1–5 confidence. | DOCUMENTATION + adapter guard |
| Guided/independent practice | Hints/support/independence map to S1 aggregates. Runtime attempt/hint/context invariants are incomplete. | REQUIRED BEFORE FINAL ASSEMBLY |
| Visual/spoken/media | Core content is authoritative; S1 accessibility and S3 presentation govern delivery. | SAFE ADAPTER |
| Session/persistence | Core phases/snapshot are not Study session/checkpoint contracts. | Correct separation |
| Privacy | Core snapshot includes redacted-but-raw transcript; redaction is narrow and validation issues/matched text can echo source values. | BLOCKER for direct persistence |
| Adult evidence | Core review is instructional evidence, not an authorization/projection record. | Required projection |
| Version | Core accepts arbitrary syntactic semver; S1 quarantine wrapper must run first. | Required adapter |

## Independently verified safety mismatch

The blocker is supported by exact source and runtime evidence:

1. Core `core/contracts/safety.ts` declares self-harm/immediate-danger and abuse/neglect categories.
2. `core/safety/rules.ts::safetyRules` contains only academic integrity, identifying information, diagnosis, grading dispute and high-stakes placement rules.
3. `core/safety/guard.ts::evaluateSafety` evaluates only that list, so no urgent rule can stop academic flow for those missing categories.
4. `tests/safety.test.ts` covers graded work, contact redaction and diagnosis—not urgent disclosures.
5. Core documentation admits matching is incomplete and expects a separately approved urgent-routing system.

Frozen Core is not modified. An approved pre-Core safety gateway with stop/escalate runtime tests is a production blocker.

## Consolidated Core/adapter change requests

1. **BLOCKER:** Approved external urgent-safety gateway for self-harm/immediate danger and abuse/neglect.
2. **BLOCKER:** Versioned Tutor→Study decision projection for low-detail assessment/mastery/prerequisite/review directives, with no raw learner content.
3. **REQUIRED:** Semantic validation for grade ordering, unique/reference integrity, option membership, phase/purpose, max attempts, hints and context taxonomy.
4. **REQUIRED:** Privacy-safe checkpoint/review projection; strip transcript, raw input, matched text and validation values.
5. **REQUIRED:** Versioned Study checkpoint/sidecar with segment active time, protected draft ref, safe instructional cursor, revision/CAS and idempotency.
6. **SAFE ADAPTER:** Session 1 envelope/IDs/version/quarantine/events remain outside Core.
7. **RETIRED REQUEST:** Core does not become the persistence system; refresh persistence belongs to the Study checkpoint/sidecar.

## Provisional adapter retirement

Retire S2 session-context, Tutor-outcome and provisional-session wire authorities; retire S3 workspace as production authority; retire all S4 provisional versions as canonical wire contracts. Preserve algorithms, UX and pure integration transforms behind Session 1 adapters. Migrate callers and fixtures, prohibit provisional imports at production boundaries, then remove provisional definitions only during a later authorized merge.
