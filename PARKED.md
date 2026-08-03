# PARKED.md — Workstream Ledger for Manuel Academy (v1.2)

Authoritative reconciliation of every known workstream. v1.2,
August 3, 2026: updates canonical master (recompose + JP-1
merged); corrects the mount-branch note (branches now on origin);
reclassifies C2/C3 as stubs; records A-line progress (A1-R, A2,
A3, A3-R, A3-C complete; A2 fix reviewed, merge pending); adds
machine-hygiene rules, the A2 exit-URL residual, and a
known-flaky test note.

v1.1 (superseded) corrected two dispatcher errors in v1.0 (CL6
asserted a push that had not occurred; the wip tip sha was wrong),
incorporated Session A1's custody findings, and added the
session-to-branch map following the fourteen-branch laptop push.

Canonical master at time of writing: 88dbc39 (recompose merge;
ancestors 5115a00 JP-1, 48db9d4 A3-C tip via recompose line,
ab22a0c PARKED v1.0 merge, 704a748 docs merge, 5be50ff v2.2).
Published production remains v2.2 (5be50ff); Netlify auto-publish
LOCKED.

Rules of this file:
- No session re-investigates anything listed CLOSED or DEAD.
- No session resumes anything listed PARKED without a dispatch
  card from Dad naming the item's ID from this file.
- Claims about remote/branch state are verified in Dad's terminal
  before action, per CLAUDE.md verification hierarchy. This rule
  binds the dispatcher too: v1.0's CL6 error was exactly such an
  unverified claim.
- Session numbers were REUSED across workstreams. Never use a
  bare session number; use the branch names below.

---

## MACHINE HYGIENE (run BEFORE any heavy test suite)
- Orphaned process sweep: check for node_repl.exe and claude.exe
  processes with dead parents. Swarms of these starve
  embedded-Postgres test spawns and cause FALSE failures
  (observed Aug 3: ~130 orphans caused failures across 3 fresh
  worktrees; taskkill sweep resolved it).
- Stale worktrees: run `git worktree list` before creating or
  reusing a worktree path. Remove stale entries with
  `git worktree remove`. Do not assume presence or absence —
  check.

## KNOWN-FLAKY TESTS (watch; not yet actionable)
- src/sync/useSync.mounted.test.tsx — failed once in a full-suite
  run during A2-R (error-message mismatch: expected "unbound",
  got household-binding message), then passed in isolation
  (29/29) and on full rerun (1221/1221). One occurrence; log
  future occurrences here.

---

## SESSION-TO-BRANCH MAP (Study Engine + Tutor lines)
All on origin as of Aug 3, 2026.

| Workstream session | Branch | Tip |
|---|---|---|
| Study S11 host prep | integrate/study-engine-host-prep | 74e2c21 |
| Study S13 storage/authz migrations | integrate/study-engine-persistence-rls | 261b879 |
| Study S14 safety/adult-review | integrate/study-engine-safety-adult-review | 09cc103 |
| Study S15 production reconciliation | integrate/study-engine-production-reconciliation | e788d4a |
| Study S16 production composition | integrate/study-engine-production-composition | 71d5e97 |
| Study S17 adult-review operations | integrate/study-engine-adult-review-operations | 4f45444 |
| Study S19 final production candidate | integrate/study-engine-final-production-candidate | b492924 |
| Study runtime closure (S20-adjacent) | integrate/study-engine-production-runtime-closure | b492924 (same tip as S19) |
| Study host runtime | integrate/study-engine-host-runtime | c004515 |
| RC1 frozen assembly (S9) | integrate/study-engine-final-assembly | ea8e976 |
| Tutor assembly foundation | feat/adaptive-tutor-assembly-foundation | f43b652 |
| Tutor assembly R1 fix | fix/adaptive-tutor-assembly-foundation-r1 | d4ccb91 |
| Adaptive English integration | integrate/adaptive-english-v0.2.0 | b10d7ac |
| Tutor math host (STUB — see D5) | integrate/tutor-math-r1-host | a5d2068 |

Notes:
- (Corrected in v1.2) The mount branches were recovered and
  pushed to origin during the Aug 2-3 estate recovery; they
  exist on the remote. v1.1's "no such branch" note is obsolete.
  MOUNT-1 guard design lives in the recovered branches 87a8076 /
  1f12491 / 11a63e2 (per A2's source analysis); their tests
  assert picker-first behavior, which A2 defines as the defect —
  do not adopt them for MOUNT-2 work.
- runtime-closure and final-production-candidate share tip
  b492924; treat as one line until proven otherwise.

## CLOSED — verified. No action ever.
- CL1. Production custody: published Netlify deploy 6a6f6353 =
  v2.2 (5be50ff); auto-publish LOCKED. (Master has since
  advanced by docs merges AND the recompose/JP-1 merges — see
  header. Published production unchanged.)
- CL2. Safe household sync / CAS: merged into v2.2.
- CL3. Student identity canonical history: hardened lineage in
  v2.2.
- CL4. AI/TTS gateway remediation: shipped in v2.2, reviewed,
  conditions verified; provider spend caps set.
- CL5. Hosted Supabase: four-row ledger authoritative (v2.2
  chain, applied via CLI Aug 2). Study migration NEVER applied —
  intentional.
- CL6 (corrected in v1.1): RC1 source integrate/study-engine-
  final-assembly (ea8e976) is on origin AS OF AUG 3 — pushed and
  ls-remote-witnessed in Dad's terminal. v1.0 asserted this
  before it was true; the assertion was false when written.
- CL7. LADDER: Claude-side proposal, never dispatched. Future
  work, not lost work.
- CL8. The full Study Engine / Tutor branch estate is on origin
  (fourteen-branch push, Aug 3, terminal-witnessed).
- CL9 (new). Study/Tutor recompose line MERGED to master: A3
  (ruled graft, integrate/study-recompose-v1) + A3-R independent
  review (SAFE WITH CONDITIONS, ~700 additional tests) + A3-C
  condition closure (docs/TESTING.md, per-suite npm scripts,
  48db9d4) — merged as 88dbc39 after the orphaned-process
  machine issue was resolved. One documented dispatcher
  exception used once for academy-cas.postgres.test.ts during
  the merge run; test passed clean on later runs and in A2-R.
- CL10 (new). JP-1: Japanese Year 1 curriculum wired into Plans
  view (8 sparse quarter-anchored weeks, source verbatim).
  Merged 5115a00.

## DEAD — declared by Dad. Forensics only.
- D1. Root pnpm workspace conversion. Unauthorized; npm baseline
  stands.
- D2. The label "CARD 19". Distinct from Study S19, which is real
  (see map).
- D3. Superseded package variants (Runtime R1, Calendar R2,
  pre-R1 Math, pre-correction English, early bridge revisions).
- D4. The claim "RFL M1/M2 media 100% complete". Withdrawn;
  inventory decides.
- D5. integrate/tutor-math-r1-host at a5d2068: zero unique
  commits, a v2.1-era stub. Dead as a branch; tutor-math host
  integration resumes under D-line cards from the frozen R1
  package, not from this ref.

## PARKED — resumable by card only. Queue order = dependencies.

### A. Study Engine production line  [first in queue]
State (post-A3/A2, v1.2): the recompose line is MERGED to master
(CL9). A1-R custody verdict: CONTESTED at the ~15-file security
seam (v2.2 wins by ruling), CHEAP elsewhere (~1,360 of 1,405
files additive). The laptop wip trove (wip/laptop-local-preserve,
fb275f2 content commit, 7df73c9 archive tip) is a 6-file
adult-review-v2 fragment with broken imports — superseded by the
merged recompose.
MOUNT-2 is FIXED on branch fix/study-engine-route-lifecycle
(8695632, one commit over 88dbc39): route evaluated inside the
initial-screen decision ahead of the picker default; 8 regression
tests; independently reviewed (A2-R, SAFE WITH CONDITIONS — both
conditions closed by this v1.2 entry and merge sequencing).
MERGE PENDING dispatcher execution.
A2 RESIDUAL (flag for A4): after deep-linking into Study and
selecting "Back home", the screen returns home but
window.location.pathname remains /study-engine; a later refresh
re-enters Study for a signed-in learner. Coherent consequence of
entry-only route evaluation; exit-time URL rewriting deliberately
not adopted (A2 ruling). The lifecycle tests do NOT assert
exit-time pathname. A4 decides whether to adopt exit-time URL
normalization.
Resume path (one card each):
  A1-R. DONE (custody verdict above).
  A2.   DONE (fix built + reviewed; merge pending).
  A3.   DONE (recompose merged, CL9).
  A4.   RUN authenticated e2e from merged master; rule on the
        exit-URL residual.
  A5.   AUTHORIZE Study migration (Dad card), CLI apply, ledger.
  A6.   BLOCKING GATE before any student use: production safety
        classifier injected AND startup assertion (production
        build refuses mode != "production"); classifierVersion
        logged at boot.

### B. Wave 1 quartet
B1 Mastery Map (needs 5C correction). B2 AI Safety Center
(packaging custody first). B3 Schedule Recovery (no first
integration decision). B4 External Course Capture (seams
unresolved). Frozen packages in archives/ + mu-music trove.

### C. Enrichment branches — merge-or-dead decisions
C1 a5-grade5-math (blocked on host Grade 5 identity).
C2 ra-azure-reading — STUB (v1.2): zero unique commits over
base; no recoverable work. Merge-or-dead decision is now a
dead-or-rebuild decision.
C3 mkjp-hiragana — STUB (v1.2): zero unique commits over base;
no recoverable work. Separate from the completed Japanese
curriculum FILE wiring (CL10). Dead-or-rebuild decision.
C4 mu-music (1b80cce).

### D. Adaptive Tutor host assembly
Core v0.2, Math R1, corrected English frozen (archives/). Host
custody + conclusive database gates unresolved. Branches on
origin: assembly foundation (f43b652), R1 fix (d4ccb91), English
integration (b10d7ac). English's 46 untracked worktree files
still need matching to the frozen package. Math registration may
be unblocked post-recompose — verify before building.

### E. Romeo Virtual Academy companion
Branch unreviewed; host audits show no host implementation.
Verify-or-archive decision pending. Non-code question for Dad:
who operates Romeo Virtual Academy; enrollment/credit effects.

### F. Ready for Life media completion
Writing complete; media inventory vs manifest reconciliation
required before any host talk. Parked behind A-E and behind
assessment week.

### G. Never started (no artifacts)
Weekly intelligence report; voice/oral-response analysis;
portfolio/attendance/transcripts; accommodations & motivation;
Romeo deferred imports; LADDER; VOICE-PICKER (card exists;
gates: docs landed [done], assessment week underway [NOT done],
voice audition + allowlist [in progress — 8 Academy-collection
candidate IDs collected Aug 3; Dad's ear-audition and final
ELEVENLABS_ALLOWED_VOICE_IDS pending]).

---

## THE CRITICAL PATH (not parked, not code)
1. Placement assessments — five students. NEVER administered;
   app has been capable since v2.2. Blocked by nothing.
2. Year scopes for four students — gated on 1.
3. Household onboarding to hosted sync — after 1.

Last updated: August 3, 2026 (v1.2) by Dad + dispatch desk.