# Provider Architecture

## Durable in-app route

`academy_study_deliver_in_app_notification_v2` performs the notification insert,
receipt insert, attempt-event append, and job transition in one database
transaction. It locks and validates the leased job, rechecks live permission,
membership, relationship, route, attempt generation, provider acceptance, and
idempotency binding, then returns minimized verified evidence.

The guardian projection exposes only notification ID, learner-safe title,
reason category, urgency, timestamps, read state, and approved action reference.
Read state is independent of delivered state. Duplicate delivery returns the
existing notification and bound receipt; a conflicting reuse of the
idempotency key fails closed.

The only stored content is the fixed title plus bounded categorical metadata.
No disclosure, transcript, classifier prompt/output, contact value, or provider
payload is accepted.

## External providers

The provider-neutral adapter requires explicit readiness, server-only contact
resolution, stable idempotency, submission notification, a strict timeout
classification, reconciliation support where available, and verified minimized
receipt evidence. Test providers are rejected in production mode.

Repository inspection found no approved email provider or configuration
pattern. Therefore email is `not-ready`; no vendor was invented and no provider
was called. SMS is explicitly disabled. Governance must approve a vendor,
contact-resolution boundary, credential/configuration ownership, receipt
verification method, webhook/reconciliation model, and retention terms before
either route can become production-ready.
