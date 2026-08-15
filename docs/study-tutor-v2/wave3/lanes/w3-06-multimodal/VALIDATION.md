# W3-06 validation

Run from the repository root:

```sh
npx tsc -p adaptive-tutor/core/v3/multimodal/tsconfig.json
node --test adaptive-tutor/core/v3/multimodal/.dist/v3/multimodal/multimodal.test.js
```

Validated on 2026-08-15 with TypeScript 5.8.3 and Node 22.23.2: **PASS,
9/9 tests**.

The focused suite covers the full mode vocabulary, mandatory captions,
transient-only media and transcripts, prohibited inference categories,
approved-only visual references, modality-independent active-assessment
anti-answer handling, nonblocking failure fallback, and durable minimization.

The minimization proof injects sentinel content into raw audio, raw learner
image, transcript, caption, and transient state fields. It asserts none of the
sentinels or source field names occur in serialized durable evidence. Separate
negative cases prove the closed durable schema rejects raw fields and the
projection rejects raw-payload-shaped values smuggled into reference fields.
