# Conflict log

The three imports completed without a manual conflict. `package.json` was automatically merged by Git while preserving the imported scopes. No source line was silently discarded to resolve an import.

Post-import semantic conflicts did exist:

- Session 12 host wiring allowed local fallback and a synthetic identity path.
- Session 13 and Session 14 defined related safety/adult-review concepts with incompatible durability and production-readiness assumptions.
- Preview visibility, provider credentials, cancellation, student authority, and staff authority were underspecified for production.

Those conflicts were reconciled by additive production contracts and migration work. Legacy/local paths remain usable only in explicit development preview; they are rejected as production ports.
