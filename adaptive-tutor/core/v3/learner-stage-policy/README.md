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
