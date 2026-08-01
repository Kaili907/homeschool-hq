# Adaptive Tutor Assembly Foundation

Status: `LOCAL_R1_CORRECTION_CANDIDATE`

Sessions: `TUTOR-ASSEMBLY-1`, `TUTOR-ASSEMBLY-R1`

## Decision and scope

Manuel Academy has a host-owned, subject-neutral Adaptive Tutor assembly seam.
The R1 correction hardens its renderer, registry descriptor inspection, and
external-artifact evidence gate without installing Tutor Math, adding a student
route, changing Grade 5 identity behavior, modifying either frozen package, or
registering a production subject.

The production registry remains empty. The reviewed candidate commit remains
unchanged; this correction is a separate local branch and is not authority to
push, merge, deploy, publish artifacts, or change production systems.

Baseline facts for R1:

- reviewed candidate: `f43b652668e0a0595095c15f472e52e7fa0082a7`;
- reviewed parent and recorded `origin/master` after fetch:
  `a5d2068ed93e3ac51cdc83787138049cf93d0063`;
- correction branch: `fix/adaptive-tutor-assembly-foundation-r1`;
- the dirty main worktree was not cleaned, reset, stashed, or modified by this
  correction.

## Ownership and lifecycle

- `App` remains the authority for active profile, grade identity, guarded
  screen transitions, sign-out, persistence, and focus restoration after exit.
- The subject registry resolves exact `(subjectId, programId)` pairs and has no
  first-subject, grade-fallback, or production Math entry.
- The loader clones unknown subject output, invokes exact Core program and graph
  validation, enforces descriptor/program identity, and returns a branded
  frozen handle.
- The runtime wrapper constructs one fresh engine per launch, validates inputs
  and outputs, projects child-safe data, and contains reset/disposal failures.
- The renderer projects commands into inert host view data and fixed React
  markup. It never accepts components, HTML, handlers, styles, URLs, or code
  from a subject.

`createAdaptiveTutorLaunchCoordinator` supports superseding launches,
cancellation, and disposal. The foundation does **not** import or observe
`App` lifecycle events automatically. A future UI integration must explicitly
invoke cancellation/disposal on active-profile change, sign-out, route exit,
program change, and component unmount.

## Registry containment

Registry creation validates the complete input batch before publishing it. All
required descriptor fields, including nested program, grade-band, provenance,
availability, and failure fields, must be own data properties. Inherited fields
and accessors are rejected. The entire inspection boundary contains throwing
getters, revoked Proxies, and Proxy traps as a structured
`MALFORMED_DESCRIPTOR` result without exposing the exception.

This is a narrow hardening of the existing accepted descriptor formats. Key
allowlists, value formats, limits, duplicate handling, loader behavior, and the
empty production registry are unchanged.

## Renderer validation model

On the normal engine path, frozen Core v0.2 semantic authority is:

`TutorResponseSchema → VisualBoardCommandSchema`

The public renderer also accepts `unknown[]`. It therefore has a separate
defense-in-depth containment parser derived command-for-command from the exact
frozen schema. The parser requires own data properties, exact keys, all base
fields, discriminators, ranges, and enums; it snapshots arrays without invoking
getters; and it catches descriptor and Proxy failures. This containment parser
does not replace or weaken Core semantic validation.

Every subject-provided fallback crosses one shared readable-text boundary:

- maximum 1,200 UTF-16 code units, including the truncation ellipsis;
- CRLF is normalized, unsafe controls are replaced, and truncation does not
  split a surrogate pair;
- empty fallback input resolves to fixed host text;
- React text escaping remains the only rendering path.

No raw command object, validation issue, exception, stack, or internal
diagnostic is serialized into child-facing output.

## Frozen Core v0.2 command matrix

All rows use frozen `VisualBoardCommandSchema` on the normal runtime path and
the host own-data containment parser at the direct renderer boundary.

| Command | Exact required-field/range handling | Host behavior and accessible output | Visuals unavailable / malformed | Maximum command text exposed | Focused coverage |
|---|---|---|---|---:|---|
| `clear-board` | Base `id`, `durationMs`, `ariaLabel`, exact keys | Intentional stateless no-op; the host does not add cumulative board state | Board receives one bounded displayed-instruction fallback; malformed clear also falls back | label 500; fallback 1,200 | valid no-op, missing base, extras |
| `set-title` | `text` 1–200 | Host `<h3>` with accessible label | Bounded text fallback | text 200; label 500 | valid, wrong type, oversize, extra key |
| `add-text` | `text` 1–1,200; required `region` and `emphasis` enums | Host paragraph; layout fields are validated even though fixed host presentation does not use them | Bounded text fallback | text 1,200; label 500 | valid, missing enum, array substitution |
| `draw-fraction` | numerator integer 0–100; denominator 1–100; label 1–100; representation enum | Fixed host figure/caption | Bounded text fallback | caption 100; label 500 | valid, range, missing representation |
| `draw-number-line` | finite min/max; finite step > 0; at most 30 finite highlights | Fixed host figure. Host presentation additionally requires `max > min`; that is a renderability rule, not a Core-schema claim | Bounded text fallback | label 500; finite numeric tokens | valid, nonfinite, bounds, hostile array |
| `show-sentence-parts` | sentence 1–500; subject/predicate 0–300; optional marker 0–100 | Fixed labelled group; schema-valid empty fields are not replaced with invented subject text | Bounded text fallback | 500/300/300/100; label 500 | valid, optional field/type limits |
| `highlight` | target stable ID; token 1–200; reason 1–500 | Fixed host `<mark>` text | Bounded text fallback | token 200; reason 500; label 500 | valid, missing target, text bounds |
| `reveal-step` | step integer 1–50; text 1–800 | Fixed numbered paragraph | Bounded text fallback | text 800; label 500 | boundaries 0/1/50/51 |
| `compare` | labels 1–300; relationship `equal`, `not-equal`, `part-whole`, or `complete-incomplete` | Fixed comparison paragraph | Bounded text fallback | labels 300 each; label 500 | all enum handling plus invalid value |
| `aria-announce` | text 1–800; priority `polite` or `assertive` | Exactly one polite status or assertive alert; processed independently of visual media | Remains active when visuals are unavailable; malformed announcement creates no live region and uses bounded visible fallback | announcement 800; label 500 | polite/assertive × visuals on/off; malformed and mixed commands |

Unavailable voice never removes the displayed spoken-turn transcript. It adds a
separate bounded status message. Native Previous/Next buttons and the labelled
navigation remain the keyboard interaction boundary. These DOM tests are not
represented as integrated-student-route browser acceptance; no student route
exists in this foundation.

## Exact external-artifact verification

Generic repository tests do not search a developer machine for frozen ZIPs.
The external compatibility test is explicitly skipped outside the private
ZIP-derived harness, and a skip is never counted as exact-artifact success.

The release-evidence command is:

```text
npm run verify:adaptive-tutor-artifacts -- --core-zip "<core.zip>" --math-zip "<math.zip>"
```

Both flags and both exact artifact filenames are required. Missing input,
duplicate/unknown flags, legacy `--core-root`/`--math-root` arguments, and hash
mismatch fail with a nonzero exit before a compatibility PASS. No user-specific
path is committed in source or package metadata.

The command:

1. reads and hashes each ZIP;
2. rejects unsafe paths, duplicates/case collisions, symlinks, encryption,
   unsupported compression, malformed bounds, and excessive expansion;
3. extracts the verified bytes into a newly created verifier-owned temporary
   directory;
4. reconciles Core `MANIFEST.json` (248/248 listed files plus its two documented
   exclusions) and Math `SHA256SUMS.txt` (91/91 listed files plus the checksum
   file itself);
5. records the derived roots and canonical tree fingerprints;
6. executes the frozen verifier and host compatibility probe only from those
   derived roots;
7. requires one non-skipped host exact-artifact test and asserts four programs,
   Grade 4–6 with no Grade 5 remap, four independent engines, 72 source items,
   96 emitted contracts, 20 visuals handled, five invalid fixtures rejected,
   and advance/reteach/escalation flows;
8. re-fingerprints both executed trees and rehashes both source ZIPs; and
9. removes the temporary directory before emitting final PASS evidence.

The command accepts no independently supplied Core or Math root. An extracted
directory can never substitute for a required ZIP.

## Validation reporting rules

Evidence totals are reported in three separate groups:

1. deterministic in-repository assembly tests, excluding the external probe;
2. the explicitly invoked exact two-ZIP command, including its one non-skipped
   host test and exact compatibility counts; and
3. aggregate repository/DB observations for the recorded commit, Node version,
   environment, and invocation.

Aggregate totals are environment-specific observations, not stable candidate
guarantees. A skipped external test is reported as skipped, never passed.
Failures are classified as candidate regression, pre-existing baseline failure,
aggregate contention, environmental limitation, or inconclusive. Timeouts,
expectations, and unrelated tests are not relaxed. The repository has no lint
script, so this correction makes no lint claim.

### R1 correction evidence

Current results below are observations for the local correction worktree under
Node `v22.23.2`; they are not permanent repository-wide guarantees.

| Gate | Current result | Classification |
|---|---|---|
| Locked dependency install | PASS — `npm ci`, 145 packages | Correction environment |
| Typecheck | PASS — `npm run typecheck` | Correction-owned gate |
| Production build | PASS — existing large-chunk warning only | Correction-owned gate |
| Deterministic assembly tests | PASS — 5 files, 78/78 | Correction-owned gate |
| Generic assembly run | 78 passed, 1 external-artifact test skipped | Skip is not a pass |
| Exact two-ZIP command | PASS — 1/1 non-skipped host test; exact counts below | Correction-owned gate |
| Missing artifact arguments | Expected failure — exit 1 | Negative evidence |
| Wrong-hash artifact | Expected failure — exit 1 before extraction/execution | Negative evidence |
| Caller-supplied extracted root | Expected failure — exit 1 as unsupported input | Negative evidence |
| Profile, migration, provenance, and launch tests | PASS — 4 files, 79/79 | Relevant regression gate |
| Source + Netlify aggregate | 830 passed, 29 failed, 1 skipped | All failures confined to untouched mounted-sync suite |
| Mounted-sync isolated, two runs | 26/29 both times | Environmental timing limitation: two five-second classes and one follow-on operation-state failure; no sync file changed |
| Foundation-integration DB | PASS — 2/2 | Isolated DB gate |
| PostgreSQL CAS, two runs | No tests reached; existing 120-second setup hook timed out, then temp cleanup reported `EBUSY` | Environmental limitation; no pass claimed |
| PGlite CAS | 20/23 | Environmental timing limitation: one 30-second and two five-second timeouts; no DB file changed |
| Base-profile DB | No terminal summary before the 15-minute command ceiling | Inconclusive; no pass claimed |

The exact command independently recorded four discovered and validated
programs, four independent engines, Grade 4–6 with Grade 5 not remapped, 72
source items, 96 emitted contracts, 20 visuals mapped or accessibly handled,
five invalid fixtures rejected, and successful advance plus
reteach/escalation flows. Core and Math source ZIP hashes and extracted-tree
fingerprints were unchanged after execution.

The mounted-sync and database limitations are outside the changed-file set and
were not hidden, reclassified as passing, or addressed by changing timeouts.
Prior validation counts are retained only as comparison context.

## Grade 5 and production boundary

Frozen Math's numeric band 4–6 directly includes Grade 5, and the exact probe
asserts that no remap field is introduced. The host persisted Grade union,
profile validation, synchronization, SQL, authentication, and database
contracts remain unchanged. Consequently, this foundation still does not
launch a persisted Grade 5 profile or add a student route.

Tutor Math remains external and test-only. Tutor Core and Tutor Math remain
byte-identical frozen inputs. No production subject, route, storage, progress
synchronization, AI gateway, or voice gateway is added.

## Artifact custody and authorization

The two current local ZIP copies are temporary read-only session inputs, not
approved custody. Immutable custody and retrieval requirements are defined in
`docs/adaptive-tutor-artifact-custody-requirements.md`.

Separate Director authorization is required before any branch push or PR,
artifact upload/publication or custody-coordinate publication, repository ZIP
policy, merge, deployment, production registration, route, identity/database
change, or production-system change.
