# Director Handoff — Adaptive Math Intervention Core v0.2 Alignment

## Package state

**Freeze-gate status: UNKNOWN pending one environmental browser check.**

The subject revision is confined to `adaptive-tutor/subjects/math/**`. The
Director-frozen Core v0.2 archive and all external systems remain unchanged.

## Completed alignment

- All four original sequences and all approved lesson files are byte-identical
  to the authoritative Math v1 package.
- Grade 5 is represented directly by Core v0.2's 4–6 integer grade band.
- Four subject programs, 72 source items, 96 emitted assessment contracts, all
  teaching responses/spoken turns, both practice contracts, all 20 visual
  commands, and all media fallbacks validate against the actual frozen Core
  schemas.
- The actual frozen Core engine completes an advance path and a repeated
  difficulty path ending in adult escalation and a contract-valid review.
- The subject runtime adds prerequisite remediation as a subphase of Core
  `reteach` and requires evidence from at least two sessions for mastery.

## Validation snapshot

- TypeScript strict typecheck: PASS
- Original behavioral tests: 9/9 PASS
- Original content validator: 214/214 PASS
- Core v0.2 alignment tests: 8/8 PASS
- Invalid Core fixtures: 5/5 rejected
- Grade 5 runtime behavior: PASS
- Missing-media and unavailable-voice behavior: PASS
- Uncertainty, escalation, and parent review: PASS
- Demo JavaScript syntax/static accessibility: PASS
- Actual browser interaction: BLOCKED because the controlled runtime exposed no
  browser backend

## Director action

Do not alter frozen Core v0.2. Run the unchanged standalone demo once in the
controlled browser and confirm its visible/keyboard interaction. If that check
passes, no known package defect remains and this derived ZIP is a candidate for
Director freeze.

No GitHub, Supabase, Netlify, Lovable, database, storage, identity,
authentication, Tutor Assembly, deployment, or progress-sync change was made.
