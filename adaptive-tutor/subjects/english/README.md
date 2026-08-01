# Manuel Academy Adaptive English Tutor v0.2

Final English subject package for Adaptive Tutor Core v0.2.0. This package imports the existing shared schemas from `adaptive-tutor/core`; it does not recreate or modify them.

## Completed modules

1. Decoding unfamiliar multisyllable words
2. Sentence completeness, subjects, predicates, and punctuation
3. Main idea and supporting details
4. Organizing and revising a clear paragraph

Each module contains a stable lesson and skill ID, grade band, prerequisite graph, diagnostic and distinguishing evidence, four learner-facing explanation modes, guided practice, at least three independent checks, reassessment, misconception-specific reteaching, prerequisite remediation, parent/teacher notes, delayed answer reasoning, narration, transcript, WebVTT, and a no-media fallback.

## Commands

```powershell
pnpm install --ignore-scripts
pnpm typecheck
pnpm build
pnpm test
pnpm validate
powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
```

## Browser demo

Run `pnpm build`, then open `demo/index.html` directly or serve this directory with any static file server. The page includes one reading intervention and one writing intervention, both generated from the same Core v0.2 contract objects used in automated tests.

## Boundary

The package is local-only curriculum and demonstration code. It does not integrate with GitHub, Supabase, Netlify, Lovable, databases, authentication, identity, storage, progress synchronization, cameras, or identifiable child photos.
