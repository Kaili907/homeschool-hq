# Agent 6 — Security, privacy, and child safety

Agent initial result: **BLOCKED**. It found a real context-poisoning flaw: the accepted deterministic gateway evaluated academic/story context before urgent rules, so mixed text such as a lesson marker followed by a first-person urgent disclosure could be classified clear. It also flagged implicit demo safety, credential smuggling through allowed parent text, and an uncomposed adult-private write.

Coordinator resolution:

- Added a Session 9 layered classifier where personal first-person urgent/uncertain signals outrank academic/story markers.
- Required explicit safety configuration on every public Tutor submission.
- Added a mixed-context regression proving zero Core invocations and no raw-text return.
- Added recursive credential rejection to public parent-control text.
- Required verified actor, learner, integrity, exact revision, accepted adult-private authorization, and a commit port; private bodies are never returned.

The accepted bridge itself was not modified. Final security/privacy tests, all 36 bridge tests, and all component adversarial suites pass.

Disposition: **initial blockers resolved; PASS for the documented non-production boundary**.
