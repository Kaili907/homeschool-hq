# W2-B10 adaptive admission scope binding repair

The adaptive admission boundary now treats Study capability metadata as an
authorization envelope for one exact Study invocation scope. The envelope and
the admission request both require these opaque references:

- `householdScopeRef`
- `learnerScopeRef`
- `sessionRef`
- `instructionalContextRef`

The capability definitions inside `capabilities` remain generic. Scope binds
the Study-issued envelope that permits those definitions to be used, not the
definitions themselves.

Both closed contracts advance to v2. Missing, malformed, legacy-version, or
extra fields fail closed as `insufficient-capability-metadata`. A valid v2
request whose required Study scope differs from the envelope is refused as
`scope-binding-mismatch`. An admitted decision repeats the four opaque scope
bindings so downstream code can retain the authorization provenance without
learner names or prose.

## Exact R4 adapter changes required

R4 must make the following changes outside this repair's ownership. The
adaptive orchestrator was intentionally not modified here.

1. In `adaptive-tutor/study-engine/tutor-v2/adaptive/orchestrator.ts`, extend
   `compositionBindingsAreValid` to require each capability-metadata scope
   field to equal the corresponding field on `request.studyAuthority`:
   `householdScopeRef`, `learnerScopeRef`, `sessionRef`, and
   `instructionalContextRef`.
2. In `admissionsFor`, emit request version
   `study-tutor-v2.adaptive-admission.v2` and populate those same four request
   fields directly from `request.studyAuthority`. Do not copy them from
   `capabilityMetadata`, and do not derive any field from grade, learner prose,
   misconception evidence, mastery evidence, or diagnostic data.
3. Update the Study-side capability-envelope producer to emit metadata version
   `study-tutor-v2.adaptive-capabilities.v2` and copy the four opaque references
   from the same trusted `Wave2StudyAuthority` used for the invocation. The
   envelope must be reissued when any one of those bindings changes.
4. In `adaptive-tutor/tests/tutor-v2-convergence/wave2-fixtures.ts`, update the
   capability metadata to v2 and add all four bindings from the fixture's Study
   authority. Add convergence reproductions for learner, household, session,
   and instructional-context mismatch, plus an exact-scope admitted path.
5. Regenerate and check
   `adaptive-tutor/json-schema/v2/wave2/wave2-adaptive-composition-request.schema.json`
   and `adaptive-tutor/json-schema/v2/wave2/SCHEMA-INVENTORY.json`, then refresh
   R4 release evidence through the normal convergence workflow.

R4 must not weaken the v2 fields to optional compatibility aliases or accept a
v1 unscoped envelope. That would restore the cross-learner/session reuse this
repair closes.

## Privacy boundary

Only opaque references are accepted. The schemas remain closed and carry no
learner name, raw learner prose, inferred grade, diagnostic data, or durable
learner classification.
