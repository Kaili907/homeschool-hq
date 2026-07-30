# Integration notes

## Boundary rule

Treat all storage, import, network, browser, and cross-module payloads as
`unknown`. Select the schema by trusted route or by `kind`, validate once, then
pass the typed value into the engine.

```ts
import {
  getStudyEngineSchemaForValue,
  migrateStudyEngineContractToCurrent,
} from '../../schemas/index.ts'

const migration = migrateStudyEngineContractToCurrent(untrustedValue)
if (!migration.ok) {
  // Quarantine and show an adult-safe diagnostic. Do not overwrite source data.
  return
}

const schema = getStudyEngineSchemaForValue(migration.value)
if (!schema) return
```

Do not coerce invalid values or silently insert inferred focus durations at this
boundary.

## Recommended persistence shape

Until the core supplies a versioned seam, persist the seven aggregates as
sidecars keyed by `(studentId, kind, id)`:

- lesson study plans;
- focus profiles;
- study sessions;
- learning evidence;
- skill reviews;
- parent/teacher controls;
- adult-private records in a separately authorized store.

Use optimistic `revision` checks for replaceable aggregates. Keep session
events, evidence, adjustments, decisions, rescheduling, review requests, and
private-note revisions append-oriented/auditable.

## Student-safe projection

Student-facing consumers may receive plan, focus, session, evidence, review, and
approved control fields only as needed. They must never receive:

- `ParentTeacherPrivateRecord` or note bodies;
- adult actor details not needed for the view;
- credentials, authentication data, provider keys, or parent PINs;
- raw keystrokes, audio, foreground-app names, or browsing history;
- diagnostic or permanent labels.

The student-safe controls contract holds only `privateRecordRef`, not note
bodies. A student projection should omit even that opaque reference unless the
surface needs to show that an adult note exists.

## Time and review dates

New timestamps are RFC 3339. Review dates are `YYYY-MM-DD` interpreted in the
recorded IANA `timeZone`. Do not compute same-day or one-day review dates by
adding 24 elapsed hours; add local calendar days.

## Identifier compatibility

Use the temporary adapters in `contracts/legacy-adapters.ts`. They preserve
bytes; validation then enforces the wire ID format. Never translate `fracUnit`
to another spelling or derive session/plan IDs from array positions.

## Safety integration

- Keep the focus `insufficient-data` state until enough eligible, comparable
  observations exist.
- Treat grade-band ranges as generic starting guidance.
- Do not display an effective work-block range as a permanent student number.
- Never infer engagement concerns or prerequisite gaps from low accuracy alone.
- Preserve technical interruptions and student-requested breaks as neutral
  operational states.
- Parent/teacher maximum work duration is a guardrail, not an assessment.
- A confirmed prerequisite gap requires the evidence contract’s independent
  support.

## Generated schemas

Run:

```powershell
node adaptive-tutor/study-engine/schemas/generate-json-schemas.ts
```

Commit the resulting `schemas/generated/*.schema.json` with the source
descriptor. CI should run the generator with `--check` and fail on drift.

JSON Schema expresses the portable structural layer. Runtime validation remains
authoritative for graph references, chronological ordering, calendar/time-zone
checks, exact percentages, state/result agreement, privacy, and safety
refinements.

