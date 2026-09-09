# Tutor V2 bounded session memory

`TutorSessionMemoryStore` is an in-process, non-durable facility. Every access
requires the original opaque Study scope: household, learner, session,
interaction, and lesson references must all match. A mismatch fails closed, so
an entry cannot silently follow a learner into another scope.

The state schema contains only bounded booleans, counts, enums, timestamps, and
opaque references. It has no field capable of storing raw Tutor prose,
transcripts, private notes, credentials, personality labels, diagnoses, parent
secrets, or sibling data. Closed-schema validation rejects those additions.

Defaults and hard ceilings are exported constants: at most 32 live entries,
eight strategy references, 12 understood-step references, 24 represented
interventions, and a two-hour TTL ceiling. Expired entries are deleted on access
or purge. Reset deletes an entry. Ending a session deletes live state and returns
only a non-durable minimized checkpoint with transient strategy, hint,
misconception-hypothesis, visual, and last-action fields removed. Any protected
durable checkpoint bridge is intentionally outside this facility.
