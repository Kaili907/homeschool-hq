# W4-13 supply-chain certification

- Session: `STUDY-TUTOR-V2-W4-13`
- Branch: `mac/tutor-v2-w4-supply-chain-r1`
- Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- Certification date: 2026-08-16

## Result

`W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE`

The baseline-relative scan completed over 87 files in the available required
roots with zero findings. `adaptive-tutor/certification/v4` was not present at
the starting SHA; the scanner will include it automatically when present.

The certification command was:

```sh
node adaptive-tutor/adversarial/v4/supply-chain/certify.mjs --json
```

It returned zero baseline findings and detected every required disposable-copy
control:

| Injected fault | Required scanner evidence | Result |
| --- | --- | --- |
| Vendor import | `vendor-sdk-import` on the injected file | Pass |
| Credential reference | `credential-environment-access` on the injected file | Pass |
| Network endpoint | `hard-coded-network-endpoint` on the injected file | Pass |
| Production Netlify import | `production-netlify-import` on the injected file | Pass |

These are lexical scanner results. No control depends on TypeScript compilation
or module-resolution failure.

## Boundary findings

- Tutor foundation production files contain no external package import, vendor
  SDK, environment access, hosted Supabase/Netlify seam, routable endpoint,
  key-shaped material, child-process/network execution, or persistence API.
- No scanned package declares a production UI dependency, and no scanned source
  imports a UI package or the prohibited root production `src` seam.
- `adaptive-tutor/evals/v3/scripts/run-compiled.mjs` inherits `spawnSync` and
  temporary `dist` cleanup. This is evaluation build tooling, not a non-test
  `core/v3` foundation path. It has no environment read, provider import, or
  network API. The runtime-execution rules remain fail-closed for foundation
  code while vendor, credential, endpoint, UI, and seam rules cover all scanned
  code and configuration.
- A separate disposable mutation verified that a dynamic vendor import produces
  `dynamic-vendor-import`. Another verified that a package dependency addition,
  production React declaration, and lockfile mutation produce
  `dependency-manifest-change`, `production-ui-dependency`, and
  `lockfile-change`, respectively.

## Dependency regression evidence

The scanner compares all repository dependency declarations and lockfiles with
the starting SHA. It found no addition, removal, version change, or lockfile
change. The root lockfile SHA-256 is unchanged:

```text
dab2efed0505e23c36e644e824d2eccb6a3141ca685536f496b19eb3e897c7f0
```

No dependency manifest or lockfile was modified in this lane.

## Inherited advisory inventory

Advisories were queried without changing a manifest or lockfile:

```sh
npm audit --package-lock-only --json
npm audit --package-lock-only --omit=dev --json
```

The full root lock graph reports three high-severity vulnerable package nodes,
representing two advisories, and no critical findings:

| Locked package | Locked version | Graph | Advisory/classification |
| --- | --- | --- | --- |
| `@playwright/test` | 1.54.1 | dev, direct | Reported through vulnerable `playwright` |
| `playwright` | 1.54.1 | dev, transitive | GHSA-7mvr-c777-76hp, browser download/install certificate verification |
| `nanoid` | 3.3.17 | dev, transitive | GHSA-2v37-7h3g-55p8, zero-size custom-generator availability issue |

The production-only audit (`--omit=dev`) reports zero vulnerabilities. Both
`adaptive-tutor/package.json` and `adaptive-tutor/evals/v3/package.json` have no
local lockfile, so package-local audit correctly returned `ENOLOCK`; this lane
did not generate one.

All listed advisory exposure is inherited from the immutable starting
lockfile. It is not a Wave 4 dependency regression, is absent from the audited
production dependency graph, and was not remediated here because this lane is
forbidden to change dependency versions.

## Decision

The provider-neutral foundation boundary, dependency custody check, and
adversarial detector controls are complete. The inherited dev-tool advisories
remain explicitly inventoried for a separate dependency-update lane.

`W4_SUPPLY_CHAIN_READY_FOR_CONVERGENCE`
