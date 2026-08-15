# W2-B13 completed-review permission replay repair

The hint selector no longer treats a boolean or a reusable privacy reference as
authority to provide hints during completed-assessment review. Authorization is
a closed, versioned union:

- `{ status: "not-authorized" }`; or
- a Study-issued `authorized` permission with an opaque permission reference,
  exact learner/session/instructional-context/opportunity/review-event scope,
  the current review-policy revision, and an explicit nullable privacy approval
  reference.

The authorized variant requires permission version
`study-tutor-v2.completed-assessment-review-permission.v1`, permission kind
`study-completed-assessment-review-permission`, and issuer `study`. Unknown
versions or kinds, provider-shaped issuers, missing references, extra fields,
and the former `completedAssessmentReviewAllowed` boolean fail closed as
`INVALID_HINT_STATE`.

For a completed review, the selector requires trusted
`currentReviewEventRef` and `currentReviewPolicyRevisionRef` values on the
current hint-selection request. It then compares every permission scope field
with the current request. Any well-formed but out-of-scope or stale permission
produces `completed-review-not-authorized`; it is never silently promoted or
partially accepted. Replaying the identical request is deterministic.

The authorization is consulted only for `completed-assessment-review`.
Instruction/practice and non-graded review continue through normal hint policy
with the `not-authorized` variant and null current-review references. The active
graded or mastery assessment structural block is evaluated before completed
review authorization and still returns `active-assessment-structural-block`
for an otherwise exact permission.

## Exact R4 adapter changes required

R4 must perform these out-of-scope composition changes. The adaptive
orchestrator and convergence fixtures were intentionally not modified here.

1. Extend the trusted Wave 2 Study authority with a nullable opaque current
   completed-review policy revision reference. For a completed review it must
   be non-null and come from Study's current review policy, not from Tutor,
   provider output, the nested hint permission, privacy metadata, or replayed
   client state. Bump the composition contract version if required by the R4
   schema policy.
2. In `compositionBindingsAreValid`, require the hint request's existing
   learner, session, context, opportunity, assessment phase, and ceiling
   bindings as today. Additionally:
   - for `completed-assessment-review`, require
     `hintSelection.currentReviewEventRef === studyAuthority.eventRef` and
     require `hintSelection.currentReviewPolicyRevisionRef` to equal the new
     non-null Study-authority policy revision;
   - when `reviewPermission.status === "authorized"`, require all permission
     learner/session/context/opportunity/review-event/policy bindings to equal
     those trusted Study-authority values; and
   - never synthesize authorization from a boolean, `permissionRef`, or
     `privacyApprovalRef` alone.
3. Have the Study-side adapter populate `reviewPermission` directly from
   Study-issued completed-review authorization metadata. Emit only
   `{ status: "not-authorized" }` when no exact permission exists. Do not let
   Tutor or a provider choose `status`, issuer, permission scope, or policy
   revision.
4. Update `tests/tutor-v2-convergence/wave2-fixtures.ts`. Its ordinary
   instruction fixture must add `currentReviewEventRef: null`,
   `currentReviewPolicyRevisionRef: null`, and
   `reviewPermission: { status: "not-authorized" }`. Add a completed-review
   fixture whose current review event is the Study authority event and whose
   policy revision comes from the new Study-authority field.
5. Add convergence attacks for replay across review event, opportunity,
   learner, session, and instructional context; copied privacy and permission
   references; stale policy revision; legacy boolean authority; provider-shaped
   permission; and active assessment with an otherwise exact permission.
6. Regenerate/check the Wave 2 composition JSON schema and inventory, then
   refresh R4 release evidence through the normal convergence workflow.

R4 must not make the new fields optional compatibility aliases or accept the
legacy boolean form. Either change would restore the replay vulnerability.

`EXPECTED_R4_COMPLETED_REVIEW_PERMISSION_ADAPTER_REQUIRED`
