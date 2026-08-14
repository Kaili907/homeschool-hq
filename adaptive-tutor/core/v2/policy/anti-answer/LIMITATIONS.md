# Anti-answer policy limitations

This boundary fails closed on explicit answer-bearing fields, enforces Study's
assessment phase and review permission, applies the canonical hint ceiling, and
rejects a small set of obvious direct-answer phrases during active graded or
mastery assessment.

It does **not** claim semantic answer safety. Paraphrases, equivalent derivations,
encoded or multilingual disclosures, multi-turn leakage, and examples that are
semantically isomorphic despite a `nonIsomorphicToActiveItem: true` proposal flag
remain subjects for later adversarial/evaluation gates.

The policy is intentionally not given a protected answer key. The Tutor proposal
and provider-facing context therefore cannot become a second answer authority;
answer-key comparison, if introduced later, must remain a trusted server-side
operation outside provider requests.
