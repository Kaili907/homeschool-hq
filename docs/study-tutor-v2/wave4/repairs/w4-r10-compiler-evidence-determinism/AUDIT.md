# W4-R10 — Compiler Evidence Determinism Audit (Phase 1)

Session: STUDY-TUTOR-V2-W4-R10
Execution subject audited: Commit A `875f53ce3d7a38bafa25233cabde0f18a67bbf90`
Committed R9 evidence compared against: Commit B `0cc2fe4cca84a71868ec0434e8e75beb569fa410`

This audit reproduces W4-18's finding and identifies the cause from captured bytes.
No cause was assumed; each hypothesis below was tested and the first one was falsified.

## 1. Code that produces the artifacts

| Concern | Path |
| --- | --- |
| Mutation campaign runner (produces `compileOutputSha256`) | `adaptive-tutor/scripts/tutor-v4/run-negative-controls.ts` |
| Compile invocation (`compileMutation`) | `adaptive-tutor/scripts/tutor-v4/run-negative-controls.ts` |
| Mutation catalog (13 definitions) | `adaptive-tutor/scripts/tutor-v4/mutations/catalog.ts` |
| Classification | `adaptive-tutor/scripts/tutor-v4/mutation-classification.ts` |
| Release artifacts + `CHECKSUMS.json` | `adaptive-tutor/scripts/tutor-v4/generate-release.ts` |
| Hard gates | `adaptive-tutor/scripts/tutor-v4/run-hard-gates.ts` |
| Compiled entrypoint | `adaptive-tutor/scripts/tutor-v4/run-compiled.mjs` |
| `NEGATIVE-CONTROL-EVIDENCE.json` | `adaptive-tutor/tutor-v2-wave4-release/NEGATIVE-CONTROL-EVIDENCE.json` |
| R9 `CAMPAIGN-EVIDENCE.json` | `docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/CAMPAIGN-EVIDENCE.json` |

`compileOutputSha256` is computed at `run-negative-controls.ts` as:

```
sha256(compile.output
  .replaceAll(realpathSync(mutantRoot), "$MUTANT_ROOT")
  .replaceAll(mutantRoot, "$MUTANT_ROOT")
  .replaceAll(realpathSync(dependencyRoot), "$DEPENDENCY_ROOT")
  .replaceAll(dependencyRoot, "$DEPENDENCY_ROOT"))
```

where `compile.output` = `stdout + stderr` of
`node node_modules/typescript/bin/tsc -p <project> --listFiles --pretty false`
(12 mutations) or `node --check <source>` (1 mutation, W4-M09).

## 2. Reproduction method

Two independent disposable detached worktrees at Commit A, different paths, created with
`git worktree add --detach`, each with its own `npm install` in `adaptive-tutor`:

- Run 1: `/tmp/r10-alpha-3mBSGE/wt-alpha`
- Run 2: `/tmp/r10-bravo-ppuUWe/wt-bravo`

The host copy of `run-negative-controls.ts` was instrumented **additively only** (dump raw
stdout/stderr/exit code and the exact pre-hash bytes to a capture directory outside the
worktrees). Mutant worktrees are created from the commit, so the subject under test was
unaffected; `HEAD` remained Commit A in both runs. Both runs reported
`PASS wave4-implementation-mutations 13/13 killed; 0 baseline-blocked`.

## 3. Toolchain identity observed

| Field | Run 1 | Run 2 |
| --- | --- | --- |
| `node -v` | v22.23.2 | v22.23.2 |
| `tsc --version` | 5.9.3 | 5.9.3 |
| resolved tsc | `<worktree>/adaptive-tutor/node_modules/typescript/bin/tsc` | same shape |
| `@types/node` | 22.20.1 | 22.20.1 |
| `undici-types` | 6.21.0 | 6.21.0 |

`adaptive-tutor/package.json` declares `typescript ^5.8.3` and `@types/node ^22.15.30`.
There is **no** `adaptive-tutor/package-lock.json` and `adaptive-tutor/node_modules` is not
committed. The dependency closure is therefore unpinned.

## 4. Result: run 1 vs run 2, and vs committed

| Comparison | Identical | Differ |
| --- | --- | --- |
| Run 1 vs Run 2 — **raw** compiler stdout (pre-normalization) | 1 / 13 | **12 / 13** |
| Run 1 vs Run 2 — **hashed** bytes (post-normalization) | **13 / 13** | 0 |
| Committed R9 vs freshly regenerated | 1 / 13 | **12 / 13** |

The committed-vs-fresh split (12 differ, 1 same) exactly reproduces W4-18. The single stable
mutation is **W4-M09**, the only `javascript-module` mutation: `node --check` emits **zero
bytes** on success, so its hash is `sha256("")` =
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` permanently, independent
of any toolchain. The other 12 are `typescript-project` mutations whose output is a
`--listFiles` file listing.

## 5. Volatile byte classes

Every byte of the hashed input was accounted for. For all 13 mutations: exit code 0, stderr
**empty**, and **0 lines** that are not a `--listFiles` absolute path. There are no
diagnostics in any committed or regenerated evidence.

### Class V1 — disposable-worktree / dependency-root absolute path prefix — ALREADY HANDLED
Raw output differs between runs; normalization removes it. Example (W4-M11 raw, run 1 vs run 2):
```
/private/tmp/r10-alpha-.../wt-alpha/adaptive-tutor/node_modules/typescript/lib/lib.es5.d.ts
/private/tmp/r10-bravo-.../wt-bravo/adaptive-tutor/node_modules/typescript/lib/lib.es5.d.ts
```
Both normalize to `$DEPENDENCY_ROOT/typescript/lib/lib.es5.d.ts`.

### Class V2 — mutant temp directory name (`mkdtemp` random suffix) — ALREADY HANDLED
`.../T/tutor-v4-implementation-mutations-**TqzQOS**/w4-m11-...` (run 1) vs
`.../T/tutor-v4-implementation-mutations-**odlK7D**/w4-m11-...` (run 2). Both normalize to
`$MUTANT_ROOT`.

### Class V3 — dependency file-set membership lines — **THE UNHANDLED CAUSE**
Most of the hashed listing is dependency file paths, not project files. Measured across the
eight mutation compile projects, dependency paths are **50.6%–96.0%** of the listed files,
and 52.7%–95.9% of the hashed bytes:

| compile project | listed files | dependency files | dependency share |
| --- | --- | --- | --- |
| `adversarial/v4/replay-crash` | 324 | 164 | 50.6% |
| `adversarial/v4/provider-chaos` | 248 | 163 | 65.7% |
| `adversarial/v4/privacy-retention` | 239 | 163 | 68.2% |
| `adversarial/v4/answer-extraction` | 226 | 163 | 72.1% |
| `core/v3/multimodal` | 208 | 163 | 78.4% |
| `adversarial/v4/parent-guardian` | 177 | 162 | 91.5% |
| `certification/v4/model-drift` | 175 | 168 | 96.0% |
| `certification/v4/live-runner` | 175 | 168 | 96.0% |

For W4-M01 on `provider-chaos` (248 lines): 58 `typescript/lib`, 68 `@types/node`,
37 `undici-types` = 163 dependency lines vs 85 project lines. The hash therefore tracks the
**installed dependency closure**, which is unpinned.

> **Corrected in W4-R11.** This section previously claimed "93–96% of the hashed bytes".
> That band is wrong: only 3 of the 8 mutation compile projects fall inside it. The
> measured range is stated above. The defect this section proves is unchanged — the digest
> tracks the unpinned dependency closure — only its magnitude was misstated.

Proven by sweeping ~60 (`typescript` × `@types/node`) combinations against W4-M11, which
produced **10 distinct hashes**, e.g.:

| typescript | @types/node | listed lines | sha (first 12) |
| --- | --- | --- | --- |
| 5.8.3 | 22.15.30–22.18.0 | 168 | `e64b8c3023ad` |
| 5.8.3 | 22.18.1–22.18.3 | 173 | `af3e838d535d` |
| 5.8.3 | 22.18.4–22.18.13 | 173 | `3caaec963029` |
| 5.8.3 | 22.19.x | 174 | `fd21fb81731d` |
| 5.8.3 | 22.20.x | 175 | `a661db15f58a` |
| 5.5.4 / 5.6.3 | 22.15.30 | 168 | `0fedbe68b766` |
| 5.5.4 / 5.6.3 | 22.20.1 | 175 | `dd2236a3eb2f` |

Exact differing lines, `@types/node` 22.18.0 → 22.20.1 (pure dependency-layout churn with
no relation to any mutation):
```
+ @types/node/globals.d.ts            (relocated)
+ @types/node/web-globals/abortcontroller.d.ts
+ @types/node/web-globals/domexception.d.ts
+ @types/node/web-globals/events.d.ts
+ @types/node/web-globals/fetch.d.ts
+ @types/node/web-globals/navigator.d.ts
+ @types/node/web-globals/storage.d.ts
+ @types/node/web-globals/streams.d.ts
+ @types/node/inspector.generated.d.ts
- @types/node/dom-events.d.ts
- @types/node/globals.d.ts            (old position)
```

TypeScript version alone was **falsified** as the sole cause: pinning `typescript@5.8.3`
with today's `@types/node` reproduced run 1's hashes byte-for-byte (13/13), not the
committed ones.

### Classes checked and found ABSENT
Timestamps, ANSI/colour formatting (`--pretty false`), diagnostic ordering (no diagnostics
exist), compiler/Node version strings (not emitted by `--listFiles`), locale, and hostname.
All are excluded by the 13/13 run-1-vs-run-2 normalized byte-identity.

## 6. Step 6 determination

**Yes.** After normalizing only the disposable-worktree/dependency absolute prefixes, run 1
and run 2 are byte-identical for all 13 mutations. Path volatility is fully handled today.

The residual non-reproducibility against the **committed** R9 hashes is **not** path
volatility. It is Class V3: the committed hashes encode a dependency closure that no longer
exists and is not pinned by any committed lockfile. The exact historical `node_modules` was
not recoverable across ~60 probed combinations. This is semantically meaningless for mutation
evidence — it proves nothing about the mutation — yet it dominates the hash.

## 7. Lockfile assessment

TypeScript **is** resolved from a single canonical installed binary inside the worktree
(`adaptive-tutor/node_modules/typescript/bin/tsc`); `run-negative-controls.ts` hard-fails if
it is absent. So the *binary* is canonical, but its *version* is not pinned.

**A lockfile is not required to fix this, and none is added.** The defect is that the evidence
hashes the dependency **file list** — a value that carries no mutation semantics. The repair
records compiler identity explicitly as data (`compiler.version`, `resolvedBinaryRelPath`,
`node.version`) and hashes only semantically meaningful content: the exact argv, the tsconfig
digest, the mutated-source digest, the compile exit code, normalized diagnostics, and a
membership proof for the mutated source alone. Dependency-layout churn then becomes invisible
to the hash, while a genuine toolchain change is *recorded and visible* rather than silently
baked into an opaque digest.

Root dependency manifests and lockfiles are unchanged, per the session constraints.

## 8. Authorized normalization for Phase 2

Only Class V1/V2 require rewriting, and only one default rule is needed:

- **R1** — proven disposable-worktree / repo-root / dependency-root absolute prefix → `<REPO_ROOT>`.

Class V3 is eliminated by **not hashing the dependency file list at all**, not by rewriting it.
No rule removes or rewrites diagnostic codes, messages, or file identities.
