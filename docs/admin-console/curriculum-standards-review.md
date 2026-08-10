# Curriculum standards human review

CURR-STANDARDS-01 adds an Admin workspace at
`/academy/admin/curriculum/standards-review` for unresolved
`standards.human_review_required` findings. It records verified human decisions
without changing the immutable `1.0.0` release or any draft entity payload.

## Repository evidence and queue

The known evidence adapter reads only tracked release metadata: the immutable
Physical Education unit metadata (including its immutable lesson IDs) plus the
assessment files for Grades
5, 7, and 8. It preserves standalone local labels `2`, `3`, `4`, and `5` as
unresolved. It does not infer an official identifier, framework version,
wording, or source.

| Local label | Grade 5 | Grade 7 | Grade 8 | Units | Lessons | Assessments | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `2` | 56 | 56 | 42 | 11 | 132 | 11 | 154 |
| `3` | 28 | 28 | 28 | 6 | 72 | 6 | 84 |
| `4` | 56 | 70 | 56 | 13 | 156 | 13 | 182 |
| `5` | 84 | 70 | 84 | 17 | 204 | 17 | 238 |
| **Total** | **224** | **224** | **210** | **47** | **564** | **47** | **658** |

The session safety brief cautioned against silently rewriting “670 references,”
but that number is not asserted as repository fact. Direct parsing of the
tracked standalone labels produces the 658 occurrences above; the product does
not manufacture twelve additional findings to match the cautionary number.

The workspace groups and filters by source label, grade, course, release/draft
context, affected count, and review state. Search includes affected entity
references. Each review item exposes the exact ADMIN-18 finding IDs and a
drill-down across unit, lesson, and assessment references.

## Lifecycle and evidence gate

The bounded presentation lifecycle is:

- `unreviewed` — derived when no persisted decision exists;
- `in_review` — an authorized curriculum author is investigating;
- `approved_mapping` — an owner records a verified mapping with complete evidence;
- `rejected_mapping` — the proposed mapping is rejected with a bounded reason;
- `needs_evidence` — evidence is insufficient, with a bounded reason.

`approved_mapping` requires all of the following, independently enforced by the
browser adapter, server parser, database RPC, table constraint, and validation
engine consumption boundary:

- canonical standard identifier;
- framework and version;
- human-readable title or text, required by Curriculum Schema Set v2;
- evidence/source reference; and
- reviewer reason/note.

The database accepts none of those mapping fields for a non-approved state.
Rejected and needs-evidence decisions require a reviewer note. The application
does not fetch standards facts and never auto-converts labels `2`, `3`, `4`, or
`5`.

## Authorization, persistence, and audit

`GET /api/admin/curriculum/standards-reviews/:contextKind/:contextRef` requires
the existing `curriculum:read` capability. `POST
/api/admin/curriculum/standards-reviews` requires
`curriculum:drafts:write` for workflow-state decisions and the stronger existing
`curriculum:approve` capability for `approved_mapping`. The trusted server
derives the actor and request digest. The database re-resolves the active Admin
assignment and exact capability on every RPC invocation.

The migration creates:

- `public.academy_curriculum_standard_reviews`, an identity-stable decision
  ledger with forced RLS, exact finding sets, revision CAS, and evidence checks;
- `academy_private.curriculum_standard_review_request_receipts`, a forced-RLS
  idempotency ledger; and
- narrow service-role RPCs
  `academy_admin_list_curriculum_standard_reviews_v1` and
  `academy_admin_update_curriculum_standard_review_v1`.

No application role has direct table access. Matching request UUID/digest pairs
replay the original result; changed input under the same UUID is rejected.
Stale revisions and changed finding identities fail without a state or audit
write.

The smallest additive audit vocabulary is
`curriculum_standard_review.update` on `curriculum_standard_review`. Audit old
and new values contain only status and revision. Mapping facts, evidence text,
reviewer notes, curriculum payloads, and entity lists are not copied into audit
rows.

## Publication blocking and application semantics

ADMIN-18 keeps every human-review finding blocking by default. During an
authoritative publication validation, a decision clears only an exact finding
ID when its state is `approved_mapping` and all four mapping/evidence fields are
complete. `unreviewed`, `in_review`, `rejected_mapping`, `needs_evidence`, stale
finding sets, and incomplete approvals remain blocking.

Decisions are stored separately. This card deliberately provides no
apply-to-draft action and never rewrites published content. A later explicit
apply workflow must use draft-authoring authority, entity and draft CAS, and a
separate user action; it may not silently rewrite the 658 repository-evidenced
references.

## Migration status

The tracked migration is
`supabase/migrations/20260810130000_academy_curriculum_standards_review.sql`.
Version `20260810130000` was selected only after inventorying migration names
across the repository worktrees; parallel `20260810120000` names were already
in use. The migration remains repository-only and has not been applied to a
hosted project.
