# W3-01 validation

Validation target: Node 22, TypeScript 5.8 strict configuration.

## Focused routing suite

Result: PASS — 14 tests passed, 0 failed.

The compiled Node test suite covers:

- bounded eligible-route output;
- subject capability mismatch;
- multimodal mismatch;
- privacy/provider-policy ineligibility;
- safety mismatch;
- over-cost candidate using `bigint` comparison;
- over-latency candidate;
- provider outage;
- deterministic tie-breaking under reversed provider/model catalog order;
- no eligible route and immediate reviewed-static fallback;
- exact preservation of the routing-only Study authority boundary;
- refusal of an action outside the Study permission boundary; and
- rejection of unknown authority and unrestricted-prose fields.

## Acceptance invariants

- `NO_ELIGIBLE_PROVIDER_ROUTE` is returned rather than thrown when routing
  cannot prove eligibility.
- Reviewed static fallback is required immediately for every no-route result
  and on failure for every selected route.
- Route decisions contain only bounded classes, references, integers,
  canonical integer-micro strings, enums, and literal authority exclusions.
- The planner is pure and performs no network, filesystem, environment,
  credential, persistence, or provider operation.
- Only lane-owned implementation, tests, and documentation are changed.

## Regression checks

- Strict `adaptive-tutor/tsconfig.json` typecheck: PASS.
- Existing adaptive-tutor baseline: PASS — 21 tests passed, 0 failed.
- Tutor V2/Wave 2 convergence suite: PASS — 288 tests passed, 0 failed.

The worktree did not contain local dependencies. The repository's existing
TypeScript 5.8.3 and Node type packages were invoked from a sibling worktree,
with compiled output written only to temporary directories. Runtime was Node
22.23.2. No dependency or package file was changed.
