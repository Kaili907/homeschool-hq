# Study Tutor V2 Wave 2 R5 validation report

Session: `STUDY-TUTOR-V2-W2-09R5 — Final Two-Blocker Wave 2 Reconvergence`

Candidate classification:
`WAVE2_R5_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS`.

`WAVE_2_COMPLETE=false`,
`WAVE_3_AUTHORIZED_BY_TECHNICAL_ACCEPTANCE=false`, and
`FINAL_INDEPENDENT_REREVIEW_REQUIRED=true`. Production wiring, master merge,
hosted Supabase, browser AI wiring, deployment, and live-model execution remain
unauthorized.

## W2-10R4 ruling and R5 repairs

W2-10R4 returned `WAVE2_VALIDATION_INCONCLUSIVE` because ignored
`node_modules` briefly existed in its canonical detached review worktree. That
custody finding is recorded separately and is not treated as a code repair.

Two independently verified product defects were repaired:

1. Completed-review `privacyApprovalRef` was serialized but not reconciled.
   B14 adds trusted `currentReviewPrivacyApprovalRef` and requires exact
   nullable equality with the permission value.
2. Pending reviewed-static fallback Parent Why copy claimed Study had already
   used the proposal. B15 replaces applied-state reason/copy with
   `tutor-unavailable-static-fallback-proposed` and closed proposal-safe copy.

The R5 adapter populates the current privacy binding in all Wave 2 fixtures.
The permanent gate proves exact non-null and null/null matches, rejects changed
privacy, null/non-null, non-null/null, learner, session, context, opportunity,
review-event, and policy-revision mismatches, preserves active-assessment
precedence, and rejects legacy boolean permission.

The permanent Parent Why gate constructs an unavailable repair dependency with
`check-prerequisite`, `reviewed-static-fallback`, `pending-study-decision`, and
`studyMutationAllowed=false`. It requires exact proposal-safe reason/copy,
rejects `Study used` and `Study applied`, verifies pending hint proposal copy,
and retains closed-copy rejection of transcript, answer, credential, private
note, diagnosis, and personality substitutions.

## Provenance and ownership

- Starting R4 candidate:
  `2e846e33dffe493ab5cc05fc4fd1d5618ee4a311`.
- B14 source `feecbf43fedae096ee6f53602edab2aa82e9bcb4` → cherry-pick
  `eb60f65c85f38783fd4dca96ed098c6ac6409c6d`; stable patch ID
  `5df7a58bd2d5b7e5cd4e26fe4d8b1e301e44c923` matched.
- B15 source `7c0d4646785bf0daa07b62e66f22890e5bbec60d` → cherry-pick
  `5940bdce18e70303fd51f4f30f674b58d115386f`; stable patch ID
  `02df97f0e5bf1cdce1cc2693f52dd1ea32536847` matched.
- Both source commits have direct parent
  `2e846e33dffe493ab5cc05fc4fd1d5618ee4a311`.
- B14 ownership is limited to `adaptive-tutor/core/v2/hints/**` and its repair
  documentation. B15 ownership is limited to Parent Why, the adaptive
  orchestrator/focused test, and its repair documentation.
- R5-authored adaptation paths passed convergence ownership from
  `5940bdce18e70303fd51f4f30f674b58d115386f`.
- No `src/**`, `netlify/**`, `supabase/**`, deployment, environment, or
  production configuration path changed.

The external learner-line Study authority dependency remains unchanged:

- repair SHA: `527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4`;
- direct parent: `7baf8dfbc27168708ed4cf504285a1838d7345f6`;
- contained in this Tutor candidate: false.

## Actual validation results

- Node: 22.23.2.
- R5 hard families: 15/15 passed:
  `ADAPTIVE_SUBSYSTEM_EXCEPTION_FALLBACK`,
  `ADAPTIVE_REPLAY_RECOVERY_AND_DIGEST`,
  `ADAPTIVE_SUBSYSTEM_RESULT_VALIDATION`,
  `SINGLE_COHERENT_ADAPTIVE_ACTION`,
  `EVIDENCE_BACKED_PREREQUISITE_INFERENCE`,
  `DECISION_OPPORTUNITY_PROVENANCE`,
  `HINT_OPPORTUNITY_COMPLETION_RESET`,
  `COMPLETED_REVIEW_PERMISSION_SCOPE`,
  `INTERVENTION_HISTORY_STATE_RECONCILIATION`,
  `MASTERY_RECENCY_CONTEXT_PARITY`,
  `RETEACH_LOOP_CAP_TERMINAL`,
  `ADMISSION_STUDY_SCOPE_BINDING`,
  `PARENT_WHY_CLOSED_SCOPE_AND_COPY`,
  `MISCONCEPTION_CODE_SEMANTIC_CLOSURE`, and
  `SINGLE_COMPOSITION_ROUTE`.
- Full Wave 2 convergence: 288/288.
- All Wave 2 lane regression: 295/295.
- Wave 2 composition regression: 25/25.
- B4 exception containment: 27/27.
- B5 composition/replay: 12/12.
- B6 hint semantics: 46/46.
- B7 intervention semantics: 25/25.
- B8 mastery semantics: 33/33.
- B9 reteach semantics: 8/8.
- B10 admission semantics: 61/61.
- B11 Parent Why semantics: 25/25.
- B12 misconception semantics: 19/19.
- B13 completed-review permission plus adapter coverage: 52/52.
- B14 review/privacy hard suite: 52/52.
- B15 Parent Why truthfulness hard suite: 43/43.
- Original blocker hard gates: 10/10.
- Mutation proof: 19/19 representative defects killed in disposable compiled
  copies, including removal of only the privacy comparison and restoration of
  historical applied-state Parent Why copy.
- Wave 1 direct gate: 253/253.
- Study Tutor bridge: 209/209.
- Foundation harness: 8/8.
- Foundation corpus: 128/128, `FOUNDATION_GATE_PASS`, `releaseReady=false`.
- Tutor Core: 21/21; build and smoke passed.
- Reconstructed frozen Tutor Core: build passed.
- Study Core Bridge: 35/36 passed; one external-archive checksum test skipped.
- Strict Tutor V2, adaptive-root, repository-root, and Study bridge typechecks:
  passed.
- Schema generation/check/parity, release generation/check, build/smoke, and
  `git diff --check`: passed.

## Serialized boundary

Exactly two Wave 2 schemas were regenerated:

- `wave2-adaptive-composition-request.schema.json` includes required
  `currentReviewPrivacyApprovalRef` with the exact nullable contract;
- `wave2-study-decision-packet.schema.json` includes the new proposal-safe
  reason/copy and excludes the old `used` reason/literal.

`generatedSchemaCount=2` and `internalPortSchemasGenerated=0`. Runtime/generated
behavioral parity passed, and schema inventory hashes plus release checksums were
refreshed.

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
- Provider raw-attempt contract width remains `WAVE3_PROVIDER_HARDENING`.
- Final independent W2-10R5 rereview of the exact candidate commit is required.
