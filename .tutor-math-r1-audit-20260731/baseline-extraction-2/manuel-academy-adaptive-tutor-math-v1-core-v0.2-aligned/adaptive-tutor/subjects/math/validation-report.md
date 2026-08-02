# Adaptive Math Intervention Content v1 — Core v0.2 Validation Report

**Derived release:** 1.0.1  
**Content version:** 1.0.0  
**Content boundary:** `adaptive-tutor/subjects/math/**`

## Preserved content

- Four ordered adaptive sequences
- 72 source assessment items
- 24 misconception patterns
- 20 visual-board commands
- 40 narration/WebVTT cues
- All lesson and sequence files byte-identical to authoritative Tutor Math v1

## Results

| Check | Result |
|---|---|
| Authoritative Math SHA-256 | PASS |
| Frozen Core v0.2 SHA-256 | PASS |
| Strict TypeScript 5.8.3 | PASS |
| Original behavioral tests | 9/9 PASS |
| Original content validator | 214/214 PASS |
| Core v0.2 alignment tests | 8/8 PASS |
| TutorProgram contracts | 4/4 PASS |
| Source assessments adapted | 72/72 PASS |
| Emitted assessment contracts | 96/96 PASS |
| Source visuals adapted | 20/20 PASS |
| Invalid runtime/Core fixtures | 5/5 rejected |
| Grade 5 direct behavior | PASS |
| Missing-media fallback | PASS |
| Unavailable-voice fallback | PASS |
| Cross-session mastery/uncertainty | PASS |
| Core engine advance trace | PASS |
| Core engine reteach/escalation/review trace | PASS |
| Subject prerequisite-remediation trace | PASS |
| Demo JavaScript/static inspection | PASS |
| Actual controlled-browser interaction | BLOCKED: no backend available |

## Boundary confirmation

No Core, GitHub, Supabase, Netlify, Lovable, database, storage, identity,
authentication, progress-synchronization, Tutor Assembly, or deployment change
was made.
