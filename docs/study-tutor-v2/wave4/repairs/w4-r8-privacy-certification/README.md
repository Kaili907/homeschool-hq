# W4-R8 current privacy certification repair

Session: `STUDY-TUTOR-V2-W4-R8`

Starting SHA: `27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76`

## Ruling

`STALE_CERTIFICATION_FIXTURE`

The post-R2/R5 product accepts a legitimate current durable multimodal
projection. The W4-07 executable certification was stale: its presentation
lacked the trusted commercial and presentation context now required by the
current contract. Other W4 repairs had likewise advanced the telemetry,
memory/recovery, and Parent-report fixtures.

No product implementation changed. The original W4-07 historical report is
unchanged; this repair establishes current post-R2/R5 certification.

## Current legitimate projection

The accepted source supplies one exact trusted tuple across the presentation,
commercial execution scope, Study advisory, caption binding, and reviewed
visual binding:

- commercial scope: `commercial-scope:w4-privacy`
- household: `household-scope:w4-privacy`
- learner: `learner-scope:w4-privacy`
- session: `session:w4-privacy`
- interaction: `interaction:w4-privacy`
- logical operation: `logical-operation:w4-privacy`
- concept: `concept:w4-privacy`
- opportunity: `opportunity:w4-privacy`
- presentation: `presentation:w4-privacy`
- reviewed content: `reviewed-content:w4-privacy-image`
- digest: `sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
- kind/MIME: `image` / `image/png`
- review: `review:w4-privacy-image`, status `approved`, learner-safe
- provenance: `provenance:w4-privacy-image`, status `approved-content`
- caption: exact neutral trusted binding at `caption:w4-privacy`

The durable projection is accepted and contains the canonical lineage and
reviewed visual metadata. It sets `transcriptPersisted` and
`rawMediaPersisted` to `false` and contains none of the transient bytes or
text.

## Privacy campaign

The current executable retains all 14 synthetic categories and direct,
case-normalized, URL-encoded, base64, and hex scanning. It scans 41 current
surfaces: 12 live certification outputs, 11 Wave 3 release JSON files, 17 Wave
4 release JSON files, and the Wave 3 mutation campaign evidence.

Result: zero direct, normalized, or encoded leaks. All six provider-policy
attacks fail closed with zero provider calls. All nine current serialized
unknown-field mutations reject.

The exported `runPrivacyDetectorNegativeControl` creates a disposable durable
projection mutant retaining the raw-transcript canary. The normal direct
canary detector deterministically throws, and the control records `DETECTED`.

Final classification:
`W4_PRIVACY_CERTIFICATION_REPAIR_READY_FOR_RECONVERGENCE`.
