# Student Runtime Safety Report

## Status

The accepted `@manuel-academy/study-core-bridge` 1.0.1 safety boundary is covered by Student Runtime integration tests. The tests verify the seven required urgent disclosures, uncertain disclosures, prompt-injection downgrade resistance, production-classifier failure behavior, one-time permits, non-echoing results, supportive learner language, and `proposed-not-delivered` adult-review status.

The bridge behavior is suitable only when the supported runtime explicitly selects production mode and supplies the reviewed classifier port. Urgent, uncertain, and invalid outcomes must stop before Tutor Core, ledger append, projection, or outbox creation. The learner UI must not state or imply that an adult was contacted.

## Verified behavior

- Required urgent examples stop normal instruction and receive no permit.
- Uncertain disclosures stop normal instruction.
- A production classifier may escalate but cannot downgrade deterministic urgent or uncertain findings.
- A missing, throwing, or malformed production classifier fails closed.
- Clear input receives an opaque, context-bound, single-use permit.
- Returned urgent and uncertain objects do not echo disclosure text.
- Adult-review hooks remain proposals with `deliveryStatus: proposed-not-delivered`.
- Learner messages are supportive, non-blaming, and explicitly say the learner is not in trouble.

## Required runtime integration checks

The final supported adapter must have no path that relies on the gateway's local-demo default. Runtime tests must spy on Tutor Core, ledger, projection, outbox, review-queue, calendar, and parent-control ports and prove zero calls after urgent, uncertain, or invalid classification.

The final UI must distinguish “adult review proposed/pending” from delivered notification. Classifier failure and invalid input currently have no delivered hook and must not be presented as though an adult has been notified.

## Residual limitations

The deterministic fallback is deliberately bounded and is not a complete disclosure classifier. Broader leetspeak, Unicode homoglyphs, and indirect or imminence language require the production classifier and a reviewed adversarial corpus. Recommended additions include `k1ll`, mixed-script obfuscation, “I have pills ready,” “I won't be here tomorrow,” and “he said he will hurt me tonight.”

The current blame-language replacement is pattern-based. Final rendered quarantine, recovery, interruption, and validation messages should also be checked against a wider shame, punishment, diagnosis, and causal-label corpus.
