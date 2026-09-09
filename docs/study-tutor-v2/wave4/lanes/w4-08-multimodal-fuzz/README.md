# W4-08 multimodal fuzz certification

Session: `STUDY-TUTOR-V2-W4-08`

Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`

Default seed: `0x57430408`

Corpus SHA-256: `4ddd296b1452ebf88a2331f9edc09ca6410dc37944fa6d53e82ddf312772d35a`

The digest is over
`adaptive-tutor/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.ts`.

## Decision

`W4_MULTIMODAL_FUZZ_BLOCKER_FOUND`

The Wave 3 contracts preserve raw-media durability minimization and several
important exact-schema controls, but ten assertions in seven blocker families
remain red. The lane is not ready for convergence.

The final default-seed runner count is 15 cases: 5 passed and 10 failed. The
same count and blocker set reproduced with seeds `0x00000001` and
`0xffffffff`.

## What held

- Synthetic raw audio/image bytes, transcripts, captions, and instructional
  content did not enter durable evidence in 256 seeded projections.
- Empty, oversized, malformed-Unicode, data-URL-shaped, raw transcript,
  base64-like, unknown, authority, and video fields failed closed.
- Explicit active-assessment `reviewed-answer` exposure was rejected.
- Supported media failures required a nonblocking captioned fallback.
- Speech output required trusted acceptance and granted no raw-audio authority.
- Raw learner-image review requests rejected byte/base64/data-URL fields.

## Blocker families

1. Multimodal runtime validation accepts prototype-inherited presentation
   properties.
2. Active-assessment captions can contain answers or authority instructions
   without a reviewed-content binding.
3. Durable projection does not reconcile learner/session or cross-child media
   scope.
4. A syntactically valid but wrong reviewed-visual digest is durable.
5. Learner speech/raw-audio input is accepted without an input-support gate.
6. `raw-audio` accepts an `image/*` MIME type.
7. Duplicate fallback delivery channels bypass the declared `uniqueItems`
   contract.

The seed and minimized reproducer for every failing assertion are recorded in
`CAMPAIGN-EVIDENCE.json` and emitted directly by the test runner.

## Repair requirements

- Apply the existing plain-JSON exact-boundary inspection to multimodal policy
  and projection inputs; do not rely on `Value.Check` alone.
- Bind captions to reviewed accessibility metadata/content before policy
  acceptance. Keyword filtering is not an adequate repair.
- Provide the projection with trusted learner, session, visual-review, and
  digest expectations and reconcile the complete tuple before persistence.
- Split media descriptors by discriminator so MIME family and input/output
  direction are structural, with unsupported learner input denied.
- Enforce `uniqueItems` in the shared runtime validator or add an equivalent
  semantic check at every affected boundary.

After repair, rerun the default and both secondary seeds. Convergence requires
all 15 assertions to pass without weakening the five positive-control groups.
