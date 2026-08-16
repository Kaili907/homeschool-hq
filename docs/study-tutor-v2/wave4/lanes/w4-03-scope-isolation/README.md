# W4-03 Cross-Child and Cross-Household Commercial Isolation

Status: `W4_SCOPE_ISOLATION_BLOCKER_FOUND`

This lane adversarially certifies the Wave 3 commercial Tutor boundary against
valid cross-child, cross-household, and stale-scope substitutions. It changes
no shared product code. The executable campaign is in
`adaptive-tutor/adversarial/v4/scope-isolation`.

## Certification rule

Every foreign binding must be rejected, quarantined, reduced to reviewed
static fallback, or proven non-influential. A failure is non-compensable if a
foreign binding reaches provider transport, receives cost or telemetry
lineage, changes memory, or produces a learner/parent-facing reference.

## Result

The campaign found blockers. Exact top-level household, learner, session, and
interaction mismatches fail closed, as do stale grounding scope, receipt to
advisory mismatches, memory-scope mismatches, and Parent report authorization
mismatches. However, syntactically valid sibling curriculum, physical attempt,
reservation, route, concept, opportunity, learner-stage, and presentation
references can influence learner A. A sibling concept can also be committed to
learner A's instructional memory.

See [ATTACK-MATRIX.md](./ATTACK-MATRIX.md) for dimension-level disposition and
[VALIDATION.md](./VALIDATION.md) for command evidence.

## Run

From the repository root:

```sh
npm --prefix adaptive-tutor/adversarial/v4/scope-isolation test
```

The command intentionally exits nonzero while the documented product blockers
remain. A green result is the prerequisite for convergence readiness.
