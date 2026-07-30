# Compatibility assessment

## Inspected baseline

The named `manuel-academy-adaptive-tutor-core-v0.2` package was not present in
the working tree, visible local Git history, incoming/attachment folders, or
common local project locations. Exact v0.2 validation parity cannot therefore
be claimed.

The available Academy code establishes these relevant conventions:

- strict TypeScript and Vitest;
- PascalCase contract types and camelCase properties;
- string-literal discriminants;
- integer root schema versions;
- hand-written validators/type guards that accept `unknown`;
- additive optional fields where absence has a runtime default;
- explicit forward migrations for breaking state changes;
- immutable updates and append-oriented event/chat history;
- opaque string identifiers, including legacy camelCase skill IDs;
- deterministic child-safety enforcement in code and tests.

This package follows those conventions without importing or modifying the
existing tutor core.

## Compatibility adapters

`contracts/legacy-adapters.ts` provides byte-preserving adapters for:

- legacy profile ID → `StudentId`;
- legacy skill ID → `SkillId`;
- legacy subject ID → `SubjectId`;
- legacy grades `3`, `4`, `6`, `10`, and `12` → broad grade bands.

The grade adapter maps only the existing grade literal. It does not infer
instructional placement, mastery, or focus capacity.

Recommended integration mappings:

- `Profile.id` → `StudentId` with no text transformation.
- Existing `SkillId` → opaque study-engine `SkillId`.
- A legacy walkthrough event → tutor-intervention evidence, if adequate
  provenance exists.
- A legacy “Needs Dad” flag → an adult review request with
  `basis: legacy-import`; never a confirmed prerequisite gap or attention
  conclusion.
- Legacy epoch milliseconds → RFC 3339 only in a documented adapter with the
  household time zone.

Do not map:

- tutor daily API-call caps to maximum work duration;
- parent PINs, provider keys, credentials, or auth identifiers into any study
  contract;
- a low legacy mastery score directly to a prerequisite gap;
- a repeated-help flag to a student trait;
- tutor transcripts into private notes without an explicit adult authorization
  and retention policy.

## Known semantic risks

1. The available core uses a closed grade union. Study-engine grade bands must
   remain independent.
2. The available core uses a closed legacy skill union. New prerequisite
   references must remain opaque and adapter-driven.
3. Existing mastery displays and engine thresholds are not a single shared
   criterion. Learning evidence therefore carries criterion and algorithm
   provenance instead of assuming one threshold.
4. Existing elapsed time does not cleanly separate active, break, pause, and
   technical time. The new session contract does; an integration adapter must
   not fabricate missing detail.
5. Current full-state export boundaries were not designed for adult-private
   study notes. Private records require a separate authorized store/projection.
6. Exact household-local same-day scheduling requires an explicit IANA time
   zone.
7. No independent JSON Schema evaluation dependency is installed. Runtime
   validators are authoritative for cross-record and semantic refinements.

See [core-change-requests.md](core-change-requests.md) for proposed shared
interfaces and temporary adapters.

