# W3-B2 Serialized Boundary Completion

W3-14 originally counted eight Wave 3 serialized boundaries. The corrected
count is ten because two current durable/recoverable contracts were omitted
from schema generation:

1. `DurableMultimodalEvidence` is persisted after a whitelist projection. Its
   canonical runtime schema contains references and reviewed/minimized outcome
   metadata only. It is closed against raw audio, raw image bytes, video, raw
   transcripts, biometric identity, and emotion/personality/diagnostic
   inference.
2. `MinimizedAcceptedStudyEffectEvent` is durably retained for accepted-effect
   and instructional-memory reconciliation. Its canonical recovery schema
   excludes raw provider responses, Tutor transcripts, learner answers, and
   Study authority widening.

Both schemas are generated directly from their canonical runtime TypeBox
schemas. `PresentationIntent` remains a trusted internal contract represented
only as a closed nested member of existing boundary schemas. Commercial
provider transport and raw multimodal inputs remain ephemeral/transient.
Provider and curriculum adapters remain future production boundaries. No
internal port receives a standalone generated schema.

## Boundary inventory

The ten current serialized boundaries are:

1. `StudyCommercialTutorInvocation`
2. `BoundedCommercialProviderRequest`
3. `BoundedCommercialProviderResponse`
4. `StudyCommercialTutorAdvisory`
5. `StudyCommercialEffectReceipt`
6. `CommercialOperationTelemetryEvent`
7. `ParentReport`
8. `InstructionalMemoryDelta`
9. `DurableMultimodalEvidence`
10. `MinimizedAcceptedStudyEffectEvent`

The machine-readable rationale and non-boundary classifications are in
`docs/study-tutor-v2/wave3/SERIALIZED-BOUNDARY-INVENTORY.json`.

## Reconvergence handoff

This repair intentionally does not regenerate the complete Wave 3 release
bundle. The later reconvergence lane must:

1. regenerate the release schema inventory from the corrected generated set;
2. update Wave 3 `STATUS` and known-limitations text to remove the
   under-generation blocker;
3. update release checksums for all changed release artifacts; and
4. replace the release's exact schema count from `8` to `10` while preserving
   the internal-port count of `0`.
