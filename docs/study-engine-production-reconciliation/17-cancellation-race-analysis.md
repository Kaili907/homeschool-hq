# Cancellation and race analysis

The host now maintains a lifecycle epoch and abort boundary across learner/profile/session transitions. Stale asynchronous results are ignored, obsolete UI state is cleared, and safety requests accept an external `AbortSignal`. Accessible pending, failed, unavailable, and completed states were added or verified in component tests.

Residual risk: the imported legacy academic port interfaces do not consistently accept `AbortSignal`. Epoch guards prevent stale UI application and subsequent mutations, but an already-started legacy mutation cannot always be cancelled at the transport boundary. Production adapters must accept cancellation or enforce the current session epoch/revision atomically at every write. This remains a production blocker for any adapter that cannot prove one of those controls.
