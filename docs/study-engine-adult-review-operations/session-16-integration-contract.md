# Session 16 Integration Contract

Session 16 owns host production composition and verified learner identity. It
must not use Session 15 v1 claim/delivery operations after this migration has
canonicalized state labels. Compose the v2 Session 17 adapter instead.

Required composition:

1. Build a durable worker-authorizer that verifies the Netlify scheduled event
   or approved admin invocation, verifies the configured credential digest and
   registry revision, and returns the exact registered worker ID.
2. Wire proposal claim/resolution recording, job claim/lease operations,
   attempt events, in-app delivery/verification, rate limiting, monitoring, and
   retention to their v2 RPCs.
3. Build monitoring with the Supabase durable sink and an approved structured
   server log. Record authorization denial at this outer boundary because an
   exception raised inside one database transaction cannot durably retain an
   audit insert from that same transaction.
4. Enable only `academy-in-app` / `in-app-config-v1`. Keep email and SMS disabled.
5. Require readiness before claim or send. Treat any loss/duplication/routing/
   receipt dependency degradation as blocking.
6. Use verified host learner/household identity; never accept household,
   membership, permission, recipient, route authority, or contact values from a
   learner/browser request.
7. Use opaque `recipient:<sha256>` and `route:<sha256>` values when provisioning
   explicit permission/routes through the existing server-only setup RPCs.
8. Do not expose worker, resolver, job, attempt, receipt, or route details in
   client responses.

Session 16 must add its own composition tests for environment variable presence
using names only and must not log values.
