# Manuel Academy — Adaptive Math Intervention Content v1

## Core v0.2 aligned release

Release `1.0.2` is the TUTOR-MATH-R1 subject-only correction derived from the
failed aligned candidate whose SHA-256 is
`665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`.
It targets the Director-frozen Tutor Core v0.2 without copying or modifying any
Core file. The new derived artifact is
`manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip`.

- `core-v0.2-adapter.ts` converts all four approved sequences to Core v0.2
  contract values.
- `runtime-v0.2.ts` preserves cross-session mastery evidence, prerequisite
  remediation, uncertainty, media/voice fallback, and adult review as
  subject-owned compatibility behavior.
- `scripts/verify-core-v0.2.mjs` validates emitted values against an extracted
  copy of the actual frozen Core package.
- `core-adapter.ts` is retained only as historical legacy evidence and is no
  longer exported from the package entry point.
- `standalone-demo/model.js` now provides the explicit adaptive phase and
  evidence model used by the no-build browser demonstration.
- `tests/standalone-demo-regression.test.mjs` covers phase progression,
  uncertainty preservation, feedback integrity, and per-item state isolation
  without adding a browser dependency.

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

The R1 freeze gate also runs `npm run validate:core-v0.2` against the extracted
frozen Core, then performs external real-browser and archive acceptance against
the sealed ZIP's clean extraction.

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
