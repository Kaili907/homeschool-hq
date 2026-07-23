# CYCLE claim — SESSION 1 (H1)

**Cycle:** H1 — state-write hardening + housekeeping
**Worktree:** ../hq-h1
**Branch:** h1-state-hardening
**Base:** master @ ce330a9

## Scope
1. Convert every profile/app-state write to a functional update (`prev => next`)
   repo-wide. Behavior identical, zero feature changes.
2. Regression tests reproducing the three historical stale-snapshot bug shapes
   (two same-tick writes; racing effects; record+finish same tick), proving they
   now compose.
3. Housekeeping: CLAUDE.md rules (subagent directive + functional-update rule);
   commit the Voice Addendum v2-5 doc; delete merged m3-grade4-6-trainers branch.

## Out of scope
MS (star economy — Session 2 / hq-ms), MM, MT-V, any feature or behavior change.

## Merge order
H1 merges FIRST in wave 2, regardless of completion order.

Claim files never reach main — this file is removed in the pre-merge commit.
