# Arts + Music Director Sample R1

## Preview status

`ARTS_MUSIC_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This is one bounded Grade 9 Arts/Music lesson sample and a development-only
browser preview. It is not Director approval, standard approval, a corpus
rewrite, a release-binding change, or a deployment.

## Authoritative inputs

| Input | Commit |
| --- | --- |
| Session base | `a7c6edee867e0d3f546aaa6e0442fac434b75c84` |
| Arts + Music Lesson Standard R1 | `679847806592762da8f956d7a272dc3b352da92d` |

## Exact sample

- Lesson ref: `ma-g9-arts-and-music-u01-l02`
- Canonical title: `Concept model A: advanced composition and visual hierarchy`
- Grade: 9
- Subject: Arts/Music — visual art
- Canonical lesson type: `VISUAL_ART_CONCEPT`
- Authored phase: `MODEL_A`
- Time: 60–70 minutes
- Scoring: formative, rubric authority, no fixed answer

The sample updates only this lesson's task package and scoring guide. It adds one
Academy-original SVG reference and a development-only preview surface. No other
lesson package, scoring guide, schedule, production binding, admission record,
Tutor V2 route, or production route is changed.

## What the lesson demonstrates

### Concept and technique instruction

The learner receives a focus-specific explanation of:

- visual hierarchy as an order of attention rather than an object;
- focal-point strength as a relationship among value, scale, placement,
  isolation, repetition, edge, and direction;
- why quiet areas help stronger areas lead;
- why increasing contrast everywhere can flatten hierarchy; and
- the tradeoff between a steep, immediate route and a subtle, open route.

The five-step technique sequence moves from stating an intended path to placing
large masses, establishing one strongest useful difference, building later
movement, and testing one-variable revision.

### Delivered perceptual model

`Three Stops` is a committed 1200 × 760 SVG, created by Manuel Academy and
licensed CC BY 4.0. It supplies:

1. a partial non-example with similar visual weight;
2. an intermediate state using placement, value, scale, and isolation;
3. a finished worked example with an annotated three-stop path; and
4. a materially different triangle-first variation that protects creative
   authority.

The SVG carries an embedded accessible title and long description. The lesson
also includes a complete adjacent verbal description and a tactile parallel
using three raised or cut-paper shapes plus string. Pattern, value, size, and
position carry meaning; colour discrimination alone does not.

### Guided skill work

The learner makes two small thumbnails with the same three forms and changes
only placement. The first impression is recorded before an optional placement
cue appears. The model and cue close before independent transfer.

### Independent creation

The learner creates a fresh composition with three or more forms or areas,
chooses a focal point, uses at least two hierarchy variables, preserves an
intermediate state, runs a visual-path check, and makes or deliberately declines
one revision with evidence.

Subject, abstraction, medium, format, style, palette, mood, hierarchy variables,
route, and final revision remain learner-owned choices.

### Reflection, critique, and checking

The blocks remain separate:

- reflection compares the intended route and intermediate/later states;
- private critique follows describe → locate evidence → compare with intent →
  ask → offer options;
- the learner may critique their own work with no peer or audience;
- the knowledge check asks for mechanism and tradeoff reasoning; and
- knowledge-check responses are evidence for rubric review, not instant
  right/wrong labels and not substitutes for the visual work.

### Rubric authority

The rubric has four focus-specific dimensions:

1. objective constraints;
2. visual-hierarchy evidence;
3. intent and interpretation; and
4. process and learner-owned revision.

Every level uses observable anchors. The scoring guide explicitly accepts
different subjects, media, formats, focal-point strategies, palettes, moods,
styles, and supported visual paths. Difference from the Academy model is never
an error and resemblance earns no extra credit.

### Retry and remediation

Two observable signals resolve to different instruction:

- If major areas compete against the learner's stated intent, reduce the work
  to a three-value map, keep one strong jump, make a small supported study, and
  retry with a fresh arrangement.
- If a different area repeatedly arrives first, compare only that competitor
  and the intended focal point, change one variable on scrap paper, and retry a
  full new thumbnail without the model in view.

Neither route applies when the learner supports an intentional ambiguous,
distributed, or model-different path. The earlier attempt stays in the process
record and is not penalized.

## Curriculum-side Tutor readiness

The sample carries only the Section 14 allowlisted fields: concept, technique,
prerequisite, common-error, reference, model, rubric, phase, allowed-support,
and age-policy identifiers. All sample-owned refs resolve. The manifest contains
no provider instruction, Tutor route, memory, scoring command, mastery decision,
or answer-delivery logic.

## Director preview

The preview presents ten usable stages:

1. Studio brief
2. Concept instruction
3. Rendered worked model
4. Guided placement study
5. Independent composition
6. Reflection
7. Private critique
8. Knowledge check
9. Rubric
10. Focused retry routes

Desktop preview: [arts-music-director-sample-r1-desktop.png](./arts-music-director-sample-r1-desktop.png)

Mobile model preview: [arts-music-director-sample-r1-mobile-model.png](./arts-music-director-sample-r1-mobile-model.png)

Live browser observations:

- desktop viewport and document width both measured 1280 px;
- mobile viewport, document width, body width, and header width all measured
  390 px;
- all ten stage headings received programmatic focus after navigation;
- the supplied model loaded at its authored 1200 × 760 intrinsic size;
- mobile model overflow is contained in the model frame, with an explicit
  sideways-scroll cue; and
- no browser console warnings or errors appeared during desktop review.

Learner notes remain in React state for the current preview tab only. The
preview makes no persistence, assessment, or mastery claim.

## How to open

From this branch/worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open:

`http://127.0.0.1:5173/__review/g9-visual-hierarchy`

The shortcut is exact-path and development-build-only. The component and SVG
are dynamically imported only when `import.meta.env.DEV` is true.

## Verification

- Focused R1 contract and route test: 7/7 passed.
- Production corpus schema checker: 1,968/1,968 package/guide files passed.
- Production corpus validator: 984/984 lesson packages and scoring guides
  passed.
- TypeScript: passed.
- Curriculum projection: 8,292 lessons projected; passed.
- Production build and browser answer-authority audit: passed with zero
  findings.
- Arts/Music checksum manifest: 1,296/1,296 existing package/guide entries
  passed after refreshing the two target hashes.
- Live responsive browser review: passed at 1280 px and 390 px.

No deploy was performed.

## Director review questions

1. Is the three-panel model's balance of annotation and open visual reading
   appropriate for Grade 9?
2. Should the guided placement study keep size and value fixed, or should one
   second guided loop isolate value before supports fade?
3. Is a three-stop route the right minimum for this first concept model, or
   should independent work permit an explicitly two-stop composition?
4. Should a future shared learner player keep the full rubric in the lesson
   flow or offer the same content in a collapsible drawer?
5. Does the private three-second self-check supply enough evidence when a
   second viewer is unavailable?

## Classification

`ARTS_MUSIC_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This classification means sample and preview ready only. It does not mean
`ARTS_MUSIC_STANDARD_APPROVED` or authorize propagation.
