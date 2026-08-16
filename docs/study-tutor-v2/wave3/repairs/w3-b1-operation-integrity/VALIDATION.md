# W3-B1 Validation

Node: `v22.23.2`

Starting SHA: `4ea58cfb4346c579fd6a18898dd48d491e5cd8fd`

## Red proof

The four W3-14 attacks were added to the convergence suite and executed before
implementation changes at the starting SHA. The run produced 18 passes and the
following four failures:

1. foreign curriculum digest reached the provider and returned an advisory;
2. top-level science plus admitted mathematics reached the provider and returned an advisory;
3. a reported 10,000 ms success bypassed the 2,000/700 ms bounds and returned an advisory;
4. a 150-micro primary attempt used the unused 100-micro failover reserve and returned an advisory.

## Green proof

After repair, those same four tests fail closed. Permanent focused results:

- commercial operation: 27/27;
- curriculum admission: 17/17;
- provider routing plus budget resilience: 35/35;
- telemetry lineage: 11/11;
- Wave 3 hard-gate evidence test: 1/1 and runtime gate 18/18;
- all Wave 3 convergence: 30/30;
- all Wave 2 convergence: 288/288;
- Wave 1 cross-slice hard-boundary regression: 253/253;
- adaptive core regression: 21/21.

Typechecks passed for strict Wave 3, adaptive root, and repository root. Adaptive
build and the sequential static-prototype smoke test passed. `git diff --check`
passed.

## Historical gate-wrapper note

The Wave 1 and Wave 2 wrapper scripts also enforce frozen release checksums and
their historical branch-specific path ownership. Their underlying Wave 1/Wave 2
test families passed, but the wrappers return nonzero when run from this Wave 3
repair because the frozen release checksum is intentionally not regenerated and
Wave 3-owned files are intentionally outside those historical ownership lists.
This session does not modify release artifacts, as required.
