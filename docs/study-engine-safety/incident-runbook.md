# Incident runbook

## Universal rules

Do not copy disclosure text, provider output, credentials, destination data, or learner identity into tickets, chat, logs, or dashboards. Do not bypass readiness, force a `clear` result, or mark delivery without verified evidence. Preserve structured event/proposal/attempt references only in authorized systems.

## `classifier-failure`

1. Confirm readiness, provider configuration-name presence, timeout rate, and breaker state without printing values.
2. Keep the endpoint fail-closed; `invalid` stops Tutor Core and proposes adult review when durable proposal storage is available.
3. Disable traffic only through the approved operational control if proposal safety cannot be maintained.
4. Restore through a tested provider adapter/config revision; observe breaker recovery and malformed/timeout metrics.

## `urgent-classification` and `uncertain-classification`

1. Confirm the event's `adultReviewState` is `recorded-not-delivered`, `duplicate-not-delivered`, or `not-confirmed`.
2. Inspect proposal/outbox state only in the authorized adult-review system.
3. If persistence or recipient resolution failed, follow the corresponding runbook; never tell the learner that an adult was notified without receipt evidence.

## `outbox-backlog`

1. Compare pending count and oldest age by urgency to documented thresholds.
2. Check worker readiness, lease expiry/recovery, recipient resolver health, provider health, and retry scheduling.
3. Scale/restart only using lease-safe operational procedures. Never create ad hoc duplicate jobs.

## `delivery-failure`

1. Inspect structured failure code and immutable attempt state; do not inspect or resend raw disclosure.
2. Preserve the same route-specific idempotency key on retries.
3. For accepted/indeterminate responses, verify provider evidence before any retry; do not claim delivery.
4. Escalate terminal failures to an authorized operational path without substituting caller-supplied contact details.

## `recipient-resolution`

Confirm active household membership, guardian relationship, adult-notification permission, and active private route. Re-resolve and reauthorize; never copy an email/phone from a profile note or request body.

## `duplicate-proposal`

Confirm the duplicate returned the original proposal and did not create a second outbox route. Investigate request replay rates without using raw learner text.

## `unauthorized-request` and `rate-limit`

Check bearer-verification and RLS health, then analyze only counts and HMAC-derived actor references. Do not relax authorization or expose whether a learner/household exists.
