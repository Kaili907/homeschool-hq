# Session 18 Hosted Preflight Dependency Map

Session 18 performs read-only hosted verification before the reserved migration
is approved for application.

- Confirm base migration lineage through Session 15 and exact expected object
  names, owners, RLS flags, grants, constraints, and function signatures.
- Confirm the reserved Session 17 migration has not already been applied and no
  object collision exists.
- Count existing proposal/job values and prove every historical label is covered
  by the canonical mapping.
- Check existing permission/route references. Non-SHA recipient/route references
  intentionally do not resolve through v2 and require controlled reprovisioning,
  never an in-place contact-derived conversion.
- Check monitoring rows remain valid under the combined v1/v2 allowlist and
  expanded severity/service/schema constraints.
- Estimate table sizes and lock duration for constraints/default backfills.
- Verify no direct grants or learner policies would expose private relations.
- Verify worker registry and route capabilities are absent before migration and
  remain unconfigured/not-ready immediately afterward until Session 16 setup.
- Confirm no provider credentials or real recipient contacts are queried or
  printed during preflight.
