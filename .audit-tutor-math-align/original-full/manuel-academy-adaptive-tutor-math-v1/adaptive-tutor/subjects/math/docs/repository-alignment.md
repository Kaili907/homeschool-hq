# Read-Only Repository Alignment

The package was prepared outside GitHub after a read-only inspection of the Manuel Academy baseline `15644974628ead6704c1e97e959cdbd801fdd1b3`.

## Existing shapes honored

- `src/types.ts`: `Question` includes `skillId`, difficulty, prompt, optional visual, choices, and answer index.
- `src/skills.ts`: legacy math skill IDs exist for grades 3, 4, and 6.
- `src/explain/types.ts`: walkthroughs are ordered steps with spoken text and optional visuals.
- `src/tutor/tutorEngine.ts`: tutor replies must avoid final-answer leakage, offer one question or hint at a time, remain brief, and cap exchanges.
- Existing local-first, missing-content, and reduced-motion patterns remain compatible with a content-only package.

## Intentional boundaries

- Stable subject IDs are content identifiers, not database keys.
- Grade 5 and expanded visuals are documented as core gaps, not silently added to shared code.
- No persistence, identity, authentication, RLS, storage, or synchronization contract is proposed here.
- The package can be loaded later through an approved content adapter after the shared foundation is ready.
