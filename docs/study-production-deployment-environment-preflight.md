# Study production deployment-environment preflight

This repository provides a deterministic, local-only preflight for the known
Study production deployment environment and checked-in Netlify configuration.
It does not load `.env` files or contact Supabase, Netlify, Anthropic, or any
other hosted service.

## Commands

Operator-readable output:

```powershell
npm.cmd run preflight:study-deployment-env -- --format operator
```

Machine-readable JSON:

```powershell
npm.cmd run preflight:study-deployment-env -- --format json
```

The command exits `0` only for `READY_FOR_DEPLOYMENT_ENVIRONMENT`. A blocked
result exits `2`; CLI usage or an unexpected local execution failure exits `1`.
No output contains an environment value.

The unified local operator command is
`npm.cmd run preflight:production-local`. It retains this preflight's full
result alongside Admin R3 and migration reconciliation; see
[`production-local-preflight.md`](./production-local-preflight.md).

## Environment inventory

Only names consumed by repository code are deployment inputs. The preflight
checks their presence or repository-defined shape without echoing values.

| Input | Requirement | Repository use |
| --- | --- | --- |
| `VITE_STUDY_ENGINE_ENABLED` | exact `true` | Client production Study gate; code default is disabled |
| `ACADEMY_STUDY_ENABLED` | exact `true` | Server Study function gate; code default is disabled |
| `VITE_STUDY_ENGINE_PREVIEW` | absent or `false` | Development/test-only preview gate; never establishes production readiness |
| `VITE_ALLOW_BROWSER_PROVIDER_KEYS` | absent or not `true` | Local/test-only provider-key mode; rejected for production preflight |
| `VITE_SUPABASE_URL` | credential-free HTTPS URL | Browser Supabase/auth configuration |
| `VITE_SUPABASE_ANON_KEY` | present | Public browser anon key and permitted server auth fallback |
| `SUPABASE_URL` | credential-free HTTPS URL | Service-role durable Study RPC endpoint |
| `SUPABASE_ANON_KEY` | optional | Server auth override; otherwise the public `VITE_` fallback is consumed |
| `SUPABASE_SERVICE_ROLE_KEY` | secret present | Trusted identity, durable safety, worker, and academic-runtime RPCs |
| `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY` | secret present | Opaque safety rate-limit correlation references |
| `ANTHROPIC_API_KEY` | secret present | Server-only Study safety classifier provider |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID` | worker-reference shape | Durable worker identity |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID` | worker-reference shape | Durable credential identifier |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION` | worker-reference shape | Explicit credential version |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION` | worker-reference shape | Explicit configuration version |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL` | 32-512 character secret | Scheduled worker and durable SQL authorization |
| `ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET` | 32-512 character secret | Public/manual worker invocation authorization |
| `VITE_USE_PROXY` | exact `true` in `netlify.toml` | Production gateway-only provider boundary |
| `NODE_VERSION` | exact `22` in `netlify.toml` | Pinned Netlify build runtime |

The server and browser Supabase URLs must identify the same normalized HTTPS
endpoint. When `SUPABASE_ANON_KEY` is provided, it must match the public browser
anon key. Passing those comparisons does not verify the hosted project or the
credential's role.

The Study safety classifier uses the checked-in, explicitly versioned
`claude-haiku-4-5` contract. The preflight rejects an unreviewed change or a
`latest` alias. Anthropic pricing and database pricing terms are deliberately
outside this preflight.

## Client-exposure safety

For every consumed server-only Study setting, the preflight checks the matching
client-facing `VITE_` convention. A non-empty client-facing counterpart yields
`unsafe_client_exposure` without printing its value. Production also fails
closed if the local-only `VITE_ALLOW_BROWSER_PROVIDER_KEYS` mode is requested.
The public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are intentional and
are not treated as secret exposure.

## Netlify checks

The checked-in configuration must:

- run `npm run build` and publish only `dist`;
- use `netlify/function-entrypoints` as the dedicated callable function directory;
- expose exactly the reviewed 31-function allowlist, with no tests, fixtures,
  helpers, debug handlers, resolvers, or unreviewed entrypoints;
- keep every callable entrypoint as a handler-only delegate to its matching
  production module under `netlify/functions`;
- schedule only the dedicated `study-adult-review-scheduled-worker` Study target;
- use the exact `*/5 * * * *` cadence in both configuration and entrypoint contract;
- keep `study-adult-review-worker` manual/public and unscheduled;
- keep the scheduled entrypoint out of public redirects;
- contain the scheduled function file and every function file referenced by a redirect;
- set `VITE_USE_PROXY` to `true` and pin `NODE_VERSION` to `22`;
- leave the Family Pilot globally default-off and enable it with the exact
  literal `true` only in the named `mac/web-release-r3-convergence-r1` branch
  context.

The scheduled entrypoint contract is inspected as local source text. This keeps
the preflight executable even when the entrypoint is absent and makes that
absence a deterministic `BLOCKED_BY_DEPLOYMENT_CONFIG` result instead of a
module-load failure. The preflight does not execute function code while checking
the schedule contract.

## Results and authority boundary

Possible overall results are:

- `READY_FOR_DEPLOYMENT_ENVIRONMENT`
- `BLOCKED_BY_MISSING_ENV`
- `BLOCKED_BY_UNSAFE_ENV`
- `BLOCKED_BY_DEPLOYMENT_CONFIG`

Passing is preliminary local evidence only. It does not prove that migrations
are hosted, provider pricing is configured in the database, provider-attempt
coverage is complete, deployed functions are ready, or production smoke tests
pass. Those require later, separately authorized phases.
