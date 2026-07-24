# CLAUDE.md — Operating Rules for Homeschool HQ

Every session working in this repo follows these rules. They are adapted from a
battle-tested build-discipline manual, scaled to this project: a local family
app, no production deploys, no database, usually one session at a time.

## Roles
- **Dad is the operator.** He accepts milestones by testing the running app,
  authorizes merges to main, and owns all real student data.
- **The session is the implementer.** It builds on a branch, verifies, and
  ENDS AT A REPORT. It never merges to main, deletes data, or runs a migration
  on real profiles without explicit authorization.

## The specs are the contract
- `Homeschool-HQ-Build-Spec-v2.md` = milestones M1–M6.
- `Homeschool-HQ-Tutor-Addendum-v2-1.md` = milestones MT-1–MT-3.
- Build order: M1 → M2 → MT-1 → M3 → M4 → MT-2 → M5 → MT-3 → M6.
- One milestone per cycle. Scope creep = stop and ask. New spec files may
  appear at repo root; if one is untracked, flag it before starting work.

## Cycle structure
1. **Phase 0 (read-only):** check git log/branches for existing or partial work
   on this milestone; recon every assumption the build depends on (schema
   version, existing components, spec acceptance criteria). Mismatch between
   assumption and disk = STOP and report, don't improvise.
2. **Branch:** one branch per milestone (`m2-morning-mission`). Main stays
   working at all times — the girls may use the app mid-build.
3. **Data safety:** before ANY code that touches stored profiles runs against
   real data: export real localStorage to `backups/` (timestamped, gitignored)
   AND write the migration test first. This rule has no exceptions.
4. **Build + verify:** typecheck, vitest, and a live browser run-through of the
   milestone's "Accept when" criteria from the spec.
5. **END AT A REPORT.** The report states: what changed (file list + summary),
   gate results (typecheck/tests/live checks, pass or fail, honestly), the
   commit sha ON THE BRANCH, and the acceptance checklist for Dad to verify
   himself in the browser. Then stop. No merge, no tag.

## The hard rules
1. **Assert only after commit.** Never report a sha, a "done," or a passing
   test for work that isn't committed. Never state results from memory —
   re-run the command and report actual output.
2. **Disk is truth; reports are claims.** Before acting on any prior report
   (including your own from earlier in the session), re-verify against the
   working tree and git. Cited things that don't exist = STOP and say so.
3. **Test gate before merge.** A milestone with failing or skipped checks
   cannot be submitted for acceptance. Failures are reported loudly, never
   silently worked around.
4. **Merges are explicit.** Merge to main only when Dad's message contains
   "ACCEPTED" (or clear equivalent) naming the milestone. Then: confirm main
   hasn't moved unexpectedly → merge → re-run gates on main → tag
   (`v2.0-m2` pattern) → report new main sha.
5. **Never fabricate, never smooth over.** If something is broken, half-done,
   or unverified, the report says exactly that. A hard stop costs minutes; a
   plausible-sounding false report costs the family's trust in the whole
   system. When Dad catches an inconsistency, the answer is the honest state
   of things, full stop.
6. **All state writes are functional updates.** Every write to profile or app
   state MUST derive its base from the updater's `prev`, never from a render or
   ref snapshot — `setState(s => patchProfile(s, id, prev => next))`, never
   `setProfile(reducer(snapshot, ...))`. Cross-component write callbacks pass an
   updater (`(prev) => next`), not a pre-computed value. This is what lets two
   writes in one tick — or a finish racing the final answer — compose instead of
   clobbering. See `appState.patchProfile` and `src/stateHardening.test.ts`.

## Standing project rules (from the specs — enforced here too)
- The app never stores official grades. The Excel gradebook is the permanent
  record; the app tracks daily work and mastery display only.
- Schema changes: bump `schemaVersion`, add a migration + test, document in
  `MIGRATIONS.md`, never delete prior-version keys from localStorage.
- Teen profiles get the clean theme — no Comic Sans, no confetti, ever.
- AI tutor (MT-2): system prompt constraints in the addendum are load-bearing
  safety rules for children, not suggestions. The tutor never gives final
  answers, never exceeds caps, and always logs transcripts for Dad.
- The API key, real profile data, and `backups/` never get committed.

## If parallel sessions ever run
Default is ONE session at a time. If two run: disjoint milestones only, each
declares its branch in its first commit message, any session finding an
in-progress branch overlapping its scope hard-stops, and merges queue
serially through Dad.

### Subagent directive (within one session)
Use parallel subagents only for file-disjoint authoring or verification. Schema
edits, shared-file edits, integration across the write contract, the final gates
(typecheck/vitest/build), and the report ALL stay in the main thread. The report
states what was delegated to subagents and what stayed in the main thread.

## Failure culture
A stopped line is a success. Freeze → establish disk truth read-only →
report the verdict → remediate under these rules. Any incident that reveals
a gap in these rules gets a new rule added to this file (via Dad's approval).
