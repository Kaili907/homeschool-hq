# W4-R2 validation

## Focused commands

From the repository root, using an available TypeScript 5.8 runtime:

```sh
tsc -p adaptive-tutor/tsconfig.json --noEmit
tsc -p adaptive-tutor/tsconfig.test.json
node --test \
  adaptive-tutor/.test-dist/core/v3/multimodal/multimodal.test.js \
  adaptive-tutor/.test-dist/core/v3/presentation/presentation.test.js \
  adaptive-tutor/.test-dist/tests/wave4-repairs/multimodal-boundary/seeded-adversarial.test.js
```

Focused result on 2026-08-16: **PASS, 30/30 tests**.

The compiled Wave 3 convergence suite excluding schema parity also passed
**28/28 tests**. The canonical schema check reports only:

```text
Wave 3 schema drift detected: durable-multimodal-evidence.schema.json
```

That drift is the expected reconvergence signal for the serialized durable
schema change. Global generated schemas and release evidence are intentionally
outside this repair's ownership; use the regeneration command documented in
`README.md` during convergence.

## Seeded regression inventory

The deterministic corpus at
`adaptive-tutor/tests/wave4-repairs/multimodal-boundary/seeded-adversarial.test.ts`
uses seed `67682526` and includes minimized reproducers for:

- `__proto__`, `constructor`, `prototype`, inherited pollution, getter traps,
  nested hostile objects, and unknown properties;
- active-assessment answer-bearing caption canaries;
- sibling learner/session presentation and reviewed-media references;
- well-formed wrong SHA-256 digests;
- missing, wrong-scope, and wrong-media learner audio-input capability;
- audio/image and diagram/MIME confusion;
- duplicate and noncanonical fallback channels; and
- malformed Unicode, empty, oversized, spaced, and raw-like references.

The existing focused suites continue to prove reference-only pieces, speech
only after trusted acceptance, mandatory captions, transient raw media,
inference prohibitions, nonblocking fallback, and durable content
minimization.
