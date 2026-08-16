# W4-R1 commercial integrity test matrix

The permanent focused suite is
`adaptive-tutor/tests/wave4-repairs/commercial-integrity/commercial-integrity.test.ts`.

| Campaign | Attack / boundary | Result |
| --- | --- | --- |
| W4-03 | Canonical household/learner/session/interaction lineage | 4 sibling substitutions fail before dispatch |
| W4-03 | Independently valid sibling curriculum tuple | Fails before dispatch |
| W4-03 | Foreign route, reservation, or physical attempt | 3 substitutions fail before dispatch |
| W4-03 | Foreign stage, concept, opportunity, or presentation | 4 substitutions fail before dispatch |
| W4-03 | Sibling provider call, cost receipt, or telemetry | Zero calls, receipts, and telemetry on rejected lineage |
| W4-03 | Canonical telemetry attribution | Exact household, learner, session, interaction, concept, and opportunity preserved |
| W4-05 | Forged model revision or configuration digest | 2 receipt mutations cannot produce advisory |
| W4-05 | Stale failover availability or circuit | 2 current-state mutations prevent failover dispatch |
| W4-05 | Policy revoked after planning | Current-state response acceptance rejects the result |
| W4-06 | Outer policy requirement bounds | Exact 64 accepted; 65 and 4096 rejected |
| W4-06 | Nested policy bounds and duplicates | Exact 3 accepted; 4096 and duplicate requirements rejected |
| W4-06 | Exact reservation/attempt/operation replay | First dispatch succeeds; replay performs zero calls |
| W4-06 | New preplanned attempt in same operation | Eligible exactly once |

The focused runner reports 12 top-level tests, 27 total assertions/tests, with
27 passing and 0 failing.

## Deliberately open cases

The accepted-effect to memory path cannot yet prove canonical household,
concept, and commercial-scope lineage. The existing Study Engine integration
constructs the memory scope and performs receipt/advisory reconciliation, but
that file is outside W4-R1 ownership. A green sibling-memory-concept test would
therefore be misleading and is not claimed here.

The independent trusted presentation-acceptance contract likewise lacks the
complete commercial lineage. W4-R1 prevents a foreign presentation identity
from reaching the provider boundary, but changing presentation acceptance
requires the separately owned presentation lane.
