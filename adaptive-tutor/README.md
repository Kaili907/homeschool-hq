# Manuel Academy Adaptive Tutor Core v0.2

A standalone, local-first TypeScript implementation of the Manuel Academy adaptive visual tutor learning cycle:

> Assessment → Identify missing concept → Teach visually → Guided practice → Independent attempt → Reassess → Advance or reteach

This package owns shared tutor contracts and engine behavior only. The math and English files under `examples/` are demonstration fixtures, not final curriculum packages.

## Run locally

```bash
npm install
npm run check
npm run dev
```

The ZIP also includes a prebuilt `dist/` folder. To preview it without installing project packages:

```bash
python3 -m http.server 4173 -d dist
```

Then open `http://127.0.0.1:4173`. The prototype includes:

- A dark Jarvis AI core with layered glowing orange rings
- Subtle idle movement and a brighter pulse while browser speech is active
- A separate visual teaching board
- Visible captions and a transcript at all times
- A no-audio fallback when browser speech is unavailable
- One complete math demonstration and one complete English demonstration

## Boundary

This package does not connect to or modify GitHub, Supabase, Netlify, Lovable, databases, storage, identity, authentication, or progress synchronization. It does not request a camera or identifying learner information.

## Main folders

- `core/contracts/` — strongly typed TypeBox-style contracts and runtime/JSON Schema sources
- `core/engine/` — deterministic adaptive cycle, assessment scoring, graph validation, confidence, and misconception classification
- `core/safety/` — tutoring safety and escalation rules
- `core/prompts/` — provider-neutral prompt templates
- `core/media/` — missing-media and unavailable-voice fallbacks
- `core/review/` — parent/teacher evidence review builder
- `examples/` — demonstration-only math and English interactions
- `prototype/` — local browser interface
- `json-schema/` — generated JSON Schema artifacts
- `tests/` — automated tests
- `docs/` — integration, limitations, validation, and handoff documents

## Design guarantees

- Jarvis never claims to be human.
- A single answer cannot establish mastery.
- Confidence always includes uncertainty and evidence counts.
- Guided responses receive less evidence weight because support is available.
- Disputed grading and persistent difficulty can be escalated for adult review.
- The tutor does not diagnose disabilities or medical conditions.
- The tutor redirects requests to complete graded work.
- Camera access and identifiable child images are never required.
- Lessons remain usable without generated media or voice.
