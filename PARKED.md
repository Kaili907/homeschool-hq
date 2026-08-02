# PARKED.md — Workstream Ledger for Manuel Academy

Authoritative reconciliation of every known workstream as of
August 3, 2026. Compiled from the project-wide status sweep
(2026-08-02), the dispatch desk record, and Dad-terminal
verification. Canonical master at time of writing: 704a748
(docs merge; parents 5be50ff = v2.2 and 7bb6383 = operating rules
v3).

Rules of this file:
- No session re-investigates anything listed CLOSED or DEAD.
- No session resumes anything listed PARKED without a dispatch
  card from Dad that names the item's ID from this file.
- Claims about remote/branch state are verified in Dad's terminal
  before action, per CLAUDE.md verification hierarchy.
- Session numbers were REUSED across workstreams ("Session 5",
  "Session 20" exist twice). Never transfer a session number
  without its workstream name.

---

## CLOSED — resolved by the v2.2 line, verified. No action ever.

- CL1. Production custody: master 704a748; published Netlify
  deploy 6a6f3653 = v2.2 (5be50ff); auto-publish LOCKED.
- CL2. Safe household sync / CAS: merged via 3K→3M lineage
  (e513172) into v2.2.
- CL3. Student identity canonical history: hardened lineage
  (ba8b634 / 879f75b) shipped in v2.2.
- CL4. AI/TTS gateway "DO NOT INTEGRATE" verdict: remediated in
  v2.2 (entitlement, daily usage ledger, timeouts, size bounds,
  direct-provider paths stripped, fail-closed flags), reviewed
  independently, conditions verified. Provider spend caps set
  (Anthropic $15/mo hard, $10 alert; ElevenLabs structurally
  capped).
- CL5. Hosted Supabase: schema reset Aug 2 via CLI; four-row
  migration ledger (profiles base, hardened identity, CAS,
  gateway usage) is authoritative and its provenance is the v2.2
  migration chain. The "hosted-only gateway migration" mystery
  from Study Session 21 is this ledger. The Study migration was
  NEVER applied — correct and intentional.
- CL6. RC1 remote custody: the Study Engine RC1 source is
  integrate/study-engine-final-assembly (ea8e976) on origin.
- CL7. LADDER: was a Claude-side card proposal (grade-progression
  skill strands), never dispatched anywhere. Not lost work;
  future work. The label maps to no artifact by design.

## DEAD — declared by Dad, August 3, 2026. Preserved as forensics
only. Never integrate, never resume, never re-litigate.

- D1. Root pnpm workspace conversion (pnpm-lock.yaml,
  pnpm-workspace.yaml). Unauthorized, no provenance. npm +
  package-lock.json remains the baseline. Forensic copy lives in
  wip/laptop-local-preserve.
- D2. The label "CARD 19 — FINAL LOCAL RECONCILIATION". No
  recoverable prompt, identity, or artifact. Not the same thing
  as Study Engine Session 19 (which is real; see A below).
- D3. Superseded package variants: Study Runtime R1, Study
  Calendar R2, pre-R1 aligned Tutor Math zip, pre-correction
  English zip, earlier bridge/reconciliation revisions. Retained
  in archives/ as receipts; never source.
- D4. The claim "RFL M1/M2 media 100% complete, QA passed".
  Withdrawn as unsupported. The 12-lesson curriculum WRITING is
  complete; media completeness is whatever the file inventory
  proves (see F).

## PARKED — preserved, mapped, resumable by card only.
Queue order reflects dependencies. Nothing here is on the
critical path for the school year.

### A. Study Engine production line  [first in queue]
Source of truth: sweep items O2/O3, O6–O12; sessions 15–21 +
MOUNT-1/2 (workstream: Study Engine production).
State: RC1 frozen on remote (CL6). Sessions 15/16/17 exist as
sibling branches/local work with required compose order 15→16→17.
Session 19 "final production candidate" reported committed
locally; the laptop wip trove (src/study/, adult-review worker,
in wip/laptop-local-preserve at bab318e) is its probable but
UNVERIFIED disk form. MOUNT-2 found a blocking lifecycle defect
(fresh navigation/refresh at /study-engine returns profile picker
before route evaluation). Session 20 (Study workstream) auth e2e
never ran from correct source. Hosted preflight resolved by CL5
except the Study migration decision itself.
Resume path (each step = one card):
  A1. VERIFY: match wip trove against Session 19 claims →
      MATCHED (continue) or UNMATCHED (evidence only, restart
      from last verified point).
  A2. FIX: MOUNT-2 refresh defect + lifecycle regression tests.
  A3. COMPOSE: 15→16→17 in order, one reconciled branch.
  A4. RUN: Session 20 auth e2e from the verified candidate.
  A5. AUTHORIZE: Study migration card (Dad), CLI apply, ledger.
  A6. BLOCKING GATE before any student use: production safety
      classifier injected AND startup mode assertion (production
      build refuses mode != "production"); classifierVersion
      logged at boot.

### B. Wave 1 quartet
Frozen packages in archives/ + PC trove (mu-music branch commit
1b80cce). Integrations never started or blocked.
  B1. Mastery Map — blocked on the specified 5C correction
      (custody, single mastery authority, learner/provenance
      validation, remove unauthorized Study dependency,
      reproducible browser evidence).
  B2. AI Safety Center — packaging custody first (seven
      directory-entry violations: waive formally or repackage +
      re-verify), then integration decision.
  B3. Schedule Recovery — frozen, no first integration decision.
  B4. External Course Capture — frozen; identity/calendar/
      timezone/persistence seams unresolved.

### C. Enrichment branches — four merge-or-dead decisions
  C1. a5-grade5-math — blocked: host grade model excludes
      Grade 5; identity support must land first.
  C2. ra-azure-reading — diff isolation + own gates needed;
      historical package/Netlify overlap.
  C3. mkjp-hiragana — needs clean authoritative branch; separate
      from the Japanese curriculum FILE wiring (which is its own
      small task: Week-N headings + move into
      src/curriculum/plans/).
  C4. mu-music — branch preserved incl. later edits (1b80cce);
      mission seam unwired; final-edit intent unrecovered.

### D. Adaptive Tutor host assembly
Core v0.2, Math R1, corrected English frozen and canonical
(archives/). Host custody, registry, renderer/accessibility,
Grade 5 identity, and conclusive database/sync gates unresolved.
English: 46 untracked files in a worktree need matching to the
frozen package before any branch is trusted.

### E. Romeo Virtual Academy companion
Branch feature/romeo-virtual-academy-companion (3 Netlify
previews, Jul 28) unreviewed; host audits show no host
implementation; RC1 intentionally omits Romeo delivery.
Decision needed: verify-and-finish or archive. SEPARATE
non-code question for Dad: who operates Romeo Virtual Academy,
and does enrollment affect homeschool/credit status.

### F. Ready for Life media completion
Curriculum writing complete (D4 note). Media zips preserved in
archives/. Required before any host talk: reconcile expected
manifest vs actual approved binaries; finish or formally reduce
scope. Host implementation remains gated (was: on foundation —
now satisfied — but stays parked behind A–E by queue order and
behind assessment week by priority).

### G. Roadmap items never started (no artifacts exist)
Weekly intelligence report; voice/oral-response analysis;
portfolio/attendance/transcript records; accommodations &
motivation system; Romeo deferred captures/imports; LADDER
(CL7); VOICE-PICKER (card exists, gated on: docs landed [done],
assessment week underway, Dad's voice audition + allowlist).

---

## THE CRITICAL PATH (not parked, not code)
1. Placement assessments — five students. Everything above is
   enhancement; this is the school.
2. Year scopes for four students — gated on 1.
3. Household onboarding to hosted sync (deliberate, post-v2.2,
   after 1).

Last updated: August 3, 2026 by Dad + dispatch desk.
