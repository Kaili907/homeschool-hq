# W3-07 Validation

## Result

`W3_PARENT_REPORTING_READY_FOR_CONVERGENCE`

## Scope proof

The implementation change is confined to:

- `adaptive-tutor/study-engine/tutor-v2/parent-reporting/**`
- `docs/study-tutor-v2/wave3/lanes/w3-07-parent-reporting/**`

No email, SMS, push, provider, persistence, UI, generated-schema, release, or
shared convergence file is changed.

## Focused validation

TypeScript strict compile:

```text
node <cached-typescript>/bin/tsc \
  -p adaptive-tutor/study-engine/tutor-v2/parent-reporting/tsconfig.json \
  --typeRoots <cached-node-types>

PASS (exit 0)
```

The worktree has no installed `node_modules`; validation used the existing
local npm cache and performed no dependency or network change.

Compiled Node test:

```text
node --test <temporary-dist>/study-engine/tutor-v2/parent-reporting/parent-report.test.js

tests 18
pass 18
fail 0
```

## Covered contract families

- exact public request and result runtime schemas;
- deterministic aggregation and duplicate evidence/event rejection;
- all reviewed observation and decision copy branches;
- explicit separation of Tutor proposed, Study approved, and Study applied;
- observation truthfulness through `Study recorded` plus null decision status;
- household, learner, session, and reporting-period binding;
- cross-child, cross-household, cross-session, and cross-period rejection;
- invalid and out-of-period chronology rejection;
- Study producer and reporting-approval provenance;
- report/evidence policy equality and source chronology;
- closed unknown-reason and reason/status rejection;
- reviewed time-on-task buckets and raw-duration rejection;
- raw transcript, raw answer, diagnosis, emotion, personality, provider prose,
  sibling data, and credential rejection without reflection;
- email, SMS/phone, push, and arbitrary narrative rejection;
- minimized accepted output and explanatory-only authority; and
- serialized copy-swap and authority-field rejection.

## Convergence note

The lane intentionally does not modify the shared Tutor V2 entrypoint,
generated schema inventory, Wave 3 gate, release artifacts, or host Parent Hub.
Convergence must select and publish the local `parent-reporting` entrypoint and
its schemas through the shared surfaces owned by the convergence lane.
