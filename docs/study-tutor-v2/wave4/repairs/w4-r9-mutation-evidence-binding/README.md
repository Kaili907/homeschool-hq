# W4-R9 mutation evidence binding repair

This repair closes the two W4-17 mutation-certification blockers without
changing Tutor product behavior.

- M04 now preserves the existing-record and payload-conflict checks, deletes
  only the cached dispatch record in place of returning `reused`, and falls
  through to a second physical execution.
- Every mutation declares an actual TypeScript project or JavaScript module
  syntax check. TypeScript runs use `--listFiles`, and a mutation is invalid if
  any rewritten source is absent from the compiler's source set.
- Detector execution records setup status, invocation status, semantic-phase
  reachability, assertion/check count, exit code, and semantic result.
- Compiler, missing-file, invocation, and pre-assertion setup failures cannot
  classify a mutation as killed.
- Evidence is bound to execution subject
  `875f53ce3d7a38bafa25233cabde0f18a67bbf90`. The final evidence commit must
  have that commit as its sole parent and may change evidence/documentation
  paths only.

The detailed mutation evidence is in `CAMPAIGN-EVIDENCE.json`. Final detached
rereview remains required; this repair does not mark Wave 4 or the Tutor V2
technical waves complete.
