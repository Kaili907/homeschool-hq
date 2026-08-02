# Manuel Academy — Adaptive Math Intervention Content v1

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
