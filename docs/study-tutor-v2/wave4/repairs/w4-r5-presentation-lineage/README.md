# W4-R5 presentation acceptance commercial lineage repair

Session: `STUDY-TUTOR-V2-W4-R5`

## Boundary ruling

Presentation acceptance now requires four independently validated inputs: the
candidate Study acceptance, the trusted presentation boundary, the exact R1
`CommercialExecutionScope`, and the Study commercial advisory produced under
that scope. A presentation cannot authorize itself by repeating valid learner,
session, content, or media references.

The existing presentation lineage is a projection of—not a replacement for—the
R1 scope. It carries and reconciles:

- `commercialExecutionScopeRef` against `CommercialExecutionScope.scopeRef`;
- household, learner, session, and interaction;
- logical operation, concept, and opportunity; and
- the canonical presentation reference.

The Study advisory must match the same scope tuple, learner stage, reviewed
content references, and exact `PresentationIntent`. The intent's fallback
presentation reference must also equal the R1 scope's `presentationRef`.
Missing, malformed, stale, sibling, or forged authority fails before W3-06
pieces are produced.

## Multimodal and durable lineage

The trusted multimodal policy context now contains the exact R1 commercial
scope and its Study advisory. Caption and reviewed visual acceptance remain
exact binding decisions, while the policy also reconciles the commercial
scope reference, logical operation, concept, opportunity, and presentation.

`DurableMultimodalEvidence` persists only the minimized canonical projection:
commercial scope reference, household, learner, session, interaction, logical
operation, concept, opportunity, and presentation reference. Raw media,
transcript text, caption text, and provider-authored data remain excluded.

## Authority and assessment

Provider-facing `PresentationIntent` and the commercial provider request do
not gain scope fields. Unknown provider scope data is rejected. The trusted R1
scope and Study advisory are supplied only at the Study-owned acceptance seam.

During active assessment, a foreign caption remains blocked as answer-bearing
metadata and a foreign reviewed image or diagram remains rejected by exact
reference, digest, kind, provenance, and commercial lineage. Scope
substitution cannot reopen instructional help.

## Schema convergence

`PresentationIntentSchema` and the commercial model-response wrapper are
unchanged. Internal accepted-presentation, presentation-boundary, W3-06,
multimodal-policy-context, and binding schemas gain canonical lineage.
`DurableMultimodalEvidenceSchema` gains durable canonical lineage fields, so
`MULTIMODAL_CONTRACT_VERSION` advances from `3.0.0-foundation.2` to
`3.0.0-foundation.3`.

At Wave 3/4 reconvergence, run the canonical schema generator:

```sh
npm --prefix adaptive-tutor run tutor-v3:schema
```

The assembled R1 baseline already has pending
`study-commercial-tutor-advisory.schema.json` drift, and this repair also
requires regeneration of
`durable-multimodal-evidence.schema.json` plus the canonical schema inventory
and checksum. This branch intentionally does not regenerate global schemas,
release evidence, or release artifacts.
