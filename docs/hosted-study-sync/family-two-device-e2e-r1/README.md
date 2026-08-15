# Family two-device browser E2E R1

This suite proves Family Cloud Sync behavior with the real Family Pilot browser
UI and three independent Playwright browser contexts. Each context has its own
cookies, `localStorage`, IndexedDB database, and durable device reference. No
browser state is copied between contexts.

## Local execution

```sh
npm run test:family-two-device-e2e
```

The default configuration builds and serves the app only on
`127.0.0.1:4183`. Cloud calls stay in the Playwright process and use the
repository's `LocalDbRpcEmulator`; the suite neither discovers nor contacts a
Supabase project. Browser request auditing fails if any non-loopback request is
observed.

The scenario covers:

- lossless, server-read-back-verified first link from Device A;
- fresh Device B hydration of the School Plan, automatic Today assignments,
  exact Study checkpoint, and typed learner-response checkpoint;
- B-to-A reconciliation without duplicate assignments or stale regression;
- a sibling flow with per-learner request and response isolation;
- concurrent compare-and-swap conflict evidence with both local and remote
  bundles retained;
- queued offline work, unrelated online sibling work, and safe reconnect;
- a completely fresh third profile, supplied no local PIN, whose hydrated state
  contains a null Parent verifier, no learner verifier, and no other secret;
- inspection of the high-level emulator payloads and underlying four-RPC
  arguments for forbidden authority, secret, Tutor, PIN, and sibling data.

## Adapter boundary for future staging

The exported `runFamilyTwoDeviceScenario` function depends on
`FamilyCloudScenarioAdapter`, not on the local emulator class. A staging runner
can inject an implementation backed by the non-production RPCs while reusing
the exact browser flow and assertions. `FAMILY_PILOT_APP_URL` disables the local
Vite server and points the browser UI at an already-running non-production
build.

The staging adapter must implement exactly these learner-scoped operations:

1. authenticated household link;
2. first-link import with read-back verification;
3. hydrate one learner;
4. compare-and-swap one learner at an expected revision.

The canonical learner payload is `HostedSyncStateSnapshotR2` and is carried by
the existing Hosted Sync R2 authority-checkpoint RPC. The two additive payloads
are narrow contracts:

- `family-pilot.family-plan-checkpoint.r1`, containing one validated planner
  record for exactly one learner;
- `family-pilot.learner-response-checkpoint.r1`, matching the forward-only
  Family response checkpoint database contract and containing response values
  only—never prompts, answer authority, scoring guides, or Tutor text.

There is no general Family Pilot state bucket. Each request is bound to one
household and one learner, validated before emulator mutation, and committed
only after the Hosted Sync compare-and-swap succeeds.

## Staging prerequisites

Do not use a production project. The first staging run requires:

- a separate non-production Supabase project and URL;
- an authenticated Parent test account bound to one disposable test household;
- the Hosted Sync R2 migration lineage plus the forward-only Family learner
  response checkpoint migration installed;
- the forward-only cross-device-data, response-checkpoint, and Family Plan
  migrations from the final 57-entry manifest;
- a staging adapter that maps the four interface operations above to the
  non-production RPCs and supplies short-lived authenticated-user sessions;
- test learner identities and curriculum release data, with no copied
  production family data;
- server-side request logging that can be queried by the test run ID for the
  same forbidden-payload assertions;
- cleanup scoped only to that disposable staging household after evidence is
  retained.

Required environment variables for that future adapter should be limited to
non-secret browser-safe configuration plus a secret injected into the test
runner, for example:

```text
FAMILY_PILOT_APP_URL=https://<staging-app-host>
FAMILY_CLOUD_E2E_ADAPTER=staging
FAMILY_CLOUD_E2E_SUPABASE_URL=https://<non-production-project-ref>.supabase.co
FAMILY_CLOUD_E2E_PARENT_EMAIL=<disposable-staging-parent>
FAMILY_CLOUD_E2E_PARENT_PASSWORD=<injected-by-test-secret-store>
```

Never commit values, service-role keys, refresh tokens, project database
passwords, Parent PINs, or learner PINs. The staging adapter must refuse the
known production project ref `ymtvzmqhfvwjtxjdmybs` before opening a network
connection.
