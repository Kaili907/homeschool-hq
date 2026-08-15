# Study Tutor V2 Wave 2 R4 validation report

Session: `STUDY-TUTOR-V2-W2-09R4 — Full Wave 2 Post-Audit Repair Reconvergence`

Candidate classification:
`WAVE2_R4_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS`.

`WAVE_2_COMPLETE=false`,
`WAVE_3_AUTHORIZED_BY_TECHNICAL_ACCEPTANCE=false`, and
`FINAL_INDEPENDENT_REREVIEW_REQUIRED=true`. Production wiring, master merge,
hosted Supabase, browser AI wiring, deployment, and live-model execution remain
unauthorized.

## Provenance and ownership

- Wave 1 accepted: `94a8d2e1708d3346e905688c4f0f78a6ed4c4a95`.
- Failed R1 candidate: `8d618502a16a3d4d169143b539286a3b6fb5b925`;
  W2-10R1: `WAVE2_HOLD_BLOCKING_FINDINGS`.
- Failed R2 candidate: `a251987b28909e827c0af0ee8bbeea668522459f`;
  W2-10R2: `WAVE2_HOLD_BLOCKING_FINDINGS`.
- R4 starting B4: `22c3734bd436c41ba8d24409dcaa146d35914e2f`.
- B5 source `c9601aa99bca89ff0673ee6e00858fafa98c70c2` → cherry
  `9e89a86bf292108276742cf2ebc3a04432e3d4b2`, patch
  `1788de549e684b7e9bb3655a1cfc184b842405c3`.
- B6 source `67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c` → cherry
  `7c3320cbc899f79c8206de2435517cc4185c83fe`, patch
  `a2f745921d05e630a5bf93f1c90cbdc85d6c861d`.
- B13 source `097ada4fe024f7eed7a50038d13801e45b990b62` → cherry
  `a11608d5de30d973785482b2d7169152c42e31ca`, patch
  `e60b439f91424e425181d24414dc9ced30dabd4e`; its source parent is B6.
- B7 source `9a6a6a2a851ee5513bc6ddab694e41c1d78cd5f5` → cherry
  `0f6f3e827ab4be2ed7a57ebddc7cf5e8db179228`, patch
  `ee90ea7ec82fda08769113978964090a5d26a553`.
- B8 source `a907f115894358a5d18b3ead1b361cbab8679390` → cherry
  `19e23646c7cc45ecb176976c3ed731b1163cfbff`, patch
  `bde79ff946a13eda529e6127d32b0544c36671ab`.
- B9 source `367b8f5450510b3e7037cd2ccf32cac1cac79b6a` → cherry
  `15ae6c42a89557b23614f6e611e912c44122f225`, patch
  `a85bf0573e4d4e4cd03e6dbada26c82a507af1d5`.
- B10 source `32fd30a7d3aa3b500e3dbaa53a8aa3715fbd9cde` → cherry
  `783ebb3216a9e7a5919f281fe8f10742bdd0f740`, patch
  `c4ec4ed6c14851dda6c77c037a996379fae22fee`.
- B11 source `5d282f08a5cfbc75e7804dbf461812f218e8db3d` → cherry
  `dacd2fe203fa93df61e772ce2346395b7c6e507c`, patch
  `0955e9b74bb113abaa47fa244eca9a8b36b00a96`.
- B12 source `c07db50067776457a6eef96f0c2a38b601177031` → cherry
  `24b604ac4fc72ea49943fff752a5da5c6e5f4125`, patch
  `aacfdda8fe7564e6a84437c8b715317ab71b5c1e`.

Every remote tip, required source parent, stable patch ID, cherry-pick identity,
and repair ownership root passed. R4-authored changes remain inside the declared
convergence paths. No `src/**`, `netlify/**`, `supabase/**`, deployment, or
production configuration path changed.

## Repaired architecture

The accepted trust model is:

`untrusted browser/provider → verified Study authority → trusted Study-owned
Wave 2 envelope → deterministic adaptive stack → pending Study decision`.

The composer is Study-internal and is no longer exported by the shared Tutor V2
barrel. Static import-boundary tests found no browser, serverless, or production
caller. Wave 2 is not wired into production.

The pending packet carries `decisionProvenance` with learner, session,
instructional context, opportunity, and locally reconciled effective assistance.
Fallback, duplicate, and quarantined packets do not invent it. Composition emits
one coherent primary action: hint, prerequisite repair, or reteach can be active
only when selected; unrelated lanes are withheld. Graph membership alone is not
deficiency evidence.

Admission metadata is bound to household, learner, session, and instructional
context. Completed-review permission is a closed Study-issued contract bound to
learner, session, context, opportunity, review event, policy revision, permission
reference, and optional privacy approval. Parent Why embeds exact reviewed copy,
full scope provenance, and a Study-issued guardian visibility authorization; it
remains non-authoritative and uses proposal language. Misconception output uses
the canonical bounded academic code schema. Mastery uses its runtime-required
provenance directly. The reteach cap is terminal with no steps, content, or
fallback continuation.

## Cross-line Study authority dependency

The external learner-line artifact was verified separately:

- learner-release baseline: `7baf8dfbc27168708ed4cf504285a1838d7345f6`;
- Study authority port: `527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4`;
- direct parent: the learner-release baseline;
- classification:
  `STUDY_RUNTIME_TUTOR_AUTHORITY_PORT_READY_FOR_TUTOR_CROSS_LINE_R4`.

It proves Tutor recommendations are advisory, Study progression decisions are
required, Tutor cannot complete a Study segment, and Study Engine remains
authority. The external commit is not contained in this Tutor candidate.

## Actual validation results

- Full convergence: 288/288.
- All Wave 2 lane/repair regression: 288/288.
- B4 exception containment: 27/27.
- B5 composition/replay: 11/11.
- B6 hint semantics: 42/42.
- B7 intervention semantics: 25/25.
- B8 mastery semantics: 33/33.
- B9 reteach semantics: 8/8.
- B10 admission semantics: 61/61.
- B11 Parent Why semantics: 23/23.
- B12 misconception semantics: 19/19.
- B13 completed-review permission plus adapter coverage: 48/48.
- R4 composition/schema/import-boundary suite: 25/25.
- Original blocker hard gates: 10/10.
- Wave 1 convergence: 253/253.
- Study Tutor bridge: 209/209.
- Foundation harness: 8/8.
- Foundation corpus: 128/128, `FOUNDATION_GATE_PASS`, `releaseReady=false`.
- Tutor Core: 21/21; build and smoke passed.
- Reconstructed frozen Tutor Core: build passed.
- Study Core Bridge: 35/36 passed; one archive checksum test skipped because
  the four external Session 6 archives were not mounted.
- Mutation proof: 17/17 representative defects killed in disposable compiled
  copies; the canonical worktree was not mutated.
- Strict Tutor V2, adaptive-root, repository-root, and Study bridge typechecks:
  passed.
- Schema generation/check/parity, release generation/check, and
  `git diff --check`: passed.

All original Wave 2, R1/R2 blocker, new R4, and Wave 1 hard-gate families passed
without scoring compensation.

## Serialized boundary

`W2_SERIALIZED_BOUNDARY_BLOCKER_FOUND` remains the historical adjudication, with
the repaired ruling that exactly two generated Wave 2 schemas are correct:

- `wave2-adaptive-composition-request.schema.json`;
- `wave2-study-decision-packet.schema.json`.

`generatedSchemaCount=2` and `internalPortSchemasGenerated=0`. Object schemas
are closed with `additionalProperties:false`, and runtime/generated behavioral
parity covers admission scope, structured review permission, decision
provenance, closed Parent Why projection, bounded misconception code, and
required mastery provenance. No standalone Parent Why or internal-port schema
was generated. Frozen Wave 1 durable Tutor evidence was not changed.

## Inherited and candidate limitations

- The broad validator remains the accepted inherited 18/19 result because its
  obsolete substring rule flags accepted authority paths/generated output.
- Three inherited high dependency advisories remain: `@playwright/test`,
  `playwright`, and `nanoid`; manifests were not changed.
- Four external Session 6 archives were not mounted, so the exact archive
  checksum test remains unavailable.
- The replay ledger remains an in-memory reference implementation.
- The final candidate SHA is recorded after commit rather than self-referenced
  inside deterministic checksummed artifacts.
- Provider raw-attempt contract width remains `WAVE3_PROVIDER_HARDENING` and is
  not reopened in R4.
- Final independent W2-10R4 rereview of the exact candidate commit is required.
