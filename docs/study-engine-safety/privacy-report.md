# Privacy and data-minimization report

## Data flow

The browser sends only a request UUID, session UUID, typed learner reference, schema version, and transient text. It attaches the existing bearer token without cookies, local storage, session storage, or caller-supplied household/recipient claims. The classification function keeps the text in local memory only through normalization, deterministic evaluation, and the server provider call.

The durable proposal allowlist is limited to schema version, proposal/household/student/session identifiers, category, classification, urgency, reason codes, classifier version, occurrence time, idempotency key, delivery state, and authorized-recipient resolution state. It rejects raw disclosure, transcript, answer, diagnosis, prompts, provider output, chain of thought, credentials, and private note bodies.

The delivery payload is smaller still: a stable idempotency key, opaque recipient/route references, and a fixed generic adult-review template. It contains no learner text, classification, category, urgency, reason code, student identifier, destination, or adult-private content.

## Retention and logging

- Raw learner text: transient process memory only; no proposal/outbox/monitoring field can accept it.
- Provider raw output: parsed transiently and never logged or persisted.
- Adult route/destination: held behind the recipient resolver; client and proposal records receive only opaque references.
- Monitoring: enumerated event names/codes with bounded counts, ages, attempt numbers, and approved adult-review states; no subject identifiers.
- Test corpus: entirely hand-authored synthetic content, version 1; no production or student data.

## Browser and secret boundary

New Study browser files contain no provider environment-variable name, server provider URL, service-role reference, recipient field, provider receipt, or persistence import. Required server variable names are:

- `SUPABASE_URL` = `[REDACTED]`
- `SUPABASE_ANON_KEY` = `[REDACTED]`
- `ANTHROPIC_API_KEY` = `[REDACTED]`
- `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY` = `[REDACTED]`

No values were printed or committed. The repository-wide pre-existing browser key handling noted in the threat model is outside this change and remains a production blocker.
