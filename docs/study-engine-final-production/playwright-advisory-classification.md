# Playwright advisory classification

Classification: **TEST-ONLY DOCUMENTED RISK**.

The frozen RC1 runtime lock directly declares `@playwright/test` 1.54.1 as a development dependency. That package pulls `playwright` 1.54.1 through the local browser-test toolchain. `npm audit` reports two high findings on that path, including the browser-download certificate-authenticity advisory for `playwright <1.55.1`. The frozen lock was not modified.

Evidence:

- Root production audit (`--omit=dev`): 0 vulnerabilities.
- Root full audit: 0 vulnerabilities.
- Prototype, Student Runtime, and Calendar/Parent Runtime full audits: 0 vulnerabilities.
- Frozen RC1 runtime full audit: 2 high, 0 critical; both are the Playwright development path.
- Production Vite bundle scan: no `playwright`, `@playwright/test`, or browser-download match.
- Netlify/server-function scan: no Playwright match.
- Lock path: root development dependency -> `@playwright/test@1.54.1` -> `playwright@1.54.1`.

The vulnerable packages are not production runtime dependencies, are absent from shipped browser output, and are absent from deployed server functions. This does not erase the risk: anyone installing/running the frozen browser tooling accepts exposure during browser acquisition. A future RC must update and re-audit the frozen test toolchain before its browser artifacts are promoted. Production reachability would change this classification to a blocker.
