# W4-08 multimodal boundary fuzz campaign

Session: `STUDY-TUTOR-V2-W4-08`

This directory is a deterministic, provider-free adversarial campaign over the
Wave 3 multimodal, canonical presentation, and durable evidence contracts. It
does not access a camera or microphone, upload learner media, or invoke TTS,
STT, rendering, or other vendor services. Byte-like values are synthetic
sentinels held only in test memory.

## Determinism

The default seed is `0x57430408`. Override it with
`W4_MULTIMODAL_FUZZ_SEED=<uint32>`. The generator is a local xorshift32 PRNG,
so the corpus has no clock, network, provider, or platform entropy.

Each invariant assertion includes:

- the seed;
- the attack name; and
- a minimized field-level reproducer.

The default campaign generates 128 seeded malformed-reference mutations in
addition to fixed empty, oversized, malformed-Unicode, and payload-shaped
references. It also runs 256 durable projections with unique raw-media,
transcript, and caption sentinels across text, reviewed-image, and
reviewed-diagram modes.

Corpus identity:

- source: `seeded-fuzz.test.ts`;
- SHA-256: `4ddd296b1452ebf88a2331f9edc09ca6410dc37944fa6d53e82ddf312772d35a`;
- top-level certification cases: 15; and
- generated malformed-reference inputs plus durable projections: 391.

## Run

From the repository root:

```sh
npx --yes --package typescript@5.8.3 tsc \
  -p adaptive-tutor/adversarial/v4/multimodal-fuzz/tsconfig.json \
  --typeRoots "$CODEX_RUNTIME_NODE_MODULES/@types"

node --test \
  adaptive-tutor/adversarial/v4/multimodal-fuzz/.dist/adversarial/v4/multimodal-fuzz/seeded-fuzz.test.js
```

`$CODEX_RUNTIME_NODE_MODULES` is the environment-provided Node package root.
A checkout with local dependencies can omit the `--typeRoots` override.

The runner is intentionally red while recorded invariant failures remain
unrepaired. A green result is required before this lane can emit
`W4_MULTIMODAL_FUZZ_READY_FOR_CONVERGENCE`.

## Covered boundaries

- reviewed image and diagram references, digests, provenance, and scope;
- accessibility caption references and transient caption text;
- MIME/media-kind metadata;
- presentation fallbacks and duplicate values;
- speech-after-acceptance gating;
- unsupported video and learner audio input;
- active-assessment disclosure across modalities; and
- whitelist projection into durable multimodal evidence.

Unknown fields, prototype-shaped objects, raw transcript fields, raw
bytes/base64/data-URL-like values, malformed Unicode, empty/oversized
references, and cross-child references are included.
