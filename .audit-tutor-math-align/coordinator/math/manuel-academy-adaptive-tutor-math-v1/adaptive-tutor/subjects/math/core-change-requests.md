# Math Subject — Core Change Requests

These requests are documentation only. This package does not edit `adaptive-tutor/core/**`.

## MATH-CORE-001 — Add Grade 5 to the canonical grade contract

**Need:** The current Academy `Grade` union contains grades 3, 4, 6, 10, and 12. This math package targets grades 4–6 and must represent Grade 5 without mislabeling the learner.

**Provisional adapter:** `adaptGradeForLegacyCore(5)` returns core grade `4` only as a rendering compatibility value, preserves requested grade `5` in subject metadata, and emits a warning that it must not change persisted enrollment.

**Requested core behavior:** Add Grade 5 as a canonical instructional/enrollment value, and separate age/default grade from subject instructional level.

## MATH-CORE-002 — Support extensible visual-board commands

**Need:** Current walkthrough visuals cover column arithmetic, number lines, fraction bars, arrays, equation ledgers, and reused question visuals. The approved math content also requires base-ten blocks, place-value charts, equal groups, area models, step diagrams, word-problem organizers, and multiples lists.

**Provisional adapter:** Unsupported commands degrade to an equation-ledger text description with full alt text. Lessons remain complete through `no-media-fallback.md`.

**Requested core behavior:** Register subject visual renderers through a discriminated, versioned command contract with required text alternatives and reduced-motion behavior.

## MATH-CORE-003 — Add a first-class adaptive sequence contract

**Need:** Existing question and walkthrough contracts do not represent diagnostics, misconception evidence, distinguishing probes, four intervention modes, reteaching, prerequisite remediation, or multi-session mastery rules.

**Provisional adapter:** Subject-owned `AdaptiveMathSequence` and JSON schema.

**Requested core behavior:** Accept a subject sequence manifest and expose one-step state transitions without requiring the subject to own application navigation.

## MATH-CORE-004 — Persist evidence events separately from mastery snapshots

**Need:** Incorrect answers must be evidence for routing, and mastery cannot be inferred from one correct response.

**Provisional adapter:** Fixtures specify evidence and routing, but this package does not persist progress.

**Requested core behavior:** Append immutable response/evidence events with content version, representation, support level, misconception signal, and session ID; derive mastery separately.

## MATH-CORE-005 — Enforce graded-work integrity at the trusted boundary

**Need:** The tutor must not complete graded homework. Prompt-only rules are insufficient.

**Provisional adapter:** Every sequence declares the integrity policy; the standalone demo contains only ungraded practice.

**Requested core behavior:** Require an activity mode (`instruction`, `practice`, `graded`) in the trusted tutor context. Deny answer-generating tutoring during graded response entry and offer a similar ungraded example instead.

## MATH-CORE-006 — Add accessible learner-response modes without camera requirements

**Need:** Learners should be able to explain reasoning by typed text, selected reasoning statements, adult scribing, or optional speech when approved. A camera or identifiable image must never be required.

**Requested core behavior:** Provide response-mode capabilities and accessibility preferences without storing raw voice or image data by default.
