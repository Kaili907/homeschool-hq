# W4-06 validation

Validated from starting SHA `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
on branch `mac/tutor-v2-w4-resource-abuse-r1`.

## Adversarial campaign

Command:

```sh
node adaptive-tutor/adversarial/v4/resource-abuse/run.mjs
```

The clean worktree did not contain installed development dependencies. For
this certification run, `NODE_PATH` pointed at an existing read-only local
installation of the lockfile-compatible TypeScript 5.8.3 dependencies; no
package was installed and no network access was used.

Result: PASS — 9 test groups, 0 failures, including deterministic reproduction
of both named blocker conditions.

Passing blocker detectors means the adverse condition was reproduced; it does
not clear the blocker.

## Existing Wave 3 convergence suite

The Wave 3 TypeScript graph compiled with strict settings, then the existing
compiled convergence suite ran.

Result: PASS — 33 tests, 0 failures.

## Certification result

- Live provider calls: 0
- Bounded per-invocation routing/attempt assertions: PASS
- Unbounded provider-policy requirement traversal/allocation: BLOCKER RA-01
- Cross-invocation reservation replay: BLOCKER RA-02
- Final: `W4_RESOURCE_ABUSE_BLOCKER_FOUND`
