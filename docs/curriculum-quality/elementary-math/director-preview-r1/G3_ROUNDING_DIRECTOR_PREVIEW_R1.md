# Grade 3 Rounding — Director Preview R1

## Preview status

`G3_ROUNDING_DIRECTOR_PREVIEW_READY`

This is a development-only browser review candidate. It is not an Elementary Math standard approval, production route, deployment, or curriculum-wide readiness claim. Only the Director can approve the sample.

## Authoritative inputs

| Input | SHA |
| --- | --- |
| Web R3 base | `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9` |
| Real Grade 3 rounding sample | `4273d7bb63c7678e99d3502eccb3d25ae36c1938` |
| Elementary question-at-a-time player | `1c95ad0ed14c642f30b6a684a6bb6dc369dba4d9` |
| Elementary Math standard draft (reference only) | `c2111bedfb24a3d12f0051fd4bb13f8207833f56` |

## Lesson identity and data path

- Lesson ref: `ma-g3-mathematics-u01-l02`
- Canonical title: `Concept build A: the place-value structure of three-digit numbers`
- Child display title: `Round Numbers to the Nearest 100`
- Canonical package: `curriculum-production/final/mathematics/active/packages/grade-03/ma-g3-mathematics-u01-l02.package.json`
- Canonical sample transcript and provenance: `docs/curriculum-quality/elementary-math/sample-r1/G3_ROUNDING_SAMPLE_R1.md`

The preview does not import the local player fixture. `npm run curriculum:build` projects the real canonical package into the existing learner-safe Family Pilot course payload. The development route loads that payload through `loadFinalFamilyPilotCatalog`, resolves the exact lesson ref, verifies the canonical title, and supplies the material to `LearnerResponseRuntime` and the elementary player.

The child title is a presentation prop. It does not alter the canonical package, catalog row, lesson ref, binding, standards, or source provenance. The shared learner material contract still has only the canonical `title`; whether a first-class learner display-title field should be standardized remains a Director UX question.

## Real content counts

| Part | Real count | Browser reached |
| --- | ---: | ---: |
| Teaching blocks | 3 | 3 |
| Worked examples | 3 | 3 |
| Guided items | 5 | 5 |
| Independent items | 10 | 10 |
| Mastery items | 5 | 5 |
| Remediation items | 4 | 4 |
| Challenge items | 2 | 2 |

The 26 graded authored items retain 26 distinct opaque item refs. The three worked examples remain read-only instruction. The learner-safe projection contains zero answer-key, correct-answer, answer-index, or scoring-authority fields.

## Player flow

1. `Learn • 1 of 3` through `Learn • 3 of 3`
2. `Example • 1 of 3` through `Example • 3 of 3`, revealing one worked step at a time
3. `Let's Try One • 1 of 5` through `5 of 5`
4. `Your Turn • 1 of 10` through `10 of 10`
5. `Check What You Know • 1 of 5` through `5 of 5`
6. `Choose what’s next`: `More Practice`, `Try a Challenge`, or `Finish for Now`
7. When activated, `More Practice • 1 of 4` through `4 of 4`
8. When activated, `Challenge • 1 of 2` through `2 of 2`

Only one guided, independent, mastery, remediation, or challenge prompt/form is rendered at a time. Browser review measured exactly one question prompt and one form at every one of the 26 graded steps. Future prompts are absent from the rendered interaction.

## Child-facing transcript

Persistent chrome:

- `Grade 3 Math`
- `Round Numbers to the Nearest 100`
- `Save for Later`
- `Need Help? Ask Jarvis`
- `Take a Break`

Teaching:

- `Learn: Find the Nearby Hundreds` — find the two hundreds around a number.
- `Learn: Let the Tens Digit Help` — use 0–4 for the lower hundred and 5–9 for the higher hundred.
- `Learn: What Happens Halfway?` — halfway numbers round to the higher hundred.

Worked examples:

- `Example 1 — Round 243 to the nearest hundred.` Final instructional answer: 200.
- `Example 2 — Round 678 to the nearest hundred.` Final instructional answer: 700.
- `Example 3 — Round 550 to the nearest hundred.` Final instructional answer: 600.

Guided prompts:

1. `234 is between which two hundreds?`
2. `Look at 681. Which digit is in the tens place?`
3. `762 is between 700 and 800. Should you round down or up?`
4. `419 is between 400 and 500. Round 419 to the nearest hundred.`
5. `Round 853 to the nearest hundred. Tell how the tens digit helped you decide.`

Independent prompts:

1. Round 142 to the nearest hundred.
2. Round 684 to the nearest hundred.
3. Round 450 to the nearest hundred.
4. Which is 326 rounded to the nearest hundred?
5. A museum had 781 visitors. About how many visitors is that, rounded to the nearest hundred?
6. A student says 249 rounds to 300 because 9 is more than 5. Is the student correct? Explain the mistake.
7. Round 615 to the nearest hundred. Explain why your answer is nearer than the other hundred.
8. Round 999 to the nearest hundred.
9. A food drive collected 352 cans. About how many cans is that, rounded to the nearest hundred?
10. Which hundred is closest to 574?

Mastery prompts:

1. Round 214 to the nearest hundred.
2. Which is 863 rounded to the nearest hundred?
3. A school used 547 sheets of paper. About how many sheets is that, rounded to the nearest hundred?
4. Round 650 to the nearest hundred. Explain what happens because the tens digit is 5.
5. A student says 392 rounds to 300. Is the student correct? Explain how you know.

Optional More Practice prompts:

1. `371 is between which two hundreds?`
2. `Look at 526. Which digit helps you round to the nearest hundred?`
3. `487 is between 400 and 500. Should you round down or up?`
4. `Now put the steps together. Round 438 to the nearest hundred.`

Optional Challenge prompts:

1. `What is the least whole number that rounds to 800 when rounding to the nearest hundred? Explain why.`
2. `Maya says every whole number from 600 through 699 rounds to 600. Is she right? Explain.`

After every submitted review response, the learner sees: `Answer saved. A trusted checker can review it later.`

## Runtime, scoring, and Jarvis boundaries

- Response runtime: existing `LearnerResponseRuntime`.
- Response authority: the existing IndexedDB-backed `BrowserLearnerResponseStore`, isolated under the Director-review database name.
- Scoring: no trusted assessor is injected, so every browser submission remains honestly `PENDING_ASSESSMENT`.
- Browser answer authority: none. The final build audit reports zero answer-key/expected-answer/correct-answer authority occurrences.
- Jarvis: existing narrow `Need Help? Ask Jarvis` callback only. No Tutor V2, AI call, old Tutor API, microphone, transcript, or conversation persistence is connected.

## Desktop, mobile, and accessibility evidence

- Desktop question screenshot: [g3-rounding-director-preview-desktop.png](./g3-rounding-director-preview-desktop.png)
- Desktop teaching screenshot: [g3-rounding-director-preview-desktop-viewport.png](./g3-rounding-director-preview-desktop-viewport.png)
- Worked-example screenshot: [g3-rounding-director-preview-worked-example.png](./g3-rounding-director-preview-worked-example.png)
- 390px question screenshot: [g3-rounding-director-preview-mobile-390.png](./g3-rounding-director-preview-mobile-390.png)

Measured browser evidence:

- Desktop viewport: 1280px; document scroll width: 1280px.
- Mobile viewport: 390px; document and body scroll width: 390px.
- Mobile answer rows: 314px wide × 56px tall.
- Mobile buttons: 51.17px tall; primary question button 314px wide.
- Desktop answer rows: 652px wide × 56px tall.
- The active heading and assessment feedback receive programmatic focus.
- Choice inputs use a labelled fieldset; text controls have visible labels; feedback uses status/alert semantics.
- The mounted player test verifies keyboard form submission; live browser review verified focusable radio controls and keyboard focus state.
- The reduced-motion media query removes meaningful animation and transition duration, and is covered by the player stylesheet test.

## Verification

- `python3 .../validateGrade3RoundingSampleR1.py`: 14/14 passed.
- Director convergence and learner-response/player tests: 7 files, 39 tests passed.
- Surrounding Family Pilot suite: 79 files, 850 tests passed.
- TypeScript: passed.
- Production build with Family Pilot enabled: passed.
- Browser answer-authority audit: passed; zero findings.
- Live browser: all 3 teaching blocks, 3 examples, 5 guided, 10 independent, 5 mastery, 4 remediation, and 2 challenge items reached.

No Dashboard/Jarvis dashboard path, Tutor V2 path, Math schedule, other grade, or other active lesson package/key changed. No deploy was performed.

## How to open

From this branch/worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Then open:

`http://127.0.0.1:5173/__review/g3-rounding`

The shortcut is exact-path and development-build-only. A production build tree-shakes the preview component and emits no preview chunk. Existing production routes and authentication are unchanged.

## Director UX questions

1. Should the child display-title override become a first-class learner-presentation field shared beyond this review?
2. Is `teaching adult` the preferred Grade 3 phrase, or should the standard use `grown-up`, `teacher`, or another household-neutral term?
3. Should More Practice and Challenge stay learner-chosen after mastery, or become intentionally selected by a future trusted assessment/adult policy?
4. Should short round-number responses use a compact numeric control while explanation prompts keep the large writing area?
5. Is the current amount of worked-example distance reasoning appropriate before independent practice?

## Classification

`G3_ROUNDING_DIRECTOR_PREVIEW_READY`

This classification means preview-ready only. It does not mean `ELEMENTARY_MATH_STANDARD_APPROVED`.
