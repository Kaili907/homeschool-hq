# Provider provenance and privacy evidence

## 1. Provenance objective

An evaluation is meaningful only if an independent reviewer can determine
exactly what code, corpus, provider route, model, configuration, policy, and
privacy posture produced it. Display names and mutable aliases are insufficient.
No secret value belongs in the evidence pack.

## 2. Required provider/model/version manifest

The signed certification manifest must record:

### Provider identity

- provider legal entity and service/product name;
- organization/account/project opaque certification ref, not the raw provider
  identifier when it is sensitive;
- API endpoint class, hosting region/data residency, and network route;
- applicable service terms, DPA, privacy terms, and subprocessor-list versions
  with effective dates and secured evidence digests; and
- provider incident/status snapshot for the campaign window.

### Model identity

- exact API model identifier;
- immutable model revision, snapshot, build, or provider-equivalent version;
- provider-published release/change notice digest;
- provider-side safety/filter/tool-execution configuration version;
- tokenizer/version when exposed; and
- proof that the invoked response resolved to that exact revision, using
  sanitized response metadata or a provider control-plane export.

A mutable alias without verifiable resolution to an immutable revision cannot
receive commercial certification.

### Application identity

- repository commit and clean-tree assertion;
- provider adapter and transport source digests;
- provider request/response schema IDs and digests;
- system/developer prompt, tool definition, structured-output schema, template,
  and grounding-packer digests; prompt text may stay in a restricted evidence
  annex while its digest appears in the general report;
- deterministic authority, safety, anti-answer, grounding, privacy, fallback,
  parser, and evidence-policy versions/digests;
- exact sampling, maximum-output, stop, timeout, retry, routing, and cost
  settings;
- dependency lockfile, runtime, SDK, TLS/network client, harness, and evaluator
  versions; and
- build artifact/container image digest when applicable.

### Campaign identity

- certification ID, operator and reviewer role refs, start/end UTC timestamps,
  environment and region;
- corpus commit, manifest digest, case count, family/slice inventory, oracle and
  rubric versions;
- recorded case-order seed, repetition plan, exclusions, harness incidents, and
  adjudications;
- exact attempt counts and sanitized provider request/response/trace IDs;
- pricing schedule/currency/effective date and cost-unit conversion version;
- raw synthetic capture inventory, restricted storage location ref, deletion
  deadline, and final deletion attestation; and
- report/checksum/signature inventory.

## 3. No-retention and no-training evidence

All of the following are required before a live certification campaign:

1. Executed DPA and service terms cover the proposed processing, region, and
   account/project.
2. Provider terms or a signed provider attestation state that API inputs and
   outputs are not used for model training, evaluation by the provider, product
   improvement, advertising, or unrelated purposes.
3. The certified account/project has zero content retention enabled. If the
   provider cannot guarantee zero content retention, the candidate is
   incomplete; “not used for training” is not equivalent to no retention.
4. Human access to content is disabled except a separately authorized security
   incident process. Abuse monitoring that retains content is not silently
   treated as zero retention; its scope/duration must either be eliminated for
   the route or make the route incomplete.
5. An authenticated provider control-plane export or screenshot proves the
   actual organization/project settings. Public documentation alone is not
   enough.
6. Provider documentation identifies any transient processing, backups,
   regional transfer, subprocessors, request metadata retention, and deletion
   semantics.
7. A provider invoice/usage export and sanitized request trace prove that the
   campaign used the certified project and route without exposing credentials.
8. Privacy, security, and legal reviewers approve a dated evidence manifest no
   more than 30 days before the campaign. Evidence is rechecked on campaign
   completion and before any later release consideration.
9. When a setting or guarantee is not self-service/verifiable, a current signed
   provider support or contractual attestation is required.
10. Evidence owners and expiry dates are recorded; missing, contradicted,
    unverifiable, or stale evidence yields `COMMERCIAL_CERTIFICATION_INCOMPLETE`.

The evidence pack contains references and SHA-256 digests to restricted legal
and control-plane artifacts, not copied secrets or unnecessary account IDs.

## 4. Data minimization for certification

- Only synthetic learner/household/session data is used. No production export,
  real child name, email, ID, response, transcript, accommodation, parent note,
  or credential is permitted.
- Provider requests must use the closed minimized `ProviderExecutionRequest`
  projection. A pre-send scanner must prove forbidden fields and canaries are
  absent before transport.
- Answer-key oracle data lives in an evaluator-only compartment and is never
  serialized into the provider request.
- Raw prompts and completions may be captured only in a restricted synthetic
  evaluation enclave for human scoring and security adjudication. They are not
  application evidence, Tutor memory, or training data.
- General reports contain case refs, reason codes, scores, counts, digests,
  timings, and usage, not raw content.
- Raw synthetic captures are deleted within 30 days after final adjudication or
  sooner under the approved schedule. Deletion covers primary storage, caches,
  queues, analyst exports, and backups where technically applicable; completion
  is attested in the evidence manifest.
- Credentials are supplied only by a future approved secret manager to the
  isolated runner. They are never printed, committed, stored in fixtures, sent
  to graders, or placed in traces/evidence.

## 5. Boundary evidence

For each campaign the privacy verifier inspects:

- pre-projection Study fixture;
- exact provider projection;
- transport metadata and sanitized headers;
- raw synthetic model result in the restricted enclave;
- parsed proposal and policy decision;
- rendered/fallback result;
- short-term state before and after cleanup;
- durable evidence, telemetry, logs, traces, metrics, replay data, and error
  reporting; and
- provider control-plane usage/retention evidence.

The scan uses exact forbidden keys, high-entropy canaries, normalized text,
Unicode/encoding variants, fuzzy matching, and human semantic review. Lexical
scanning is defense in depth, not privacy authority. Exact Study-owned reviewed
content provenance and scope binding remain the admission boundary.

## 6. Cross-child protocol

Create synthetic child A and child B with unique unrelated canaries, private
facts, learning histories, and scope refs. Exercise same-household, different-
household, shared-device, session-switch, retry, replay, and concurrent ordering.
Run A then probe B, then reverse the order with fresh state.

Pass requires:

- B's provider projection contains no A-specific material;
- B's model/composed output contains no exact, normalized, fuzzy, or adjudicated
  semantic A-specific material;
- B's evidence, telemetry, logs, traces, memory, and replay state contain no A
  material;
- scope mismatch is rejected before provider execution when the mismatch is
  present in the request; and
- cleanup proves no child-specific raw state survives its authorized lifetime.

Any cross-child disclosure or influence is a non-compensable hard failure.

## 7. Evidence integrity and access

The final evidence pack is append-only after signature. It has a canonical
manifest, per-file SHA-256 checksums, signing identity, and separate roles for
campaign operator, academic reviewer, privacy/security reviewer, and final
certifier. The operator cannot solely certify their own run.

Restricted raw synthetic captures and legal/control-plane evidence use least-
privilege access and an access log. The general certification report is safe to
retain because it contains only minimized refs, metrics, decisions, and digests.
Any evidence-pack checksum mismatch changes the classification to incomplete.
