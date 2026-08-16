# W4-11 deterministic decision contract

## Inputs

The evaluator requires:

- a caller-supplied canonical `evaluatedAt` instant;
- a versioned certificate or explicit `null`;
- a versioned observation with exact identity and alias-resolution evidence;
- all eight required hard-gate outcomes;
- exactly the certificate's soft-quality metric catalog; and
- optionally, an exactly resolved prior rollback certificate.

Malformed digests, noncanonical instants, duplicate or missing gates, duplicate
metrics, metric-catalog differences, future observations, and internally
inconsistent alias resolutions throw `ModelDriftPolicyInputError`. Invalid
evidence cannot produce `CERTIFIED`.

The host-owned certification registry is the trust authority for certificate
records. The reproducible identity digest detects inconsistent binding but is
not a provider attestation or substitute for registry authenticity.

## Outputs

Every `tutor-v2-model-drift-decision/4` includes:

- one state: `UNCERTIFIED`, `CERTIFIED`, `EXPIRED`, `REVOKED`,
  `DRIFT_DETECTED`, or `RECERTIFICATION_REQUIRED`;
- `certificationValid`, which is true only for `CERTIFIED`;
- `revocationRequired`, which is true only for a newly observed hard regression
  on the exact active certified identity;
- exact changed identity fields and recertification scopes;
- hard failures and per-metric soft breaches;
- stable reason codes;
- ordered recommendations; and
- `productionDeploymentAction: "none"`.

## Recommendation semantics

| Recommendation | Deterministic meaning |
| --- | --- |
| `retain` | Continue recognizing this exact certificate; emitted only for `CERTIFIED`. |
| `quarantine` | Exclude the observed candidate from certified commercial routing. |
| `fallback` | Use a separately authorized safe/static fallback; this policy does not choose or invoke it. |
| `revert-certification` | Prefer the returned exact prior certificate target instead of the observed candidate. |
| `require-recertification` | Do not recognize the observed candidate until the returned scopes are satisfied by a new certificate. |

All non-certified states emit `quarantine` and `require-recertification`. They
emit `revert-certification` only when the supplied target certificate is
active, within its validity window, and its currently resolved identity exactly
matches its certified identity. Otherwise they emit `fallback`.

The observation's alias resolution must be timestamped at `observedAt`, and a
rollback target's resolution must be timestamped at the caller-supplied
`evaluatedAt`. No internal clock is read.

`revert-certification` is not an instruction to relabel a new revision with an
old certificate. The target identity digest and certificate reference are
returned explicitly. A host must separately authorize and execute any routing
or deployment change.

## Hard and soft drift

Hard gates are boolean, complete, and noncompensable. A failure on a matching
certified identity immediately makes the state `REVOKED`, even when every soft
score is 10,000.

Soft quality uses integer basis points to avoid floating-point or rounding
ambiguity. Each metric independently must be at least 7,500 and no more than
500 points below its certified baseline. Equality is allowed. A breach produces
`DRIFT_DETECTED`, quarantine, fallback/revert evaluation, and recertification;
it does not silently revoke the stored certificate.
