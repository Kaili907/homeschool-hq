# Card 5 reconciliation integration record

Status: **RECONCILED FOR THIS LOCAL LAB**

Laptop correction: the accepted authority is
`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`, SHA-256
`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`,
38,300 bytes and 18 central-directory entries. The formerly cited
`CARD-5-STUDY-RECON-AUDIT.zip` (`0.5.0-blocked.1`, SHA-256
`2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`)
is not the accepted R2 archive. Any conflicting historical statements below
are superseded by this correction and `six-decision-parity-report.md`.

Card 5 arrived during Session 8’s final availability check. The provisional
first-wins resolver was retired before packaging.

## Verified input

- Accepted archive entries: 18
- Accepted archive size: 38,300 bytes
- Accepted archive checksum: verified

Production integration and final assembly remain separately unauthorized; that
does not block the Session 8 local runtime.

## Applied Card 5 decisions

The DEC labels are dispatch crosswalk identifiers: they do not occur literally
in the accepted R2 archive, and R2 does not contain
`reconciliation/probes/policy.mjs`.

The former linear rule:

```text
Safety → Accommodation → Parent maximum → Manual → Engine → Default
```

is replaced by constraint reduction:

1. Reject an unsupported version, failed integrity, or unauthorized actor.
2. Apply safety vetoes and bounds.
3. Compose all enabled required accommodation bounds/obligations.
4. Apply the most restrictive active authorized adult hard maximum.
5. Compute the feasible interval; an empty interval returns `manual-review`.
6. Choose an active valid manual target/hold/reduce candidate; otherwise an
   accepted engine recommendation; otherwise an established target; otherwise
   the grade-band default.
7. Clamp the candidate to the feasible interval.
8. Record the candidate source/value, final target, all binding constraints,
   feasible bounds, reason code, and applied clamp provenance.

Acceptance or rejection remains separate from hard-control mutation. Rejection
suppresses only its recommendation ID.

## Adapter boundary

The Card 8 adapter is local and typed. It calls the Card 5 reference function
without editing or copying the reconciliation package. Parent settings expose:

- `status`: resolved, manual-review, or quarantine;
- Card 5 reason code and policy version;
- candidate source/value;
- effective target or `null`;
- lower/upper feasible bounds;
- every applied constraint;
- parent-facing winner and explanation.

Break and timer accommodations remain typed obligations. Adult-private note
bodies remain on the separately authorized projection.

## Parity gate

The Session 8 parent tests replay Card 5 fixtures for:

- hard maximum clamping a hold/manual target;
- required accommodation clamping looser parent/manual values;
- infeasible bounds routing to manual review;
- rejected recommendation not applying;
- unsupported version, failed integrity, and unauthorized actor quarantining.

No provisional Card 5 badge or manifest status remains in the packaged lab.

The remaining reconciled seams are:

- **DEC-009:** aggregate-only independence conversion is a safe local adapter;
  it cannot establish mastery, diagnosis, prerequisite authority, or a hidden
  learner trait.
- **DEC-014:** same-day is a learner-local civil date, never immediate.
  `retryNotBefore` stays null unless an authorized adult/scheduler supplies the
  offset instant after the required preparation and break/session boundary.
- **DEC-017:** canonical result return uses a versioned idempotent command and
  memory-only outbox with stable review, occurrence/queue, session, result,
  attempt, and evidence identities.
- **DEC-018:** Romeo input/update is versioned; the public/calendar seam uses
  opaque `hostLaunchRef`; tutoring support uses
  `VersionedReference<StudyPlanId>`; due date remains date-only; progress
  domains remain separate.
- **DEC-019:** private bodies stay in a separate adult-private repository,
  parent-only audiences are never widened, adult operational events are
  metadata-only, and the student-private projection is empty.

These decisions are locally conformed and tested. They do not remove Card 5’s
Tutor Core blocker or authorize final assembly.
