# Anti-answer policy limitations

This boundary fails closed on explicit answer-bearing fields, enforces Study's
assessment phase and review permission, and applies the canonical hint ceiling.
During active graded or mastery assessment it structurally rejects every
provider-authored free-form academic action (`explain`, `hint`, `ask-check`,
`show-example`, and `reteach`) regardless of wording. Lexical disclosure checks
remain defense in depth; they are not the active-assessment security boundary.

Wave 1 therefore does not expose arbitrary provider-generated academic prose to
the learner during an active graded or mastery check. Eligible structured
control actions may continue through the other policy gates, and rejected prose
uses the Study-reviewed deterministic fallback path. Richer assessment-time
tutoring requires a separately reviewed structured mechanism.

The policy is intentionally not given a protected answer key. The Tutor proposal
and provider-facing context therefore cannot become a second answer authority;
answer-key comparison, if introduced later, must remain a trusted server-side
operation outside provider requests.
