# W3-R7 validation

## Commands

```sh
npx --yes --package typescript@5.8.3 tsc -p adaptive-tutor/tsconfig.json --noEmit --typeRoots "$CODEX_RUNTIME_NODE_MODULES/@types"
npx --yes --package typescript@5.8.3 tsc -p adaptive-tutor/tsconfig.test.json --typeRoots "$CODEX_RUNTIME_NODE_MODULES/@types"
node --test adaptive-tutor/.test-dist/core/v3/presentation/presentation.test.js
```

`$CODEX_RUNTIME_NODE_MODULES` denotes the environment-provided Node package
directory when the worktree has no local dependencies. A normal repository
checkout can use `npm --prefix adaptive-tutor run typecheck` and its installed
TypeScript toolchain instead.

## Covered cases

| Requirement | Assertion |
| --- | --- |
| text only | `reviewed-text` maps to only `reviewedTextRef` and `text` |
| visual only | `reviewed-visual` maps without manufactured text |
| text + visual | independent W3-06 text and image pieces remain present |
| diagram | diagram kind survives as a diagram piece |
| structured check | dedicated check reference and piece |
| caption semantics | caption is metadata with `instructionalText: false` and cannot stand alone |
| speech after acceptance | no speech piece before trusted acceptance; no audio after it |
| learner-stage denial | resolved modality allowance denies image deterministically |
| routing lacks modality | derived `REVIEWED_IMAGE` produces W3-01 `MULTIMODAL_MISMATCH` on text-only route |
| raw audio rejected | exact intent schema rejects audio payloads |
| raw image bytes rejected | exact intent schema rejects bytes and data URLs |
| unknown display mode rejected | unchanged W3-10 validator returns `malformed` |
| authority fields rejected | intent and commercial wrapper reject additional authority fields |

The focused suite also covers the closed refusal wrapper, grounding sidecar,
visual provenance binding, and non-lossy W3-06 piece order.
