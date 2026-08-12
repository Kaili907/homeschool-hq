# WAITING_ON_MAC_STUDENT_OUTPUT

Session CLAUDE-WIN-FAMILY-PILOT-BROWSER-SMOKE-R1 checked this branch's base
(`win/family-pilot-browser-smoke-r1`) and found no student-login route and no
student-dashboard component under `src/`. Those surfaces are owned by the Mac
Student track (e.g. `mac/family-pilot-student-r1`, not yet merged to this
base) and are out of scope for this session to touch or guess at.

## What exists today

- `pilot-browser-test-server.mjs` — static server for the built app shell,
  modeled on `tests/browser/admin-browser-test-server.mjs`.
- `playwright.config.ts` — self-contained Playwright config, run with:
  ```bash
  npx playwright test --config tests/family-pilot/browser/playwright.config.ts
  ```
- `pilot-flow.ts` — a `PilotFlow` page object with one method per step of the
  pilot success path. Every method currently throws
  `WAITING_ON_MAC_STUDENT_OUTPUT` instead of using an invented selector.
- `pilot-harness-smoke.spec.ts` — passes independently today; proves the
  harness (build, server, app shell) works without depending on unfinished UI.

## What's needed from the Mac Student track before the real pilot flow can be written

For each step, the exact selector/route is: **WAITING_ON_MAC_STUDENT_OUTPUT**

| Step | Needs |
| --- | --- |
| Student login | Route path, and selectors for the student picker/login control |
| Student dashboard | Route path, and a selector that reliably identifies "dashboard loaded" |
| Assigned Grade 5 Math work | Selector for the assignment card/link on the dashboard |
| Open lesson | Route path or navigation trigger for entering a lesson |
| Visible lesson content | Selector proving lesson content actually rendered (not just the shell) |
| Progress action | Selector for the in-lesson action that records progress |
| Return/resume | Route/selector for returning to the dashboard and resuming a lesson in progress |

## How to close this out

Once the Mac Student surface lands on this branch's base:

1. Fill in the routes/selectors in `pilot-flow.ts`, replacing each `pending(...)`
   call with the real Playwright interaction.
2. Add a `pilot-flow.spec.ts` that drives `PilotFlow` through the full path.
3. Delete this file, or trim it to whatever (if anything) is still open.
