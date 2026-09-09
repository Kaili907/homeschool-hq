# W3-03 test matrix

| Boundary | Expected deterministic result |
| --- | --- |
| Every required ref uniquely resolves to exact reviewed context | Grounded / `sufficient` |
| No material claim requirements | Grounded / `sufficient` |
| Required material claim absent | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Unknown claim or content ref | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Unexpected known support ref | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Requirement, bundle, or item scope mismatch | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Stale or invalid context | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Digest mismatch | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Context not Study-reviewed | `INSUFFICIENT_GROUNDED_CONTEXT` |
| Provider adds review or confidence attestation | Malformed claim refusal |
| Provider adds numeric confidence | Malformed claim refusal |
| Exact grounded material during active assessment | Anti-answer refusal |
| Some claims grounded and some unsupported | Refused / `partial` |
| Reviewed, valid, in-scope static fallback | Returned by opaque ref and digest |
| Unreviewed, stale, wrong-kind, or cross-scope fallback | Never selected |
| Raw transcript or open bundle field | Malformed bundle refusal |
| Hostile reflection | Fail-closed refusal without throw |
| Math/language/science/humanities-shaped opaque fixtures | Identical subject-neutral rule |
