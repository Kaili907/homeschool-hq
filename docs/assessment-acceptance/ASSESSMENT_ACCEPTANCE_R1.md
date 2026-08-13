# Session 699 — Assessment Acceptance R1

## Ruling

`BLOCKED`

The canonical materialization is complete and learner-safe, but the production Family Pilot does not yet expose or launch the canonical assessment workflow end to end. This session made no product repairs.

## Audited inputs

- Base: `c81ddb6e04bc1c3629212327d47817c1b5677477`
- Assessment materialization: `520ce571e7a3e9dc8c60699cfae5f22ee10d56e2`
- Scoring: `1d594411fc969f523b76f340fa388a4c24a0b5a2`
- Response: `f8406fca39c33ba08616ff8ff41a6a0452de47e4`
- Projection: `51792ba67bcc3ec79d35fd55063870b21da82d82`

## Corpus result

- Total: 699
- Learner material: 699
- Isolated workflow launchable from assignment and schedule bindings: 699 each / 1,398 launches
- Response mode: 699
- Restricted authority and scoring/review artifact: 699
- `AUTO_SCOREABLE`: 90
- `RUBRIC_REQUIRED`: 555
- `GUARDIAN_REQUIRED`: 25
- `COMPLETION_ONLY`: 29
- `STRUCTURAL_ONLY`: 0
- Forbidden learner answer fields: 0

Subject counts:

| Subject | Count |
| --- | ---: |
| Arts | 54 |
| ELA | 90 |
| Financial Literacy | 59 |
| Health | 54 |
| Math | 91 |
| PE | 81 |
| Ready for Life | 54 |
| Science | 81 |
| Social Studies | 81 |
| Technology | 54 |

Classification was re-derived from the source material and authority projections. All 90 auto-scoreable records are mathematics packages with fixed items and separate existing answer-key custody. The one rubric-required mathematics record is `ma-g8-mathematics-c01-assessment`. All guardian/completion records match the existing Ready for Life completion-authority projection.

## Required failure proofs

- All 25 guardian-required assessments reject learner certification.
- `ma-g3-social-studies-u09-assessment`, the single canonical assessment with `requiresSourceAttachment: true`, rejects launch when its source attachment is absent and launches only when source readiness succeeds.
- The isolated adapter produces a learner DTO with only the ten allowlisted fields and no adult authority reference or answer field.
- The built browser payload contains zero canonical assessment packages.

## Blockers

1. `BROWSER_ASSESSMENT_DTO_UNAVAILABLE`: the browser build/catalog emits and loads lesson materials only. It has no canonical assessment package loader.
2. `ASSIGNMENT_SCHEDULE_ASSESSMENT_LAUNCH_UNWIRED`: the production Family Pilot controller and UI never construct the assessment workflow. Assignment and schedule launches remain lesson-based.
3. `RUBRIC_FALSE_AUTO_SCORE_GUARD_MISSING`: when the injected assessor returns `SCORED`, the workflow returns `SCORING_COMPLETE` even for `RUBRIC_REQUIRED` work. The acceptance test reproduces this behavior.
4. `CANONICAL_SCORING_REVIEW_PATH_UNWIRED`: no production catalog/assessor implementation connects the canonical assessment packages to the trusted scoring/review service.

## Verification

- `node scripts/assessment-acceptance/audit.mjs` — `BLOCKED`; 699 audited; zero corpus failures; four runtime blockers.
- `node curriculum-production/final/assessments/validation/validate.mjs` — passed.
- `npx vitest run --project root-app scripts/assessment-acceptance/assessment-acceptance.test.ts` — 7/7 passed.
- `node --test scripts/learner-projection/structured-projection-r1.test.mjs` — 5/5 passed; all 8,292 learner projections audited.
- Focused assessment/response/scoring Vitest suites — 45/45 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm test` — 6,440/6,441 passed. One unrelated Supabase test failed during the full concurrent run with `STUDY_IN_APP_ATTEMPT_NOT_SUBMITTED`; its isolated rerun passed 1/1. No repair was made.

## Classification

`BLOCKED`
