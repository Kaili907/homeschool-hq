# Learner release browser E2E acceptance R1

## Status

`BLOCKED` — the immutable repair assembly builds and the corpus is browser-loadable,
but required learner controls and the browser assessment launch path are incomplete.
This is acceptance evidence only; it is not a deployment record and makes no deploy
claim.

## Immutable assembly

- Base: `c81ddb6e04bc1c3629212327d47817c1b5677477`
- Learner material projection: `51792ba67bcc3ec79d35fd55063870b21da82d82`
- Assessment materialization: `520ce571e7a3e9dc8c60699cfae5f22ee10d56e2`
- Response runtime: `f8406fca39c33ba08616ff8ff41a6a0452de47e4`
- Learner release quality gate: `c759e23263078567ee47a9ac7bd1d34c1e98e119`
- Mathematics repair: `c8f5a6b6b9b18317f96b5e2f92d453bde0f0b2b9`
- ELA repair: `d161efc876ad7563505897323f80fdb2cb11d5a4`
- Science repair: `dc2cee7fa16ea059218862d0dc42a2bee504269d`
- Social Studies repair: `9ab9860741566c2d02421fb36dc6c1eb0ddc9223`
- Health repair: `858fed9c55e49d03e6457cdf8bf3426dadbd1cd3`
- Physical Education repair: `1651f72f222c002a857506ac8537951a9a77e698`
- Technology repair: `2d43cd014046ad6190d3bb0f672e3313897d63fd`
- Arts/Music repair: `d78c4f39b6ff97eba830135068c01d21f0893f46`
- Financial Literacy security repair: `4350673d80284066918120157c994672f92c1c53`
- Ready for Life guardian attestation runtime: `94dc3418fde4d19c43c7c0e158e9b0268c8bda48`

The commits were applied without committing to a detached temporary worktree. Two
shared-generator conflicts (Health/PE and Technology/Arts) were reconciled only in
that temporary assembly. No production curriculum or application source was changed
in the acceptance branch.

## Commands

```sh
npm ci --ignore-scripts
npm run curriculum:build
npx playwright test --config playwright.learner-release.config.ts
npm run typecheck
```

The Playwright web server executes the real production Vite build and preview before
launching headless Chromium. The browser was also inspected through the in-app browser
against the production preview.

## Evidence

- Curriculum build: PASS — 90 courses, 698 units, 8,292 lessons, 699 assessments,
  and 8,292 production bindings.
- Browser lazy-load audit: PASS — no course payload was requested before setup; all
  90 course files were then fetched and parsed through browser `fetch`.
- Grade × subject smoke: PASS — all 90 manifest cells (9 grades × 10 subjects) loaded.
- Learner DTO audit: PASS — 8,292 lessons, bindings, and materials parsed; every
  material declared the learner projection DTO version and valid format.
- Assessment DTO audit: PASS — all 699 canonical learner packages parsed and paired
  one-to-one with 699 restricted adult-authority files.
- Learner DTO answer-leak audit: PASS — all 90 browser course bodies, persisted
  learner responses, and rendered DOM passed the forbidden-answer scan.
- Grade 3 Math choice/reload: PASS — an actual repaired question rendered, a radio
  choice submitted to `PENDING_ASSESSMENT`, and the minimized pending record plus
  study position survived reload.
- Static scoring adapter: PASS — both assignment and schedule origins launched; the
  returned score record contained only completion status and an opaque record ref.
- Dynamic Social Studies: PASS — the lesson blocked without adult source metadata,
  remained unlocked after an adult attachment and reload, and then rendered.
- Negative controls: PASS — a tampered manifest, injected answer material, and learner
  guardian self-certification were rejected.

## Blocking proof

1. The production response mapper found 3,881 answer-required items with noncanonical
   runtime values: `FIXED` (2,507), `OPEN` (96), `checklist-item` (789),
   `constructed-response` (9), `extended-response` (220), and `short-response` (260).
   No answer-required item mapped to `NONE`, but the vocabulary mismatch prevents the
   required controls from appearing.
2. Projected mapped counts contain no `NUMERIC`, `TEXT`, `RUBRIC_REVIEW_PENDING`, or
   `GUARDIAN_ATTESTATION` items. Choice and activity paths work; actual Grade 3 Math
   constructed-response reaches the repaired question but renders no `Your response`
   control, so it cannot submit.
3. Ready for Life reaches response-required work rendered as `Mark step complete`.
   The runtime correctly refuses to advance without evidence, producing a learner
   deadlock before guardian-pending. The adapter-level negative control confirms a
   learner cannot self-certify, but the browser guardian path is not end-to-end usable.
4. Production browser JavaScript contains answer-bearing identifiers and runtime
   material. The learner route loads `answerIndex` in the main bundle and
   `expectedAnswer` in the Family Pilot bundle. The complete production asset directory
   additionally contains `correctAnswer`. This violates the browser-file/network
   answer-leak negative control even though the public learner course DTOs are clean.
5. The production browser exposes no `Start assessment` or `Launch assessment` control
   from the assignment/schedule surface. The 699 assessment packages and restricted
   authorities exist in the production curriculum tree but are not exposed by the
   browser release payload.

The full result is `7 passed, 5 failed` in `playwright-results.json`. The five failures
are the assessment launch surface, browser artifact answer material, canonical response
vocabulary, Grade 3 constructed response control, and Ready for Life guardian-pending
progression.

`npm run typecheck` also reports an existing production recovery-test fixture mismatch:
`FamilyPilotRecoveryScreen.test.tsx` lacks the now-required assignment `completion`
field. The acceptance harness itself is not implicated by that diagnostic.

## Classification

`BLOCKED`
