# Learner-stage Tutor policy

This module applies deterministic teaching-shape bounds selected by Study from
an explicit, trusted learner-stage profile binding. It never selects a profile
from learner prose, behavior, voice, appearance, age, grade, identity, emotion,
personality, or diagnosis.

Study owns profile approval, trusted binding construction, actual-turn
measurement, policy enforcement, parent routing, and reviewed static fallback.
Tutor and its provider receive no authority from a successful evaluation and
cannot override the selected bounds.

The eight bounded dimensions are response length, step count, hint depth,
instructional density, visual-step complexity, break-suggestion cadence,
multimodal allowance, and the Study parent-review routing threshold. Policy
outputs contain closed reason codes and references, never learner-facing prose
or psychological judgments.

Unknown, malformed, or mismatched stage bindings return the configured
`study-reviewed-static-stage-fallback`. This result disables adaptive Tutor and
provider invocation; it does not guess a nearby stage.

## Commercial catalog

`catalog.ts` commits the Study-approved commercial foundation catalog. It has
one explicit profile for each broad stage supported by W3-01: early elementary,
upper elementary, middle grades, and secondary. Each entry pins the catalog
version, profile reference, policy revision, approval, and every W3-11 bound.

`createCommercialLearnerStagePolicyCatalog()` accepts no profile or fallback
inputs. It constructs W3-11 from the committed entries and reviewed static
fallback only. Callers can inspect defensive copies but cannot install or
replace a commercial profile. Bindings must carry the exact current catalog
version, policy revision, and Study-supplied `learnerStageRef`.

The reviewed routing mapping converts each canonical `learnerStageRef` to the
matching W3-01 broad routing-stage literal. It is a routing input only. Nominal
grade, official working level, curriculum grade, and learner stage remain four
separate authorities, and no grade or working-level value is accepted by the
catalog binding.
