# Composition and host invocation

## Before state

```mermaid
flowchart TD
  F["Study feature flag"] --> P{"DEV + explicit preview opt-in?"}
  P -->|yes| L["Session 12 local development ports"]
  L --> C["Browser-derived household and learner hashes"]
  C --> R["Frozen RC1 runtime"]
  R --> S["Synthetic learner: local-release-candidate"]
  P -->|no| U["Production composition declared but never invoked"]
  U --> X["Study unavailable"]
```

The host mounted Study screens only through the explicit Session 12 preview. The preview path created local ports and preview parent authorization in the browser. The frozen RC1 runtime introduced `learner:local-release-candidate`; it was preview-reachable, not a verified production learner. The Session 15 production root existed as a declarative boundary but `src/App.tsx` did not call it.

## After state

```mermaid
flowchart TD
  F["VITE_STUDY_ENGINE_ENABLED === true"] --> A{"Verified authenticated host?"}
  A -->|no| U1["Learner-safe unavailable; no Study mutation"]
  A -->|yes| G["Server-authorized guardian launch / verified learner grant"]
  G --> R["Authenticated readiness query"]
  R --> P{"Complete branded 17-port registry?"}
  P -->|no| U2["not-ready; no fallback"]
  P -->|yes| V{"Verified production academic runtime?"}
  V -->|no| U3["not-ready; RC1 sentinel runtime rejected"]
  V -->|yes| C["createStudyProductionComposition"]
  C --> E["Authority-bound lifecycle epoch"]
  E --> D["Dashboard / calendar / session"]
```

## Host invocation map

`src/App.tsx` owns one `StudyLifecycleBoundary` and one readiness client for the mounted host. It calls `createStudyProductionComposition(...)` directly. It does not construct partial production services in child components.

| Host state | Behavior |
|---|---|
| Feature disabled | No Study navigation, readiness request, production registry, safety request, persistence request, or preview seed. |
| Enabled, unauthenticated/unverified binding | Safe unavailable state; no registry or server mutation. |
| Authenticated, dependency not-ready | Minimized readiness query only; no Tutor processing or durable write. |
| Fully authorized and ready | Composition contract supports verified authority, complete registry, verified academic runtime, and lifecycle epoch. This state is deliberately unreachable until Session 17 and runtime reconciliation finish. |

The host exposes a Study availability action in production-selected mode, then renders a safe unavailable screen. It never substitutes the preview composition. Sign-out cancels the current lifecycle and invalidates readiness.
