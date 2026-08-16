# W3-R5 validation matrix

The permanent focused suite is
`adaptive-tutor/core/v3/learner-stage-policy/catalog.test.ts`. It runs alongside
W3-11's `policy.test.ts`.

| Requirement | Permanent evidence |
| --- | --- |
| Every catalog entry validates | Every committed entry passes the exact catalog schema and W3-11 semantic registry validation, with all metadata and bounds asserted. |
| Every supported stage resolves | All four canonical learner-stage refs resolve to the pinned profile and W3-11 policy profile. |
| Unknown stage fails | An unapproved opaque stage ref returns reviewed static fallback with adaptive Tutor and provider invocation disabled. |
| Revision mismatch fails | Catalog-version and policy-revision mismatches produce distinct closed fallback reasons. |
| Grade is not learner stage | Nominal and generic grade fields invalidate the exact binding and never influence resolution. |
| Working level is not learner stage | Official and generic working-level fields invalidate the exact binding. |
| Curriculum grade is not learner stage | Curriculum-grade input invalidates the exact binding and cannot change the trusted stage. |
| No implicit inference | Learner prose, voice, image, and behavior fields invalidate the binding. |
| Provider cannot override | Provider profile, revision, bound, and routing-class fields invalidate the binding; the canonical early-elementary bound remains 60 words. |
| Deterministic routing mapping | Mapping completeness, uniqueness, exact W3-01 literals, replay equality, and per-stage resolution are asserted. |
| W3-11 enforcement | Commercial evaluation of a 61-word early-elementary turn rejects on the committed 60-word limit. |
| Catalog cannot be mutated | Profile lists are defensive copies; caller mutation does not alter later commercial resolution. |

The assembled W3-11 suite continues to cover every policy dimension, exact
boundary equality, fallback semantics, authority declarations, and replay
stability.
