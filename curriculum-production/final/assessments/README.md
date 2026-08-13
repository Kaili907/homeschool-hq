# Canonical assessment production layer R1

This subtree materializes the 699 admitted Family Pilot assessment records without changing normal lesson corpora. `packages/` is learner-safe. `adult-authorities/` is restricted scoring/completion custody and is never projected into a learner DTO.

`src/generate.mjs` joins admitted assessment identities to the admitted course/unit location, existing assessment metadata, existing standards authorities, and each unit's existing assessment or mastery material. It retains fixed/computational math items where the production corpus supplies separate answer-key custody. Other subjects retain their native writing, investigation, evidence, reflection, performance, project, or critique modes.

RFL authority is copied from the existing completion-authority projection. A learner assertion cannot certify a `GUARDIAN_REQUIRED` package. Social Studies records that need an attached source carry their existing resolver key and fail closed at workflow launch until a qualifying source is ready.

Run:

```sh
node curriculum-production/final/assessments/src/generate.mjs
node curriculum-production/final/assessments/validation/validate.mjs
```

The browser/runtime integration seam is `src/study/family-pilot/final-app/assessment`. Scoring is delegated only through its injected production assessor port; this layer contains no second scoring implementation.
