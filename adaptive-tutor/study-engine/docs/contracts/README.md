# Manuel Academy Study Engine Contracts v1

This package defines the typed and runtime-validated boundary for adaptive study
plans, student focus profiles, study sessions, learning evidence, review
scheduling, and parent/teacher controls.

The package is intentionally standalone. It does not modify the tutor core,
subjects, engine, UI, integrations, parent surfaces, databases, identity,
storage, authentication, GitHub, or deployment.

## Source layout

- `contracts/` — public TypeScript wire contracts, version constants, and
  byte-preserving legacy adapters.
- `schemas/` — zero-dependency runtime validators, JSON Schema descriptors,
  deterministic generator, registry, migration gate, and automated tests.
- `schemas/generated/` — seven deterministic JSON Schema Draft 2020-12 files.
- `fixtures/valid/` — synthetic valid examples for every root and every study
  session state.
- `fixtures/invalid/` — focused invalid mutations with expected issue codes and
  paths.
- `docs/contracts/` — this reference set, validation evidence, compatibility
  notes, migrations, integration guidance, and core-change requests.

## Validation API

```ts
import { validateLessonStudyPlan } from '../../schemas/index.ts'

const result = validateLessonStudyPlan(untrustedPayload)
if (!result.ok) {
  console.error(result.issues)
  return
}

const plan = result.value
```

Every root schema exposes `validate`, `parse`, and `is` forms. Validation:

- accepts `unknown`;
- does not coerce, normalize, trim, or insert defaults;
- returns stable issue codes and JSON-style paths;
- rejects unknown properties outside `metadata.extensions`;
- rejects unsafe/non-JSON data, cycles, sparse arrays, accessors, reserved keys,
  non-finite numbers, and excessive input size;
- performs cross-field, identifier, reference, chronology, sequence, privacy,
  and child-safety refinements.

## Language rule

An **effective work-block range** is contextual and revisable. It may change by
subject, task, environment, accommodation, fatigue, available support, and new
evidence.

A **fixed attention span** would claim a permanent number about a child. This
package intentionally has no such field, type, output, or inference. An
insufficient-data focus profile carries only generic grade-band starting
guidance and cannot contain a personalized baseline, target, or maximum.

Low accuracy is learning evidence. It is never, by itself, proof that a student
was not attending. Runtime validation rejects an engagement-support concern
whose only supporting signal is accuracy.

## Verification commands

```powershell
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/contracts/tsconfig.json --noEmit
node adaptive-tutor/study-engine/schemas/generate-json-schemas.ts --check
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/schemas
```

See [validation-report.md](validation-report.md) for recorded results and
[integration-notes.md](integration-notes.md) for the adapter boundary.

