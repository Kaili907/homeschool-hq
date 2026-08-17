# Wave 4 R6 executable gate-integrity repair

Session `STUDY-TUTOR-V2-W4-R6` removes the manually authored Boolean acceptance
model from Wave 4. `scripts/tutor-v4/executable-detectors.ts` maps each of the
13 non-compensable families to a focused current executable suite. The hard-gate
runner invokes every suite with a pinned Tutor working directory, derives status
from exit status plus observed assertion coverage, and fails closed for missing
detectors, invocation errors, or insufficient assertion output.

`run-negative-controls.ts` runs a serial campaign of 13 guarded implementation
rewrites. Each rewrite is applied in its own detached disposable worktree, is
compiled before its unchanged permanent detector runs, records its exact diff
and source hashes, and is removed and pruned afterward. Compiler or rewrite
failure is `INVALID_MUTANT`; detector pass is `SURVIVED`; only an executed
detector failure can be `KILLED`. Boolean flips, expected-output edits, result
JSON edits, release-artifact edits, and permanent-test edits are prohibited.

The R6 starting candidate has two separately owned current baseline failures:
W4-04 does not compile against the current memory contract and W4-07 fails its
current durable multimodal projection assertion. They are executed and reported
as `EXTERNAL_BASELINE_BLOCKED` under W4-R7 and W4-R8 respectively. Their
historical results are not treated as current PASS evidence.

Release generation reads and validates the v2 executable hard-gate and
implementation-mutation artifacts. It cannot synthesize either result and does
not claim Wave 4 certification while either current detector is failing.

