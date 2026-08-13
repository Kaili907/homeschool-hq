# Family Pilot Web Release R1

## Release identity

- Audited base SHA: `19d1ced429b03685b5e9b5759beed4b4a607d1a5`
- Tested release source SHA: `65f9d02b2d501b0470a8b41c85220104ffd86744`
- Audited classification: `READY_FOR_FAMILY_PILOT`
- Release branch: `mac/family-pilot-web-release-r1`
- Curriculum release: `family-pilot-r1`, `ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1`
- Inventory: 9 grades, 90 courses, 698 units, 8,292 lessons, 699 assessments, 8,292 production bindings, and 8,292 learner materials

The release source descends directly from the exact audited base. The evidence-only commit that adds this file does not change runtime code or configuration.

## Netlify deployment contract

Checked-in facts from `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node version: `22`
- Deployed proxy selection: `VITE_USE_PROXY=true`
- SPA fallback: final `/*` redirect to `/index.html` with status `200`; API redirects precede it
- Direct `/family-pilot` navigation, refresh, and browser navigation therefore use the same SPA entry
- Non-secret build values are declared in `netlify.toml`; provider credentials remain server-side Netlify values and were not read

Hosted Netlify facts remain unknown. The repository contains conflicting production-branch claims: `CODEX.md` names `master`, while the older `DEPLOY.md` names `main`. GitHub's default branch and both local and remote repository references are `master`, but only the authenticated Netlify site setting can establish the Netlify production branch and auto-publish behavior. No Netlify CLI executable, local Netlify link, Netlify environment credential, GitHub deployment, GitHub check run, GitHub commit status, repository webhook, or GitHub Actions workflow established hosted Netlify state in this session.

Netlify distinguishes a direct non-production-branch push (a branch deploy, if enabled for the site) from a pull-request deploy preview. This release created no pull request. The authorized pilot branch push produced no observable GitHub deployment/check/status record after two checks. That empty result is not proof that no private Netlify integration exists; branch-deploy enablement and the production auto-publish state are `UNKNOWN` until inspected on the authenticated site.

## Feature flag

The route remains default-off. `netlify.toml` contains exactly one `VITE_FAMILY_PILOT_ENABLED` assignment:

```toml
[context."mac/family-pilot-web-release-r1".environment]
  VITE_FAMILY_PILOT_ENABLED = "true"
```

No global, production, deploy-preview, or general branch-deploy context enables it. The configuration test proves both the exact literal and the absence of a global assignment. An explicit `false` production build proves `/family-pilot` remains unavailable outside the dedicated release context.

## Web URL and deploy status

- Web URL: `NOT_CREATED`
- Deploy status: `AWAITING_AUTHENTICATED_NETLIFY_BRANCH_DEPLOY_ENABLEMENT`
- Production deploy: not requested or performed
- Production branch, DNS, custom domain, hosted Supabase, migrations, and server Tutor routing: untouched

Manual action: on the authenticated Manuel Academy Netlify site, add `mac/family-pilot-web-release-r1` as an allowed branch deploy under **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**. The checked-in branch context will then supply the exact pilot flag without enabling unrelated deploys.

## Build and test proof

All commands ran at the tested release source SHA unless identified as an unchanged-base check.

| Proof | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Default production build, `npm run build` | PASS; 543 modules; 8,292 lessons in 90 lazy course payloads |
| Enabled production build, `VITE_FAMILY_PILOT_ENABLED=true npm run build` | PASS; 543 modules; final app chunk `FinalFamilyPilotApp-C3bmklhs.js`, 253,197 bytes |
| `npm run audit:family-pilot-launch` | PASS; 8,292/8,292 bindings and learner materials; 81 guardian-authority lessons; 12 dynamic Social sources; 0 adult-only material leaks |
| Family Pilot Vitest set | PASS; 73 files, 825 tests |
| Route/config lifecycle subset | PASS; 3 files, 21 tests |
| Bundle/browser-safety subset | PASS; 4 files, 47 tests |
| Enabled production-preview Playwright suite | PASS; 4 tests |
| Default-off production-preview Playwright suite | PASS; 1 test |

The first standalone launch-audit attempt in the clean checkout stopped on the expected missing generated browser manifest. The normal build generated the manifest and lazy payloads; the post-build audit then passed. This was a command-order correction, not a release defect.

## Browser and storage proof

The enabled production preview directly opened `/family-pilot` from a fresh persistent Chromium profile. It completed Family Setup, created students, resolved the admitted curriculum, assigned work, opened the final Study composition and production learner material, saved progress to IndexedDB, closed and reopened the browser process, reloaded the direct route, and resumed the exact durable segment. The workflow also proved student isolation, RFL guardian attestation, dynamic Social source attachment, scoped safety holds, reports, static Tutor fallback, and corrupt/write-failure fail-closed behavior.

The production storage identity remains `manuel-academy.study.family-pilot-durable`. The final route closure contains the storage identity and IndexedDB implementation. It does not use localStorage for Study documents. Supporting roster and app projections retain their audited localStorage roles; the durable Study document remains in IndexedDB.

The visible parent-facing notice says:

> This pilot currently saves progress in this browser on this device. Download backups regularly. Cross-device sync is coming next.

## Independent-browser and backup-transfer proof

Browser A created `Transfer Student`, assigned a real Grade 5 Mathematics lesson, advanced to the second segment, checkpointed, and downloaded a minimized Parent Download Backup. A distinct fresh persistent Browser B opened `/family-pilot` with no students or Browser A state. Browser B used the new first-run restore entry point, restored the backup, reproduced Browser A's exact durable Study document, and resumed at `Step 2 of 3`.

This proves the expected current behavior:

- A URL can be opened from different computers, but each browser/origin storage area begins independently.
- Progress does not automatically sync across computers.
- Parent Download Backup and Restore is the supported interim transfer and recovery path.

The backup proof also confirms `learnerTextIncluded=false`, `tutorTranscriptIncluded=false`, rejects corrupt/future-schema files without replacing valid state, and restores roster, assignments, exact segment references, source metadata, attestations, preferences, safety state, and durable Study documents.

## Bundle and security proof

The final enabled route emitted one `FinalFamilyPilotApp` chunk and 90 lazy course JSON payloads. Automated module-closure tests plus a final built-output scan found no:

- `createLocalDevelopmentStudyPorts`, `localDevelopmentPorts`, `fakeIndexedDb`, or test IndexedDB adapter;
- Node `fs`/`path` built-ins or internal filesystem paths;
- localhost-only provider or server Tutor production route;
- hosted Study/Supabase dependency in the Family Pilot route closure;
- service-role key name/value, provider credential name/value, or secret-shaped Anthropic key;
- learner-visible answer-key/scoring-authority fields or teacher/scoring-guide paths.

The audited Family Pilot made no external requests during the complete workflow. No hosted Study request is required for this release.

## Device-local limitation and next cloud-sync step

Known limitation: state is isolated by browser profile and hosted origin. Clearing site data removes the local state unless a Parent Download Backup is available. Different computers do not converge automatically.

Next cloud-sync step: open a separately authorized cross-device-sync release, first identify the exact Manuel Academy Supabase and Netlify site identities, then run the hosted preflight and review the already tracked migration/ownership protocol before enabling any hosted Study environment or browser sync flag. Do not reuse this branch to activate hosted persistence.

## Production/master proof

Before implementation, before the pilot push, and after the pilot push:

- local `master`: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f`
- `origin/master`: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f`
- remote `refs/heads/master`: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f`

Only `mac/family-pilot-web-release-r1` was pushed. No pull request, merge, production deploy, force update, DNS change, custom-domain change, hosted Supabase contact, migration, or server Tutor activation occurred.
