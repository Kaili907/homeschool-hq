# Learner Web Release R2

Date: 2026-08-13

Branch: `mac/learner-web-release-r2`

Authoritative source: `7baf8dfbc27168708ed4cf504285a1838d7345f6`

Classification: `BLOCKED`

The obsolete web release `c81ddb6e04bc1c3629212327d47817c1b5677477`
was not used as application source.

## Release result

| Field | Result |
|---|---|
| STATUS | `BLOCKED` |
| SOURCE_SHA | `7baf8dfbc27168708ed4cf504285a1838d7345f6` |
| NETLIFY_CONTEXT | custom branch context `mac/learner-web-release-r2` |
| FEATURE_FLAG | `VITE_FAMILY_PILOT_ENABLED=true` only in that exact context; unset globally |
| BUILD | default-off production PASS; enabled learner pilot production PASS; exact Netlify branch-context offline build PASS |
| FUNCTIONS | trusted scorer included and locally bundled; deploy artifact hygiene FAIL |
| QUALITY_GATE | PASS |
| BROWSER_PROOF | PASS |
| BUNDLE_SECURITY | FAIL |
| WEB_URL | none |
| DEPLOY_STATUS | not attempted; production untouched |
| MASTER_UNCHANGED | `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f` before release work |
| CLASSIFICATION | `BLOCKED` |

## Configuration

`netlify.toml` now enables the learner route only in:

```toml
[context."mac/learner-web-release-r2".environment]
  VITE_FAMILY_PILOT_ENABLED = "true"
```

The global build environment does not define the flag. Production, Deploy
Previews, and unrelated branch contexts therefore remain default-off.

The `production-item-assessment` function uses the `esbuild` bundler and has
explicit `included_files` coverage for the admitted manifest, all 8,292
production bindings, and all 16,584 dynamically resolved production-package
and scoring-authority references. The focused configuration test proves that
every reference is covered.

The SPA fallback remains last in `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Verification

| Verification | Command | Result |
|---|---|---|
| Default-off production build | `env -u VITE_FAMILY_PILOT_ENABLED npm run build` | PASS |
| Enabled production build | `VITE_FAMILY_PILOT_ENABLED=true npm run build` | PASS |
| Exact branch-context Netlify build | `npx --yes netlify-cli@latest build --context branch:mac/learner-web-release-r2 --offline` | PASS |
| Release configuration | `npx vitest run --project root-app scripts/family-pilot-web-release-config.test.ts` | PASS, 4/4 |
| Learner quality gate | `npm run audit:learner-release` | PASS; 8,292 lessons and 699 assessments ready |
| Family Pilot launch audit | `npm run audit:family-pilot-launch` | PASS; adult-only learner-material leak count 0 |
| Trusted scoring function | `npx vitest run --project netlify-functions netlify/functions/production-item-assessment.test.js` | PASS, 14/14 |
| Assessment workflow | `npx vitest run --project root-app src/study/family-pilot/final-app/assessment` | PASS, 13/13 |
| Enabled browser smoke | `npm run test:family-pilot-browser` | PASS, 4/4 |
| Default-off browser proof | `npm run test:family-pilot-flag-default` | PASS, 1/1 |
| Learner web bundle security | `npm run audit:learner-web-bundle` | FAIL (release-blocking) |

The enabled browser suite opens `/family-pilot` directly, closes and reopens a
real Chromium process on that route, and proves durable recovery. The Netlify
SPA fallback supplies `index.html` on hard refresh. The default-off browser
suite proves the same direct route returns the normal Homeschool HQ surface
when the flag is not exactly `true`.

## Function artifact proof

The offline Netlify build resolved the exact custom branch context and emitted:

- `.netlify/functions/production-item-assessment.zip`
- 62,866,841 compressed bytes
- 205,874,947 uncompressed bytes across 15,918 files
- the scorer handler, admitted `MANIFEST.json`, `production-bindings.jsonl`,
  and representative Math, Science, ELA, Social Studies, and Technology/Arts
  production and scoring authorities

The browser client default endpoint is the same-origin Netlify function path
`/.netlify/functions/production-item-assessment`; no localhost scoring endpoint
is required.

Artifact hygiene is not releasable: Netlify emitted 60 function ZIPs, including
28 top-level `*.test.js` files as functions and a separate
`production-item-resolver.zip` helper artifact. The functions source layout must
be corrected so only intended handlers become deployable endpoints.

## Bundle security failure

The strict scan inspected all 344 text browser artifacts in the enabled `dist`
tree. It found:

| Rule | Files with matches |
|---|---:|
| adult answer authority | 0 |
| `answerIndex` | 2 |
| `correctAnswer` data | 4 |
| answer-key locator | 0 |
| scoring locator | 0 |
| PIN | 2 |
| Tutor transcript | 2 |
| service-role | 2 |
| localhost production dependency | 1 |

The release-blocking artifacts include the main application bundle, Grade 5
Math Practice, Admin Console, and `FinalFamilyPilotApp`. In particular, the
Family Pilot chunk contains a local Tutor path carrying `correctAnswer`, while
the main application bundle contains `answerIndex` and
`http://localhost:9999`. No browser bundle is approved while any requested scan
class remains present.

No service-role value was configured, printed, or supplied, and Supabase was not
contacted. This does not waive the strict bundle failure caused by service-role
tokens in emitted browser code.

## Deployment decision and manual action

No deployment was attempted. The machine has no installed Netlify CLI, no
Netlify auth environment value or user configuration, and no linked
`.netlify/state.json`. Hosted branch allowlisting and hosted runtime environment
values therefore could not be verified.

After the bundle and function-artifact blockers are fixed and all gates pass,
perform this exact Netlify UI action:

1. Open the connected Netlify project.
2. Go to **Project configuration → Build & deploy → Continuous Deployment →
   Branches and deploy contexts → Configure**.
3. Select **Let me add individual branches**.
4. Add exactly `mac/learner-web-release-r2` and save.
5. Confirm the production branch is unchanged, then create/observe only the
   non-production branch deploy. Do not publish or promote it.

Do not take that UI action for this commit while classification remains
`BLOCKED`.

## Blockers

1. Remove learner-side answer authority and every other requested sensitive
   scan token/dependency from the complete enabled browser artifact.
2. Remove the local Tutor `correctAnswer` path from the Family Pilot production
   chunk or replace it with a server-trusted learner-safe contract.
3. Eliminate the localhost production dependency from the emitted main bundle.
4. Move tests and non-handler helpers out of the Netlify functions entrypoint
   directory (or stage a handler-only functions directory) and re-inspect the
   exact deploy artifact.
5. Re-run all gates, then verify the exact branch allowlist and runtime
   environment on the hosted Netlify project without contacting Supabase.

Final classification: `BLOCKED`
