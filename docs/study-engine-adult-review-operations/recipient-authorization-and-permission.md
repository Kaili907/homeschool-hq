# Recipient Authorization and Notification Permission

Resolution is server-only. A recipient is eligible only when the proposal,
permission, route, household membership, guardian-to-student access, household,
and learner all match; membership and relationship are active; the member role
is guardian; permission is explicit, active, not revoked, and effective at the
safety-event time; and the requested route is active and allowed.

Permission is not inferred from UI access, a parent PIN, household ownership,
contact presence, prior notification, browser claims, or service-role use.
Session 17 adds `effective_at`, optional `expires_at`, permission version 2, and
live expiry checks. Delivery and guardian reads re-check current expiry and
revocation, so permission that was valid at proposal time cannot authorize a
later send or read after termination.

The v2 resolver emits only:

- `recipient:<sha256>`
- `permission:<sha256>` and its revision
- recipient schema version and effective time
- route and `route:<sha256>` with route revision

No membership ID, guardian access ID, user ID, email, phone, address, or contact
value leaves the resolver. Recording the resolution re-derives and compares the
permission reference, revision, effective timestamp, recipient version, route
revision, household, and learner. Caller-forged recipient arrays cannot create
jobs outside those bindings.

Learner roles receive no permission, recipient, route, notification, attempt,
or receipt projection and therefore no adult-review existence signal.
