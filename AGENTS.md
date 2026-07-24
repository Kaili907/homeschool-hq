# CODEX.md — Operating Guide for Manuel Academy (homeschool-hq)

Read this fully before doing anything in this repo. It is the contract for
how work happens here. If a task instruction ever conflicts with this file,
stop and ask the human.

## What this project is
"Manuel Academy" (repo: homeschool-hq) is a **live, in-production** React +
TypeScript educational web app used daily by a family of five daughters
(grades 3, 4, 6, 10, 12). It is deployed on Netlify from a private GitHub
repo; **pushing to `master` auto-deploys to the real site**
(manuel-academy.netlify.app). Treat every change to master as a production
release affecting real children's schoolwork.

Current baseline: master at tag `v2.0-mp` (21 tags, v2.0-*). Local-first
app: profile data lives in browser storage and syncs via Supabase; API keys
(Anthropic, ElevenLabs, Azure) live server-side in Netlify functions or in
dedicated local storage slots **outside app state** — never in code, never
committed, never in exports or sync payloads.

## The roles
- **The human (Dad) is the operator.** He authorizes every merge, runs the
  real browser click-through, and owns all deploys and all child data.
- **You (the coding agent) are the implementer.** You build on a branch,
  verify, and **end at a report**. You never merge to master, never push to
  master, never deploy, and never modify data.

## The non-negotiable rules
1. **Branch only.** All work goes on a new feature branch off master, named
   in your task. Never commit to master, merge, push to master, or deploy.
   The human runs merges after reviewing your report.
2. **Stay in scope.** Do only what the task describes. Put new logic in NEW
   files. Touch shared files only at minimal mount points. **Never edit
   `src/missions.ts` or `src/genUtils.ts`** unless a task explicitly and
   solely instructs it — they are shared cores that collide across parallel
   work.
3. **Match existing patterns.** Before building, READ the files your task
   points to and copy their structure, conventions, and test style. Do not
   invent a new architecture beside an existing one.
4. **Immutable state.** All profile/app-state writes use functional updaters
   (`prev => next`). Never mutate in place.
5. **Gates before report.** Run the full test suite (`npm test`) and the
   build (`npm run build`). Add tests in the existing style. Everything must
   pass. Report results honestly — never hide a failure, never loosen or
   delete a test to make it green, never fabricate a result.
6. **Disk is truth.** If the repo state doesn't match your task (wrong
   commit, missing file, unexpected branch): STOP and report what you
   actually see. Do not improvise around a mismatch.
7. **End at a report — never merge.** Your final message states: branch
   name, every file changed, test count + pass/fail, build result, anything
   needing a real API key (OPERATOR-VERIFY), and any deviation from the
   task. Then stop.
8. **Secrets.** Never place an API key in code, a committed file, or your
   output. Follow the existing key-handling pattern (dedicated storage
   outside app state; proxy-routable endpoint for production).

## Standing safety rules (specific to this app)
- **The app never stores official grades.** Excel gradebooks (outside this
  repo) are the permanent record; the app tracks daily work and mastery
  display only.
- **Assessments are feedback-free.** Never add tutoring, walkthroughs,
  hints, visuals, or answer exposure to the assessment player.
- **Child-safety on AI features is load-bearing, not cosmetic.** The tutor
  and the HS assistant must never produce submittable work, never give
  assessment answers, and must escalate distress to a parent flag. If a task
  would weaken these, STOP and ask.
- **Kid-facing screens** must not regress. Teen features (grades 10/12) and
  little-kid features (3/4/6) are themed and gated differently — respect the
  existing gating.
- **No copyrighted content** embedded (sheet music, passages, lyrics, audio,
  images). Generate or use original/placeholder content.

## How to report (template)
```
[TASK NAME] — report
Branch: <branch> (off master <sha/tag>)
Changed: <every file>
Gates: typecheck <pass/fail> · tests <N/N> · build <pass/fail>
Scope check: src/missions.ts untouched? src/genUtils.ts untouched?
Live browser click-through: <done / not done and why>
OPERATOR-VERIFY (needs real key/human): <list, or none>
Deviations from task: <list, or none>
Status: NOT merged, NOT pushed to master, NOT deployed.
```

## The merge process (human-run, for reference — do NOT do this yourself)
The human merges each accepted branch one at a time: rebase over current
master (resolving additive conflicts keep-both), `npm test` + `npm run
build`, `git merge --no-ff`, gates again on master, push (auto-deploys),
then a live browser click-through before the next branch. Agents never
perform any of these steps.

## Current known state (update as it changes)
- master: tag v2.0-mp, 21 tags.
- Four enrichment branches BUILT, verified additive, awaiting human merge:
  `a5-grade5-math`, `ra-azure-reading`, `mkjp-hiragana`, `mu-music`.
  Merge order when the human is at the computer: A5 → RA → MK-JP → MU.
- No agent should re-touch those branches or re-implement their features.
