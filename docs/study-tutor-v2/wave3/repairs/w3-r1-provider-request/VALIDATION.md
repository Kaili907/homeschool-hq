# W3-R1 validation

Target runtime: Node 22 with strict TypeScript settings.

## Focused contract suite

PASS — 8 tests passed, 0 failed.

Coverage includes:

- accepted structured Study-facts projection;
- absent attempt evidence;
- all named raw learner, answer, conversation, transcript, media, prompt,
  credential, and unknown-field attacks;
- attacks at both the Study-facts projection and direct provider boundary;
- nested attempt contamination;
- hostile prototypes and object/array getters without getter invocation;
- inconsistent attempt ordinal/count and duplicate-reference rejection; and
- detached, deeply frozen accepted requests.

## Regression validation

All requested checks passed:

- strict `adaptive-tutor/tsconfig.json` typecheck: PASS;
- Wave 1 privacy and anti-answer regressions: PASS — 152 tests passed,
  0 failed;
- Wave 2 convergence regression: PASS — 288 tests passed, 0 failed; and
- `git diff --check`: PASS.

Validation used Node 22.23.2 and TypeScript 5.9.3. The worktree had no local
dependency installation, so the checked-out compiler and Node type packages
were invoked from an existing sibling worktree. Compiled test output was
written only to temporary directories. No dependency, package, script, shared
barrel, release schema, or Wave 1 source was changed.
