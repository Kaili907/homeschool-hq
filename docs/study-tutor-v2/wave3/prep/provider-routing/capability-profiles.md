# Capability profiles and route contract

This file is normative design pseudocode, not a runtime schema. Every union is
closed, every record rejects unknown properties, and every referenced profile
is immutable and versioned in the future implementation.

## Shared primitives

```ts
type CanonicalIntegerMicros = string // /^(0|[1-9][0-9]*)$/; no sign/decimal
type NonNegativeInteger = number     // safe integer at API edges
type OpaqueRef = string              // bounded, typed, non-secret reference
type RegionCode = string             // closed deployment-policy code, not location prose

type ActionFamily =
  | "explanation"
  | "hint"
  | "guiding-question"
  | "grounded-example"
  | "prerequisite-recommendation"
  | "parent-safe-draft"

type LearnerStage =
  | "early-elementary"
  | "upper-elementary"
  | "middle-grades"
  | "secondary"

type SubjectCapability =
  | "numerical"
  | "symbolic"
  | "prose"
  | "source-grounded"
  | "spatial-visual"
  | "multilingual"

type Modality = "text" | "reviewed-image-input"

type RouteFailureCode =
  | "study-not-admitted"
  | "route-expired"
  | "provider-unavailable"
  | "provider-rate-limited"
  | "provider-timeout"
  | "provider-response-invalid"
  | "provider-response-policy-rejected"
  | "pricing-unavailable"
  | "budget-exhausted"
  | "latency-infeasible"
  | "privacy-or-residency-ineligible"
  | "cost-anomaly"
  | "internal-routing-failure"

type RouteReasonCode =
  | "primary-selected"
  | "failover-selected"
  | "static-fallback-selected"
  | RouteFailureCode
```

These are routing capabilities, not academic labels. `LearnerStage` cannot be
used to infer or change working level. `SubjectCapability` cannot choose
curriculum or validate factual content. New values require a versioned contract
and reviewed migration; arbitrary strings fail closed.

## ProviderCapabilityProfile

```ts
interface ProviderCapabilityProfile {
  readonly profileRef: OpaqueRef
  readonly profileVersion: NonNegativeInteger
  readonly providerClass:
    | "commercial-standard"
    | "commercial-zero-retention"
    | "commercial-region-pinned"
  readonly lifecycle: "active" | "disabled" | "retired"
  readonly allowedRegions: readonly RegionCode[]
  readonly executionRegions: readonly RegionCode[]
  readonly crossBorderTransfer: "forbidden" | "contracted-explicit"
  readonly dataResidencyEvidenceRef: OpaqueRef
  readonly retention: {
    readonly mode: "zero-retention" | "bounded-operational-retention"
    readonly maximumHours: NonNegativeInteger
    readonly trainingUse: "contractually-disabled"
    readonly humanReview: "forbidden" | "contracted-incident-only"
    readonly deletionEvidenceRef: OpaqueRef
  }
  readonly minorData: {
    readonly permitted: boolean
    readonly contractualBasisRef: OpaqueRef
  }
  readonly securityReviewRef: OpaqueRef
  readonly structuredOutput: "closed-json-schema"
  readonly supportedModalities: readonly Modality[]
  readonly maximumRequestBytes: NonNegativeInteger
  readonly timeoutRangeMs: {
    readonly minimum: NonNegativeInteger
    readonly maximum: NonNegativeInteger
  }
  readonly modelProfileRefs: readonly OpaqueRef[]
  readonly adapterClassRef: OpaqueRef
  readonly effectiveFrom: string
  readonly effectiveUntil: string | null
}
```

The profile contains reviewed facts and contract evidence, not a provider's
marketing claims. `adapterClassRef` resolves only inside the server-only
registry. Credentials, raw vendor model IDs, account IDs, endpoints, prompt
formats, and SDK objects are forbidden.

A provider profile is ineligible if evidence is absent, expired, contradictory,
outside its effective interval, or weaker than the request. An active lifecycle
does not override the availability snapshot or circuit state.

## ModelCapabilityProfile

```ts
interface ModelCapabilityProfile {
  readonly profileRef: OpaqueRef
  readonly profileVersion: NonNegativeInteger
  readonly providerProfileRef: OpaqueRef
  readonly modelClass:
    | "fast-text"
    | "balanced-text"
    | "reasoning-text"
    | "balanced-vision"
  readonly lifecycle: "active" | "disabled" | "retired"
  readonly actionFamilies: readonly ActionFamily[]
  readonly learnerStages: readonly LearnerStage[]
  readonly subjectCapabilities: readonly SubjectCapability[]
  readonly inputModalities: readonly Modality[]
  readonly maximumContextTokens: NonNegativeInteger
  readonly maximumOutputTokens: NonNegativeInteger
  readonly closedStructuredOutput: true
  readonly groundingMode:
    | "provided-reviewed-content-only"
    | "provided-grounding-with-policy-validation"
  readonly safetyControlClass: "minor-standard" | "minor-heightened"
  readonly latencyClass: "interactive-fast" | "interactive-standard"
  readonly latencyEvidenceRef: OpaqueRef
  readonly pricingDimensionRef: OpaqueRef
  readonly deploymentRegionCodes: readonly RegionCode[]
  readonly immutableArtifactRef: OpaqueRef
}
```

`modelClass` is an Academy capability class, not a vendor name or claim of
truthfulness. `immutableArtifactRef` binds evaluation and change control to one
reviewed model release/configuration. A provider alias that changes its backing
artifact is not the same reviewed model profile and is ineligible until a new
profile is approved.

Model capability never substitutes for Study-side validation. In particular,
`reasoning-text` does not receive answer keys, score official work, decide
mastery, or permit longer/unbounded reasoning traces to be returned or stored.

## ProviderRoutingInput

```ts
interface ProviderRoutingInput {
  readonly contractVersion: "tutor-provider-routing/1"
  readonly logicalOperationRef: OpaqueRef
  readonly actionFamily: ActionFamily
  readonly learnerStage: LearnerStage
  readonly subjectCapability: SubjectCapability
  readonly contextSize: {
    readonly estimatedInputTokens: NonNegativeInteger
    readonly estimationOverheadTokens: NonNegativeInteger
    readonly requiredOutputTokens: NonNegativeInteger
  }
  readonly safetyRequirement: {
    readonly admission: "academic-flow-admitted" | "academic-flow-held"
    readonly clearanceRef: OpaqueRef
    readonly expiresAt: string
    readonly controlClass: "minor-standard" | "minor-heightened"
  }
  readonly latencyTarget: {
    readonly serviceClass: "interactive-fast" | "interactive-standard"
    readonly endToEndDeadlineMs: NonNegativeInteger
    readonly deterministicReserveMs: NonNegativeInteger
  }
  readonly costCeiling: {
    readonly currency: "USD"
    readonly operationMaximumMicros: CanonicalIntegerMicros
    readonly interactionRemainingMicros: CanonicalIntegerMicros
    readonly householdPeriodRemainingMicros: CanonicalIntegerMicros
    readonly platformPeriodRemainingMicros: CanonicalIntegerMicros
  }
  readonly reviewedContentRequirement:
    | "provided-reviewed-grounding-required"
    | "reviewed-static-only"
  readonly multimodalRequirement: {
    readonly modality: Modality
    readonly sanitizationPolicyRef: OpaqueRef | null
  }
  readonly providerAvailability: ProviderAvailabilitySnapshot
  readonly remainingPhysicalAttempts: NonNegativeInteger
  readonly catalogSnapshotRef: OpaqueRef
  readonly pricingSnapshotRef: OpaqueRef
  readonly budgetPolicyRef: OpaqueRef
  readonly circuitPolicyRef: OpaqueRef
  readonly staticFallbackPolicyRef: OpaqueRef
}
```

The cost ceiling used for selection is the minimum of the four remaining caps,
calculated with arbitrary-precision integer comparison. A caller cannot submit
or raise these fields; trusted server policy derives them. A zero remaining cap
routes directly to static fallback.

`reviewed-static-only` prohibits a commercial call. It exists so Study can
express that reviewed content is the only permitted response for the action.

## ProviderAvailabilitySnapshot

```ts
interface ProviderAvailabilitySnapshot {
  readonly snapshotRef: OpaqueRef
  readonly observedAt: string
  readonly expiresAt: string
  readonly entries: readonly {
    readonly providerClass: ProviderCapabilityProfile["providerClass"]
    readonly modelClass: ModelCapabilityProfile["modelClass"]
    readonly region: RegionCode
    readonly deployment: "available" | "maintenance" | "disabled"
    readonly health: "healthy" | "degraded" | "outage" | "unknown"
    readonly rateLimit: "clear" | "limited" | "blocked" | "unknown"
    readonly retryAfterMs: NonNegativeInteger | null
    readonly circuit: "closed" | "open" | "half-open"
    readonly halfOpenProbeAvailable: boolean
  }[]
}
```

The snapshot is produced by trusted operations state and has a short maximum
age defined by versioned policy. Expired, missing, duplicate, or contradictory
entries are `unknown`, and `unknown` is ineligible. Browser hints, provider
response text, and model output cannot edit availability. A half-open route is
available only to the dedicated probe coordinator; ordinary learner traffic
cannot become a probe.

Within one catalog/availability snapshot, the tuple of provider class, model
class, execution region, and adapter artifact has exactly one active server-side
mapping. Zero or multiple mappings are ineligible; the router never resolves
ambiguity by insertion order.

## ProviderRouteDecision

```ts
type RetryableFailure =
  | "confirmed-pre-dispatch-outage"
  | "confirmed-pre-dispatch-rate-limit"
  | "confirmed-not-dispatched-transport-failure"
  | "indeterminate-timeout-with-full-reserve"

interface ProviderRouteDecision {
  readonly contractVersion: "tutor-provider-route-decision/1"
  readonly decision:
    | "commercial-route"
    | "no-commercial-route"
  readonly logicalOperationRef: OpaqueRef
  readonly providerClass: ProviderCapabilityProfile["providerClass"] | null
  readonly modelClass: ModelCapabilityProfile["modelClass"] | null
  readonly maxTokens: NonNegativeInteger
  readonly timeoutMs: NonNegativeInteger
  readonly retryPolicy: {
    readonly maximumPhysicalAttempts: 0 | 1 | 2
    readonly maximumSameRouteRetries: 0
    readonly retryableFailures: readonly RetryableFailure[]
    readonly backoffMs: NonNegativeInteger
    readonly requireFreshAvailability: true
    readonly requireConfirmedNotDispatched: true
    readonly requireRemainingDeadlineAndBudget: true
  }
  readonly fallbackProviderClass:
    | ProviderCapabilityProfile["providerClass"]
    | null
  readonly fallbackModelClass: ModelCapabilityProfile["modelClass"] | null
  readonly fallbackMaxTokens: NonNegativeInteger
  readonly fallbackTimeoutMs: NonNegativeInteger
  readonly executionRegion: RegionCode | null
  readonly routeBindingRef: OpaqueRef | null
  readonly staticFallbackRule: {
    readonly policyRef: OpaqueRef
    readonly selection: "reviewed-content-by-trusted-study-ref" | "fixed-stop"
    readonly onFailure: readonly RouteFailureCode[]
  }
  readonly reservedMaximumCostMicros: CanonicalIntegerMicros
  readonly expiresAt: string
  readonly snapshotRefs: {
    readonly catalog: OpaqueRef
    readonly pricing: OpaqueRef
    readonly availability: OpaqueRef
    readonly budgetPolicy: OpaqueRef
    readonly circuitPolicy: OpaqueRef
  }
  readonly reasonCodes: readonly RouteReasonCode[]
}
```

`fallbackProviderClass` and `fallbackModelClass` are both null or both present.
The fallback route is independently evaluated at plan time and revalidated at
dispatch time. The fallback model can be cheaper or faster but cannot be weaker
on a hard request requirement. The output token ceiling is the minimum of the
request need, model maximum, action-family maximum, latency-feasible maximum,
and cost-feasible maximum.

For `no-commercial-route`, both provider/model pairs, execution region, and
route binding are null; token limits, timeouts, maximum physical attempts, and
reserved cost are zero. For a commercial route, the primary fields are
non-null/non-zero. Fallback limits are zero exactly when the fallback pair is
null. The opaque route binding resolves only through the unique reviewed
server-side registry mapping and discloses no vendor identifier.

The static fallback rule is mandatory for every decision, including a
commercial route. Its lookup key comes from trusted Study admission and policy,
not from provider output, malformed input, or a client-selected content
reference.

## Closed reason codes

At minimum, the future versioned reason-code sets must distinguish:

- malformed, stale, or held Study routing input;
- no privacy-eligible or region-eligible provider;
- unsupported action, learner stage, subject, context, reviewed-content, or
  multimodal requirement;
- provider disabled, outage, degraded beyond policy, rate-limited, or circuit
  open;
- missing, ambiguous, stale, or unsupported pricing;
- operation, interaction, household-period, or platform-period budget cap;
- latency deadline infeasible;
- cost anomaly quarantine; and
- selected primary, selected failover, or static fallback.

Reasons are bounded operational codes. They must not contain provider error
text, learner content, model output, prices as prose, or identity.
