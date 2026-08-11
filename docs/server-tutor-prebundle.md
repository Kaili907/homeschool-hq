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

## Production invocation and fixed mapping custody

Production mode is the default and accepts no mapping path or digest from its
caller:

```text
npm run server-tutor:bundle
```

The only production authority is the repository-reviewed
`src/study/server/tutorHostMapping.v1.json` plus its source-controlled canonical
digest. The build invokes Mapping H2's exact parser and invariants, rechecks the
Academy and 91-file frozen Tutor custody, and rejects caller-supplied production
artifact or digest fields. The current reviewed result is intentionally empty:
`no-approved-mapping-under-current-frozen-runtime` with zero approved mappings.

The canonical mapping SHA-256 hashes Mapping H2's canonical JSON and is recorded
as `mappingSha256`. The optional raw source-file hash, which includes the final
newline, is separately named `rawFileSha256`; the two meanings are never
interchanged. `hostContentMapping` also records the actual `academySourcePins`,
`frozenTutorPins`, schema, artifact kind, mapping version, compatibility status,
and the generated bundle SHA.

The validated full mapping and a recursively frozen custody descriptor are
statically embedded and exported by `server-tutor.mjs`. The generated runtime
does not load a mapping file and exposes no replacement seam.

Tests may opt in to the dedicated non-production fixture only explicitly:

```text
npm run server-tutor:bundle -- --mode test \
  --test-fixture-mapping netlify/build/host-content-mapping.test.json \
  --output-dir <isolated-test-output>
```

That fixture declares its own test-only schema, `artifactKind` and
`compatibilityStatus`; production mode cannot accept that identity. Test mode
requires an explicit output under an existing nested operating-system temporary
directory. Repository-local and symlink-aliased outputs are rejected, so a
fixture cannot replace `netlify/build/generated/`.

## Production build order

The default `npm run build` deliberately remains unchanged until the future
Tutor handler is independently reviewed. That future production packaging order
must be:

```text
curriculum:build -> server-tutor:bundle -> vite build -> stamp-sw
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
