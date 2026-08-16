# W4-10 Validation

## Verdict

`W4_PARENT_GUARDIAN_BLOCKER_FOUND`

## Assembly

- branch: `mac/tutor-v2-w4-parent-guardian-r1`
- starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- shared Parent reporting implementation modified: no

## Focused strict compile

The lane compiles under TypeScript 5.8.3 with strict,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, unused-symbol, and
fallthrough checks enabled.

```text
tsc -p adaptive-tutor/adversarial/v4/parent-guardian/tsconfig.json \
  --typeRoots <existing-local-node-types>

PASS (exit 0)
```

No dependencies were installed and no network or hosted service was used.

## Adversarial campaign

The same focused project was emitted to a temporary directory and executed
with Node's test runner.

```text
tests 30
pass 25
fail 5
cancelled 0
skipped 0
todo 0
PROBE_EXIT=1
```

The five failures are expected blocker evidence, not harness errors:

- sibling/foreign consent reference accepted;
- required-consent policy downgrade accepted;
- replayed authorization accepted for a second report;
- Tutor-proposed evidence relabeled Study-applied accepted; and
- Study-approved evidence reclassified as completed practice accepted.

The control passed, all six confused-deputy substitutions were rejected, both
pending-wording checks passed, and all four privacy probes rejected or omitted
the attacked material.

## Shared baseline control

The unchanged shared Parent-reporting focused project compiled and its existing
Node test suite remained green:

```text
tests 26
pass 26
fail 0
BASELINE_EXIT=0
```

This green control does not clear the Wave 4 blockers; it confirms the five red
probes cover gaps outside the existing 26-test baseline.

## Scope

Owned changes are confined to:

- `adaptive-tutor/adversarial/v4/parent-guardian/**`
- `docs/study-tutor-v2/wave4/lanes/w4-10-parent-guardian/**`
