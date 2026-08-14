# Tutor provider boundaries

The Wave 1 boundary has four deliberately separate responsibilities:

1. **Provider execution** receives only a closed `ProviderExecutionRequest`: opaque request and interaction references, an already-minimized provider context, ephemeral short-term state, and bounded routing/budget metadata. `TutorRequest` and `StudyAuthorityContext` are structurally unavailable to every `TutorProviderPort` implementation.
2. **Provider transport** receives a closed `ProviderTransportRequest` derived only from that provider-safe execution request and returns bytes plus numeric usage metrics. It has no prompt-string API and no Study mutation callback.
3. **Provider response parsing** bounds JSON, checks the canonical proposal contract, and binds the proposal to the interaction. It does not decide whether a contract-valid action is permitted by Tutor policy.
4. **Tutor policy validation and Study authority** remain downstream. Study validates the untrusted proposal against its detached pre-provider authority snapshot; the provider-facing context is never an authority source. Study alone may select curriculum, record progress, change working level, determine mastery, clear safety, certify guardian work, or apply an accepted action.

Every provider failure carries `fallbackRequired: true` and a canonical `tutor-static-fallback-required` envelope. Ordinary Study therefore remains available without a provider.

Routing types describe future primary/fallback, model class, timeout, and cost-class selection. Wave 1 contains no vendor route or network transport.
