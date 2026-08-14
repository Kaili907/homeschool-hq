# ELA Director Sample R1

Review target: `ma-g7-english-language-arts-u05-l03` — “Guided practice A: reasoning and warrants”

Status: **READY FOR DIRECTOR REVIEW**. Human quality, complexity, source-integrity,
accessibility, child-facing, and answer-leakage approval remain deliberately
recorded as `review.pending.ela-director-r1`; this sample does not claim Director
approval or production admission.

## Authority and scope

- Task base: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`
- Resolved and freshly fetched standard SHA:
  `3e723857352c992940eed682c2ad153fcf8f9eca`
- Standard subject: `origin/mac/ela-lesson-standard-r1`
- Canonical sample: `ma-g7-english-language-arts-u05-l03.lesson.json`
- Advisory schema: `../../ELA_LESSON_CONTRACT_R1.schema.json`

This directory adds one separately reviewable sample. It does not rewrite or
re-admit the existing ELA corpus, alter a production binding, or implement Tutor
V2. The `tutor_manifest` is curriculum metadata and evidence inventory only.

## What the sample demonstrates

- a learner-facing goal and contextual teaching of claim, evidence, and warrant;
- selective vocabulary support with meaning and use checks;
- separate model, guided, sustained independent, reteach, recheck, and fresh
  transfer texts;
- a visible reading think-aloud that notices evidence, weighs alternatives,
  rejects overclaiming, and qualifies a conclusion;
- embedded comprehension checks with observable, answer-protecting feedback;
- two guided attempts with partial-to-minimal support fading;
- a protected two-to-three-paragraph evidence-based analysis;
- content-neutral planning, drafting, and revision scaffolds that do not write
  the learner's response;
- a before/after meaning-level revision requirement;
- fresh independent transfer evidence with access support only; and
- diagnosis-specific reteach, a fresh independent recheck, and return to the
  grade-level transfer text.

The independent article is 645 words and retains sampling, cost, access,
mission, counterclaim, and qualification demands. Readability values in the
contract are advisory metrics; qualitative and reader-task review determine the
complexity judgment.

## Open the development-only preview

From the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Then open:

`http://127.0.0.1:5173/dev/ela-director-preview`

If port 5173 is already in use, add `--port 5174` and use the corresponding
URL. The route fails closed outside a development build. The browser projection
is generated from the canonical contract and excludes protected question keys,
source anchors, scoring reasoning, and adult rubrics.

## Verification

```sh
npm run ela:director-preview:build
npm run ela:director-preview:check
npm run typecheck
npm test -- --project root-app src/dev/elaDirectorPreviewRoute.test.ts
npm run build
```

Schema validation was run against JSON Schema Draft 2020-12 with Python
`jsonschema`. The production build was also inspected for the preview route,
copy, and protected authority; none were present.

## Director decisions requested

1. Is the independent/transfer text-task combination appropriately complex and
   feasible for Grade 7 in 50–70 minutes?
2. Does the model reveal authentic expert reasoning without handing the learner
   the protected response process or prose?
3. Do guided supports fade enough before independent evidence?
4. Are multiple defensible judgments handled fairly by the protected anchors
   and analytic distinctions?
5. Does the remediation route teach differently and return to legitimate
   grade-level transfer?
6. Should any part of this sample or the R1 standard change before a rollout or
   corpus-repair policy is considered?
