# W4-07 Validation Record

## Required outcome

`W4_PRIVACY_RETENTION_READY_FOR_CONVERGENCE`

## Certification assertions

- All 14 synthetic canary categories were injected into untrusted or transient
  in-memory inputs.
- Eleven requested resulting surfaces were scanned for direct,
  case-normalized, URL-encoded, base64, and hex marker forms.
- Eleven current `tutor-v2-wave3-release` JSON artifacts and the Wave 3 real
  mutation campaign evidence were scanned read-only.
- All nine schema-backed durable-output mutations with a forbidden unknown
  field were rejected.
- All six provider-policy adversarial cases failed closed before dispatch.
- The composed Wave 3 evidence collector reported 18 of 18 hard gates passing.
- No live network call, hosted data access, production write, or storage build
  occurred.

## Successful targeted command

The worktree did not contain a local `node_modules` install. Validation used the
same pinned TypeScript 5.8 dependency already installed in a sibling worktree,
with that installation's Node type declarations:

```sh
/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/.bin/tsc \
  -p adversarial/v4/privacy-retention/tsconfig.json \
  --pretty false \
  --typeRoots /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/@types
node adversarial/v4/privacy-retention/.dist/adversarial/v4/privacy-retention/certify.js
```

Observed result: exit 0. The report declared 14 canaries, zero matches on all
generated and static evidence scans, six fail-closed provider-policy results
with zero calls, nine of nine closed-schema mutations passing, and 18 of 18
Wave 3 hard gates passing.

## Independent Wave 3 regression

Using the same installed TypeScript compiler and Node declarations:

```sh
/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/.bin/tsc \
  -p scripts/tutor-v3/tsconfig.json \
  --pretty false \
  --typeRoots /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/@types
node --test scripts/tutor-v3/.dist/tests/tutor-v3-convergence/*.test.js
node scripts/tutor-v3/.dist/scripts/tutor-v3/generate-schemas.js --check
node scripts/tutor-v3/.dist/scripts/tutor-v3/generate-release.js --check
```

Observed results:

- TypeScript compile: exit 0.
- Wave 3 convergence: 33 tests, 33 passed, 0 failed.
- Schema check: `PASS wave3-schema-check 10 schemas + inventory`.
- Release check: `PASS wave3-release-check 11 artifacts`.

## Reproducibility note

With this worktree's declared dependencies installed, use the portable command
shown in `README.md`. `.dist/` is ignored and is not durable certification
evidence. The checked-in `CERTIFICATION.json` contains no canary values.
