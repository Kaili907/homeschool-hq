# W4-03 Attack Matrix

Tested against starting SHA `a2fdf1858cd50c998f5da53970d36ee6c90ff31a` on
branch `mac/tutor-v2-w4-scope-isolation-r1`.

| Scope dimension | Attack | Observed disposition | Certification |
| --- | --- | --- | --- |
| household | Foreign household with the same learner/session/interaction IDs | Static fallback; zero calls and telemetry | PASS |
| learner | A grounding/session plus B learner | Static fallback; zero calls and telemetry | PASS |
| session | A learner plus B or stale session | Static fallback; zero calls and telemetry | PASS |
| interaction | A session plus B interaction | Static fallback; zero calls and telemetry | PASS |
| household + learner + session + interaction | All 15 non-empty deterministic substitution combinations | Every combination contained | PASS |
| logical operation + physical attempt | A logical operation plus valid B physical-attempt refs | Provider called; B attempt received usage receipt and telemetry | BLOCKER |
| reservation | Valid B reservation in A execution | Advisory and commercial settlement produced for B reservation | BLOCKER |
| reservation + route | A reservation plus valid B route catalog refs | Provider called and telemetry used the mixed lineage | BLOCKER |
| curriculum release/package/version/digest | A session plus a coherent B curriculum tuple and matching B metadata | Provider called and advisory produced | BLOCKER |
| course/unit/lesson | Coherent B course, unit, and lesson with matching admitted metadata | Provider called under learner A trusted scope | BLOCKER |
| concept | Valid B concept substituted into A invocation | B concept reached provider request `academicScope` | BLOCKER |
| opportunity | Valid B opportunity substituted into A invocation | Advisory was attributed to B opportunity | BLOCKER |
| learner-stage ref | Valid B stage plus a route eligible for that stage | B stage selected a provider route and produced an advisory | BLOCKER |
| grounding scope | Stale prior-session bundle/items/requirements | Static fallback; zero calls and telemetry | PASS |
| memory delta scope | A receipt plus B learner delta scope | Rejected; no projection | PASS |
| memory delta content | A accepted receipt plus B concept operation | Recovery completed and B concept was projected into A memory | BLOCKER |
| accepted effect tuple | Foreign logical operation, learner, session, interaction, or opportunity in receipt | Rejected; no projection | PASS |
| accepted effect household | Same IDs under different households | Household is absent from receipt, memory-scope, and accepted-event contracts | BLOCKER |
| telemetry | Cross-child attribution requirements | Event lacks household, learner, session, and interaction scope; B attempt refs are emitted | BLOCKER |
| guardian authorization | A guardian plus B learner; foreign guardian/household/session | Parent report rejected | PASS |
| Parent report evidence | Foreign learner, household, or session evidence | Parent report rejected | PASS |
| presentation refs | B fallback/reviewed refs in A invocation | Provider call and advisory produced with B presentation ref | BLOCKER |
| presentation acceptance | Scope-free valid B acceptance | Accepted and rendered into presentation pieces | BLOCKER |

## Required attack pairs

- A learner + B session: PASS.
- A session + B curriculum: BLOCKER.
- A operation + B physical attempt: BLOCKER.
- A reservation + B route: BLOCKER.
- A memory + B accepted effect: scope mismatch PASS; sibling memory content BLOCKER.
- A grounding + B learner: PASS.
- A guardian + B learner: PASS.
- Same IDs under different household: ingress and Parent report PASS; effect/memory lineage BLOCKER because household is not represented.
- Stale prior-session refs: session and grounding PASS.
- Valid refs from sibling: BLOCKER across curriculum, attempts, reservation, route, concept, opportunity, stage, memory content, and presentation.
