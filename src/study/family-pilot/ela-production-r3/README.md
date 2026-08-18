# ELA Production R3 — Harness

Build harness for the English Language Arts production rewrite, derived from the
Director-approved R2 freeze.

**This harness contains zero authored lesson content, by instruction.** Authoring
is deliberately blocked until the Mathematics reference lesson has been reviewed
in the real player and the house style is confirmed; writing ELA lessons before
that risks a whole grade band in a style that is then rejected.
`registry.ts` is empty and the gate asserts it.

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
npx vitest run --project root-app src/study/family-pilot/ela-production-r3
```

## Adding the first authored lesson

1. Answer the open questions that block it — at minimum Q1 (where lessons live)
   and Q10 (COURSE PROGRESS copy).
2. Build the lesson with `buildElaProductionLesson`.
3. Add it to `ELA_PRODUCTION_R3_LESSONS` in `registry.ts`.
4. Update `authoredLessonCount` in `manifest.json`.
5. Run the gate. It validates the new lesson automatically.
