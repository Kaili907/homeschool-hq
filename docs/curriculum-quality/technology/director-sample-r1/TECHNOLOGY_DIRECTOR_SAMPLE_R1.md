# Technology Director Sample R1

## Review status

`TECHNOLOGY_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This is one development-only lesson and browser preview for Director review. It is not a Technology standard approval, curriculum-wide rewrite, production deployment, or continuation of the Tutor V2 validator-hardening work.

## Authoritative inputs

| Input | Authority |
| --- | --- |
| Pinned base | `a7c6edee867e0d3f546aaa6e0442fac434b75c84` |
| Technology Lesson Standard R1 | `origin/mac/technology-lesson-standard-r1` at `9365bc26` |
| Lesson | `ma-g10-technology-u02-l05` |
| Learner package | `curriculum-production/student-work/technology-arts-lessons/packages/technology/grade-10/ma-g10-technology-u02-l05.task-package.json` |
| Restricted adult authority | `curriculum-production/student-work/technology-arts-lessons/scoring-guides/technology/grade-10/ma-g10-technology-u02-l05.scoring-guide.json` |
| Advisory metadata | `ma-g10-technology-u02-l05.advisory-contract.json` |

## Learner sequence

1. Explicitly teach algorithm specifications, loop invariants, correctness, the debugging evidence cycle, and O(n)/O(n²) time-space trade-offs.
2. Work a complete `containsZero` early-return debug with trace, hypothesis, one change, reruns, invariant, and complexity.
3. Guide the learner through a different `countEven` state-update defect and state exactly where support fades.
4. Close teaching fixtures and independently create `firstDrop` from a specification and public tests.
5. Independently debug `hasDuplicate` using nested distinct-position reasoning, with only a location/evidence cue available.
6. Save all responses locally as `PENDING_ASSESSMENT`; no correctness or mastery claim is generated in the learner browser.
7. When remediation is selected, use either a card-pair coverage map or a six-box evidence ladder, then require a fresh Set-based `sharesInitial` debug.

The fully worked example and each protected task differ in defect family, control structure, data shape, and decisive repair. Exact independent, mastery, and fresh-check solutions live only in the restricted scoring guide.

## Static and safety boundary

- The complete explanation, code fixtures, public tests, paper route, guided check path, support fade, independent tasks, remediation, and fresh check are static curriculum.
- Tutor V2, the legacy Tutor API, AI calls, microphone, camera, transcript, account, upload, and network access are not connected or required.
- Browser responses use the existing learner-response runtime and an isolated Director-review IndexedDB. No assessor is injected.
- All inputs are fictional. The lesson explicitly prohibits real credentials, tokens, private messages, precise locations, personal data, live targets, access-control bypass, and third-party sign-in.
- The paper/pseudocode route preserves algorithm construction, program-state tracing, correctness, debugging, and efficiency and receives equal credit.

## Preview route

From this worktree:

```sh
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/__review/technology-algorithms`.

The route is exact-path and development-build-only. The production build emits no Director preview chunk and does not alter existing production routes or authentication.

## Visual evidence

- [Desktop concept teaching](./technology-director-preview-desktop.jpg)
- [Desktop analogous worked example](./technology-director-preview-worked-example.jpg)
- [Desktop protected independent boundary](./technology-director-preview-independent.jpg)
- [390 px mobile concept teaching](./technology-director-preview-mobile-390.jpg)

Measured browser evidence:

- The concept, worked, guided, independent, mastery, remediation, fresh-check, and completion/decision states were reached through visible controls.
- A guided response was durably saved to the isolated review store and returned only `PENDING_ASSESSMENT` language.
- At the independent and mastery states, the worked `containsZero` fixture was absent from the DOM.
- The mastery evidence cue was present, while the decisive target repair was absent.
- The selected remediation route and fresh Set-based check remained free of both the original repair and the fresh check's decisive state update.
- At 390 px, document and body scroll widths were exactly 390 px; the protected response area was 326 px wide and all visible buttons were 52 px tall.
- Browser console review found no warning or error entries.

## Director review questions

1. Is the transition from teaching to the independent evidence boundary explicit enough for a Grade 10 learner?
2. Does the worked early-return example teach the debugging cycle while remaining structurally distant enough from both protected tasks?
3. Is the `LOCATION_OR_EVIDENCE_CUE` on the nested-loop task appropriately revealing, or should the ceiling be stricter?
4. Are the two independent tasks proportionate for a 60–75 minute mastery lesson?
5. Should the learner choose remediation from self-observed signals, or should a future trusted scorer/adult select the route after review?

## Verification record

- Advisory contract validation against `TECHNOLOGY_LESSON_ADVISORY_CONTRACT_R1.schema.json`: passed.
- `node .../tests/validate-corpus.mjs`: 984 packages/guides passed.
- `node .../tests/technology-actionability-audit.mjs`: 336/336 actionable; passed.
- `node .../tests/schema-check.mjs`: 1,968 files passed.
- `node .../tests/duplicate-check.mjs`: no exact duplicates or threshold violations; passed.
- `vitest ... tests/technology-director-preview.test.js`: 4/4 passed.
- `npm run typecheck`: passed.
- `VITE_FAMILY_PILOT_ENABLED=true npm run build`: passed; browser answer-authority audit reported zero findings across four chunks and 322 course payloads.
- Production artifact scan: no Director route/chunk markers and no independent, mastery, or fresh-check exact repair strings.

## Classification

`TECHNOLOGY_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This classification means one sample is ready for Director review only. It does not mean `TECHNOLOGY_STANDARD_APPROVED` or that any other Technology lesson is depth-ready.
