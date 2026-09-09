# Wave 1 dependency map

## Exact order

```text
W1-01
  -> W1-02
       -> W1-03 ┐
       -> W1-04 ├─ parallel after the exact W1-02 commit
       -> W1-05 ┤
       -> W1-06 ┤
       -> W1-07 ┘
                    -> W1-08
                         -> W1-09
                              -> W1-10 detached review
```

The canonical order is:

**W1-01 → W1-02 → W1-03/W1-04/W1-05/W1-06/W1-07 in parallel → W1-08 → W1-09 → W1-10 detached review.**

## Dependency pins and acceptance gates

| Consumer | Must start from | Gate before consumer starts |
|---|---|---|
| W1-02 | exact committed/pushed W1-01 architecture SHA | architecture docs complete; authority and path maps internally consistent |
| W1-03–W1-07 | exact committed W1-02 contract SHA, independently | V2 contracts compile; closed action/context/version rules frozen; no parallel slice has begun changing shared artifacts |
| W1-08 | one integration base containing accepted W1-02–W1-07 slice commits | contract, provider, policy, age/memory, evidence/privacy, and eval surfaces pass independently; Study authority remains unchanged |
| W1-09 | exact accepted W1-08 integration SHA | additive bridge passes its tests; no production wiring; all slice-owned paths are stable |
| W1-10 | exact committed W1-09 convergence SHA in a detached/read-only checkout | convergence tree clean; generated artifacts reproducible; full scoped validation green |

## Parallel-session constraints

W1-03 through W1-07 are parallel only because path ownership is disjoint. They all consume W1-02 and must not consume each other's uncommitted working trees. A parallel session may describe a needed cross-slice change, but only W1-09 may edit shared exports/artifacts and only the owning slice may alter its semantics.

## W1-08 integration boundary

W1-08 is the first session allowed to compose all Tutor V2 slices with canonical Study contracts. It must:

- accept a Study-owned invocation and minimized `StudyAuthorityContext`;
- run preconditions and map to Tutor V2 without answer/guardian/provider authority leakage;
- accept only validated closed actions;
- expose proposals/results to Study-owned ports without writing Study state itself;
- preserve Study event/checkpoint/idempotency semantics;
- contain no production web, serverless route, database, or deployment wiring.

## W1-09 convergence boundary

W1-09 owns shared exports, generated V2 schemas, package/manifest exposure, and cross-slice tests. It is not permission to import V2 into production composition. Its success criterion is one coherent internal Wave 1 package that remains dormant until later production-security convergence.

## W1-10 detached review

W1-10 checks the exact W1-09 SHA without authoring fixes. It reviews authority, privacy, safety, answer separation, determinism, subject/age breadth, provider failure, import boundaries, generated artifacts, and clean history. Findings classify the convergence SHA; repairs require a separately owned session and a new review SHA.

## Stop conditions

Stop the wave rather than silently converge if any dependency:

- reintroduces Tutor-owned scoring/mastery/progress/working-level authority;
- creates another Study session/planning/persistence state machine;
- exposes answer authority, raw history, identity, adult-private data, or credentials;
- permits an open-ended provider response to bypass deterministic action/grounding validation;
- imports demo/local runtimes into a production graph;
- requires production web/database/deployment changes during Wave 1;
- changes a frozen 0.2 or 1.0.1 artifact in place.
