# Standalone Demonstration

Open `index.html` directly in a modern browser, or serve this directory with a
local static server. No build, account, camera, microphone, persistent storage,
or network connection is required.

The demo uses an explicit subject-owned phase model to illustrate this bounded
path:

`assessment → reasoning evidence → visual explanation → guided practice →
independent attempt → reassessment → mastery checkpoint or continued support`

Every new item resets its selected answer, reasoning text, feedback,
uncertainty, and control state. Completed in-memory evidence remains keyed to
the item that produced it. Correct-but-uncertain responses stay uncertain and
do not receive confident evidence or mastery credit.

The demonstration is ungraded and page-memory only. Its checkpoint explains
the aligned rule; it does not establish cross-session mastery or make a
placement decision. All instructions and visual teaching steps have displayed
text, so missing media and unavailable voice do not block progress.

`model.js` contains the dependency-free phase/evidence model. The focused Node
regressions are in `../tests/standalone-demo-regression.test.mjs`; real-browser
keyboard, focus, resource, console, reduced-motion, and fallback acceptance is
performed by the external freeze harness so no browser dependency is added to
this content package.
