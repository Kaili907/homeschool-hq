# Study Tutor V2 — Wave 1 architecture

- Status: Wave 1 architecture baseline
- Evidence base: `7baf8dfbc27168708ed4cf504285a1838d7345f6`
- Contract rule: **Study Engine is the authority. AI Tutor is a controlled teaching assistant. There is exactly one Study Engine.**

This directory is the read-first architecture package for Study Tutor V2 Wave 1. It records the current system, assigns every authority, classifies what may be reused, freezes non-overlapping implementation paths, and identifies the seams that later security convergence must close. It does not change a production runtime, wire a provider, or replace Tutor Core 0.2 / Study Core Bridge 1.0.1 history.

## Read order

1. [Current architecture inventory](current-architecture-inventory.md)
2. [Authority map](authority-map.md)
3. [Tutor V2 reuse map](tutor-v2-reuse-map.md)
4. [Wave 1 path ownership](wave1-path-ownership.md)
5. [Dependency map](dependency-map.md)
6. [Architecture decisions](architecture-decisions.md)
7. [Architecture risks](architecture-risks.md)

## Target boundary

The Study Engine owns durable learning truth and invokes Tutor V2 with a minimized, server-derived `StudyAuthorityContext`. Tutor V2 may return only a closed `TutorAction` proposal. Deterministic validators check the action, curriculum grounding, anti-answer rules, age policy, privacy, and safety before the Study Engine renders or applies anything. Tutor V2 never writes Study state and never receives answer keys, guardian authority, provider credentials, raw history, or unrestricted learner identity.

Wave 1 creates contracts and internal adapters only. Production web wiring, provider enablement, database changes, and deployment are explicitly out of scope.
