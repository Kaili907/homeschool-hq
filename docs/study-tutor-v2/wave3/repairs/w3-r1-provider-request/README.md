# W3-R1 commercial provider-request boundary

Session: `STUDY-TUTOR-V2-W3-R1`

This repair adds a new commercial-only boundary at
`adaptive-tutor/core/v3/provider-request/`. It does not modify, widen, or
reinterpret the accepted Wave 1 provider contracts.

## Contract

`BoundedCommercialProviderRequest` is the only value admitted by the new
commercial boundary. It is a closed, reference-oriented structure containing
only:

- invocation and logical-operation references;
- opaque subject, course, and concept references;
- a learner-stage policy reference;
- a closed action family and assessment phase;
- reviewed-content and grounding references paired with SHA-256 digests;
- bounded Study-derived attempt evidence;
- a closed presentation requirement; and
- opaque provider, configuration, safety, and presentation policy references.

Every object rejects unknown properties. Every list and integer is bounded.
Strings are closed enum values, digests, or bounded opaque references. There is
no unrestricted provider-visible prose field.

## Raw-attempt ruling

Commercial disclosure of arbitrary learner free-form attempt text is not
allowed. The contract fixes `rawAttemptDisclosureAllowed` to `false` and the
projection accepts only Study-derived structured attempt evidence:

- opaque attempt reference;
- attempt ordinal and count;
- closed assistance level;
- closed academic signal codes;
- bounded misconception references; and
- closed completion and recheck signals.

The schema has no learner response, student answer, correct/expected answer,
answer key, conversation, message, transcript, audio/image payload, provider
prompt, diagnostic/personality/emotional prose, or credential property.

## Projection and final boundary

`projectCommercialProviderRequest` (also exported as
`minimizeCommercialProviderRequest`) accepts an `unknown` candidate, proves it
matches the exact trusted Study facts schema, checks cross-field and uniqueness
invariants, and constructs the narrower provider request. Unknown fields are
rejected rather than silently dropped.

`validateBoundedCommercialProviderRequest` independently validates an
already-projected candidate at the final provider boundary. Both functions
return exactly:

- `accepted-commercial-provider-request`; or
- `provider-request-rejected` with a closed reason code.

Rejected results never echo attacker-controlled input and always set
`providerCallAllowed` to `false`. Acceptance establishes only request-shape
safety; it grants no routing or policy authority. Accepted requests are
detached and deeply frozen. Neither function has a provider, network,
credential, persistence, or Study-mutation port.

## Hostile input handling

Before schema validation, the boundary inspects own property descriptors and
plain prototypes. Accessors, symbols, sparse or extended arrays, cycles,
non-plain prototypes, excessive depth/width, and non-JSON values reject. This
preflight does not read accessor values, including accessors installed on array
indices.
