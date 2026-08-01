# Core v0.2 Mapping

The English package directly imports and validates against the shared Core v0.2 schemas. No schema is copied into this package.

Direct mappings include `TutorProgramSchema`, `AssessmentItemSchema`, `TutorResponseSchema`, `SpokenTurnSchema`, `VisualBoardCommandSchema`, `GuidedPracticeContractSchema`, `IndependentMasteryContractSchema`, `MediaFallbackSchema`, and the shared narration/caption/transcript schema.

## Subject-owned provisional adapter

`src/adapters/english-core-v02-extension.ts` validates English metadata that Core v0.2 does not model as first-class fields:

- learner-facing labels for Show Me, Talk Me Through It, Let’s Do One Together, and Different Example;
- links from distinguishing probes to Core item IDs and evidence tags;
- prerequisite-remediation directions linked to Core skill IDs;
- parent/teacher coaching notes;
- delayed answer reasoning linked to Core item IDs;
- learner-authorship and graded-assignment boundaries;
- serialized WebVTT derived from Core caption cues.

The adapter points to valid Core objects and stable IDs. It does not replace the Core engine or contracts.

The generated validation report contains the authoritative classification of every integration area. There are no `BLOCKED_CORE_CHANGE` or `NOT_TESTED` areas and no Core-change request.
