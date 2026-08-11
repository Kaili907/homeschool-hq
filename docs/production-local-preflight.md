# Unified local production preflight

The unified local production preflight is one operator entrypoint over three
existing authorities:

- Admin production activation preflight R3;
- the read-only migration reconciliation planner; and
- the Study production deployment-environment preflight.

It preserves each subsystem's complete result. The aggregate status selects one
deterministic highest-priority classification, while `blockers` and the operator
report continue to list every simultaneous blocker.

## Commands

Operator-readable output:

```powershell
npm.cmd run preflight:production-local
```

Machine-readable JSON:

```powershell
npm.cmd run preflight:production-local:json
```

The command exits `0` only for `READY_FOR_HOSTED_PREFLIGHT`. A local blocker
exits `2`; invalid CLI usage exits `1`. The command never loads an `.env` file,
contacts a hosted service, applies or renames a migration, authorizes production
activation, or runs deployment smoke tests.

## Deterministic overall precedence

The first classification present wins:

1. `BLOCKED_BY_MIGRATION_IDENTITY`
2. `BLOCKED_BY_UNSAFE_ENV`
3. `BLOCKED_BY_LOCAL_INTEGRATION`
4. `BLOCKED_BY_DEPLOYMENT_CONFIG`
5. `BLOCKED_BY_MISSING_ENV`
6. `BLOCKED_BY_CONFIGURATION`
7. `BLOCKED_BY_STUDY`
8. `BLOCKED_BY_PROVIDER_ACCOUNTING`
9. `READY_FOR_HOSTED_PREFLIGHT` only when all three authorities are ready

This precedence does not suppress lower-priority blockers. For example, an
unresolved migration collision remains `BLOCKED_BY_MIGRATION_IDENTITY` even
when the Study environment is statically complete, while an Admin blocker and
any Study blockers remain present in the report.

## Authority and phase boundaries

`components.adminR3.result`, `components.migrationReconciliation.result`, and
`components.studyDeploymentEnvironment.result` contain the detailed native
result from each authority. Missing or failed local subsystem execution fails
closed instead of becoming ready.

The migration planner is invoked as a library in `READ_ONLY` mode. The unified
preflight rejects a result that does not state `mutationPerformed: false`; it
has no apply mode and never renames migration files.

The Study result validates local environment presence/shape and checked-in
Netlify configuration. It does not validate hosted credential roles, hosted
function readiness, database pricing authority, or applied migrations.

The report makes three phases distinct:

- local static readiness: performed by this command;
- hosted preflight: `NOT_RUN`, requires separate authorization; and
- deployment smoke tests: `NOT_RUN`, require a deployed target and separate
  authorization.

Environment values are not part of any authority result. Before JSON or
operator formatting, the aggregate also redacts any sensitive environment
value if a future subsystem accidentally returns one.
