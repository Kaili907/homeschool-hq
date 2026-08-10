# Server Tutor prebundle infrastructure

`npm run server-tutor:bundle` is the production-grade Node 22 ESM prebundle
step for the frozen Tutor runtime. It creates exactly two files in the ignored
`netlify/build/generated/` staging directory:

- `server-tutor.mjs` — the dependency-free server execution factory.
- `server-tutor.manifest.json` — custody, contract, mapping, source and bundle
  digests under schema `study-server-tutor-prebundle.v1`.

The staging directory is intentionally outside `netlify/functions/`. Netlify
publishes only `netlify/functions`, so this card cannot accidentally turn the
artifact into a callable endpoint. The future handler card may move the same
outputs to `netlify/functions/_shared/generated/` only when a reviewed handler
owns that packaging step.

## Production invocation and mapping seam

Production mode is the default and fails closed unless it receives both T2's
reviewed host-content mapping artifact and its independently reviewed SHA-256:

```text
npm run server-tutor:bundle -- --mapping-artifact <repo-relative-path> --mapping-digest <lower-case-sha256>
```

The build hashes the artifact and refuses a mismatch. It records that digest in
`hostContentMapping.sha256`; no production mapping digest is embedded or
invented here. A file named as a test fixture is rejected in production mode.

Tests may opt in to the dedicated non-production fixture only explicitly:

```text
npm run server-tutor:bundle -- --mode test --test-fixture-mapping netlify/build/host-content-mapping.test.json
```

## Production build order

The default `npm run build` deliberately remains unchanged until T2's mapping
artifact is merged and the future Tutor handlers are reviewed. When those
prerequisites land, the required order is:

```text
curriculum:build -> server-tutor:bundle (reviewed mapping) -> vite build -> stamp-sw
```

The server prebundle must complete before any handler bundling or packaging,
while the Vite output remains independent and continues to publish only
`dist/`. Netlify's `COMMIT_REF` (or `GITHUB_SHA` in equivalent CI) is recorded as
`buildSourceSha` when available; local builds without an authoritative supplied
revision record `null` rather than guessing.

## Frozen custody and deterministic graph

Before esbuild runs, the command checks the canonical alias target, package name
and package version, content manifest version, the externally pinned digest of
`SHA256SUMS.txt`, all 91 listed file digests, and the exact frozen file set. It
then bundles one static server entry with the shared alias authority and rejects
browser modules, stylesheets, unresolved imports, dynamic imports, or a leftover
frozen package specifier. No timestamp enters the bundle or manifest, so
unchanged inputs and mapping produce byte-identical outputs.
