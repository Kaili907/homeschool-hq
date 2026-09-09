# W4-R4 Study lineage test matrix

The permanent focused suite is
`adaptive-tutor/tests/wave4-repairs/study-lineage/study-lineage.test.ts`.

| Scenario | Result after repair |
| --- | --- |
| Accepted Study effect, memory failure, exact retry | Memory repaired once; effect accepted once |
| Exact replay after completion | Duplicate memory application; no repeated effect |
| Sibling concept operation | Rejected before canonical effect lookup |
| Sibling opportunity delta | Rejected before canonical effect lookup |
| Syntactically valid sibling accepted event | Quarantined; no memory mutation |
| Same logical operation, foreign household | Conflicting replay; quarantined |
| Same logical operation, foreign learner | Conflicting replay; quarantined |
| Same logical operation, foreign commercial scope | Conflicting replay; quarantined |
| Foreign session receipt | Rejected before canonical effect lookup |
| Raw learner name or Tutor transcript | Closed schema rejection |

The focused runner reports 9 tests passing and 0 failing.

## Starting-SHA red reproduction

A disposable archive of starting SHA
`ef672ba2e65e83e17f84057782d8005cc1a03016` reproduced all six requested
unrepaired substitution classes. Each completed and produced a memory
projection despite sibling concept, sibling opportunity, sibling-effect recast,
foreign household, foreign learner, or foreign commercial-scope input. The
archive was isolated under `/private/tmp`; it did not modify the baseline or
this worktree.
