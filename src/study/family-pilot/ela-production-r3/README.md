# ELA Production R3 — Harness

Build harness for the English Language Arts production rewrite, derived from the
Director-approved R2 freeze.

**Wave 1 is exactly one authored reference lesson**, awaiting Director review:
`ma-g3-english-language-arts-u07-l08`. Lesson content ships as `.lesson.json`
documents under `curriculum-production/final/english-language-arts/r3/lessons/`,
not as TypeScript. `registry.ts` stays empty and the gate asserts it; documents
are validated through `lessonDocument.ts`, which lifts them into the same
`ElaProductionLesson` record the validator checks.

Preview the reference lesson in the real player at
`/curriculum-preview/english-language-arts-r3`.

## What is here

| File | Role |
|---|---|
| `contract.ts` | The derived contract as machine constants, each citing its frozen source. |
| `CONTRACT.md` | The same contract in prose, clause by clause, with citations. |
| `OPEN-QUESTIONS.md` | The twelve production decisions the frozen R2 artifacts do not make. All UNDECIDED. |
| `buildElaProductionLesson.ts` | Structural assembler. Places author-supplied copy into the approved eighteen-section shape. Supplies no content of its own. |
| `validateElaProductionLesson.ts` | The gate. `error` = frozen contract requires it. `observation` = the approved samples happen to do it, but no frozen artifact rules it. |
| `registry.ts` | Authored lessons (currently none) plus the cross-lesson checks. |
| `manifest.json` | Machine-readable harness state. |
| `lessonDocument.ts` | Adapts an authored `.lesson.json` document into the record the validator checks, so the gate runs against the shipped artifact. |
| `harnessFixture.ts` | Structural test fixture. Contains no curriculum, is not exported from `index.ts`, and its lesson id cannot match a canonical corpus id. |
| `elaProductionR3.test.ts` | Derivation proof, harness behaviour, and authoring state. |

## Derivation, not reinterpretation

The gate re-derives the section plan, review titles, required response sequence,
page floor, and observed envelope directly from the nine frozen ELA samples and
fails if `contract.ts` disagrees with them. It reads the frozen artifacts; it
never writes to them.

Anything the frozen artifacts do not settle is recorded in `OPEN-QUESTIONS.md`
and left undecided. The validator's two severities exist for exactly that reason:
the harness will not quietly promote an observation into a rule.

## Run the gate

```bash
node scripts/curriculum/verify-ela-r3.mjs && npx vitest run --project root-app src/study/family-pilot/ela-production-r3 src/study/family-pilot/lesson-player/elaProductionR3.test.ts
```

## Questions answered by the approved Math R3 reference lesson

- **Q1** (where lessons live): `.lesson.json` documents under
  `curriculum-production/final/<subject>/r3/lessons/`, with a `productionMetadata`
  envelope around `learnerMaterial`.
- **Q10** (COURSE PROGRESS copy): a factual position statement,
  `Unit N, Lesson M of T in <unit title>.`, mirrored into
  `lessonReview.courseProgress`, with `lessonReview.nextAction` set to one of the
  four runtime enum values. Director-sample copy is forbidden and the verifier
  rejects it.

The remaining open questions stay UNDECIDED.

## Adding the next authored lesson

1. Write the `.lesson.json` document under the lesson document root.
2. Update `curriculum-production/final/english-language-arts/r3/manifest.json`
   and `authoredLessonDocuments` here.
3. Add a static import to the preview route so the Director can open it.
4. Run `node scripts/curriculum/verify-ela-r3.mjs` and the vitest gates.
