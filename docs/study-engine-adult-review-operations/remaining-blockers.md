# Remaining Blockers and Conditions

- Session 16 must compose and verify the worker credential boundary, durable
  ports, structured server log, and denial-audit callback. The default handlers
  intentionally return `service_not_ready` until then.
- Session 18 must complete hosted read-only preflight and flag any legacy
  non-opaque permission/route references for controlled reprovisioning.
- The approved migration process must apply the reserved migration before any
  route can operate against hosted data.
- Product/policy must explicitly permit the in-app route as the available
  production delivery route. Email has no approved vendor and remains
  `not-ready`; SMS remains disabled.
- The repository migration-order test owns a hard-coded pre-Session-17 filename
  list outside this session’s permitted files. It must be updated by its owner
  to include the reserved migration; Session 17 does not weaken or edit it.
- Two untouched local-development calendar tests fail with
  `event_out_of_order` under the current runtime date. They reproduce in
  isolation and live in host/Tutor integration code outside Session 17
  ownership; no frozen code or assertion was changed.
