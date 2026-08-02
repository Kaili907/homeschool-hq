# PARKED.md — Workstream Ledger for Manuel Academy (v1.1)

Authoritative reconciliation of every known workstream. v1.1,
August 3, 2026: corrects two dispatcher errors in v1.0 (CL6
asserted a push that had not occurred; the wip tip sha was wrong),
incorporates Session A1's custody findings, and adds the
session-to-branch map following the fourteen-branch laptop push
(witnessed in Dad's terminal, Aug 3).

Canonical master at time of writing: ab22a0c (PARKED.md v1.0
merge; ancestors 704a748 docs merge, 5be50ff v2.2).

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
- No branch named "study-engine-host-mount" exists. MOUNT-1 work
  is presumed inside host-runtime or the S19 candidate; the A1
  re-run must determine which.
- runtime-closure and final-production-candidate share tip
  b492924; treat as one line until proven otherwise.

## CLOSED — verified. No action ever.
- CL1. Production custody: published Netlify deploy 6a6f3653 =
  v2.2 (5be50ff); auto-publish LOCKED. Master advances by docs
  merges only since.
- CL2. Safe household sync / CAS: merged into v2.2.
- CL3. Student identity canonical history: hardened lineage in
  v2.2.
- CL4. AI/TTS gateway remediation: shipped in v2.2, reviewed,
  conditions verified; provider spend caps set.
- CL5. Hosted Supabase: four-row ledger authoritative (v2.2
  chain, applied via CLI Aug 2). Study migration NEVER applied —
  intentional.
- CL6 (corrected): RC1 source integrate/study-engine-final-
  assembly (ea8e976) is on origin AS OF AUG 3 — pushed and
  ls-remote-witnessed in Dad's terminal. v1.0 asserted this
  before it was true; the assertion was false when written.
- CL7. LADDER: Claude-side proposal, never dispatched. Future
  work, not lost work.
- CL8 (new). The full Study Engine / Tutor branch estate is on
  origin (fourteen-branch push, Aug 3, terminal-witnessed).

## DEAD — declared by Dad. Forensics only.
- D1. Root pnpm workspace conversion. Unauthorized; npm baseline
  stands.
- D2. The label "CARD 19". Distinct from Study S19, which is real
  (see map).
- D3. Superseded package variants (Runtime R1, Calendar R2,
  pre-R1 Math, pre-correction English, early bridge revisions).
- D4. The claim "RFL M1/M2 media 100% complete". Withdrawn;
  inventory decides.
- D5 (new). integrate/tutor-math-r1-host at a5d2068: zero unique
  commits, a v2.1-era stub. Dead as a branch; tutor-math host
  integration resumes under D-line cards from the frozen R1
  package, not from this ref.

## PARKED — resumable by card only. Queue order = dependencies.

### A. Study Engine production line  [first in queue]
State (post-A1): the laptop wip trove (wip/laptop-local-preserve,
fb275f2 content commit, 7df73c9 archive tip) is NOT the S19
candidate — it is a 6-file adult-review-v2 fragment with broken
imports (missing ./types, ./stateMachine). The true candidate is
the S19 branch (b492924, on origin). MOUNT-2's blocking defect
(fresh navigation/refresh at /study-engine returns profile picker
before route evaluation) remains unfixed; the route code was
absent from the wip fragment and must be located in the S19/
host-runtime trees.
Resume path (one card each):
  A1-R. RE-VERIFY custody against real refs: does b492924
        contain the 15-16-17 composition over RC1? Where does
        the /study-engine route live? Is the wip fragment
        subsumed (then mark it superseded) or does it hold
        unique content?
  A2.   FIX MOUNT-2 defect + lifecycle regression tests.
  A3.   COMPOSE 15-16-17 if A1-R finds the candidate incomplete;
        skip if already composed.
  A4.   RUN authenticated e2e from the verified candidate.
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
C2 ra-azure-reading. C3 mkjp-hiragana (separate from the small
Japanese curriculum FILE wiring task). C4 mu-music (1b80cce).

### D. Adaptive Tutor host assembly
Core v0.2, Math R1, corrected English frozen (archives/). Host
custody + conclusive database gates unresolved. Branches now on
origin: assembly foundation (f43b652), R1 fix (d4ccb91), English
integration (b10d7ac). English's 46 untracked worktree files
still need matching to the frozen package.

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
Romeo deferred imports; LADDER; VOICE-PICKER (card exists; gates:
docs landed [done], assessment week underway, voice audition +
allowlist).

---

## THE CRITICAL PATH (not parked, not code)
1. Placement assessments — five students.
2. Year scopes for four students — gated on 1.
3. Household onboarding to hosted sync — after 1.

Last updated: August 3, 2026 (v1.1) by Dad + dispatch desk.
