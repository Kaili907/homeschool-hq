# W4-07 Privacy, Retention, and Logging Adversarial Certification

Session: `STUDY-TUTOR-V2-W4-07`  
Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`  
Scope: current durable Wave 3 Tutor artifacts  
Method: synthetic canaries only; local in-memory execution; no production storage

## Result

`W4_PRIVACY_RETENTION_READY_FOR_CONVERGENCE`

The executable certification injects 14 unique synthetic markers into transient
learner, Tutor, provider, transcript, media-metadata, identity, credential-like,
diagnostic, emotion, and personality inputs. It then scans the actual projected
or rejected results at every requested durable surface. No marker or tested
encoding was found in a durable result.

Provider governance also failed closed for unknown retention, training enabled,
minor-data unsupported, wrong region, expired evidence, and policy revision
drift. Each composed routing probe stopped before dispatch with zero provider
calls.

## Executable evidence

Source:
`adaptive-tutor/adversarial/v4/privacy-retention/certify.ts`

From `adaptive-tutor`, after repository dependencies are available:

```sh
npx tsc -p adversarial/v4/privacy-retention/tsconfig.json --pretty false
node adversarial/v4/privacy-retention/.dist/adversarial/v4/privacy-retention/certify.js
```

The command writes no production artifact. It prints a sanitized JSON report to
standard output. Canary values exist only in the adversarial source fixture and
transient in-memory objects; the report contains category names and counts.

## Boundaries certified

| Surface | Current Wave 3 mechanism | Adversarial result |
| --- | --- | --- |
| Provider request | Closed exact schema plus whitelist projection | Unknown canary fields rejected; accepted request clean |
| Provider response normalization | Closed model-output vocabulary | Contaminated output malformed; normalized output clean |
| Advisory | Closed Study advisory schema | Contaminated provider response selected bounded fallback |
| Accepted effect event | Closed minimized accepted-event schema | Event reconstructed only from minimized effect and memory fields |
| Memory delta/snapshot | Closed bounded memory schemas and whitelist constructors | Foreign input fields omitted or rejected |
| Telemetry | Operational-field whitelist projection | Provider extras and nested metric extras omitted |
| Multimodal durable evidence | Explicit durable whitelist projection | Transcript, bytes, captions, and raw metadata omitted |
| Parent report | Exact input validation plus reviewed-copy projection | Contaminated request rejected; clean report uses reviewed literals |
| Eval evidence | Deterministic containment attempt projection | Raw prompt, completion, and claim sidecar retention all false |
| Mutation evidence | Nine closed-schema canary mutations | Every mutation rejected |
| Release evidence | Executed 18-gate evidence plus current JSON artifact scan | 18/18 gates pass; no canary match |

## Opaque references and digests

Opaque references and digests are permitted only in fields admitted by the
current closed Wave 3 schemas. The certification never encodes a canary into an
opaque reference or digest. Each schema-backed durable artifact is re-mutated
with an unknown canary field and must fail exact validation. Existing release
and mutation evidence is scanned read-only.

This lane does not authorize production, provider use, storage, deployment, or
release. It certifies only the named privacy/retention property of the starting
Wave 3 artifacts.

