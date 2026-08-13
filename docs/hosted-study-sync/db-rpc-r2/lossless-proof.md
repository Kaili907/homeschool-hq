# Lossless Device-B proof

The V2 hydrate projection reconstructs every minimized continuation field from
canonical typed storage or an exact validated JSON object:

| Local state | Server authority | Hydrate projection |
| --- | --- | --- |
| Session identity | explicit link + canonical session | local and hosted household/student/assignment/session references |
| Completion | canonical session | state, started time, completed time, session revision |
| Checkpoint | canonical checkpoint | contract/version/id/revision/times, local session ref, lesson/segment, safe cursor, completed segments, per-segment active time, paused/break totals, protected draft/Tutor refs, event ref/version, interaction ref, technical interruption, privacy flags |
| Social attached source | session authority `social_source` | exact student/assignment/lesson/source refs, title, publisher, published/attached times, satisfied status |
| RFL | session authority `guardian_attestation` | exact binding, authority, pending/certified status, learner assertion time, attestation time, attesting adult ref, evidence mode |
| Safety | session authority `safety_holds` | complete ordered hold history with hold ref, exact student/session, creation time, status, reason, source, dedupe key, acknowledgement and clear authority metadata when present |
| Assessment | session authority `assessment_state` | exact assignment/assessment/student/course refs, subject, grade, title, authority class, status and lifecycle timestamps |

The import test starts with local and hosted session identifiers that differ,
imports checkpoint revision 3 plus all R1-missing domains, then hydrates the
local identity and full checkpoint back. Subsequent tests write checkpoint
revision 4, clear one safety hold while retaining another, certify the RFL and
assessment records, complete the session, and verify one hydrate contains the
exact converged Device-B state and revisions.

No parallel checkpoint or session document is introduced. Local session IDs in
checkpoint payloads are translated only at the canonical foreign-key boundary
and translated back through the explicit mapping on hydrate.
