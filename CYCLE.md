# CYCLE — H2 (Distractor-Integrity Fix)

**Session:** SESSION 1 (H2)
**Branch:** `h2-distractor-fix`  ·  **Worktree:** `../hq-h2`  ·  **Dev port:** 5187
**Base:** `master` @ 021aa46 (17 tags)

## Scope (claimed)
A hotfix cycle spun out of the MJ gate. The shared choice-builder
`genUtils.finishChoices` pads a short choice set with a **malformed** fallback
distractor `` `${correct}?${filler++}` `` when a generator's distractor pool
collapses below `count-1` unique values — producing user-facing options like
`(0, 0)?1` (caught by the HS fuzz `expect(c).not.toMatch(/\?\d+$/)`). This is a
**live, pre-existing** bug affecting **every** generator (littles' math too), not
just HS, and it is independent of MJ.

**Fix:** replace the `?N` pad with a genuinely distinct, **valid-form** distractor
derived by perturbing the actual answer (numNear/bigNear style), handling numeric
AND coordinate/fraction/labelled cases, never emitting the correct answer or a
duplicate. Make the generators **seedable** (an injectable RNG in `genUtils`)
enough to write a DETERMINISTIC regression for the `(0,0)?1` coordinate case and a
plain-number case — while leaving the existing unseeded fuzz coverage intact.

## Out of scope (do NOT touch)
`mj-hs-assistant` (holds at 6701aa9), `mp-parent-hub`, `missions.ts`, feature code.
This cycle is confined to `genUtils` (+ its new test); no generator logic changes
beyond routing randomness through the injectable RNG.

## Merge order (per operator)
**H2 merges first**, then MJ rebases over it, then MP.

## Rules
Claim-by-push (origin live). Own worktree. Functional writes where applicable.
Master auto-deploys — **no merge without authorization**. End at a report.
