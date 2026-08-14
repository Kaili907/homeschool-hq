# Elementary Math Sample Player R1

## Status

`ELEMENTARY_SAMPLE_PLAYER_READY`

This presentation-only prototype implements a child-facing Grade 3 rounding lesson over the current structured learner-response runtime. The fixture is local sample material and is not canonical curriculum.

## Source and scope

- Branch: `mac/elementary-math-sample-player-r1`
- Authoritative base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`
- App root routing changed: no
- Student or Jarvis dashboard paths changed: no
- Tutor V2 paths changed: no
- Canonical curriculum changed: no
- Deployment performed: no

## Flow

The default presentation order is:

1. Learn
2. Example 1, Example 2, Example 3
3. Let's Try One: three guided items
4. Your Turn: ten independent items
5. Check What You Know: four mastery items

Each worked example reveals one solution step at a time, visually emphasizes its final instructional answer, and requires no learner input. Guided practice includes numeric bounding, a digit-identification choice, and a numeric rounding response.

Independent and mastery work render exactly one current question. Future prompts are not present in the rendered card. Progress is learner-facing, for example `Your Turn • 3 of 10`.

The response controls cover `CHOICE`, `TEXT`/short input capability, `NUMERIC`, and `CONSTRUCTED_RESPONSE`. The supplied sample uses choice, numeric, and constructed response items. Each answer form supports keyboard submission.

## Response runtime and scoring boundary

`ElementaryMathSamplePlayer` receives an existing `LearnerResponseRuntime` and calls its `submit` method with stable lesson, section, item, segment, and choice references. The module does not instantiate a response store and does not use local storage or IndexedDB directly. The existing runtime/store remains the sole response authority; IndexedDB remains authoritative when this presentation is converged into the browser composition.

There is no browser answer key, expected-answer field, response comparison, or scoring rule. Without an injected trusted assessor, the runtime durably saves the response as `PENDING_ASSESSMENT`. The presentation displays correctness only from the assessor receipt returned by that runtime. It supports:

- `PENDING_ASSESSMENT`: answer saved for later trusted review
- `CORRECT`: positive confirmation
- `INCORRECT`: saved answer with retry and next controls
- `REVIEW_REQUIRED` (and partial review): saved for a closer look

The local fixture contains worked solutions only as visible instructional example content; they are never consulted during submission.

## Jarvis placeholder

`Need Help? Ask Jarvis` is always in a consistent support-control location. An injected `onNeedHelp` callback receives only the current item reference. No AI call, Tutor runtime, response persistence, or conversation persistence exists here. Without the callback, the button has an accessible description and displays: `Tutor help is not connected in this sample yet.`

## Mobile and accessibility

The stylesheet is mobile-first. Question controls and buttons use large touch targets, numeric questions use a numeric mobile keyboard hint, content wraps inside a single-column card, and wider layouts are an enhancement.

The current screen heading receives focus after navigation. Assessment feedback receives focus after Check Answer. Inputs have visible labels, choice groups use fieldset and legend, support navigation is labelled, live feedback uses status/alert semantics, and keyboard form submission is supported. Focus indicators are visible and reduced-motion preferences disable meaningful animation and transition duration.

Child-facing copy uses `Learn`, `Example`, `Let's Try One`, `Your Turn`, `Check What You Know`, `Need Help?`, `Take a Break`, and `Save for Later`. It does not expose segment roles, response kinds, session status, mastery authority, or other engineering state.

## Tree

```text
docs/curriculum-quality/elementary-math/sample-player-r1/
└── ELEMENTARY_SAMPLE_PLAYER_R1.md

src/study/family-pilot/elementary-math-sample-player/
├── ElementaryMathSamplePlayer.css
├── ElementaryMathSamplePlayer.test.tsx
├── ElementaryMathSamplePlayer.tsx
├── fixture.ts
├── index.ts
├── presentation.ts
└── types.ts
```

## Tests

The mounted and static tests cover:

- complete flow projection and three worked examples
- worked-example expansion and next-example focus
- guided numeric and guided choice
- independent numeric, choice, and constructed response
- mastery presentation
- one-question-at-a-time visibility
- pending assessment and injected correct, incorrect, and review-required receipts
- runtime save followed by next-question navigation
- keyboard form submission
- numeric mobile input semantics
- accessible labels, live feedback, and focus movement
- honest Jarvis fallback and optional help/break/save callbacks
- mobile-first touch sizing and reduced-motion CSS
- absence of browser scoring authority and absence of a second response store

Verification commands:

```sh
npm run typecheck -- --pretty false
npm test -- --project root-app src/study/family-pilot/elementary-math-sample-player/ElementaryMathSamplePlayer.test.tsx
npm test -- --project root-app src/study/family-pilot/final-app/learner-response src/study/family-pilot/lesson-player src/study/family-pilot/elementary-math-sample-player
VITE_FAMILY_PILOT_ENABLED=true npx vite build
VITE_FAMILY_PILOT_ENABLED=true node scripts/audit-browser-answer-authority.mjs
```

## Blockers

None.

## Final classification

`ELEMENTARY_SAMPLE_PLAYER_READY`
