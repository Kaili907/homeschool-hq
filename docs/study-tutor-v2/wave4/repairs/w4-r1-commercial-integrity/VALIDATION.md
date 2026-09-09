# W4-R1 validation record

Date: 2026-08-16

## Identity and ownership

- Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- Branch: `mac/tutor-v2-w4-commercial-integrity-repair-r1`
- Adversarial W4-03, W4-05, and W4-06 worktrees were inspected read-only.
- No adversarial lane, eval/certification lane, production configuration,
  credential, or release artifact is part of this repair.

## Validation results

| Validation | Result |
| --- | --- |
| Adaptive Tutor root TypeScript | PASS |
| Tutor V3 strict TypeScript | PASS |
| Focused W4-R1 attacks | PASS, 27/27 |
| All compiled V3 core tests | PASS, 203/203 |
| Tutor V3 convergence tests | PASS, 33/33 |
| Tutor V3 hard gates | PASS, 18/18 |
| Adaptive Tutor base suite | PASS, 21/21 |
| Wave 2 behavioral/typecheck regressions | PASS within formal runner |
| Wave 2 formal result | HOLD: historical convergence-ownership assertion rejects the intentional Wave 3/4 file set; all behavioral/typecheck suites pass |
| Wave 1 formal result | INCONCLUSIVE: frozen mutation/build copies do not support the new post-Wave-3 module and the runner applies historical ownership rules |
| Wave 3 mutation runner | NOT RUN: intentionally refuses dirty product source |
| `git diff --check` | PASS |

The Wave 1 and Wave 2 ownership findings are gate-configuration incompatibilities,
not failures in the live-tree regression suites. The Wave 1 frozen-copy build
failures are also isolated-runner incompatibilities. Neither wrapper is
represented as a clean formal gate pass.

## Required follow-up dependencies

1. The existing Study Engine commercial integration must bind its accepted
   effect receipt and `InstructionalMemoryScope` to the canonical commercial
   scope, including household and concept, and compare those identities before
   recovery. That integration file is outside this repair's ownership.
2. The presentation lane must add complete canonical scope lineage to trusted
   presentation acceptance. W4-R1 blocks foreign presentation refs before
   commercial provider influence but does not change presentation code.

Because the session explicitly requires stopping rather than modifying
presentation implementation, final status is
`W4_COMMERCIAL_INTEGRITY_REPAIR_INCOMPLETE`.

## Schema impact

The runtime schemas for commercial attempt/plan/usage receipt, routing request,
budget/reservation, advisory, and telemetry gain scope or immutable execution
identity fields. Wave 4 convergence must regenerate and review the affected
global JSON Schemas and release evidence. This branch intentionally does not
regenerate the Wave 3 or Wave 4 release bundle.
