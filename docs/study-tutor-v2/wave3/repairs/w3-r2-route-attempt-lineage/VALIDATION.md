# Validation

Validation is local-only and uses no provider, hosted database, credential,
production integration, or learner data.

Required gates:

```sh
tsc -p adaptive-tutor/tsconfig.json --noEmit
tsc -p adaptive-tutor/tsconfig.test.json
node --test adaptive-tutor/.test-dist/core/v3/routing/provider-routing/provider-routing.test.js
node --test adaptive-tutor/.test-dist/core/v3/routing/budget-resilience/budget-resilience.test.js
node --test adaptive-tutor/.test-dist/core/v3/provider-policy/provider-policy.test.js
node --test adaptive-tutor/.test-dist/core/v3/telemetry/telemetry.test.js
git diff --check
```

The final branch result and counts are recorded in the convergence handoff.

R2 result: both TypeScript configurations passed; the combined W3-01, W3-02,
W3-08, and W3-09 run passed 56 tests with 0 failures; `git diff --check`
passed.
