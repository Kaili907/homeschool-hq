# Frozen Core v0.2 Repository Alignment

The authoritative Tutor Math v1 and Tutor Core v0.2 ZIPs were verified by
SHA-256 before inspection. Correction was made only in the derived
`adaptive-tutor/subjects/math/**` tree.

## Frozen contracts honored

- `TutorProgramSchema`
- `AssessmentItemSchema`
- `TutorResponseSchema`
- `SpokenTurnSchema`
- `GuidedPracticeContractSchema`
- `IndependentMasteryContractSchema`
- `VisualBoardCommandSchema`
- `MediaFallbackSchema`
- `ParentTeacherReviewSchema`

The adapter is subject-owned and copies no Core source. The external verifier
loads the actual extracted frozen Core runtime and schemas.

## Intentional boundaries

- Stable subject IDs are content identifiers, not database keys.
- Grade 5 is directly included in the Core 4–6 band.
- No Core file, persistence, identity, authentication, RLS, storage,
  synchronization, Tutor Assembly, or deployment contract is changed.
- `core-adapter.ts` documents the pre-v0.2 legacy baseline only and is not
  exported by the aligned package entry point.
