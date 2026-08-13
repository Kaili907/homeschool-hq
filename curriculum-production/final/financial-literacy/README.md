# Final Financial Literacy production corpus

Canonical, deterministic Family Pilot First corpus reconciled from six pinned production inputs. It contains **504 lessons** and does not modify source curriculum.

- Grades: G3 36, G4 36, G5 36, G7 36, G8 72, G9 72, G10 72, G11 72, G12 72.
- Scoring: 468 MIXED, 36 JUDGMENT_APPLICATION, 0 FIXED_OR_COMPUTATIONAL.
- Authority: 468 lessons with verified substantive fixed-answer authority; 504 with substantive rubric and acceptable-answer criteria.
- Learner security: 369 direct pre-task answer matches repaired to 0; 504 scoring-authority locators removed from learner packages, leaving 0.
- Grade 10: 20 base + 52 completion = 72, with zero overlaps, missing IDs, or invented IDs against pinned source authority.
- H3: READY; raw heuristic reviews are preserved and individually adjudicated in `reports/h3-readiness.json`.

Rebuild and verify:

```bash
node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/reconcile.mjs
node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/verify.mjs
```
