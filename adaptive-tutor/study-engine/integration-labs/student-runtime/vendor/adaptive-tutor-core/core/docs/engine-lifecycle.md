# Engine Lifecycle

The deterministic engine exposes three primary actions:

- `start()` — presents the first diagnostic item
- `submit(input)` — evaluates a learner response, records bounded evidence, and moves to the next required phase
- `continue()` — reveals exactly one teaching or transition step when no answer is expected

Optional actions:

- `requestAlternateExplanation()` — selects a second approved explanation without changing subject content
- `getSnapshot()` — returns in-memory session state for debugging or an approved future adapter
- `getReview()` — builds the parent/teacher evidence review

The cycle cannot advance directly from teaching to mastery. It must pass through guided practice, at least three independent items, and fresh reassessment. Weak evidence routes to reteaching. Repeated weak cycles route to adult review without shaming language.
