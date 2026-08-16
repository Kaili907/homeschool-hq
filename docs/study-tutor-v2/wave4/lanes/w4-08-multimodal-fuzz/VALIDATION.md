# W4-08 validation

## Environment

- Branch: `mac/tutor-v2-w4-multimodal-fuzz-r1`
- Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- Date: `2026-08-16`
- Default seed: `0x57430408`
- Secondary seeds: `0x00000001`, `0xffffffff`
- Corpus source: `adaptive-tutor/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.ts`
- Corpus SHA-256: `4ddd296b1452ebf88a2331f9edc09ca6410dc37944fa6d53e82ddf312772d35a`

No camera, microphone, learner-media upload, TTS, STT, or media vendor was
used. All payload-shaped values were short synthetic test sentinels.

## Commands and results

TypeScript compilation:

```sh
npx --yes --package typescript@5.8.3 tsc \
  -p adaptive-tutor/adversarial/v4/multimodal-fuzz/tsconfig.json \
  --typeRoots "$CODEX_RUNTIME_NODE_MODULES/@types"
```

Result: `PASS` (exit `0`).

Focused default-seed campaign:

```sh
node --test \
  adaptive-tutor/adversarial/v4/multimodal-fuzz/.dist/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.js
```

Result: expected certification failure (exit `1`), 15 tests, 5 passed, 10
failed. Every failure printed seed `0x57430408` and its minimized reproducer.

The 15 top-level cases exercise 135 fixed/seeded malformed-reference inputs
and 256 raw-media minimization projections, for 391 generated corpus inputs in
addition to the fixed boundary attacks embedded in their cases.

Seed stability:

```sh
W4_MULTIMODAL_FUZZ_SEED=1 node --test \
  adaptive-tutor/adversarial/v4/multimodal-fuzz/.dist/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.js

W4_MULTIMODAL_FUZZ_SEED=4294967295 node --test \
  adaptive-tutor/adversarial/v4/multimodal-fuzz/.dist/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.js
```

Both secondary runs reproduced the same blocker set. The final expanded suite
has 5 passing and 10 failing assertions for each seed.

Wave 3 convergence baseline:

```sh
npx --yes --package typescript@5.8.3 tsc \
  -p adaptive-tutor/scripts/tutor-v3/tsconfig.json \
  --typeRoots "$CODEX_RUNTIME_NODE_MODULES/@types"

node --test \
  'adaptive-tutor/scripts/tutor-v3/.dist/tests/tutor-v3-convergence/*.test.js'
```

Result: `PASS`, 33 tests passed, 0 failed. This confirms the fuzz blockers are
newly exposed boundary gaps rather than a pre-existing red Wave 3 baseline.

Wave 3 presentation/multimodal regression:

```sh
node --test \
  '<temporary-output>/core/v3/presentation/presentation.test.js' \
  '<temporary-output>/core/v3/multimodal/multimodal.test.js'
```

The sources were compiled from the unchanged baseline into a temporary output
directory before execution. Result: `PASS`, 22 tests passed, 0 failed.

## Exact control results

- Raw-media minimization: 256/256 projections accepted while persisting no raw
  audio, learner image, transcript, caption, instructional content, byte, or
  base64 sentinel.
- Unsupported video: rejected.
- Speech after acceptance: a bare intent was rejected; the trusted accepted
  intent emitted speech with `rawAudioAuthorityGranted: false`.
- Fallback behavior: captioned nonblocking continuation validated; changing it
  to blocking was rejected.
- Active assessment: explicit `reviewed-answer` exposure was rejected, but an
  answer-bearing caption and an authority-bearing caption were both accepted.
- Cross-child/session: a foreign session reference and child-B visual/review
  references were both accepted into a child-A durable projection.
- Prototype/hostile objects: an inherited valid presentation and own
  `__proto__`/`constructor` keys were accepted.
- Wrong digest: a well-formed digest different from the accepted binding was
  accepted durably.
- Learner audio input: accepted without an explicit support gate.
- Media kind: `raw-audio` with `image/png` was accepted.
- Fallback uniqueness: duplicate `text` fallback channels were accepted.

## Final

`W4_MULTIMODAL_FUZZ_BLOCKER_FOUND`
