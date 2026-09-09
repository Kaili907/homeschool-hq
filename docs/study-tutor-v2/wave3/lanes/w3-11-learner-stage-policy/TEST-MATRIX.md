# W3-11 validation matrix

The focused suite is
`adaptive-tutor/core/v3/learner-stage-policy/policy.test.ts`.

| Required scenario | Permanent evidence |
| --- | --- |
| Representative explicit profiles | Three Study-bound profiles resolve only by exact profile, stage, and approval references. |
| Deterministic profile differences | The same measured turn is rejected by two tighter explicit profiles and allowed by the configured larger profile. |
| Response-length bound | A measured count above the exact ceiling emits `RESPONSE_LENGTH_LIMIT_EXCEEDED`. |
| Step-count bound | A measured count above the exact ceiling emits `STEP_COUNT_LIMIT_EXCEEDED`. |
| Hint-depth bound | Closed ordered hint levels reject escalation above the selected ceiling. |
| Instructional-density bound | Closed ordered density levels reject density above the selected ceiling. |
| Visual-step complexity | Closed ordered complexity rejects excess, and modality/complexity inconsistencies reject the measurement. |
| Break policy | Disabled, too-early, cooldown, count-limit, and eligible cases are covered. |
| Multimodal allowance | Disallowed modalities, modality-count overflow, and duplicate modality measurements fail closed. |
| Parent-review threshold | Either threshold requires a Study route; a present request grants no Tutor contact authority. |
| Unknown stage policy | Unknown, malformed, and mismatched bindings return the reviewed static fallback with adaptive/provider execution disabled. |
| No age or implicit inference | Age, grade, prose, behavior, voice, appearance, emotion, personality, and diagnosis fields all invalidate the binding. |
| Provider/model override | Override fields in either binding or measured output fail closed and cannot change bounds. |
| Invalid registry inputs | Invalid fallback, duplicate profile reference, duplicate modalities, and incoherent visual allowance are rejected. |
| Boundary equality | A measured turn exactly at every inclusive upper bound is allowed. |
| Replay and mutation safety | Repeated evaluation is deeply equal, caller inputs are unchanged, and resolved profiles are defensive copies. |

The suite also asserts the closed authority declaration on resolved, allowed,
rejected, and static-fallback paths.
