# Core change requests

The requested shared capabilities were not available in the inspected core.
This session did not edit the core.

## CR-01 — Shared opaque identifiers and time primitives

**Requested change:** Add shared branded wire types for student, subject, skill,
lesson, plan, session, evidence, review, and actor IDs, plus validated ISO date,
RFC 3339 date-time, and IANA time-zone values.

**Why needed:** Existing core IDs and dates are plain strings with several
historic naming forms. Study-engine references must preserve old bytes while
preventing accidental cross-kind substitution.

**Proposed interface:**

```ts
type OpaqueId<Name extends string> = string & { readonly __brand: Name }
type ISODate = string & { readonly __brand: 'ISODate' }
type ISODateTime = string & { readonly __brand: 'ISODateTime' }
```

**Backward-compatibility impact:** Additive at compile time; unchanged JSON.

**Temporary adapter:** Use `contracts/legacy-adapters.ts`, then validate the
aggregate. Do not normalize the input ID.

## CR-02 — Shared runtime-validation result and schema registry

**Requested change:** Add a core `RuntimeSchema<T>` abstraction with stable
diagnostic issues and a registry by contract kind.

**Why needed:** Existing guards return booleans or ad hoc errors. Integration,
imports, migrations, and adult diagnostics need stable codes and paths.

**Proposed interface:**

```ts
type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; issues: ValidationIssue[] }

interface RuntimeSchema<T> {
  schemaId: string
  schemaVersion: number
  validate(value: unknown): ValidationResult<T>
  parse(value: unknown): T
  is(value: unknown): value is T
  jsonSchema: JsonSchemaDocument
}
```

**Backward-compatibility impact:** Additive. Existing boolean guards can
delegate to `.is`.

**Temporary adapter:** Import the owned study-engine registry at the
integration boundary.

## CR-03 — Deterministic JSON Schema generation/check

**Requested change:** Provide a shared, dependency-reviewed mechanism to
generate Draft 2020-12 JSON Schema and check committed artifacts for drift.

**Why needed:** The current package has no JSON Schema generator or independent
validator. Cross-language consumers need stable structural documents.

**Proposed interface:**

```ts
generateRegisteredJsonSchemas({ outputDirectory, checkOnly })
```

**Backward-compatibility impact:** None to runtime data; CI gains a deterministic
check.

**Temporary adapter:** Use
`schemas/generate-json-schemas.ts` and the seven committed generated files.

## CR-04 — Versioned study-engine persistence seam

**Requested change:** Add a sidecar repository interface instead of placing
study-engine aggregates directly into the current app-state object.

**Why needed:** The current core has no versioned home for plans, sessions,
evidence, reviews, or control revisions. Direct insertion would couple this
session to core state and migration ownership.

**Proposed interface:**

```ts
interface StudyEngineRepository {
  read<T>(studentId: StudentId, kind: string, id: string): Promise<T | null>
  write<T>(value: T, expectedRevision: number | null): Promise<void>
  appendEvent(sessionId: SessionId, event: StudySessionEvent): Promise<void>
}
```

**Backward-compatibility impact:** Additive if introduced as an optional
sidecar. No current profile key changes.

**Temporary adapter:** In-memory or local sidecar keyed by
`studentId/kind/id`; never overwrite a core profile wholesale.

## CR-05 — Adult-private storage and projection boundary

**Requested change:** Add an authorized-adult repository and an explicit
student-safe projection API.

**Why needed:** Private note bodies and sensitive accommodation details must
not ride in ordinary profile export, sync, student context, or session results.

**Proposed interface:**

```ts
interface AdultPrivateStudyRepository {
  read(recordId: PrivateRecordId, authorization: AdultAuthorization):
    Promise<ParentTeacherPrivateRecord | null>
  write(record: ParentTeacherPrivateRecord, authorization: AdultAuthorization):
    Promise<void>
}

projectStudentSafeControls(controls: ParentTeacherControls): StudentSafeControls
```

**Backward-compatibility impact:** Additive, but export/sync call sites must
explicitly exclude the new private repository.

**Temporary adapter:** Store only `privateRecordRef` in controls; keep the
private record in a separate, adult-authorized store. Do not embed note bodies.

## CR-06 — Household time-zone contract

**Requested change:** Add one validated IANA household time zone to shared
calendar context.

**Why needed:** Same-day and one/three/seven/fourteen/thirty-day reviews are
local calendar concepts. UTC or elapsed-hour arithmetic can schedule the wrong
day around offsets and daylight-saving changes.

**Proposed interface:**

```ts
interface HouseholdCalendarContext {
  timeZone: IanaTimeZone
  localDateAt(timestamp: ISODateTime): ISODate
  addLocalDays(date: ISODate, days: number): ISODate
}
```

**Backward-compatibility impact:** Additive if optional during rollout; review
scheduling should remain disabled or require adult selection when absent.

**Temporary adapter:** Store `timeZone` on each `StudentSkillReview` and use
calendar-day arithmetic.

## CR-07 — Append-only event/evidence retention policy

**Requested change:** Add append APIs, revision checks, and a declared retention
policy for session events, learning evidence, decisions, requests, and private
notes.

**Why needed:** Opportunistic pruning is not a guaranteed deletion or audit
policy. Adaptive decisions also need reproducible evidence references.

**Proposed interface:**

```ts
interface RetentionPolicy {
  category: 'session-event' | 'learning-evidence' | 'adult-private'
  retainForDays: number | 'family-controlled'
  deletionMode: 'automatic' | 'adult-review'
}
```

**Backward-compatibility impact:** Additive. Existing records need an explicit
legacy retention classification rather than silent deletion.

**Temporary adapter:** Keep policies in namespaced metadata and expose an
adult-reviewed cleanup report; do not claim pruning guarantees.

## CR-08 — Functional profile-sidecar update hook

**Requested change:** Add a functional update hook that composes with the
core’s latest-state update discipline.

**Why needed:** Study-engine revisions and core profile changes can otherwise
race and overwrite one another.

**Proposed interface:**

```ts
updateStudySidecar<T>(
  key: StudySidecarKey,
  update: (previous: T | null) => T,
): Promise<T>
```

**Backward-compatibility impact:** Additive.

**Temporary adapter:** Keep study aggregates outside `AppState` and apply
compare-and-swap by `revision`.

