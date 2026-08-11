# Admin correlation and incident explorer

The Admin Incident Explorer is a privacy-minimized operational read surface. It
is not a raw log viewer and has no developer-mode bypass. It follows only a
trusted execution/request key already shared by operational telemetry and
provider accounting, or the canonical UUID correlation field on Admin audit
events. It never correlates by account, household, learner, or content.

## Bounded search

`GET /api/admin/v1/correlations` accepts an optional safe correlation ID plus a
bounded time range, source domain, engine, operational result, Admin audit
action/resource, page limit, and opaque cursor. The default range is the prior
24 hours, the maximum range is 90 days, and each page is limited to 100 safe
events. Cursors are bound to the canonical query so they cannot be silently
reused with different filters. Both supplied endpoints are inclusive, while
the descending `(occurred_at, event_id)` cursor is exclusive. The server rejects
an end time beyond its own observation clock.

The service reads provider accounting through its existing indexed service-only
table access and uses the existing bounded Admin audit RPC. Operational events
intentionally have no direct service table grant and the legacy RPC omits the
execution key, so the smallest additive read-only migration adds a bounded
`engines:read` runtime incident projection. Provider accounting projects status
only; it does not return account/household/learner references, provider payloads,
usage payloads, or bigint cost values.

The additive migration is
`20260810180000_academy_admin_correlation_runtime_read.sql`. Its prefix was
selected after scanning active Academy worktrees; the latest observed active
prefix was `20260810170000`. The migration has not been applied hosted.

## Independent authorization and evidence state

Each source is independently authorized with the narrowest existing read
capability:

- runtime telemetry: `engines:read`
- Admin audit: `audit:read`
- provider accounting: `costs:read`

An unauthorized or failed source is omitted while independently authorized
sources remain usable. The response labels every event with its source and
reports source availability, rejected malformed entry count, retention limits,
and a bounded `complete` or `partial` evidence state. Runtime, audit, and
provider records remain separate semantic events even when their correlation
IDs match. Runtime retention completeness is reported by the database reference
clock; the exact 30-day expiry boundary is retention-limited.

## Privacy and malformed data

Server projections are rebuilt field by field. The runtime projection includes
only event ID, correlation ID, timestamp, engine, event type, result, duration,
and selected allowlisted operational metadata. Admin audit includes only the
existing safe transition DTO. Provider accounting includes only provider,
product, engine, result, reason, billing disposition, and accounting state.

Prompts, responses, assessment answers, learner identity, audio, journals,
private notes, provider raw request/response, secrets, raw backend errors, and
diagnostic or personality inference are never selected or returned. Unknown,
secret-like, prohibited, or malformed fields reject that entry without
invalidating other timeline evidence. The browser validates the same exact DTO
again and renders bounded details field by field rather than dumping JSON.
