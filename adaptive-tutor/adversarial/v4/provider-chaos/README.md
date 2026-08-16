# W4-05 Provider Chaos Certification

This lane attacks the accepted `CommercialProviderTransport.execute()` boundary with a deterministic in-memory adapter. It performs no network access, reads no credentials, imports no provider SDK, uses no randomness, and creates no timers.

The matrix contains 21 cases covering all requested provider, transport, identity, cost, availability, circuit, and policy-revocation faults. A case records the expected execution outcome, observed outcome, expected and observed boundary provider-call counts, actual possible provider dispatches, called route identities, attempt freezing, mutation success, and retry/fallback invariants.

Compile and run from `adaptive-tutor`:

```sh
node /path/to/typescript/bin/tsc \
  -p adversarial/v4/provider-chaos/tsconfig.json \
  --typeRoots /path/to/node_modules/@types
node --test adversarial/v4/provider-chaos/.dist/adversarial/v4/provider-chaos/provider-chaos.test.js
node adversarial/v4/provider-chaos/.dist/adversarial/v4/provider-chaos/print-matrix.js
```

The certification runner deliberately returns a classified result rather than throwing on an expectation mismatch. The Node test proves the present starting SHA's known blocker classes are reproduced exactly; convergence should change those expected blocker assertions after repairing and re-running the lane.
