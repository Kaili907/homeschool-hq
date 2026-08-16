# W4-R2 multimodal and presentation boundary repair

Session: `STUDY-TUTOR-V2-W4-R2`

Stable adversarial seed: `67682526` (`0x0408c0de`)

## Boundary ruling

Presentation and multimodal acceptance are now two-input trust decisions. The
learner-facing candidate is safely validated and snapshotted, then reconciled
against a separately supplied trusted Study boundary. A syntactically valid
candidate does not approve its own references, scope, digest, provenance,
caption, or input capability.

The repair remains reference-only at presentation output. It adds no
provider-authored prose, Tutor authority, Study authority, commercial routing,
commercial execution, or Parent-reporting behavior.

## Closed failures

1. Presentation validation rejects custom prototypes, reserved keys, accessors,
   nested hostile objects, and unknown fields before semantic property reads.
   Accepted values are immutable data-property-only snapshots.
2. Active protected assessment captions must exactly match the trusted neutral
   accessibility binding. Answer, expected-answer, choice, solution-step, and
   workaround canaries cannot be substituted under the same caption reference.
3. Trusted presentation and media boundaries bind household, learner, session,
   interaction, and opportunity lineage. Sibling-child/session acceptance and
   W4-03 cross-child reference influence fail closed.
4. Reviewed visual acceptance reconciles the exact content reference, media
   kind, SHA-256 digest, review reference, approved provenance, review time, and
   learner-safe status against the trusted binding.
5. Learner raw-audio input requires an explicit trusted capability for the
   exact lineage and media reference. Absence, unknown capability data, speech
   output, caption support, and presentation allowance do not imply input
   permission.
6. Raw-audio descriptors require `audio/*`; raw learner images require
   `image/*`; reviewed images use supported raster image MIME types; reviewed
   diagrams require `image/svg+xml`.
7. Fallback channels accept only canonical `[text]`, `[visual]`, or
   `[text, visual]` order. Duplicates and reversed order are rejected.

## Durable minimization

Durable evidence remains a whitelist projection. No raw audio, image bytes,
video, transcript text, caption text, biometric data, face identity,
emotion/personality inference, or diagnosis is serialized. The durable record
now includes the trusted household, learner, session, interaction, and
opportunity lineage plus exact reviewed-media MIME and provenance metadata.

## Schema convergence note

`PresentationIntentSchema` did not change. `DurableMultimodalEvidenceSchema`
changed and `MULTIMODAL_CONTRACT_VERSION` advanced from
`3.0.0-foundation.1` to `3.0.0-foundation.2`.

At reconvergence, regenerate only the normal Wave 3 schema outputs with:

```sh
npm --prefix adaptive-tutor run tutor-v3:schema
```

This updates
`adaptive-tutor/json-schema/v3/wave3/durable-multimodal-evidence.schema.json`
and the Wave 3 schema inventory/checksum through the canonical generator. This
repair intentionally does not update global release evidence or release
artifacts.
