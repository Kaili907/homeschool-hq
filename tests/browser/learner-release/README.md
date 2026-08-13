# Learner release browser acceptance R1

Run against a temporary integration assembly containing the Director-pinned
repair commits:

```sh
npx playwright test --config playwright.learner-release.config.ts
```

The server command performs the real production curriculum generation and Vite
build before Chromium starts. The gate intentionally fails closed: a missing
response control, non-canonical response kind, absent assessment launch, answer
leak, incomplete DTO count, or broken authority boundary is a test failure.

The suite owns no production curriculum or application source. Evidence belongs
under `docs/learner-browser-e2e/` and the integration assembly must not be
committed.
