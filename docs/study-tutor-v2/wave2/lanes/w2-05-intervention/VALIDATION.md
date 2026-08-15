# W2-05 validation record

## Environment

- Starting SHA: `94a8d2e1708d3346e905688c4f0f78a6ed4c4a95`
- Branch: `mac/tutor-v2-w2-intervention-r1`
- Runtime: Node.js `v22.23.2`
- Package install: `npm ci --ignore-scripts`

The install reported three high-severity dependency audit advisories. This lane
does not own dependency manifests or lockfiles, so it did not change package
versions or run an automatic audit fix.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run tutor-v2:typecheck` from `adaptive-tutor` | PASS |
| `npm run tutor-v2:test` from `adaptive-tutor` | PASS — 253/253 existing Tutor v2 convergence tests |
| `node --test scripts/tutor-v2/.dist/core/v2/interventions/intervention-ladder.test.js` from `adaptive-tutor` | PASS — 14/14 intervention tests |
| `npm test` from `adaptive-tutor` | PASS — 21/21 existing core tests; the test compilation also includes the intervention source and suite |
| `npm run build` from `adaptive-tutor` | PASS — schemas, declarations, and static prototype generated successfully |

## Required scenario matrix

| Required scenario | Permanent test evidence | Result |
| --- | --- | --- |
| first difficulty | continues via existing `return-to-lesson` kind | PASS |
| repeated difficulty | recommends bounded `hint` | PASS |
| hint exhaustion | advances to `reteach` | PASS |
| prerequisite suspicion | prioritizes `check-prerequisite` | PASS |
| reteach path | persistent misconception enters bounded reteach | PASS |
| break suggestion | elapsed effort produces optional suggestion | PASS |
| repeated break protection | cooldown suppresses a second suggestion | PASS |
| adult escalation | final slot targets Study/adult review only | PASS |
| safety hold | only authorized escalation; otherwise blocked | PASS |
| unauthorized action | skips disallowed candidate or fails closed | PASS |
| active assessment | excludes hint/reteach and returns Study control | PASS |
| replay | identical result and no input mutation | PASS |
| bounded intervention count | cap and prior escalation stop the loop | PASS |

The focused suite also verifies exact rejection of unknown or semantically
inconsistent structured evidence and validates a replay result against the
closed result schema.
