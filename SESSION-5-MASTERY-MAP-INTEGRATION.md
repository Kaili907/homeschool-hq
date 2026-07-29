# Session 5 — Mastery Map foundation integration

## Scope and custody

- Repository: `https://github.com/Kaili907/homeschool-hq.git`
- Default branch: `master`
- Baseline commit: `15644974628ead6704c1e97e959cdbd801fdd1b3`
- Integration branch: `integrate/wave1-mastery-map`
- Frozen artifact:
  `manuel-academy-mastery-map-session-1-corrected.zip`
- Frozen artifact size: `832700` bytes
- Frozen artifact SHA-256:
  `78c86a953b36414ec8f31e7e9168d9f0ebb1243eb8754a463037b30958b39701`

The archive contained 56 regular entries: 54 manifest-controlled files, the
embedded manifest, and the embedded verification record. Archive-to-staging,
manifest-to-staging, staging-to-worktree, and post-integration destination
checks all passed with zero missing, unexpected, or mismatched files. Only the
54 manifest-controlled files were copied into the host. Git attributes disable
line-ending conversion for frozen paths.

The package's required canonical type import was absent from `master`.
`adaptive-tutor/study-engine/contracts/common.ts` was installed byte-for-byte
from the separately frozen Study Engine Contracts v1 artifact:

- `CARD-1-STUDY-CONTRACTS.zip` SHA-256:
  `79ba0f39688db42197947915aa421bca540ad060c072e898e86619f0a66b6f41`
- `common.ts` size: `3555` bytes
- `common.ts` SHA-256:
  `4b34c7b1dc4331da809b4a7c97675e4ef4ebd54b27c305b73555a32be90b7fa3`

This canonical Study Engine contract is not Adaptive Tutor Core v0.2. No
Adaptive Tutor Core file was added, edited, reconstructed, or replaced.

## Host integration boundary

The host adapter is isolated under `src/integrations/mastery/`.

- The learner route requires an ephemeral learner principal established only
  after the existing learner PIN flow.
- A persisted `activeProfileId` is not treated as a fresh login.
- The active state key, active profile identity, and authenticated learner
  identity must all match.
- The learner UI mounts `StudentMasteryMap` directly. Parent detail and manual
  override controls are not mounted.
- The read model uses only learner ID, name, grade, and frozen mastery-domain
  records. It does not read or translate legacy skill estimates, completion,
  attendance, transfer credit, schedules, assessment completion, tutor state,
  adult approval, or UI state.
- Exact evidence replays are idempotent at the host boundary. Reuse of an
  evidence ID with different content or learner scope fails closed.
- No persistence, migration, RLS policy, RPC, Supabase change, or profile
  schema change was added.

The current route intentionally displays a foundation-mode empty model because
no approved production skill catalog, evidence producer, or sidecar persistence
contract is available.

## Mastery Change Request review

All requests in
`adaptive-learning/mastery/core-change-requests.md` were reviewed. None is
implemented or represented as resolved by this foundation integration.

| Request | Session 5 disposition |
| --- | --- |
| MCR-001 canonical learning-event envelope | Unresolved; no host producer exposes the required stable event and replay identities. |
| MCR-002 explicit independent-demonstration outcome | Unresolved; automatic promotion remains blocked. Unsupported host signals produce no mastery evidence. |
| MCR-003 assessment item-to-skill mapping | Unresolved; no canonical item mapping or independence assertion exists. |
| MCR-004 tutor intervention event | Unresolved; existing walkthrough counters are not adapted. |
| MCR-005 prerequisite outcome mapping | Unresolved; actual Adaptive Tutor Core v0.2 enums remain unavailable. |
| MCR-006 sidecar persistence and optimistic revision | Unresolved; no production storage or compare-and-swap implementation was added. |
| MCR-007 authenticated adult override command | Unresolved; parent detail and override controls remain unmounted. |
| MCR-008 versioned skill catalog publication | Unresolved; the route does not productionize sample fixtures. |
| MCR-009 review-scheduler handoff | Unresolved; no scheduler or calendar mapping was guessed. |

## Production blockers

This branch is a validated foundation integration, not a production-data
release. Production readiness requires Director-approved work for:

1. a versioned canonical skill catalog;
2. authenticated production learner sessions beyond the local family PIN;
3. explicit evidence producers, including independent-demonstration
   attestations;
4. learner-scoped sidecar persistence with atomic compare-and-swap revisions;
5. adult authorization and atomic override audit persistence; and
6. review-scheduler handoff semantics.

No database change was made in this session.

## Validation record

All commands used Node `v22.23.1` and npm with the repository lockfile.

- Baseline: typecheck passed; 32 files / 499 tests passed; production build
  passed with the existing chunk-size advisory.
- Frozen package typechecks: mastery domain, UI, and test contract passed.
- Frozen runtime validation: passed for 2 graphs, 18 evidence events, 9
  records, all 6 states, cycle rejection, completion-only rejection, override
  audit, unknown-property rejection, and future-version rejection.
- Complete frozen scoped suite: 4 files / 51 tests passed.
- Independent host probes: 1 file / 8 tests passed.
- Scoped host regression: 33 files / 507 tests passed.
- Complete host test command: 37 files / 558 tests passed.
- Host typecheck: passed.
- Production build: passed with the pre-existing chunk-size advisory.
- npm audit: 0 vulnerabilities.
- `git diff --check`: passed.
- Credential-shape scan: 63 changed text files scanned, 0 candidates, 0
  tracked `.env`-like files.
- Browser route smoke: authenticated learner entry passed; refresh returned to
  the picker and required a fresh PIN; adult surfaces exposed no learner map,
  parent detail, or override control; 0 browser console errors.
- Repository lint/format scripts: not configured on the baseline branch.

Nothing was merged or deployed.
