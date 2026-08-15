# Family Services staging convergence R1

Status: `FAMILY_SERVICES_STAGING_CONVERGENCE_R1_READY`

## Inputs and activation ruling

- Base: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`
- Hosted Sync input: `32086dd2d47741362901bcc042ae46fb887b7d59`
- Trusted Scorer input: `9b1cbbdf9abc68d73bff789b5dde22a5c495b78d`
- Default Hosted Sync: **OFF**.
- Default Trusted Scorer: **OFF**.
- This convergence performs no deploy, hosted Supabase call, migration apply,
  live scorer call, or production configuration change.

The Family Pilot accepts one optional `FamilyServicesPilotConfigurationR1`.
Feature flags alone do nothing: a non-production host must also inject the
already-accepted Hosted Sync R2 RPC adapter and/or the existing trusted scorer
assessor port. A `production` composition mechanically resolves both services
to disabled.

## Later non-production staging configuration matrix

These rows document later staging inputs. They are not set in this tree.

| Mode | `VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED` | `VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED` | Injected ports | Server scorer locks | Result |
|---|---:|---:|---|---|---|
| Neither enabled | unset/`false` | unset/`false` | none | scorer flag unset/`false` | Local Family Pilot only; Parent status is `Local only`; responses remain pending assessment |
| Sync only | exact `true` | unset/`false` | accepted Hosted Sync R2 adapter | scorer flag unset/`false` | Hosted state may sync; no response is sent to the scorer |
| Scorer only | unset/`false` | exact `true` | existing trusted scorer assessor | `ACADEMY_STUDY_ENABLED=true`, `ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED=true`, `ACADEMY_DEPLOYMENT_ENV=staging` | Local state remains authoritative; allowed submissions may receive minimized trusted receipts |
| Both enabled | exact `true` | exact `true` | both existing ports in the one composition | same three scorer locks | Independent services coexist; only allowlisted receipt fields enter Hosted Sync |

Every non-production enabled row also requires
`configuration.environment=staging`. Exact string `true` is required. A
missing injected port disables only its corresponding service. No flag can
construct a provider, authorization lease, Supabase client, or scorer transport.

## Sync/scorer interaction and allowlist

The convergence does not add a service adapter. It reuses:

- `HostedSyncRpcAdapter` for Hosted Sync; and
- `LearnerResponseAssessor` / `createFamilyPilotTrustedScorer` for scoring.

An eligible trusted receipt is represented in the existing strict Hosted Sync
R2 `assessmentStates[].outcome` slot. The wire fields are only:

- `assessmentRecordRef`;
- `decision`;
- `assessedAt`; and
- `assessorRef`.

The surrounding already-allowlisted assessment state binds the receipt to the
student, assignment, and assessment. Export requires exact receipt keys, the
trusted scorer reference, matching student/assignment/assessment identity, and
an `ACTIVE` or `PENDING_ASSESSMENT` state. Duplicate or mismatched receipts are
rejected. Hydrate returns the same minimized receipt sidecar so the receiving
device can use its existing receipt store; it never hydrates a learner response.

The bridge cannot carry a response body, selected response, answer key, correct
answer, rubric, scoring guide, worked solution, resolver payload, bearer,
provider credential, or adult answer authority. An extra field such as
`answerKey` makes the whole receipt fail closed. Scorer existence therefore
does not widen Hosted Sync's deny-by-default key vocabulary.

## Assessment and Parent projection

- With no scorer, a saved response remains `PENDING_ASSESSMENT`.
- With a valid trusted receipt, the hosted assessment projection is
  `SCORING_COMPLETE`, or `ADULT_REVIEW_REQUIRED` for `REVIEW_REQUIRED`.
- The learner response body remains device-local in the existing IndexedDB
  learner-response document.
- Parent sync status and trusted scoring review status remain separate read
  models. Scorer-only mode still displays `Local only`; it cannot imply that
  state was synchronized. Sync-enabled modes use only `Sync ready`, `Syncing`,
  `Up to date`, or `Needs attention` supplied by the hosted coordinator.
- Trusted review remains limited to `PENDING_TRUSTED_SCORE`,
  `TRUSTED_RESULT_AVAILABLE`, and `PARENT_ACTION_REQUIRED`.

Neither a scoring receipt nor a Parent presentation advances deterministic
Study progression or creates completion/mastery authority.

## Offline and Netlify boundaries

Offline local Study continues to use its current local stores. Hosted Sync's
adapter reports offline before provider dispatch. Scorer failure, timeout,
disabled gateway, malformed result, or stale result leaves the saved response
truthfully `PENDING_ASSESSMENT`. With Hosted Sync disabled, local state remains
authoritative and no background sync worker is introduced.

The only scorer Netlify surface remains
`production-item-assessment`. It independently requires the Study server gate,
the dedicated Family Pilot scorer gate, and `local|test|staging`; production is
denied. The Hosted Sync client flag cannot open that function. Hosted Sync uses
its accepted authenticated RPC boundary and is not exposed through a new
Netlify function or redirect.

## Staging prerequisites not performed here

Later staging still requires explicit human authorization to configure the
environment, apply/verify the already-included Hosted Sync migrations against a
non-production project, inject authenticated provider ports, and run external
smoke tests. None of those actions is part of this candidate.
