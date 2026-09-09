# W2-B8 mastery semantics validation

Validation date: 2026-08-15

Session: `STUDY-TUTOR-V2-W2-B8`

Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`

Branch: `mac/tutor-v2-w2-mastery-semantics-repair-r3`

## Results

| Check | Result |
| --- | --- |
| Strict Tutor V2 TypeScript compilation | PASS |
| Required input/item provenance compile-time assertions | PASS |
| Missing-provenance negative TypeScript constructions | PASS |
| Complete mastery lane | 33/33 PASS |
| Stale failure plus two current/spaced independent demonstrations | PASS: `supported-evidence` |
| Stale success plus current failure | PASS: `insufficient-evidence`, failure-only retained |
| Current/current outcome contradiction | PASS: `conflicting-evidence` |
| Current-session current evidence with wrong context | PASS: rejected with `current-session-context-conflict` |
| Prior-session current evidence with historical context | PASS: accepted |
| Same-session stale evidence with older context | PASS: accepted as stale-only |
| Assistance laundering matrix and attacks | PASS within mastery lane |
| Duplicate opportunity and replay protections | PASS within mastery lane |
| Non-authoritative/Study-decision boundary | PASS within mastery lane |
| Complete Core V2 regression | 295/295 PASS |
| Tutor V2 convergence regression | 280/280 PASS |
| Wave 2 generated schema parity | PASS: 2 schemas plus inventory |
| Base generated schema parity | PASS: 23 schemas plus inventory |

The worktree has no dependency installation. Compilation used the pinned
TypeScript binary and Node type roots from an existing sibling worktree while
targeting this worktree's unchanged
`adaptive-tutor/scripts/tutor-v2/tsconfig.json`. The compiled tests executed
from `adaptive-tutor`, matching the repository runner's working-directory
contract.

## Ownership

Modified files are confined to:

- `adaptive-tutor/core/v2/mastery/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b8-mastery-semantics/**`

The adaptive orchestrator and every other subsystem remain unchanged.
