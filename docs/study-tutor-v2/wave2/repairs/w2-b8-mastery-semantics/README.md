# W2-B8 — Mastery recency, context, and type parity repair

## Root causes

The mastery recommendation treated every demonstrated/not-demonstrated pair
as a current contradiction. One stale failure could therefore force
`conflicting-evidence` even when two current independent demonstrations,
including a spaced demonstration, otherwise supported the concept.

Current-session integrity was enforced only for the current opportunity.
Another opportunity could claim `recency: "current"` in Study's current session
while naming an older instructional context.

The runtime schemas required all Study provenance and current binding fields,
but the exported TypeScript schema types deliberately projected those fields
as optional. Invalid construction could compile and fail only at runtime.

## Deterministic repair policy

Recommendation contradiction decisions use only conclusive evidence that
Study marks `current`:

- at least one current demonstration plus at least one current failure is
  `conflicting-evidence`;
- stale outcomes remain in counts and may add
  `stale-contradiction-observed`;
- stale outcomes do not independently force a current contradiction;
- two current independent demonstrations with at least one spaced sample can
  remain `supported-evidence` in the presence of a stale failure; and
- a stale demonstration cannot mask a current failure-only result.

Conflicting versions of one evidence reference remain
`conflicting-evidence`; this replay-integrity rule is separate from outcome
recency.

Context validation uses exact opaque-reference equality:

1. Current-opportunity evidence must continue to match Study's current
   session and instructional context, regardless of recency.
2. Any other evidence with both `sessionRef === currentSessionRef` and
   `recency === "current"` must match
   `currentInstructionalContextRef`; otherwise the batch rejects with
   `current-session-context-conflict`.
3. Evidence from a prior session may use that session's older instructional
   context, including when Study still classifies it as current.
4. Same-session stale evidence may retain an older context because it does not
   claim current relevance.

## Type/runtime parity

The optional compatibility casts were removed. The public schema-derived
TypeScript types now require exactly the provenance that runtime validation
requires.

Input binding fields:

- `currentSessionRef`
- `currentInstructionalContextRef`
- `currentOpportunityRef`
- `currentOpportunityAssistanceLevel`

Evidence item fields:

- `sessionRef`
- `instructionalContextRef`
- `opportunityRef`

Compile-time assertions verify that each field is required, and negative
construction checks use `@ts-expect-error` so compilation fails if either
projection becomes optional again.

## Preserved boundaries

The repair retains assistance severity binding and laundering rejection,
distinct-opportunity enforcement, exact replay deduplication, legitimate
historical independent evidence, bounded non-authoritative output, and Study's
exclusive decision authority:

```text
studyDecisionRequired = true
studyMutationAllowed = false
authoritative = false
```

No adaptive orchestrator file is modified.
