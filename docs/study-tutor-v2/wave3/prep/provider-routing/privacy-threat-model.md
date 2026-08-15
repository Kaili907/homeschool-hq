# Privacy constraints and threat model

## Data classification and provider eligibility

Commercial routing is permitted only after the existing Tutor boundary creates
an independently minimized, ephemeral `ProviderExecutionRequest`. Routing
metadata is content-free. The provider payload may contain only the minimum
learner-safe teaching context for one Study-admitted action.

| Data or authority | Router | Commercial provider | Durable routing/accounting telemetry |
| --- | --- | --- | --- |
| Coarse learner stage/presentation policy | Closed class only | Minimum approved parameters | Policy/profile version only |
| Subject/action capability | Closed codes only | Minimized instruction | Closed codes if operationally required |
| Reviewed grounding | Reference/digest only | Bounded allowlisted excerpt when permitted | Reference/digest only, never excerpt |
| Current learner response | Never | Only when the existing explicit ephemeral permission allows it; bounded and non-persistent | Never |
| Reviewed image | Sanitized class/digest only | Only if specifically required and eligible | Digest/policy result only |
| Study authority context, allowed permissions, mastery, working level | Never | Never | Never |
| Answer key, expected answer, scoring path, hidden solution | Never | Never | Never |
| Learner/household/guardian identity or route | Never | Never | Never; trusted account/household attribution may remain in existing private accounting authority, outside route telemetry |
| Transcript, raw history, private/adult note | Never | Never | Never |
| Prompt/completion/provider raw error | Never | Transient execution only | Never |
| Provider credential, endpoint, account ID | Never | Transport secret use only | Never |

Provider input is never used as Tutor memory. It is destroyed on completion,
cancellation, safety stop, authorization loss, learner switch, expiry, or
failure. The router, attempt journal, cost ledger, logs, metrics, traces,
breaker, anomaly detector, and idempotency records have exact schemas with no
free-form metadata field.

## Retention, training, and human access

An eligible provider contract must bind:

- provider training/fine-tuning use contractually disabled;
- zero retention when policy requires it, otherwise a reviewed maximum
  operational-retention duration expressed in integer hours;
- deletion behavior and evidence;
- human review forbidden or limited to a separately contracted incident path;
- minor/education data permitted under a reviewed contractual basis;
- subprocessors, security review, breach duties, and account isolation;
- no provider-side conversation history, memory, prompt caching, or request
  replay unless separately modeled, reviewed, and allowed by the profile.

Provider defaults or dashboard toggles are not sufficient evidence. The
server-side adapter must enforce the reviewed account/project settings, and
readiness must verify them without exposing secrets. Missing or expired
evidence makes the provider ineligible. A lower-cost or lower-latency provider
never wins over a retention/privacy requirement.

## Region and data residency

Study policy derives an allowed processing region class without disclosing an
address or identity. A route is eligible only when provider profile, model
deployment, adapter endpoint, availability entry, and contractual evidence
agree on an allowed region and cross-border-transfer rule.

Region is a hard filter, not a ranking preference. Failover must remain within
the original allowed region set. Global endpoints with undocumented processing
location are ineligible for region-pinned requests. Storage, logs, abuse
monitoring, backup, and human support locations are part of the residency
review; merely selecting a regional network endpoint is insufficient.

For a reviewed image, the future media boundary must strip metadata, reject
unexpected formats/polyglots, decode and re-encode within size/pixel caps,
verify its admitted curriculum/learner-safe provenance, and prohibit biometric
or incidental-person analysis. If sanitization or residency cannot be proven,
the route uses text/static fallback. Audio/video are unsupported in routing
contract version 1 and fail closed.

## Protected assets

- Study's exclusive authority over permissions, working level, mastery,
  sequencing, progress, safety, answer authority, and durable effects.
- Learner transient content and the relationship between content and identity.
- Reviewed curriculum grounding and hidden assessment/answer material.
- Provider credentials, private provider mapping, pricing, and commercial
  account configuration.
- Exact budget reservations, physical-attempt identity, cost ledger, availability,
  breaker, and anomaly state.
- The invariant that every provider result is untrusted and ordinary Study
  remains available through deterministic fallback.

## Trust boundaries

1. Browser/caller to Study admission: untrusted; canonical Study authentication,
   authorization, lifecycle, safety, and action admission remain mandatory.
2. Study/Tutor to router: only closed routing metadata crosses; no Study
   authority object or raw content.
3. Reviewed catalog/configuration to router: privileged and versioned; updates
   require authorization, audit, and safe activation.
4. Router to adapter registry: capability classes resolve to a server-only
   reviewed mapping; no caller-selected provider/model string.
5. Adapter to external provider: minimized request leaves Academy control and
   is subject to the selected privacy/residency profile.
6. Provider response to Tutor/Study: wholly untrusted; exact parsing and all
   downstream Study validators remain mandatory.
7. Attempt/cost/telemetry boundary: exact content-free events only; journal and
   ledger authorities stay separate.

## Threats and required controls

| Threat | Required control | Failure behavior |
| --- | --- | --- |
| Caller forges provider/model, availability, cost, deadline, learner stage, or capability | Server derives closed inputs; exact schemas; browser values never enter catalog/availability/budget authority | Reject or static fallback |
| Routing becomes a second Study authority | Router has no Study context, mutation port, curriculum selector, or action-widening field; architecture/import tests | No provider dispatch/effect |
| Route/failover weakens Study permissions, working level, mastery, or answer separation | Immutable detached Study constraints revalidated after output; fallback eligibility cannot widen hard constraints | Static fallback/stop; no mutation |
| Answer authority leaks through context, grounding, logging, fallback, or provider error | Allowlist projection, contamination scanner, no answer fields, exact telemetry, trusted fallback references | Prevent dispatch or reject output |
| Prompt injection asks the model/router to change route, budget, policy, or authority | Content never enters router; provider output cannot address operational contracts; closed action response | Reject candidate; no retry |
| Malicious/compromised catalog enables an unsafe provider | Privileged two-phase reviewed activation, immutable versions, signatures/digests, audit, rollback, readiness validation | Catalog version ineligible; static fallback |
| Vendor silently changes an aliased model | Bind immutable artifact/release/config reference; require reevaluation and new profile | Disable route |
| Provider claims false structured-output/safety/privacy capability | Academy evaluation plus contractual/technical evidence; never trust response claims | Ineligible/quarantine |
| Cost ceiling bypass via floats, overflow, rounding, currency, or missing price | Canonical IntegerMicros strings, bigint/database arithmetic, checked operations, exact USD terms, unknown is not zero | No dispatch; anomaly signal |
| Price changes after planning (TOCTOU) | Snapshot exact term revisions; revalidate immediately before dispatch | Re-plan or static fallback |
| Retry/failover doubles billing or content disclosure | Durable physical-attempt reservation, at most two attempts, no same-route retry, confirmed-not-dispatched rule, conservative unknown-cost hold | Static fallback when proof/budget is absent |
| Rate-limit or outage creates retry storm | Shared availability cooldown, open circuit, bounded failover, no deadline sleep | Static fallback |
| Timeout continues remotely | Monotonic local timeout; treat cancellation/billing as indeterminate; retain reservation | No unsafe retry; reconcile later |
| Malformed/oversized/wrong-binding response exploits parser | Byte/token caps before parse, exact JSON schema, interaction binding, no repair parsing | Reject, breaker signal, static fallback |
| Provider response reveals answer or unsafe/ungrounded content despite valid schema | Study-side grounding, anti-answer, age/privacy, allowed-action, and output-safety validation | Reject; Study fallback/stop |
| Availability or breaker poisoning by a learner | Only authenticated platform attempt outcomes update state; dimension keys exclude learner/content; minimum samples; probes are synthetic | Ignore untrusted signal |
| Distributed half-open probe storm | Atomic circuit transitions and one bounded probe lease | Keep circuit open/static fallback |
| Cross-region failover violates residency | Exact region intersection is a hard filter on primary and fallback; dispatch-time recheck | No failover; static fallback |
| Provider retains/trains on learner content | Contract/account enforcement, readiness evidence, zero/bounded retention profile, payload minimization | Provider ineligible |
| Multimodal file contains identity, metadata, exploit, or hidden answer | Reviewed provenance, decode/re-encode sanitizer, metadata removal, type/size/pixel caps, no biometric inference | Text/static fallback |
| Logs/traces/journal expose prompts, responses, identities, credentials, or prices incorrectly | Exact allowlisted telemetry, redaction as defense in depth, no raw error/body/metadata, privacy scanning | Drop event safely and alert; do not log payload |
| Static fallback reference is attacker-controlled | Resolve only from trusted Study admission and versioned fallback policy; invalid requests use constants | Reviewed fallback or fixed stop |
| Provider/registry/circuit/pricing dependency is unavailable | Every dependency fails closed; ordinary Study continues without commercial provider | Static fallback |

## Residual risk and release gate

Even with these controls, a commercial provider processes the minimized payload
outside Academy infrastructure, provider latency/cost can vary, provider
invoices can differ from usage-derived estimates, and deterministic anti-answer
checks cannot prove all semantic leakage is impossible. Those risks require
contract review, representative offline/live certification under separate
authorization, monitoring, kill switches, and independent security/privacy
review before production.

This preparation does not accept those risks, select a provider, or authorize a
live evaluation.
