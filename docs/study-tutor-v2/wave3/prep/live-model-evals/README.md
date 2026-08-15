# Tutor V2 live-model commercial certification design

## Status and boundary

This directory is a preparation-only design for a future live-model certification
system. It does not contain a provider adapter, provider credential, live-model
call, production configuration, deployment permission, or production
authorization.

The design starts from the Wave 1 and Wave 2 invariant that Study is the sole
authority. A model produces an untrusted candidate. Deterministic Study-side
contracts and policy decide whether that candidate is rejected, replaced by
reviewed static curriculum, or made eligible for Study to render. A live-model
quality score can never override a deterministic rejection.

Commercial certification is necessary but not sufficient for deployment. A
passing evidence pack authorizes only a separate release authority to consider
the exact certified tuple. It does not authorize production wiring, traffic,
credentials, a vendor agreement, or deployment.

## Documents

- [EVAL-ARCHITECTURE.md](./EVAL-ARCHITECTURE.md) defines the evaluation pipeline,
  corpus contract, evaluation families, deterministic/live separation, and
  `INSUFFICIENT_GROUNDED_CONTEXT` behavior.
- [METRICS-AND-GATES.md](./METRICS-AND-GATES.md) defines non-compensable hard
  gates, academic rubrics, operational thresholds, and the commercial decision
  rule.
- [STOCHASTIC-CERTIFICATION.md](./STOCHASTIC-CERTIFICATION.md) defines repetition
  counts, instability statistics, slices, run scheduling, and renewal triggers.
- [PROVENANCE-AND-PRIVACY.md](./PROVENANCE-AND-PRIVACY.md) defines exact
  provider/model/version provenance and no-retention/privacy evidence.
- [FUTURE-IMPLEMENTATION-PLAN.md](./FUTURE-IMPLEMENTATION-PLAN.md) sequences a
  future implementation without granting production authority.

## Decision vocabulary

The future certifier emits exactly one terminal classification for one exact
candidate tuple:

- `COMMERCIAL_CERTIFICATION_PASS`
- `COMMERCIAL_CERTIFICATION_FAIL`
- `COMMERCIAL_CERTIFICATION_INCOMPLETE`

`PASS` requires every hard gate, every required academic threshold, the
stochastic campaign, operational thresholds, provenance checks, privacy
evidence, and human adjudication to pass. `FAIL` means a completed required gate
failed. `INCOMPLETE` means required evidence is missing, stale, unscorable, or
the campaign did not meet its sample plan. Neither `FAIL` nor `INCOMPLETE` may be
represented as a partial commercial approval.

## Candidate identity

A certificate is bound to the hash of the complete certification tuple:

```text
provider legal entity + provider account/project + endpoint/region
+ immutable model revision + provider safety/config revision
+ adapter commit + request/response schema digests
+ system/developer prompt and tool-definition digests
+ sampling and output limits + routing/timeout/retry/cost policy digests
+ grounding packer and deterministic policy digests
+ corpus manifest and evaluator/rubric versions
+ privacy/no-retention evidence manifest
```

Changing any member invalidates the certificate or requires the recertification
rule in `STOCHASTIC-CERTIFICATION.md` to be applied.

## Core commercial rule

Hard safety and security failures are non-compensable. A higher academic mean,
lower cost, faster latency, another provider's result, or a later successful
repetition cannot offset one observed hard-gate failure. Provider routes are
certified separately; a strong primary route cannot certify an untested fallback
route.
