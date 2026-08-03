# PARKED.md — Workstream Ledger for Manuel Academy (v1.3)

Authoritative reconciliation of every known workstream. v1.3,
August 3, 2026: records A4 (PASS WITH FINDINGS), the A4-X fix +
A4-X-R review + merge; closes the A2 exit-URL residual and A4-F2;
records the surviving back-button residual; inserts A4-B after
A5; fixes v1.2's stale "merge pending" line; adds the git-remote
fetch-authorization clarification for review cards.

Canonical master at time of writing: d28e94a (A4-X exit-URL
normalization, fast-forwarded; ancestors 6c9d024 A2 merge,
6222ba4 PARKED v1.2, 88dbc39 recompose, 5115a00 JP-1, ab22a0c
PARKED v1.0, 704a748 docs, 5be50ff v2.2). Published production
remains v2.2 (5be50ff); Netlify auto-publish LOCKED.

Rules of this file:
- No session re-investigates anything listed CLOSED or DEAD.
- No session resumes anything listed PARKED without a dispatch
  card from Dad naming the item's ID from this file.
- Claims about remote/branch state are verified in Dad's terminal
  before action, per CLAUDE.md verification hierarchy. This rule
  binds the dispatcher too.
- Session numbers were REUSED across workstreams. Never use a
  bare session number; use the branch names below.
- Card-template clarification (v1.3): "no hosted contact" in
  cards prohibits the hosted Supabase project and Netlify. It
  does NOT prohibit the git remote (origin/GitHub). Read
  operations against origin (fetch, ls-remote) are authorized
  for all sessions; writes to origin follow each card's terms.

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
- Environment note (v1.3): embedded-Postgres tests FAIL by
  construction in root-user Linux containers (initdb privilege
  drop cannot enter root-owned temp dirs). Confirmed
  environmental during A4-X; the same test passes on the PC.
  Gates for merge decisions run on the PC.

## KNOWN-FLAKY TESTS (watch; not yet actionable)
- src/sync/useSync.mounted.test.tsx — failed once in a full-suite
  run during A2-R (error-message mismatch), passed in isolation
  and on all subsequent full runs (A4, A4-X-R). One occurrence;
  log future occurrences here.

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
| A4-X exit-URL fix (MERGED, d28e94a) | claude/study-engine-exit-url-whwy3g | d28e94a |

Notes:
- Mount branches recovered and pushed to origin during the
  Aug 2-3 estate recovery. MOUNT-1 guard design lives in
  87a8076 / 1f12491 / 11a63e2; their tests assert picker-first
  behavior, which A2 defined as the defect — do not adopt them.
- runtime-closure and final-production-candidate share tip
  b492924; treat as one line until proven otherwise.
- claude/study-engine-exit-url-whwy3g is merged into master and
  may be deleted from origin at Dad's convenience.

## CLOSED — verified. No action ever.
- CL1. Production custody: published Netlify deploy = v2.2
  (5be50ff); auto-publish LOCKED. Master has advanced past it
  (see header); published production unchanged.
- CL2. Safe household sync / CAS: merged into v2.2.
- CL3. Student identity canonical history: hardened lineage in
  v2.2.
- CL4. AI/TTS gateway remediation: shipped in v2.2, reviewed,
  conditions verified; provider spend caps set.
- CL5. Hosted Supabase: four-row ledger authoritative (v2.2
  chain, applied via CLI Aug 2). Study migration NEVER applied —
  intentional; that is A5.
- CL6. RC1 source integrate/study-engine-final-assembly
  (ea8e976) is on origin, ls-remote-witnessed.
- CL7. LADDER: Claude-side proposal, never dispatched.
- CL8. Full Study Engine / Tutor branch estate on origin
  (fourteen-branch push, Aug 3, terminal-witnessed).
- CL9. Study/Tutor recompose line MERGED to master (A3 + A3-R +
  A3-C), merged as 88dbc39.
- CL10. JP-1: Japanese Year 1 curriculum wired into Plans view.
  Merged 5115a00.
- CL11 (new). MOUNT-2 fixed and MERGED: A2 fix (8695632) +
  A2-R review, merged as 6c9d024. Route evaluated ahead of the
  picker default; 8 regression tests.
- CL12 (new). A4 e2e route-lifecycle pass on merged master:
  PASS WITH FINDINGS, real-browser verification of all MOUNT-2
  scenarios at the mount boundary, zero hosted contact.
  Findings F1 (runtime depth hosted-auth-gated by construction
  → A4-B) and F2 (cross-learner stale-URL re-entry) recorded;
  F2 closed by CL13.
- CL13 (new). Exit-URL residual + A4-F2 CLOSED: A4-X fix
  (leaveStudyEnginePath via replaceState at all five Study exit
  sites incl. signOut; 3 new lifecycle tests, red-first) +
  A4-X-R independent review (SAFE, unconditional; gates green
  on PC incl. academy-cas.postgres 4/4, retroactively confirming
  the builder's Linux-container initdb failure as environmental
  — no gate exception exists). Fast-forwarded to master as
  d28e94a.

## DEAD — declared by Dad. Forensics only.
- D1. Root pnpm workspace conversion. Unauthorized; npm baseline
  stands.
- D2. The label "CARD 19". Distinct from Study S19 (see map).
- D3. Superseded package variants (Runtime R1, Calendar R2,
  pre-R1 Math, pre-correction English, early bridge revisions).
- D4. The claim "RFL M1/M2 media 100% complete". Withdrawn;
  inventory decides.
- D5. integrate/tutor-math-r1-host at a5d2068: zero unique
  commits, v2.1-era stub. Tutor-math host integration resumes
  from the frozen R1 package, not this ref.

## ACCEPTED RESIDUALS (documented, ruled, not defects)
- R1 (v1.3). Back-button-then-refresh: browser Back after a
  replaceState Study exit can restore /study-engine from an
  earlier history entry; a refresh then re-enters Study for a
  valid active learner. No popstate handler exists by design.
  Dispatcher-accepted (A4-X ruling): current-entry exit
  normalization is fixed; historical-entry restoration stands.
  Entry-time URL consumption was considered and rejected — it
  would reverse verified mid-Study-refresh behavior.

## PARKED — resumable by card only. Queue order = dependencies.

### A. Study Engine production line  [first in queue]
State (v1.3): MOUNT-2 fixed and merged (CL11). Route lifecycle
e2e-verified (CL12). Exit-URL residual and A4-F2 closed (CL13).
The only surviving edge is accepted residual R1.
Resume path (one card each):
  A1-R. DONE (custody verdict: CONTESTED at ~15-file security
        seam, v2.2 wins by ruling; CHEAP elsewhere).
  A2.   DONE (CL11).
  A3.   DONE (CL9).
  A4.   DONE (CL12; route lifecycle only — runtime depth is
        A4-B by construction).
  A4-X. DONE (CL13).
  A5.   AUTHORIZE Study migration (Dad card), CLI apply against
        hosted Supabase, ledger update. First hosted-touching
        step of the A-line. Requires this v1.3 as the ledger of
        record before dispatch.
  A4-B. RUN runtime-depth e2e post-A5: verified workspace,
        launch scoping per profile, runtime cancellation —
        everything F1 identified as hosted-auth-gated. Currently
        covered only by the merged unit tests (mocked study
        layer).
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
C2 ra-azure-reading — STUB: zero unique commits; dead-or-rebuild
decision.
C3 mkjp-hiragana — STUB: zero unique commits; dead-or-rebuild
decision. Separate from the completed Japanese curriculum FILE
wiring (CL10).
C4 mu-music (1b80cce).

### D. Adaptive Tutor host assembly
Core v0.2, Math R1, corrected English frozen (archives/). Host
custody + conclusive database gates unresolved. Branches on
origin: assembly foundation (f43b652), R1 fix (d4ccb91), English
integration (b10d7ac). English's 46 untracked worktree files
still need matching to the frozen package (investigation card
D-ENG-1 drafted). Math registration may be unblocked
post-recompose — investigation card D-MATH-1 drafted; verify
before building.

### E. Romeo Virtual Academy companion
Branch unreviewed; host audits show no host implementation.
Verify-or-archive investigation card E-ROMEO-1 drafted. Non-code
question for Dad: who operates Romeo Virtual Academy;
enrollment/credit effects.

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

Last updated: August 3, 2026 (v1.3) by Dad + dispatch desk.