# Session 5-R2 Portable Harness Validation

Scope: portability correction only. No contract reconciliation decision, mapping, blocker, classification, authority boundary, frozen-source finding, or compatibility-probe rule changed.

## Files changed

- `reconciliation/artifact-map.json`: absolute paths replaced by relative filenames.
- `reconciliation/artifact-resolver.mjs`: environment/fallback resolution and controlled preflight.
- `tests/reconciliation/reconciliation.test.mjs`: environment-based loading and portability regression checks.

## Files added

- `docs/reconciliation/portable-test-harness.md`: Windows, Linux, and macOS usage.
- `docs/reconciliation/portable-validation-report.md`
- `docs/reconciliation/SESSION-5-R2-HANDOFF.md`

## Resolution behavior

- Primary root: `STUDY_ARTIFACT_DIR`.
- Fallback root: `./artifacts`, resolved from the command’s current working directory.
- Artifact map entries: relative filenames only.
- Frozen Tutor Core compatibility alias: the originally delivered filename containing a space before `.zip` is accepted without changing its canonical portable filename or expected hash.
- Missing files: one concise list and unsuccessful exit, without raw filesystem `ENOENT` output.

## Automated validation

- Original reconciliation tests preserved: 29.
- Added cross-platform portability tests: 6.
- Total Node tests: 35 passed, 0 failed, 0 skipped.
- Compatibility probe: PASS.
- Resolver preflight with all five supplied ZIPs: 5 resolved, all five hashes verified by the test suite.
- Missing-input preflight: exit code 2, all five canonical filenames listed, raw `ENOENT` absent.

Added checks prove:

1. No personal Windows, macOS, or Linux home path remains in package text.
2. Every artifact filename and accepted alias is relative and traversal-free.
3. Windows and POSIX resolution select the same intended filenames.
4. Environment override and relative fallback behave consistently.
5. Missing input reporting is controlled.

The final archive’s byte size and SHA-256 are reported externally after sealing. Its raw central directory is audited after the final build.
