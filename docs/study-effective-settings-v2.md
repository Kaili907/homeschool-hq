# Study Effective Settings V2

Status: implemented locally; migration not applied hosted; production composition remains not-ready.

V2 is the authoritative, minimized Study settings projection used between the
existing guardian/accommodation persistence boundary and future Admin
configuration and Study production composition.

## Authority and result contract

The deterministic precedence is:

`admin_default < guardian < accommodation < safety`

Admin values fill missing settings only. A guardian value is never replaced by
an Admin default. Required accommodations and safety constraints then reduce
the legal range; safety is evaluated last. An empty legal work or break range
returns `manual_review` without an invented value.

Every result uses schema version 2 and exactly one frozen state:

- `ready`: minimized effective values plus per-field source categories.
- `manual_review`: safe reason codes and source categories only.
- `unavailable`: a safe authoritative-source reason code only.

The source vocabulary is `admin_default`, `guardian`, `accommodation`, and
`safety`. No accommodation ID, provenance reference, actor, private note,
conversation, emotional label, personality judgment, or diagnostic inference
is returned.

## Break semantics

The Admin/default setting is `required_break_interval_minutes`. V2 does not add
an Admin-level required-break count. The established guardian `required_breaks`
column is projected as `minimumBreakCount`; when a guardian record is absent it
has the neutral value `0` and no source category. The effective result retains
both constraints, allowing runtime scheduling to satisfy the interval and the
guardian minimum count together.

Required accommodation and safety break intervals use the smallest configured
interval. Required break duration raises the effective minimum, while the
safety maximum can lower the effective maximum. A minimum above the maximum is
`manual_review`.

## Persistence and authorization

`20260810120200_academy_study_effective_settings_v2.sql` adds two typed private
singleton records:

- `study_effective_settings_admin_defaults`
- `study_effective_settings_safety_policy`

They are fixed-column domain records, not a generic JSON setting store. Both
use enabled and forced RLS, have no application-role table grants, and seed
non-sensitive defaults/outer safety bounds. There is no browser mutation API.
Future Admin configuration work can add a reviewed, audited mutation boundary
without changing the V2 consumer contract.

`academy_study_effective_settings_v2(uuid,date)` is `SECURITY DEFINER` with
`search_path=pg_catalog`. It derives the caller from `auth.uid()`, reuses the
existing Study household/learner authorization predicate, grants execution only
to `authenticated`, and rejects cross-household access. V1 remains unchanged
for compatibility.

## Production readiness

The parent-settings production registration now requires an explicit live V2
effective-settings readiness probe. Missing, `manual_review`, malformed,
throwing, or `unavailable` probes map to `not-ready`; only `ready` can satisfy
this part of the registration. The checked-in production host still supplies no
complete academic composition, so this change cannot make Study production
ready by itself.
