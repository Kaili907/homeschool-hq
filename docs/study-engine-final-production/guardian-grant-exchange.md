# Guardian grant exchange

1. Verify the Supabase session.
2. Accept a learner selector only; derive guardian, household, relationship, and permission on the server.
3. Issue a short-lived opaque Study launch reference.
4. Keep the reference only inside the browser identity-client closure.
5. Verify the required capability for every academic request.
6. Revalidate current underlying authority inside the same transaction as the read or mutation.
7. On logout, learner switch, rotation, expiry, readiness loss, or revocation: abort the browser generation, clear the closure, and best-effort revoke. Server rejection remains authoritative.

Invalid, expired, revoked, wrong-purpose, wrong-capability, rotated, and replayed references fail closed. A grant is never sufficient after its underlying membership or relationship is revoked.
