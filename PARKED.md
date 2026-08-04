# PARKED.md — Workstream Ledger for Manuel Academy (v1.4)

Authoritative reconciliation of every known workstream. v1.4,
August 4, 2026: closes A5 (hosted state EQUIVALENT-TO-AUDITED)
with riders; corrects CL5 as to fact; records the dashboard
representation finding and reference hashes as standing
knowledge; closes D-ENG-1; records the D-MATH-1 verdict and
lifts the D-MATH-2 hold; reclassifies E-Romeo VERIFY-WORTHY;
records CURR-1 (delivered, not merged); adds SCHED-1 (approved
in principle); updates VOICE-PICKER; adds the sequencing
snapshot and three presence-check open items.

Canonical master at time of writing: 6e78632 (PARKED v1.3;
ancestors d28e94a A4-X exit-URL normalization, 6c9d024 A2
merge, 6222ba4 PARKED v1.2, 88dbc39 recompose, 5115a00 JP-1,
ab22a0c PARKED v1.0, 704a748 docs, 5be50ff v2.2). Published
production remains v2.2 (5be50ff); Netlify auto-publish LOCKED.

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
- Dashboard hygiene (v1.4): the Supabase SQL editor persists
  unsaved tab text across sessions — select-all/delete the
  editor before running any dashboard query.

## KNOWN-FLAKY TESTS (watch; not yet actionable)
- src/sync/useSync.mounted.test.tsx — failed once in a full-suite
  run during A2-R (error-message mismatch), passed in isolation
  and on all subsequent full runs (A4, A4-X-R). One occurrence;
  log future occurrences here.

## HOSTED VERIFICATION — standing knowledge (v1.4)
- Dashboard representation finding: "View migration SQL"
  reconstructs from the ledger's statements array: blank lines
  BETWEEN statements are dropped (17 in 160000), blanks INSIDE
  statement bodies are preserved (20). Local 546 lines = hosted
  view 529 = 509 substantive both. Dashboard line numbers
  therefore drift from file line numbers — benign; any future
  hosted-vs-local equivalence check must use blank-line-stripped
  normalization.
- Reference hashes. Local raw-byte SHA-256s of the six Study
  migrations at 6e78632 (recorded from the A5-PRE pre-flight
  paste; 160000 re-witnessed fresh Aug 4):
  - 20260801010000 = 2d3123ce42fc7d602745d43fc5392359b7e383946b6ff646f19fe46c09b364b1
  - 20260801011000 = 72f43830f0c80145a016847dbad266b2c348bd2d3e8727500ec382932501b2ac
  - 20260801012000 = 6e9fc40845e51e090bc0b5561e3b68ae69dc360b0445ae484dbc4682e101ba34
  - 20260801160000 = f803fbd3aa2c93ac94775c37f262e476d142d2974d5a3c5162050133dc6f9414
  - 20260801170000 = fece2318c482b8421d88572d1facb9e6293c0b3e8add521f5ff6f062dfda6107
  - 20260801190000 = 83c27caec34b3c685e86fe0b070aca00b4882263df146c829ae06920ac244c6a
- Hosted content_md5 fingerprints per version (md5 of joined
  statements arrays, Chrome round 1):
  - 20260724074106 = 993aceade5a8fade17b68c641342472c
  - 20260724230000 = 3cda983cb7e5d757dd8089f09c5b651a
  - 20260726120000 = 6ca96f3dda460c0b140d1e6d5a9da7fa
  - 20260731120000 = 1dcf1a94e9939663cf184e8555357a82
  - 20260801010000 = 0186a78f2a0cbd4b5be4d144e41bab7e
  - 20260801011000 = 7533a2a9bc8fa3a3cf14b050b98ea905
  - 20260801012000 = 224af074257a637fc75eb5b98cbe484d
  - 20260801160000 = 59187949a5044a2fedbbc6e1020523de
  - 20260801170000 = 6d6e3c9ca4ab64c71c4c031b6a07c70a
  - 20260801190000 = b00965f64b371e63923a2f377e32ba99

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
- CL5 (CORRECTED v1.4). Hosted Supabase. The prior claim
  "Study migration NEVER applied — intentional" is FALSE as to
  fact: the ten-migration chain is applied on hosted (CLI
  evidence Aug 3, content verification Aug 4 — see CL14).
  Authorship and apply-time remain OPEN — ledger "Inserted at"
  is version-derived (no apply-time evidence exists); the
  unsaved-editor breadcrumb
  (academy_study_final_production_readiness_v1) suggests
  readiness checks ran ~Aug 1, likely the Codex line; question
  formally owed to the ChatGPT desk. Do not record authorship
  until answered.
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
- CL14 (new). A5 CLOSED — Study line. Ruling: hosted state
  EQUIVALENT-TO-AUDITED; all ten migrations were already
  applied on hosted before the Aug 3 db push (which no-op'd:
  "Remote database is up to date"). Evidence chain,
  terminal-witnessed in the Aug 4 dispatch thread: master
  6e78632; migrations dir clean; local 160000 raw-byte SHA-256
  f803fbd3aa2c93ac94775c37f262e476d142d2974d5a3c5162050133dc6f9414
  matching the A5-PRE pre-flight record; scope-limited
  read-only dashboard capture of applied 160000 SQL (529 lines,
  gutter-only numbering, ends commit;); blank-line-normalized
  SHA-256 identical both sides:
  AF22430400802FAEB51AB6F8B0DFD99FB5701F660C9C9F55689B74D9531AB172
  (509 substantive lines each); round-2 function inventory
  (129 functions: 45 academy_private + 84 public) and RLS map
  (46 tables: 27 private forced; public 10 forced + 9
  enabled-not-forced, all pre-Study v2.2 tables) reconcile with
  A5-PRE. Riders:
  (a) Readiness-RPC re-map: the installed function is
      public.academy_study_verified_identity_readiness_v1
      (A5-PRE's short name verified_identity_readiness_v1 never
      existed; both 42883 errors were a stale-editor artifact).
      EXECUTION HOLD: invoking it is hosted contact —
      dispatcher authorization required; rides with A4-B.
  (b) A5-PRE prose correction: 160000 contains 5
      create-function statements — 4 public SECURITY DEFINER
      RPCs (issue_guardian_launch_v1, verify_session_v1,
      revoke_session_v1, verified_identity_readiness_v1) + 1
      private trigger-protection function
      (study_protect_session_identity_fields); counting
      convention, not substance.
  (c) Accepted residuals recorded as R2 (see ACCEPTED
      RESIDUALS).

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
  from the frozen R1 package, not this ref. (v1.4: D-MATH-1
  confirmed the a5d2068 stub = the v2.1 tag; stays dead.)

## ACCEPTED RESIDUALS (documented, ruled, not defects)
- R1 (v1.3). Back-button-then-refresh: browser Back after a
  replaceState Study exit can restore /study-engine from an
  earlier history entry; a refresh then re-enters Study for a
  valid active learner. No popstate handler exists by design.
  Dispatcher-accepted (A4-X ruling): current-entry exit
  normalization is fixed; historical-entry restoration stands.
  Entry-time URL consumption was considered and rejected — it
  would reverse verified mid-Study-refresh behavior.
- R2 (v1.4, A5 riders). (i) The other nine migrations stand on
  version-ledger match + structural reconciliation, not byte
  comparison (procedure proven at ~10 min/file if ever wanted,
  not load-bearing). (ii) The hosted statements-array md5s were
  not independently reproduced locally (belt-and-braces only).

## PARKED — resumable by card only. Queue order = dependencies.

Sequencing snapshot (v1.4): Study line A5 ✅ → A4-B next
(carries the readiness-RPC execution under authorization) → A6
remains the BLOCKING gate before any student use of the Study
Engine. Parallel-eligible post-v1.4: D-MATH-2, CURR-1-R,
SCHED-1, A4-B, D-ENG-2. Critical path unchanged: five placement
assessments never administered; four daughters' year scopes
gated on them.

### A. Study Engine production line  [first in queue]
State (v1.4): MOUNT-2 fixed and merged (CL11). Route lifecycle
e2e-verified (CL12). Exit-URL residual and A4-F2 closed (CL13).
A5 closed (CL14): hosted state EQUIVALENT-TO-AUDITED. The only
surviving edge is accepted residual R1 (plus A5 residual R2).
Resume path (one card each):
  A1-R. DONE (custody verdict: CONTESTED at ~15-file security
        seam, v2.2 wins by ruling; CHEAP elsewhere).
  A2.   DONE (CL11).
  A3.   DONE (CL9).
  A4.   DONE (CL12; route lifecycle only — runtime depth is
        A4-B by construction).
  A4-X. DONE (CL13).
  A5.   DONE (CL14; hosted state EQUIVALENT-TO-AUDITED — the
        ten-migration chain was already applied; the Aug 3 db
        push no-op'd; no new hosted write occurred).
  A4-B. RUN runtime-depth e2e post-A5 [NEXT]: verified
        workspace, launch scoping per profile, runtime
        cancellation — everything F1 identified as
        hosted-auth-gated. Currently covered only by the merged
        unit tests (mocked study layer). Carries the CL14(a)
        rider: first invocation of
        public.academy_study_verified_identity_readiness_v1 is
        hosted contact and runs only under dispatcher
        authorization.
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
Core v0.2, Math R1, corrected English frozen. (v1.4 location
correction: archives/ is NOT on disk; the frozen-artifact
custody gap converges with CURR-1's blocker — one custody card
can serve both.) Host custody + conclusive database gates
unresolved. Branches on origin: assembly foundation (f43b652),
R1 fix (d4ccb91), English integration (b10d7ac).
- D-ENG-1 (v1.4): CLOSED. 46/46 files matched by SHA-256;
  corrected-package freeze hash
  2dfb31856c9bdfb96827b8fc266280dfc3b8218100fbad480fcb36111582926d;
  files committed as 99b903c on integrate/adaptive-english-v0.2.0
  (tip b10d7ac). The prior "still untracked" premise was
  stale — corrected.
- D-ENG-2 (verify 8 host-integration files + O17/C31 gates):
  approved in principle, undispatched, now sequence-eligible
  post-A5.
- D-MATH-1 (v1.4): verdict PARTIALLY-BLOCKED recorded.
  Canonical frozen Math R1 hash
  ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351,
  preserved in the 7df73c9 wip tree. Registration is
  client-side, NOT A5-gated. Blockers: package content absent
  from tree; registration point is a hardcoded ternary at
  tutor-bridge.ts:150; validate-package.ts:77-78 guard rejects
  subjects/math — amendment AUTHORIZED by dispatcher ruling;
  bridge single-item flattening.
- D-MATH-2: scoped, approved in principle — HELD status LIFTED
  (A5 closed); dispatch-eligible.
- D5 stub (a5d2068) confirmed = the v2.1 tag; stays dead (see
  DEAD D5).

### E. Romeo Virtual Academy companion
Reclassified VERIFY-WORTHY (v1.4):
feature/romeo-virtual-academy-companion (tip 3901403) holds the
only copy of complete client-side Phase 1 (contract module,
panel, prompt rules, tests, docs incl. the ChatGPT Project
instructions); base v2.0-mp. NEVER MERGE — resume shape is
re-apply onto master (~39 lines across 3 seam-colliding files).
OPEN ACTION: GitHub PR #1 points at this branch; Dad closes it
in the browser (unconfirmed as of v1.4). Non-code Romeo
questions (operator, enrollment/credit effects) remain Dad's.

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
candidate IDs collected Aug 3; v1.4: stray "Lauren" voice
removal CONFIRMED executed (Dad, ElevenLabs dashboard, Aug 4);
Academy collection = the 8 audition candidates only; remaining
gates: assessment week + Dad's ear audition, then final
ELEVENLABS_ALLOWED_VOICE_IDS]).

### H. CURR — curriculum import (grades 5/7/8)
CURR-1 (v1.4): DELIVERED-AND-WITNESSED, NOT MERGED, NO MERGE
AUTHORIZATION. Branch
claude/integrate-curriculum-grades-5-7-8-s5u0wp, tip
b0a7d7ed97e883fc29ddd97b1ffe74e1359d2225 (witnessed); 209 files
vs master (witnessed); collision holds ANSWERED-CLEAR —
witnessed findstr over the full changed-file list returned no
hits for tutor-bridge / validate-package / adaptive-tutor.
Disclosed seam contact: src/types.ts (Grade union +5/7/8),
src/sync/provenance.ts, src/migration.ts, src/App.tsx,
src/components/Picker.tsx, provenance.academy.test.ts. Content:
curriculum-content/manuel-academy/1.0.0/ — 30 courses / 232
units / 2,736 lessons (session-verified). Flags
VITE_ACADEMY_GRADE_{5,7,8}_ENABLED all OFF. Adapters
built/tested/unmounted (gated on Study and Tutor lines
resuming). Embedded-Postgres suite honestly reported NOT
PASSED–environmental (container, per the v1.3 environment
note). CURR-1-R mandatory before any merge word: fresh session,
PC, separate worktree, full gates incl.
academy-cas.postgres.test.ts, walkthrough re-runs.
Frozen-artifact blocker (three ZIPs absent from repo:
grade5-math, adaptive-english-mvp-v0.2.0, ready-for-life-v1)
converges with D-MATH-1's custody gap — one custody card can
serve both. Roster note: grades 5/7/8 serve no enrolled student
in 2026-27. Dispatching-desk attribution OPEN (handoff said
ChatGPT-side; report shape indicates Claude session; Dad to
confirm). CURR-2: next-planned, undispatched,
builder-never-reviews.

### I. SCHED — schedule template line
SCHED-1 (v1.4, new, approved in principle). Reusable schedule
template "Core Day v1" for all five profiles p1–p5: Math
9:00–9:30 daily; Reading 9:30–10:00; break 10:00–10:15;
Writing/Spelling alternating 10:15–10:45; Science M/W or Social
Studies T/Th 10:45–11:15; shared read-aloud 11:15–11:30;
Friday = rotating flex (library / art / nature walk / field
trip / catch-up). Per-girl extension supported from day one
(the 10th/12th graders extend with credit-bearing coursework
post-assessment). v1 scope is Parent Hub only (template +
per-girl weekly calendar view); the student-facing daily view
is GATED BEHIND A6. Note: academy_study_calendar_blocks already
exists on hosted (round-2 RLS map). No tutor-seam contact;
parallel-eligible with D-MATH-2. Card drafts after v1.4 lands.

---

## OPEN ITEMS (v1.4 presence check — absent from v1.3, added)
- OI1. Generative image/video API policy: lesson specs
  referencing openai-images.json / kling-3-omni.json —
  prohibited pending explicit dispatcher ruling; video dirs
  were empty, blocked-assets present.
- OI2. Wave 1 Sessions 2/3 packaging spot-check: possible
  latent pre-correction package-artifact.ps1 defect.
- OI3. MCR-002 vs Session 4 transfer-credit tension.

---

## THE CRITICAL PATH (not parked, not code)
1. Placement assessments — five students. NEVER administered;
   app has been capable since v2.2. Blocked by nothing.
2. Year scopes for four students — gated on 1.
3. Household onboarding to hosted sync — after 1.

Last updated: August 4, 2026 (v1.4) by Dad + dispatch desk.