# W3-B3 Real Implementation Mutation Proof

Status: ready for Wave 3 reconvergence.

This repair replaces the Wave 3 Boolean-evidence flip with a serial executable
implementation-mutation campaign rooted at the repaired B1 commit
`dfc512283ad1e7194558bdddb5debb2c0f8c7589`.

For each of the 18 hard-gate families, the runner creates a fresh detached
worktree at B1, verifies clean custody, provisions the canonical dependency
tree by symlink, applies one guarded source-scoped mutation, records the exact
diff and source hashes, compiles the mutant, executes an unchanged focused
permanent detector, executes the aggregate Wave 3 hard gate, records normalized
logs, removes the worktree, and prunes worktree metadata.

The source rewrite catalog rejects missing, repeated, or stale anchors. A
compiler failure is `INVALID_MUTANT`; a clean undetected mutant is `SURVIVED`;
only an expected permanent test or hard-gate failure is `KILLED`. The campaign
stops at the first result other than `KILLED`.

The successful campaign produced 18 qualifying, compile-valid implementation
mutants and killed all 18. There were no survivors, invalid mutants, or blocked
baseline runs. No permanent detector or product implementation is changed by
this repair.

Detailed evidence is in `CAMPAIGN-EVIDENCE.json`; normalized command logs are
under `logs/`; release-consumed evidence is in
`adaptive-tutor/tutor-v2-wave3-release/MUTATION-EVIDENCE.json`.
