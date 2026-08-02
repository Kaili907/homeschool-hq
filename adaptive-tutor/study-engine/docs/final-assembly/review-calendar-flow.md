# Review and learner-calendar flow

`accepted minimized evidence → Study review recommendation → idempotent outbox proposal → bounded review queue → canonical review result → accepted ledger entry → interval decision → learner-local placement`

Placement requires an explicit intended local date, scheduled start with numeric offset, household IANA timezone, and an exact `earlier` or `later` disambiguation choice for overlaps. Invalid timezones, impossible dates, DST gaps, host-timezone dependence, overload, and duplicates fail closed or route to manual review.

Partial completion records completed segments, exact cursor, and remaining minutes. One continuation block is created with a uniqueness key; replay cannot create a second calendar entry. Required-instruction reserve remains binding on same-day retry placement.
