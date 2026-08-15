# W2-B14 completed-review privacy binding repair

The completed-assessment review permission carries a nullable
`privacyApprovalRef`. That permission value is now reconciled against a
separate trusted value on `HintSelectionRequest`:
`currentReviewPrivacyApprovalRef: OpaqueReference | null`.

For `completed-assessment-review`, authorization requires exact equality across
the permission's learner, session, instructional context, opportunity, review
event, review-policy revision, and privacy-approval bindings. Privacy equality
uses opaque-reference identity only: the selector does not normalize values or
compare substrings or prefixes. The nullable cases are therefore:

| Permission `privacyApprovalRef` | Current review binding | Result |
| --- | --- | --- |
| exact non-null ref | same non-null ref | privacy dimension matches |
| non-null ref | null | `completed-review-not-authorized` |
| null | non-null ref | `completed-review-not-authorized` |
| different non-null ref | non-null ref | `completed-review-not-authorized` |
| null | null | privacy dimension matches |

This does not make privacy approval universally non-null. It binds the value
when Study represents it in the permission. Ordinary instruction, practice,
and non-graded review do not consult completed-review authorization. Active
graded or mastery assessment remains structurally blocked before completed
review authorization is considered.

## Exact R5 adapter work required

R5 owns the adaptive composition adapter, fixtures, generated Wave 2 schema,
convergence gates, and release artifacts. It must perform all of the following:

1. Add `currentReviewPrivacyApprovalRef: OpaqueReference | null` to
   `Wave2StudyAuthoritySchema` in
   `study-engine/tutor-v2/adaptive/contracts.ts`. It must be separate from
   `hintSelection.reviewPermission.privacyApprovalRef`.
2. Populate `hintSelection.currentReviewPrivacyApprovalRef` from that trusted
   Study-authority value. Do not derive it from the nested permission, provider
   output, a permission reference, privacy metadata, or replayed client state.
3. For ordinary instruction/practice and the existing ordinary composition
   fixture, include the required field explicitly and set it to `null` when no
   current completed-review privacy approval applies.
4. In the completed-review fixture, set the trusted current value and
   `hintSelection.currentReviewPrivacyApprovalRef` to the same nullable value.
   If the Study-issued permission is authorized, populate its
   `privacyApprovalRef` independently from Study-issued permission metadata and
   require it to equal that current value. Both may be null.
5. Extend `compositionBindingsAreValid` in
   `study-engine/tutor-v2/adaptive/orchestrator.ts` so the hint current privacy
   value exactly equals `studyAuthority.currentReviewPrivacyApprovalRef`, and
   an authorized permission's privacy value exactly equals it as well. Fail
   closed on every mismatch; do not add aliases, normalization, substring, or
   prefix matching.
6. Add convergence attacks for changed-only permission privacy, non-null/null,
   null/non-null, different non-null refs (including prefix-similar refs), and
   active assessment with an otherwise exact permission. Preserve the existing
   learner/session/context/opportunity/review-event/policy replay attacks,
   legacy-boolean rejection, deterministic replay, and ordinary-instruction
   behavior.
7. Regenerate and check the Wave 2 composition request schema and inventory,
   then refresh convergence and release evidence through the R5 workflow. Do
   not hand-edit generated artifacts to simulate adapter support.

`EXPECTED_R5_REVIEW_PRIVACY_BINDING_ADAPTER_REQUIRED`
