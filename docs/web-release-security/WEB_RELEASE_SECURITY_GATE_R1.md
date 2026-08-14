# Web Release Security Gate R1

## Command

Run this from a clean, installed checkout before every Family Pilot branch
deploy:

```sh
npm run audit:web-release
```

The command builds the enabled production browser artifact with the deployed
proxy selection, scans that exact `dist` tree, enumerates the callable Netlify
function candidates, runs the existing full learner/Family Pilot quality gate,
and runs the route lifecycle proof for default-off behavior. Any finding or
failed command exits nonzero.

## Rules

### Adult answer authority

The browser scan fails on executable correctness fields or behavior, including
`correctAnswer`, `answerIndex`, answer/scoring authority references, and live
adult answer/scoring locators. Type-only language, display copy, deny-list
strings, regex guards, and literal `*Included: false` minimization claims are
not authority and do not fail merely for naming a protected concept.

### Learner PIN material

The browser scan fails when executable code or browser JSON carries PIN values,
PIN digests, or learner/parent PIN fields. UI prose such as “PIN required” is
not credential material by itself.

### Raw Tutor transcript material

The browser scan fails on raw Tutor transcript/session fields and Tutor chat
collections. A boolean statement that a transcript is not included remains a
safe minimization assertion.

### Service-role credentials

The browser scan fails on executable service-role credential fields, bracket
access to those fields, recognized service-secret shapes, and JWT payloads with
the `service_role` role. A server-field name inside a browser-side deny list or
guard regex is not itself a credential.

### Localhost/dev-only endpoints

The browser scan fails when a loopback URL is used as runtime endpoint/config
for fetch, clients, sockets, or URL construction. Incidental developer-facing
prose is not treated as a required production dependency.

### Netlify function surface

Every top-level function source (and non-private directory entrypoint) under the
functions directory actually configured in `netlify.toml` is a callable-output
candidate. The gate compares that complete inventory with the closed allowlist
in `scripts/audit-web-release/lib.mjs`. Tests, specs, fixtures, helpers,
resolvers, and every unknown entrypoint fail. Adding a legitimate handler
therefore requires an explicit allowlist review.

### Quality and default-off integration

The permanent gate requires both:

- `npm run audit:family-pilot-launch`, which includes the full learner-release
  quality audit and Family Pilot launch audit;
- the focused `App.familyPilotRouteLifecycle` test.

It also checks that every `netlify.toml` pilot flag assignment is the exact
literal `"true"` under a specifically named branch context, that at least one
such context exists, and that the host flag helper accepts only exact literal
`true`.
Global, production-wide, deploy-preview-wide, generic branch-deploy, truthy,
or multiple assignments fail.

## Negative controls

`npm run test:web-release-gate` injects and proves detection of every blocker:

1. executable answer authority and an adult scoring locator;
2. learner PIN material;
3. a raw Tutor transcript;
4. a service-role field and credential-shaped JWT;
5. a required localhost grading endpoint;
6. callable Netlify test/helper/unknown functions;
7. a failed integrated quality command;
8. global flag enablement and truthy flag semantics.

Positive controls prove that generic protected-field identifiers in deny lists,
guard regexes, UI prose, and explicit false minimization metadata do not create
false authority findings.

## R2 baseline expectation

The authoritative R2 source SHA
`7baf8dfbc27168708ed4cf504285a1838d7345f6` is expected to fail this gate. That
is the intended proof that release blockers are caught before deployment, not a
request for this gate-only branch to make broad production repairs. The report
prints findings grouped by stable rule code and the complete callable Netlify
inventory for remediation branches to close.
