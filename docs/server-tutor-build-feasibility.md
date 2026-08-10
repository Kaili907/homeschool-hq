# Server-side Tutor: build feasibility

> Successor: the reusable, deterministic infrastructure proved by this spike is
> documented in [server-tutor-prebundle.md](./server-tutor-prebundle.md). This
> file remains the historical feasibility record.

**STUDY-A1-SERVER-TUTOR-BUILD-FEASIBILITY-C**, base `a310702`.

```
SERVER_TUTOR_BUILD:  FEASIBLE
FROZEN_ALIAS:        RESOLVED
PRODUCTION_ROUTE:    DARK
```

The bundle-boundary analysis recommended executing Tutor on the server and named
one hard prerequisite before any of that work was worth starting: prove Netlify's
build can bundle the frozen Tutor Core and resolve `@frozen/tutor-math-r1`. This
is that proof. It mounts no route, adds no endpoint, changes no flag, and relaxes
no browser bundle policy.

The probe is `netlify/build/server-tutor-bundle.mjs` and its fixture
`netlify/build/server-tutor-bundle.test.js`. `netlify/build/` is not
`netlify/functions/` — the directory netlify.toml publishes — so nothing here is
mountable, and the fixture asserts that.

## What actually failed

`@frozen/tutor-math-r1` was resolved by exactly one thing: `resolve.alias` in
`vite.config.ts`. The frozen Math R1 directory declares only `name` and `type` —
no `exports`, no `main` — and no tsconfig in the repo carried a `paths` entry. So
the specifier was invisible to every build that was not Vite, and `netlify/`
contained no TypeScript at all.

Run under the settings Netlify's function bundler uses, that is not a prediction:

```
Could not resolve "@frozen/tutor-math-r1"
  @ adaptive-tutor/study-engine/runtime/src/subject-registry.ts:15
```

The RED case in the fixture passes `alias: {}` and asserts that specific
specifier at that specific file. "The build failed" would also have been
satisfied by a typo in the test.

## The mechanism

One alias map, declared once, read by both builds.

`scripts/frozen-package-aliases.mjs` holds the specifier-to-path mapping and
resolves it to absolute paths. `vite.config.ts` spreads it into `resolve.alias`;
`netlify/build/server-tutor-bundle.mjs` passes it to esbuild's `alias`. Two maps
that must agree and are never compared is how a browser and a server end up
teaching from different content while both look correct, so there is one map.

esbuild is not a stand-in for Netlify's bundler — it **is** Netlify's function
bundler. The probe calls it with the deployed runtime's settings:

| setting | value | why |
|---|---|---|
| `platform` | `node` | function runtime |
| `format` | `esm` | repo is `"type": "module"` |
| `target` | `node22` | netlify.toml sets `NODE_VERSION = "22"` |
| `bundle` | `true` | nothing may be left to resolve at deploy time |

The fixture asserts netlify.toml still says 22, so the target cannot drift away
from the runtime it claims to describe.

**The deploy-time shape this implies.** `zip-it-and-ship-it` exposes no `alias`
option, so Netlify's bundler cannot be handed the mapping directly. A real server
Tutor function is therefore produced by a pre-bundle inside `npm run build` —
which Netlify already runs — emitting a dependency-free ESM artifact that leaves
the function bundler nothing to resolve. That is the mechanism this probe
exercises end to end.

## Alternatives, measured rather than assumed

**tsconfig `paths` — works for esbuild, does not work for Vite.** esbuild
respects `paths` and produces a byte-identical bundle (393,018 bytes either way).
Vite does not: with `paths` present and the alias removed, resolution fails with
`Cannot find package '@frozen/tutor-math-r1'`. No `vite-tsconfig-paths` plugin is
installed. So `paths` would mean two mechanisms instead of one, and it would also
change how `tsc` resolves the specifier for the whole app — today it resolves
through the ambient `runtime/src/frozen-math-r1.d.ts`. Rejected on blast radius,
not on capability.

**A real `node_modules` package — blocked by the freeze.** Resolving the
specifier the ordinary way needs an `exports` or `main` field in the frozen
package's `package.json`, or a shim file beside it. Both break
`adaptive-tutor/subjects/math/SHA256SUMS.txt`, which covers all 91 interior files
including `package.json`, and whose test also fails on any *unlisted* file. The
freeze is enforced, so this route is closed. Verified: 91 files hashed, 0
mismatches, frozen tree untouched by this card.

**Relaxing the browser bundle policy — not considered.** The card forbids it and
nothing here needed it.

## What the probe proves

1. **Bundles.** All five production Tutor entry points build under the Netlify
   settings above — `tutorAdapter` (393,018 B), `tutorRuntime` (415,211 B),
   `tutorLaunchOrdering` (3,805 B), `tutorPseudonym` (1,199 B),
   `tutorPresentation` (284 B). `tutorRuntime` is included because it is what a
   real function would import, and it reaches WebCrypto and the contract parser
   that the adapter alone does not.

2. **Not tree-shaken.** All four frozen sequence ids survive. The load-bearing
   half of that claim is behavioural, not a text search: `selectTutorProgram`
   falls back to `programs[0]` for any routing id it cannot match, so a bundle
   that had dropped the three non-default lessons would not fail — it would
   quietly answer with sequence 01. The fixture drives **sequence 04** and
   requires its distinctive prose. Mutating the routing ids to unmatched values
   produces exactly the sequence-01 fallback and fails the test.

3. **Executes.** The bundled adapter runs in Node and returns a canonical
   accepted turn: `directive: continue`, `reasonCode: tutor-core-continue`,
   `coreSubmitInvocations: 1`, the frozen sequence-04 utterance, and an empty
   privacy-action list.

4. **No credential.** The bundle contains no provider key name, no `process.env`
   or `import.meta.env` read, no `fetch(`, and no browser global. The event
   ledger and both safety classifiers are injected ports, so a turn needs no
   provider at all. The one credential-shaped token in the artifact is `"apiKey"`
   as a **denylist entry** in the privacy sanitizer — the opposite of a
   requirement — and the fixture pins that reading so the scan cannot be mistaken
   for having missed it.

5. **Documented.** This file.

## Findings the next card needs

**The wall clock is read, but it does not reach the result.** The frozen bridge
compares a pre-Core safety permit TTL against `Date.now()`, and a few envelope
fields fall back to `new Date().toISOString()`. Claiming the artifact holds no
clock would be false. The claim that holds is narrower and stronger, and the
fixture measures it: the same turn run under two system times seven months apart
produces the identical result. `Math.random` is genuinely absent.

**WebCrypto must be global.** The bridge derives its event-ledger idempotency key
via `globalThis.crypto.subtle.digest('SHA-256', ...)`, and `tutorPseudonym` needs
it too. Node 22 provides it; a runtime that did not would fail the session at
launch rather than mid-turn.

**`selectTutorProgram` still defaults silently.** An unmatched `lessonRef` or
`skillRef` returns sequence 01 — place value — rather than refusing. On the
server this is unchanged and remains the eligibility preflight's problem, but it
is now also the reason proof 2 above had to be behavioural.

**The browser production build never reaches this specifier.** `App.tsx` gates
the Study route behind `import.meta.env.DEV`, so production folds it away and
Rollup eliminates the import; emptying the alias entirely still produces a
successful `vite build`. The alias is load-bearing for tests, dev, and any future
path that is not dead-code-eliminated. Browser output is byte-identical across
this change — all four asset content hashes unchanged.

## What stays dark

No route is mounted, no function is published, no flag moved. Hosted Netlify
state was not authenticated or modified and remains **UNKNOWN**, as
[netlify-unknowns.md](./study-engine-final-production/netlify-unknowns.md)
records. This card answers a build
question and nothing else; the transport, the server function and its regression
suite are separate work.
