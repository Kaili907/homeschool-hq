# Grade 3 Math Production Sample R2

## Scope

- Base: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`
- Lesson: `ma-g3-mathematics-u01-l02`
- Child title: **Round Numbers to the Nearest 100**
- One Director sample only; no bulk lesson rewrite.

## Controlling input provenance observed at session start

| Requested input | Observed SHA | Provenance |
| --- | --- | --- |
| `origin/mac/elementary-math-standard-r1` | unavailable | The remote did not advertise this branch and the local remote-tracking ref did not exist. The matching local source branch was `c2111bedfb24a3d12f0051fd4bb13f8207833f56`. |
| `origin/mac/g3-rounding-sample-r1` | `4273d7bb63c7678e99d3502eccb3d25ae36c1938` | Resolved from the remote-tracking ref and confirmed by `git ls-remote --heads origin`. |
| `origin/mac/elementary-math-sample-player-r1` | `1c95ad0ed14c642f30b6a684a6bb6dc369dba4d9` | Resolved from the remote-tracking ref and confirmed by `git ls-remote --heads origin`. |

The local standard commit was ported explicitly. This record does not represent it as a remote SHA.

## Learner experience

The learner sees one active block or question at a time:

1. Learn — 3 teaching blocks
2. Examples — 3 worked examples revealed one step at a time
3. Let's Try One — 5 guided questions
4. Your Turn — 10 independent questions
5. Check What You Know — 5 mastery questions
6. Optional choice — 4 More Practice questions and/or 2 Challenge questions

The player uses Grade 3 wording and never renders a list of future questions.

## Runtime and authority

- The current Family Pilot `LessonSurface` selects the special presentation only for the target lesson.
- The current Dashboard/Study assignment and controller paths remain unchanged.
- Production answers pass through the existing `LearnerResponseRuntime` and the existing `BrowserLearnerResponseStore` owned by `LessonSurface`.
- The player contains no answer key, scoring rule, correctness test, or response-store implementation.
- The Director preview uses the existing in-memory learner-response store implementation. Review answers disappear on reload and cannot enter production learner records.
- Jarvis exposes only a future callback placeholder. No Tutor V2 connection was added.

## Director preview

From this worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/__review/g3-rounding`.

The shortcut is exact-path and development-only. Production builds cannot enter it.

## Verification

- Grade 3 rounding content validator: 14/14 checks passed.
- Focused sample/player tests: 19/19 passed.
- Current Family Pilot controller assignment/start test: passed.
- TypeScript typecheck: passed.
- Default production build: passed.
- Family Pilot-enabled production build: passed.
- Browser answer-authority audit: passed with zero findings.
- Desktop and 390 × 844 preview interaction checks: passed with no console warnings or errors.
- Full repository Vitest gate: 6,571 passed; 1 unrelated baseline test failed because base `netlify.toml` uses `netlify/function-entrypoints` while the preflight expects `netlify/functions`.
