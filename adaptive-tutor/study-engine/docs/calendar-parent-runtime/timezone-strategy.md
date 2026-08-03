# Household timezone strategy

## Authority and storage

The household supplies one explicit, supported IANA timezone, demonstrated
with `America/New_York`. It is an input to every placement and grouping
operation; the browser or Node host timezone is never an implicit fallback.
Calendar blocks preserve all of:

- `scheduledStart`: an ISO 8601 instant with `Z` or an explicit numeric offset;
- `householdTimeZone`: the household IANA timezone used to group and display
  that instant;
- `scheduledLocalStart`: the requested learner wall minute;
- `intendedLocalDate`: the guarded learner civil date;
- `placementSource`: `explicit-offset` or the visibly provisional
  `lab-wall-time-resolution`.

Review due dates remain canonical `YYYY-MM-DD` civil dates interpreted in the
review record's IANA zone. They are never created by adding 24 elapsed hours to
a midnight instant. Production integration should supply the explicit offset
instant plus intended date. Wall-minute resolution remains only an isolated
lab compatibility path and is labeled as such.

## Same-day retry windows

A same-day recommendation is converted to a learner-local retry window, not an
immediate duplicate block:

1. Preserve `notBeforeLocalDate`, `dueByLocalDate`, `attemptOrdinal`,
   `dailyAttemptLimit`, household IANA zone, and the required support-boundary
   reference from Card 5 DEC-014.
2. Require the applicable reteaching or prerequisite-remediation evidence.
3. Require a matching completed break or session boundary.
4. Leave `retryNotBefore` null and route to `manual-review` if no authorized
   scheduler/adult policy supplies an offset-bearing instant. The adapter never
   derives a time by adding cooldown minutes.
5. Validate the authorized instant against the learner-local date, household
   zone, latest allowed local time, completed preparation/boundary, and daily
   attempt limit.
6. Reserve required instruction before fitting review work.
7. Preserve the canonical review ID, occurrence/queue ID, and attempt ordinal
   as independent stable identities.

If no same-day capacity remains, the queue keeps the recommendation pending
with a visible capacity reason. It does not silently move it or crowd out
required instruction.

## Daylight-saving behavior

The runtime uses `Intl.DateTimeFormat` with the stored IANA zone for grouping
and display. Test fixtures cover both 2026 transitions in New York:

| Transition | Learner wall minute or choice | Resolved instant or result |
| --- | --- | --- |
| Spring forward, March 8 | `01:59` | `2026-03-08T06:59:00.000Z` |
| Spring forward, March 8 | `02:30` | Rejected as `nonexistent_local_time` |
| Spring forward, March 8 | `03:00` | `2026-03-08T07:00:00.000Z` |
| Fall back, November 1 | `00:59` | `2026-11-01T04:59:00.000Z` |
| Fall overlap at `01:30` | `earlier` | `2026-11-01T05:30:00.000Z` |
| Fall overlap at `01:30` | `later` | `2026-11-01T06:30:00.000Z` |
| Fall back, November 1 | `02:00` | `2026-11-01T07:00:00.000Z` |

For ambiguous fall-back wall times, the offset-bearing input or an explicit
`earlier`/`later` disambiguation is authoritative. An authorized retry window
must include an explicit offset and the unchanged IANA zone; the runtime does
not generate an instant from a date-only recommendation. Consumers must not
discard either field.

## Validation and failure behavior

- Unknown IANA zones are rejected as `invalid_time_zone`.
- Instants without `Z` or a numeric offset are rejected at adapter boundaries.
- An intended local date may be supplied as a guard; a mismatch fails rather
  than silently moving the block.
- An explicit instant that does not map to the supplied wall minute in the
  household zone is rejected.
- Drag/drop and parent rescheduling preserve the household zone unless an
  explicit, validated new zone is included.
- The host-independence fixture produces byte-identical results after the Node
  host zone is changed among `UTC`, `Pacific/Honolulu`, and `Asia/Tokyo`.

## Runtime-data caveat

`Intl` timezone behavior comes from the ICU/tzdb data shipped by the executing
browser or Node runtime. The lab pins a Node runtime floor and asserts the
known 2026 New York transition instants, but it does not ship or update tzdb.
Production should pin supported runtimes, monitor tzdb changes, and retain both
the offset-bearing instant and IANA zone so future rendering is auditable.
