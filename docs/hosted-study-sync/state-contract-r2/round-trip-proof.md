# Round-trip and validation proof

## Conversion seam

`exportLocalBundleToHostedSyncStateR2` consumes the three current Family Pilot authorities:

1. `FamilyPilotStateV1` Core student/assignment/progress;
2. `FinalFamilyPilotAppStateV1` session handles, assessment metadata, RFL, Social source, and Safety;
3. learner-scoped `DurableStudyDocumentV1` from IndexedDB.

It requires exact household/student/learner identity, finds each saved assignment session in the durable calendar/session authorities, derives no missing cursor, and emits the R2 snapshot.

`importHostedSyncStateToLocalBundleR2` validates the snapshot again and upserts the selected student into a supplied receiving-device template. It creates missing Core assignment rows, app session rows, student profile, RFL, Social, assessment, and Safety rows while preserving sibling rows. It installs the exact validated durable IndexedDB document. The selected student's PIN digest is removed, and `pinRequired` becomes false until that device performs local PIN enrollment.

## Executable fixtures

`stateContract.test.ts` constructs actual current local document fixtures for:

- active Math with one completed segment, exact current segment, checkpoint revision 4, and active seconds;
- normally completed Math with all segments and completion time;
- pending trusted assessment and adult rubric review;
- RFL learner assertion pending guardian certification;
- RFL certified with exact attester ref and evidence mode;
- Social source attachment with exact minimized metadata and source revision;
- open Safety hold;
- cleared Safety hold with guardian clearer identity and logical revision.

The proof is:

```text
current local bundle
  -> export R2 snapshot
  -> import into an empty receiving-device bundle
  -> export R2 snapshot again
  -> deep equality
```

The test also deep-compares the imported and source `DurableStudyDocumentV1`, proving the calendar/session/checkpoint continuation authority is not projected away.

Additional parser tests cover scored assessment outcome, unknown version, expected-identity mismatch, sibling contamination, negative envelope and checkpoint revisions, idempotency mismatch, dangerous nested authority fields, and privacy canaries.

## Validation command

```text
node <offline-vitest>/vitest.mjs run --config src/study/hosted-sync/v2/contracts/vitest.config.mjs
```

Result at implementation time: 1 file passed, 4 tests passed.

The worktree did not contain `node_modules`; validation used an already cached local Vitest 4.1.10 runtime and made no network request. A repository-wide TypeScript invocation without installed dependencies reports unrelated missing React/Vitest/Vite modules. Filtering that compiler output to the owned contract path leaves only the expected missing `vitest` test-module declaration; production contract sources report no TypeScript diagnostics.
