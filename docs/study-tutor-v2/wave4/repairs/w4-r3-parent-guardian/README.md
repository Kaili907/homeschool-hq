# W4-R3 Parent Guardian Authority Repair

Status: ready for Wave 4 reconvergence.

This repair closes the five W4-10 Parent/guardian escapes without adding
mutable replay state. Parent report generation now accepts two distinct
boundaries:

1. the serialized report request, which is always untrusted; and
2. a detached `study-parent-report-trusted-authority` snapshot supplied by
   Study/policy authority.

Missing or malformed detached authority fails closed. Tutor output, provider
output, telemetry, memory, curriculum admission, and Parent requests are not
valid substitutes for either guardian authorization or the detached authority
snapshot.

## Consent and policy binding

The trusted policy record declares the current policy revision and whether
consent is required. Report input cannot redefine that requirement. Every
consent branch is bound to the exact:

- guardian, household, and learner;
- authorization reference and revision;
- policy reference and revision;
- `parent-report` visibility; and
- session or reporting-period reference.

Required consent additionally carries a consent reference, consent revision,
current revision, and revision status. The consent must be granted and current.
A sibling consent reference, sibling learner scope, stale consent revision, or
`required` to `not-required` substitution is rejected against the detached
trusted snapshot.

## Authorization replay and freshness

Authorization is bound to one `reportRef`, its exact session/reporting-period
scope, the current policy revision, an issuance event, and an issuance/expiry
window. Current-revision equality is required; consumed, superseded, revoked,
stale, not-yet-valid, and expired authorization is rejected.

Reusing an authorization for a different `reportRef` is replay and is
rejected. Rebuilding the exact same report with the same authority snapshot is
deterministic idempotence and remains allowed. A new report requires a newly
bound current authorization. This pure contract uses no process-global or
cross-request mutable state.

## Closed truthfulness model

Each submitted evidence row must have a detached trusted Study receipt with
the same evidence identity, source event, learner/scope, policy revision,
reason, and timestamp. The receipt uses a closed terminal state:

| Trusted state | Required Study event | Allowed report claim |
| --- | --- | --- |
| `TUTOR_PROPOSED` | proposal event | `tutor-proposed` decision reason |
| `STUDY_APPROVED` | proposal + approval events | `study-approved` decision reason |
| `STUDY_APPLIED` | proposal + approval + applied events | `study-applied` decision reason |
| `STUDY_COMPLETED` | distinct completion event | `practice-completed` |
| `STUDY_RECORDED` | distinct observation event | non-decision recorded facts |

The receipt source event must equal the terminal event for the state. Illegal
state/reason combinations reject. In particular, Tutor-proposed cannot be
relabeled Study-applied, and Study-approved cannot be reclassified as completed
practice.

## Preserved boundaries

Exact schemas continue to reject sibling evidence, raw Tutor transcripts,
provider responses or prose, raw learner answers, diagnosis, emotion labels,
personality judgments, and arbitrary fields. Rejections do not reflect private
input. Pending Tutor and Study-approved reviewed copy continues to disclaim
application and completion.
