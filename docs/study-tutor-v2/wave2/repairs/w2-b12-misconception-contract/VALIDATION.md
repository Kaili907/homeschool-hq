# W2-B12 validation

## Coverage

The lane-local tests cover:

- a legitimate reviewed academic code;
- a code over the 96-character policy limit;
- a 16,001-character boundary probe;
- spaces and free-form learner prose;
- a diagnostic sentence;
- a personality statement;
- Unicode and invalid namespaces;
- diagnostic, emotional, and personality code tokens;
- an unknown registry reference;
- a known reference paired with the wrong code;
- a legitimate reviewed registry signal; and
- identifier suppression for every non-possible status.

Code and serialized-signal cases are checked against both the in-memory schema
and a JSON-serialized copy of the schema. The 16,001-character probe therefore
fails because of the explicit schema `maxLength`, not only because of the
runtime validator's 16,000-character JSON boundary.

## Commands

Run from `adaptive-tutor/`:

```sh
npm run tutor-v2:typecheck
node scripts/tutor-v2/run-compiled.mjs test
node --test scripts/tutor-v2/.dist/core/v2/misconceptions/academic-misconceptions.test.js
npm run tutor-v2:wave2-schema-check
```

Validation on 2026-08-15:

| Check | Result |
|---|---:|
| Tutor V2 strict typecheck | PASS |
| Compiled Tutor V2 suite | 280/280 PASS |
| W2-03 misconception suite | 19/19 PASS |
| Existing Wave 2 schema drift check | PASS — 2 schemas + inventory |
| `git diff --check` | PASS |

The broader `tutor-v2:wave2-gate` is not a repair-branch acceptance gate. It
reports `WAVE2_HOLD` despite 195/195 lane tests passing because it pins the
pre-repair 192-test count and the prior convergence ownership manifest. Its
isolated frozen-source checks also lack the external Session 6 archives and an
isolated Node type install in this worktree. No gate artifact produced by that
diagnostic run is included in this repair.

The Wave 2 generated-schema drift check remains unchanged in this owned-path
repair. R4 convergence must regenerate and validate the decision packet schema
after importing the repaired projection contract.
