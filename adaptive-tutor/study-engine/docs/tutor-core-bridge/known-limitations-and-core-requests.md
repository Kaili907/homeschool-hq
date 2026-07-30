# Known Limitations and Remaining Core Requests

## Known limitations

1. Tutor Core v0.2 has no package `exports`, `main`, or `types` entry.
2. Tutor Core declares urgent categories without runtime routes. The bridge
   covers the two urgent categories through a layered classifier boundary.
   The reviewed deterministic fallback is English-language and cannot
   guarantee complete detection; production must inject the required
   classifier port.
3. Tutor Core stores learner response text in its in-memory snapshot. The
   bridge prevents boundary crossing but does not modify Core memory.
4. Tutor Core validates prerequisite graphs but does not enforce missing
   prerequisites in its engine cycle.
5. Tutor Core has no explicit prerequisite-result export. The bridge accepts
   the validated graph but emits only `insufficient-evidence`; it cannot claim
   or remediate a prerequisite gap until Core exports provenance.
6. Tutor generated JSON Schema repeats nested `AssessmentItem` `$id` values.
7. This package does not implement authorization, emergency messaging,
   storage, delivery, retention/deletion, queue workers, calendar placement,
   or parent-dashboard enforcement.
8. Production rule review, localization, false-positive tuning, encryption,
   and monitoring remain required.
9. The canonical Study review request has no urgent reason field, so exact
   urgent reason stays in a bridge-owned adult hook.
10. The frozen Core's static smoke runner uses a URL pathname directly as a
    Windows filesystem path. The unchanged runner fails on Windows before its
    content assertions; the isolated static build and an independent
    equivalent seven-assertion asset smoke pass.
11. Production must supply an atomic accepted-event ledger with uniqueness on
    session/event identity and idempotency-key collision detection. This
    package defines and tests the port but does not implement storage.

## Remaining Core change requests

- Add reviewed runtime routes and tests for all declared safety categories.
- Export a privacy-minimal, versioned Tutor result/decision envelope.
- Export an explicit, versioned prerequisite result with evidence provenance.
- Provide a durable adult-review destination contract.
- Provide a safe snapshot/export that omits raw answers and transcripts.
- Add package export metadata.
- Add cross-field Tutor program checks for item IDs, item purpose/collection,
  skill membership, grade ordering, and fresh reassessment contexts.
- Remove duplicate nested JSON Schema IDs or document a supported resolver
  strategy.

Tutor Core remains frozen for this session. These are requests, not edits.
