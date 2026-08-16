# Future authorized live-provider adapter handoff

This document is a contract for a later lane. It is not authorization to make
live calls, obtain credentials, install an SDK, or add a network route.

## Interface the adapter must implement

The authorized adapter must implement `CertificationTransport`:

```ts
interface CertificationTransport {
  readonly transportRef: string;
  execute(
    request: CertificationTransportRequest,
  ): Promise<CertificationTransportObservation>;
}
```

`transportRef` must name the audited adapter revision. It is repeated in
campaign and trial provenance. The adapter must not change any request identity
or tuple field.

## Exact request the adapter receives

For each single sequential trial, the runner supplies:

- deterministic `campaignId`, `caseId`, `trialId`, and one-based `trialIndex`;
- deterministic uint32 `seed`, or `null` only when the case declares it not
  applicable;
- exact `policyRevision`;
- exact `providerId`, `modelId`, `providerModelRevision`, safe configuration,
  configuration digest, and adapter revision;
- exact subject/course category, learner-stage profile, locale, action family,
  assessment phase, adversarial family, and fault mode;
- stable synthetic `scenarioRef`; and
- ephemeral synthetic/redacted input plus its digest.

The adapter must bind the call to that exact provider/model/revision/config
tuple. It must not substitute a moving model alias, silently change settings,
ignore an applicable seed, reroute providers, retry under a different tuple, or
execute extra physical calls for one runner invocation. A retry is a separately
planned trial unless a later approved protocol explicitly changes this
contract.

Secrets are not part of `providerModel.configuration`. A future approved
credential mechanism must inject them below this interface from an authorized
secret store and must never place them in a request, report, log, exception, or
reason code.

## Work the adapter must perform before returning

The transport is an end-to-end certification transport, not a thin SDK wrapper.
It owns the ephemeral provider exchange and the approved evaluators needed to
reduce that exchange to persistence-safe evidence. Before resolving, it must:

1. Dispatch exactly one authorized provider request using the supplied tuple
   and scenario inputs.
2. Keep prompts, completions, tool payloads, grader context, learner text, and
   provider error bodies ephemeral.
3. Run the approved deterministic/human-adjudicated hard-gate evaluators for
   all six gates. Every gate must be returned exactly once as `pass` or
   `violation`; missing evidence is not a pass.
4. Emit at least one minimized machine reason code for every violation.
5. Run only the approved non-hard quality graders and return finite,
   non-negative named metrics. Hard gates must never be represented as scores.
6. Return measured provider latency, reconciled input/output/total usage, ISO
   currency, and an exact base-10 integer micro-cost derived from the certified
   pricing revision.
7. Return either `null` or a SHA-256 digest of the provider request reference.
   If an opaque provider ID could be identifying, hash it with a campaign-local
   secret salt and do not retain the salt in the report.
8. Delete/discard all ephemeral exchange material before the promise resolves.

The returned object must contain exactly these fields:

- `hardGates`;
- `qualityMetrics`;
- `providerLatencyMs`;
- `usage`;
- `cost`; and
- `providerRequestRefDigest`.

Extra fields are rejected. In particular, the adapter must never return raw
prompts, raw completions, conversations, model reasoning, arbitrary prose,
provider response objects, or exception bodies.

## Failure behavior

If dispatch cannot be proven to have produced one valid, fully evaluated
observation, the adapter must reject/throw. The runner records only
`transport_error`, marks every hard gate `not-evaluated`, classifies the
campaign `INCOMPLETE`, and stops. The adapter must not encode provider errors as
passing gates. Expected fault-mode scenarios still require a complete valid
observation if they are to count as evaluated trials.

The runner executes trials sequentially. After any returned hard violation it
will not call the transport again. The adapter must not queue, batch, prefetch,
or independently parallelize future trials, because doing so would defeat the
immediate stop condition.

## Authorization and acceptance prerequisites

Before a live adapter can be used, a separate authorization must name the
provider, model/revision, credential source, outbound hosts, data-handling
terms, retention/training settings, region, pricing revision, evaluator
revisions, and campaign plan. The future lane must prove:

- no request or telemetry retention outside the approved boundary;
- no provider training or human review for certification traffic;
- exact tuple and seed binding with one physical call per trial;
- complete hard-gate evaluator coverage and adversarial negative controls;
- exception/log/tracing redaction;
- accurate latency, usage, and micro-cost accounting;
- fail-fast behavior under a real adapter test double before live use; and
- report persistence contains none of the ephemeral canary strings.

Nothing in this runner or its reports grants production authorization.

