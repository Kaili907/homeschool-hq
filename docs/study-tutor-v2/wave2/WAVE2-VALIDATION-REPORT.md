# Study Tutor V2 Wave 2 R2 validation report

Session: `STUDY-TUTOR-V2-W2-09R2 — Wave 2 Blocker Repair Reconvergence`

Candidate classification:
`WAVE2_R2_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS`.

Wave 2 is not complete. Independent W2-10R2 review of the exact candidate
commit is required. Production wiring, master merge, hosted Supabase, browser
AI wiring, deployment, and live-model certification remain unauthorized.

## R1 hold and repair provenance

- Failed R1 candidate: `8d618502a16a3d4d169143b539286a3b6fb5b925`
- W2-10R1: `WAVE2_HOLD_BLOCKING_FINDINGS`
- B1 source `5ed021ed5cf239bf9b4d90b6baefed960565459a` imported as
  `461f8298bafcd95b226f8abd76e184e2f58c5ad4`, stable patch ID
  `ee25597f03be72840f8417e1efdd506e85c0f79c`.
- B2 source `28849cc7eeef76e9e6eeeb199375523e25317b0b` imported as
  `ee572e7f4d655e101671ce36253c2121e04d7ff8`, stable patch ID
  `2caee0379c0a6bc7e5012557fc94a5c073e77f03`.
- B3 source `76839746eebc60a1adf8e24a6daa68661a9adfa9` imported as
  `07587f463565e0a0ddce46499ba010249e0319f3`, stable patch ID
  `8b2142f6b809abb7d7462bfb3a918a89bebca462`.
- Every repair remote tip matched, every repair had the failed R1 candidate as
  its direct parent, and every source diff stayed inside its declared roots.

The R1 hold contained five blockers: incomplete global safety stopping,
allowedActions bypass by hint/repair/reteach, unbound current hint assistance
and mastery evidence, caller-influenced invalid fallback references, and
unscoped hint/intervention histories. All five now have permanent,
non-compensable R2 gate families.

## R2 composition ruling

The Study-side composition is:

`Study authority → global scope/safety reconciliation → replay protection →
global Study admission/allowedActions → scoped adaptive state → current
opportunity assistance reconciliation → bounded mastery evidence → bounded
repair/reteach → minimized Parent Why → pending Study decision`.

Study issues the opaque current opportunity reference. Hint, intervention, and
mastery request scope must reconcile with the Study learner, session,
instructional context, and opportunity before adaptive execution. Contaminated
history is rejected; legitimate prior source interactions in the same
learner/session/context remain valid.

Current assistance is the most-assisted applicable value across the
Study-provided previous level, same-opportunity hint history,
same-opportunity intervention history, and current hint. The canonical order is
`independent < light-hint < guided < reteach-required`. A caller's lower claim
cannot overwrite observed assistance. Current concept-cue or guided assistance
cannot become independent mastery evidence; aligned guided evidence remains
bounded, historical independent evidence is preserved, and duplicate
opportunities cannot inflate samples.

Consistent Study safety hold returns a non-academic quarantined packet after
replay protection and invokes zero adaptive dependencies. Contradictory safety
representations fail closed before replay or adaptive work. Study
`allowedActions` independently gates hint, prerequisite repair, and reteach;
the intervention receives the exact Study action set. Invalid requests use only
canonical event, fallback, and reviewed-content references without inspecting
invalid selector fields, getters, proxies, or nested metadata.

Every returned academic packet requires a Study decision, permits no Study
mutation, and retains Study Engine authority. Tutor cannot assign curriculum,
change grade or official working level, or declare official mastery. Parent Why
remains minimized and non-authoritative. Wave 1 active-assessment and privacy
boundaries remain closed.

## Gate results

- 21/21 hard-gate families passed: 12 prior Wave 2, 5 R2 blocker families, and
  all 4 Wave 1 hard families.
- 253/253 Wave 1 convergence tests passed.
- 209/209 Study Tutor bridge tests passed.
- 192/192 Wave 2 lane and repair tests passed.
- 17/17 prior Wave 2 composition/schema-parity tests passed.
- 10/10 R2 blocker hard-gate tests passed.
- 5/5 representative historical blocker mutations were killed in disposable
  compiled copies; the canonical worktree was never mutated.
- 8/8 foundation harness tests and 128/128 foundation corpus scenarios passed;
  corpus classification remained `FOUNDATION_GATE_PASS` with
  `releaseReady=false`.
- 21/21 Tutor Core tests passed; build and smoke passed.
- Reconstructed frozen Tutor Core built successfully.
- Study Core Bridge executed 35/36 tests successfully; one external archive
  checksum test skipped because the four Session 6 archives were not mounted.

## Schemas and release evidence

Exactly two schemas are generated for actual serialized Wave 2 boundaries:

- `wave2-adaptive-composition-request.schema.json`
- `wave2-study-decision-packet.schema.json`

The request schema is closed (`additionalProperties: false`) and includes the
new authority, hint, intervention, and mastery opportunity/scope fields. It
contains no raw learner prose, answer authority, mastery mutation, grade
mutation, or working-level mutation request. No schemas are generated for
internal graph, repair, reteach, or replay ports. Generation, runtime parity,
inventory, checksum, and drift checks pass deterministically.

The release provenance preserves the R1 candidate, W2-10R1 hold, all five
findings, B1/B2/B3 source and cherry-pick identities, and the requirement for
final W2-10R2 review. As in Wave 1, the exact final commit SHA is recorded after
commit in the session return instead of self-referencing a checksummed artifact.

## Inherited and candidate limitations

- The obsolete broad validator remains 18/19 because its substring-based
  platform rule flags accepted authority paths and generated output.
- Three inherited high dependency advisories remain in unchanged Study runtime
  manifests: `@playwright/test`, `playwright`, and `nanoid`.
- Four external Session 6 archives are not mounted; their exact checksum test
  remains unavailable, though reconstructed frozen source and executable bridge
  validation passed.
- The replay ledger is an in-memory reference implementation only; durable
  production persistence is absent.
- Reviewed content remains reference-only and no learner-facing production
  delivery path is wired.
- No live model or commercial web runtime certification was performed.
