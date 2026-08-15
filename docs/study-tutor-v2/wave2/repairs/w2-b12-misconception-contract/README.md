# W2-B12 — Misconception contract and serialized semantic closure

## Finding

The lane registry and match contracts bounded `academicMisconceptionCode`, but
the independently declared Wave 2 decision projection used an unrestricted
`string`. A runtime-produced value was normally narrow while the serialized
decision schema still admitted arbitrary learner prose and strings longer than
the runtime JSON boundary. This was schema width, not authority to classify a
learner.

The adaptive orchestrator and generated schemas are outside this repair's
ownership and are intentionally unchanged.

## Repaired lane contract

`ReviewedAcademicMisconceptionCodeSchema` is the explicit reviewed
academic-code contract enforced at registry admission and serialized signal
review:

- maximum length is `96` in the schema itself;
- the namespace must begin with an allowlisted academic subject token;
- the remaining value is two to seven uppercase ASCII policy-code segments;
- spaces, paragraphs, Unicode text, diagnostic/emotional terms, and personality
  terms do not satisfy the schema; and
- a code is actionable only through a Study-reviewed registry entry.

The pre-existing `AcademicMisconceptionCodeSchema` wire shape remains unchanged
so the checked-in request schema does not drift in this ownership lane. Its
existing `maxLength: 96` continues to align runtime and generated request
validation; registry admission adds the stronger academic semantic check.

The exported `SerializedAcademicMisconceptionSignalSchema` is the owned contract
for R4 convergence. A `possible-misconception` serializes only:

- an opaque registry-bound `misconceptionRef`;
- the bounded `academicMisconceptionCode`; and
- literal non-authority controls.

Every other status serializes both the reference and code as `null`. It cannot
leave behind a durable learner classification when evidence is absent,
insufficient, or conflicting.

The registry's `reviewSerializedSignal` operation supplies semantic closure that
JSON Schema alone cannot express. It rejects a syntactically valid but unknown
`misconceptionRef` and rejects a known reference paired with a different code.
Only the exact reviewed registry pair is accepted.

## Preserved authority and safety

The contract remains an academic instructional signal only. It is a possible
signal, never a diagnosis. It carries no personality judgment or emotional
label, is non-authoritative for mastery and diagnosis, and cannot authorize a
durable learner classification. Study remains authority for evidence admission,
instruction, state, and persistence.

## Required R4 convergence

The R4 convergence lane should replace the local unrestricted
`MisconceptionProjectionSchema` in
`study-engine/tutor-v2/adaptive/contracts.ts` with the exported
`SerializedAcademicMisconceptionSignalSchema`. The decision mapper should emit
the reviewed `misconceptionRef` and bounded code only for
`possible-misconception`; all other statuses should emit both as `null`. It
should also carry `authoritativeMasteryState: false` so every preserved
non-authority claim is serialized.

R4 must regenerate the two existing Wave 2 schemas and add parity tests proving
that a 16,001-character code is rejected by both the runtime decision schema and
the generated decision schema. No additional public schema is required for this
lane-local contract.
