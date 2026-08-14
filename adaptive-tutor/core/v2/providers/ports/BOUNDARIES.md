# Tutor provider boundaries

The Wave 1 boundary has four deliberately separate responsibilities:

1. **Provider transport** receives a closed `ProviderTransportRequest` and returns bytes plus numeric usage metrics. It has no prompt-string API and no Study mutation callback.
2. **Provider response parsing** bounds JSON, checks the canonical proposal contract, and binds the proposal to the interaction. It does not decide whether a contract-valid action is permitted by Tutor policy.
3. **Tutor policy validation** is a downstream deterministic consumer of a successful proposal. In particular, `instruction.allowedActions`, safety, grounding, answer, and assessment rules are not enforced by the provider adapter.
4. **Study authority** alone may select curriculum, record progress, change working level, determine mastery, clear safety, certify guardian work, or apply an accepted action.

Every provider failure carries `fallbackRequired: true` and a canonical `tutor-static-fallback-required` envelope. Ordinary Study therefore remains available without a provider.

Routing types describe future primary/fallback, model class, timeout, and cost-class selection. Wave 1 contains no vendor route or network transport.
