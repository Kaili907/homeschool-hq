# Manuel Academy — Adaptive Math Intervention Content v1

## Core v0.2 aligned release

Release `1.0.1` is a subject-only alignment derived from the unchanged Tutor
Math v1 artifact. It targets the Director-frozen Tutor Core v0.2 without
copying or modifying any Core file.

- `core-v0.2-adapter.ts` converts all four approved sequences to Core v0.2
  contract values.
- `runtime-v0.2.ts` preserves cross-session mastery evidence, prerequisite
  remediation, uncertainty, media/voice fallback, and adult review as
  subject-owned compatibility behavior.
- `scripts/verify-core-v0.2.mjs` validates emitted values against an extracted
  copy of the actual frozen Core package.
- `core-adapter.ts` is retained only as historical legacy evidence and is no
  longer exported from the package entry point.

Run the Core conformance gate with:

```text
node scripts/verify-core-v0.2.mjs --core-root <extracted-core-v0.2-adaptive-tutor>
```

This content-only package provides four complete adaptive mathematics intervention sequences for approximately grades 4–6:

1. Place Value and Regrouping
2. Multiplication and Division Relationships
3. Equivalent Fractions and Common Denominators
4. Multistep Word-Problem Reasoning

The package is designed for eventual placement under `adaptive-tutor/subjects/math/**`. It does not edit or depend on a modified shared tutor core, database, authentication, storage, progress synchronization, GitHub branch, deployment, or hosted service.

## Start here

- `manifest.json` and `manifest.ts` — ordered module metadata
- `types.ts` — subject-owned extensible contracts
- `core-adapter.ts` — provisional read-only compatibility adapter for the current Academy tutor shapes
- `lessons/**` — authoritative Markdown plus TypeScript/JSON content
- `fixtures/**` — assessment and misconception fixtures
- `standalone-demo/index.html` — no-build demonstration
- `scripts/validate.mjs` — automated content validation
- `validation-report.md` — actual validation results
- `completed-module-list.md` — completed sequence inventory
- `limitations.md` — shared-core and integration limitations
- `director-handoff.md` — integration handoff

## Validation

From this folder:

```bash
npm run check
```

No package installation is required for the included Node tests. TypeScript 5.8 or newer is required for `npm run typecheck`.

## Instructional commitments

- One question or step at a time.
- No immediate final-answer reveal.
- Learners explain reasoning.
- Incorrect answers are evidence for adaptation.
- No shame, ability labels, or medical diagnosis.
- No completion of graded homework.
- Mastery requires repeated evidence across representations and sessions.
- Media is optional; every sequence has a complete no-media fallback.
- No camera or identifiable child photo is required.
