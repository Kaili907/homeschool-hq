# Final package topology

| Root | Authority | Public status |
|---|---|---|
| `adaptive-tutor/core`, `examples`, `prototype`, `json-schema` | Frozen Tutor Core 0.2 | Consumed only through the accepted bridge |
| `adaptive-tutor/study-engine/contracts`, `schemas` | Session 1 canonical Study contracts | Canonical |
| `adaptive-tutor/study-engine/engine`, `prompts` | Session 2 recommendations | Canonical for pacing/break/review recommendations |
| `adaptive-tutor/study-engine/ui`, `prototype` | Session 3 Study UX | Accepted component |
| `adaptive-tutor/study-engine/integrations`, `parent` | Session 4 integration surfaces | Internal input to reconciled runtime |
| `adaptive-tutor/study-engine/reconciliation` | Session 5-R2 decisions | Canonical reconciliation record |
| `adaptive-tutor/study-engine/bridges/tutor-core` | Session 6-R2 bridge 1.0.1 / contract 1 | Sole Tutor-to-Study authority |
| `adaptive-tutor/study-engine/integration-labs/student-runtime` | Session 7-R2 runtime 0.7.2 | Accepted student runtime |
| `adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime` | Session 8-R3 runtime 0.8.1 | Sole calendar/parent authority |
| `adaptive-tutor/study-engine/runtime` | Session 9 umbrella 1.0.0-rc.1 | Controlled public composition |
| `adaptive-tutor/study-engine/release` | Traces, evidence, manifest, archive tooling | Release-only |

Session 7 vendor snapshots are private parity fixtures, not public authorities. The Session 9 public exports deliberately omit raw adapters, vendor paths, provisional enums, `student-runtime.session6-bridge.v2`, generic parent resolvers, and historical Romeo constants.

Public entry points are `.`, `student`, `calendar`, `parent`, `review`, `tutor-bridge`, `checkpoint`, `outbox`, `safety`, `adult-review`, `romeo`, and `health`.
