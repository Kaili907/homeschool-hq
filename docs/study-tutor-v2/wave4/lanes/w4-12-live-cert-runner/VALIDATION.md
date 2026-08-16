# W4-12 validation

## Offline-only commands

From `adaptive-tutor/certification/v4/live-runner`:

```sh
npm test
npm exec --offline --yes --package=typescript@5.8.3 --package=@types/node@22.15.30 -- sh -c 'task_tsc_bin=$(command -v tsc); task_type_roots=$(dirname "$(dirname "$task_tsc_bin")")/@types; exec "$task_tsc_bin" -p tsconfig.json --noEmit --typeRoots "$task_type_roots"'
```

The second command explicitly forces npm offline and uses packages already in
the local npm cache. It does not authorize or require a registry connection.

## Result

- Node test runner: 11 passed, 0 failed.
- Strict TypeScript 5.8 validation: passed with no diagnostics.
- Scope/diff whitespace check: passed.
- Live calls, credentials, provider SDKs, and network operations: none.

## Covered invariants

- deterministic campaign/case/trial identity is stable across repeated runs
  and input case ordering;
- exact provider/model/configuration provenance, policy revision, all seven
  case axes, timestamps/durations, and applicable seeds reach every trial;
- all six hard violations independently produce immediate `FAIL` and prevent
  a second transport call;
- perfect non-hard quality cannot compensate for a hard violation;
- non-hard statistical quality thresholds run after complete campaigns;
- transport exceptions and malformed/extra observation fields stop as
  `INCOMPLETE` with hard gates `not-evaluated`;
- raw exception text, ephemeral input canaries, prompts, and completions are
  absent from reports and mock request audits;
- cost, latency, and usage aggregate deterministically; and
- plan validation rejects credentials, hard-gate thresholds, overflowing
  seeds, incomplete dimensions, and duplicate semantic cases.

No live provider, credential, key, SDK, HTTP client, or network call is used.
