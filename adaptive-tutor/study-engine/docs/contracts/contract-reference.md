# Contract reference

All persisted aggregates use this header:

```ts
interface ContractHeader<Kind extends string, Id extends string> {
  kind: Kind
  schemaVersion: 1
  id: Id
  revision: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
  metadata?: {
    source?: 'manual' | 'adaptive-engine' | 'migration' | 'import'
    tags?: string[]
    extensions?: Record<'namespace:key', JsonValue>
  }
}
```

Identifiers are opaque wire strings and branded TypeScript types. Validators
accept legacy-compatible values such as `p1`, `fracUnit`, and
`personal-finance`, then preserve their bytes exactly.

## LessonStudyPlan

Discriminant: `kind: 'lesson-study-plan'`.

The plan carries:

- stable plan, student, lesson, subject, segment, skill, focus-profile, and
  control-set references;
- task types for instruction, examples, guided/independent/retrieval practice,
  reading, writing, discussion, problem solving, project work, mastery checks,
  prerequisite remediation, reflection, and namespaced custom tasks;
- generic grade-band starting ranges;
- subject- and task-specific timing profiles;
- ordered lesson segments and an explicit canonical `segmentSequence`;
- per-segment timing, cognitive-load metadata, active-response requirements,
  break eligibility, mastery-check requirements, prerequisites, and earlier
  segment dependencies.

Runtime invariants include:

- unique, contiguous segment sequences;
- exact agreement between `segments` and `segmentSequence`;
- no dangling or forward dependencies;
- ordered timing ranges;
- a custom task identifier only for `taskType: 'custom'`;
- a required active response has a mode and positive response count;
- a required mastery check has a target, item count, and criterion.

`GradeBandStartingRange` is generic planning guidance. It is never serialized as
a personalized student trait.

## StudentFocusProfile

Discriminant: `kind: 'student-focus-profile'`.

The focus estimate is a closed union:

- `status: 'insufficient-data'` — observation counts, reason, and a generic
  grade-band starting range only.
- `status: 'established'` — evidence-backed baseline work duration, current
  target work duration, comfortable maximum work duration, contextual
  `effectiveWorkBlockRange`, confidence, assessment time, and evidence IDs.

The aggregate also contains:

- default break duration and timer presentation preference;
- task- and subject-specific focus profiles;
- functional accessibility settings;
- minimally described accommodations;
- append-only adjustment history;
- optional adult operational override with reason, provenance, review time,
  optional expiration, and work/break guardrails.

Validation prevents fabricated personalized durations in the insufficient-data
state and requires an active adult maximum to cap the current target.

## StudySession

Discriminant: `kind: 'study-session'`; state discriminant: `status`.

The union covers:

- `planned`
- `active`
- `paused`
- `approved-break`
- `student-requested-break`
- `technical-interruption`
- `completed`
- `abandoned`

All variants preserve session, student, plan, and planned-segment references,
plus an append-only event log. Events carry a stable ID, enclosing session ID,
contiguous sequence, RFC 3339 timestamp, neutral event type, actor, and optional
low-detail references.

Paused, break, and technical states require a valid `ResumePoint`. Terminal
states require a `SessionResult`, end in a matching terminal event, and cannot
carry a resume point. Break and technical-interruption records contain neutral
operational data, never failure or engagement labels.

`SessionResult` partitions the planned segments into completed and remaining
sets; records active, break, and paused seconds separately; references learning
evidence; and recommends a typed next action.

## LearningEvidence

Discriminant: `kind: 'learning-evidence'`.

Optional structured observations cover:

- accuracy and completion counts/percentages;
- independence and sourced confidence, effort, and frustration ratings;
- hint use, tutor intervention, and redirection count;
- response-latency summaries;
- cautious random-response indicators;
- exact next-day recall;
- retention, mastery, and prerequisite-gap outcomes;
- contextual engagement-support interpretation.

At least one observation is required. Null/absence and numeric zero remain
distinct. Counts, percentages, latency ordering, and evidence requirements are
validated.

Random-response indicators explicitly state that they do not establish
inattention. A confirmed prerequisite gap requires named prerequisite skills
and multiple evidence references. Low accuracy alone cannot create an
engagement-support concern or a confirmed prerequisite gap.

## StudentSkillReview

Discriminant: `kind: 'student-skill-review'`.

The schedule records:

- student, subject, and skill references;
- an IANA time zone;
- chronological retrieval attempts;
- the current review interval and next local review date;
- interval adjustment history;
- optional reteaching and prerequisite-remediation triggers.

Canonical intervals are:

- same day (`0`)
- one day (`1`)
- three days (`3`)
- seven days (`7`)
- fourteen days (`14`)
- thirty days (`30`)
- custom (`0..3650`, excluding canonical counts)

Runtime validation checks exact canonical ID/day pairs, local review dates,
calendar-day scheduling, expansion/contraction direction, chronology, and
evidence-backed triggers. These intervals are adaptive defaults, not a claim
that one schedule is universally optimal.

## ParentTeacherControls

Discriminant: `kind: 'parent-teacher-controls'`.

The student-safe adult control record carries:

- maximum work-duration guardrail;
- minimum/default/maximum break duration;
- timer visibility;
- typed, expiring manual overrides;
- recommendation acceptance/rejection audit records;
- functional accommodation settings;
- rescheduling history;
- adult review requests;
- approved interruption categories;
- an optional opaque reference to a separate adult-private record.

The maximum is an operational guardrail, never an estimate of a child trait.
Override values must match their target and stay within parent/teacher caps.

## ParentTeacherPrivateRecord

Discriminant: `kind: 'parent-teacher-private'`.

Private note bodies live only in this separately authorized aggregate. Each note
has a stable ID, parent/teacher author, timestamps, category, body-length bound,
and literal `visibility: 'authorized-adults-only'`.

The controls, focus, session, evidence, and review schemas reject embedded
private-note fields.

