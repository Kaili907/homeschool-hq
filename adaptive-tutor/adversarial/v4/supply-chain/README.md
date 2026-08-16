# Tutor foundation supply-chain certification

This lane certifies that the Tutor v3 foundation remains provider-neutral. It
is a static gate: it does not resolve, install, compile, or execute a suspect
module before reporting it.

## Run

From the repository root:

```sh
node adaptive-tutor/adversarial/v4/supply-chain/scanner.mjs
node adaptive-tutor/adversarial/v4/supply-chain/certify.mjs
```

Both commands accept `--root`, `--baseline`, and `--json`. The default baseline
is the Wave 4 starting SHA, `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`.

The scanner walks these roots when present:

- `adaptive-tutor/core/v3`
- `adaptive-tutor/adversarial/v4`
- `adaptive-tutor/certification/v4`
- `adaptive-tutor/evals/v3`

It fails on direct or dynamic vendor imports, any unexpected external package
import, hosted Supabase or production Netlify imports, credential/environment
access, routable hard-coded endpoints, API-key-shaped material, unsafe TLS or
Node configuration, production UI dependencies, prohibited root `src`
cross-imports, and non-literal dynamic imports. In non-test
`adaptive-tutor/core/v3` files it additionally rejects child-process, network,
filesystem, and browser-persistence execution.

Every repository package manifest and lockfile is compared with the certified
baseline. Added, removed, or version-changed dependency declarations and any
lockfile byte change fail the gate. Production UI packages are also rejected
when declared by a package inside the scan roots.

## Adversarial controls

`certify.mjs` makes a fresh disposable copy for each required control, decodes
one inert fixture into `adaptive-tutor/core/v3`, runs the scanner, asserts the
specific scanner rule and injected path, and removes the copy. It proves
detection of:

1. a direct vendor SDK import;
2. a credential environment reference;
3. a routable provider endpoint; and
4. a production Netlify function import.

The fixtures are encoded in the certification source so the scanner itself
does not need an allowlist. No compiler or module resolver participates in the
proof.

## Result contract

- `W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE`: clean baseline-relative scan and all
  negative controls detected.
- `W4_SUPPLY_CHAIN_BLOCKER_FOUND`: the real scan found a prohibited condition.
- `W4_SUPPLY_CHAIN_INCOMPLETE`: one or more adversarial controls escaped.
- `VALIDATION_INCONCLUSIVE`: the scanner could not complete its evidence.

Exit status is zero only for readiness. A blocker exits one; incomplete or
inconclusive validation exits two.
