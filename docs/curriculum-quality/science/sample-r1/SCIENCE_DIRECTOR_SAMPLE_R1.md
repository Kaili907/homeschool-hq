# Science Director Sample R1

Status: **DIRECTOR REVIEW CANDIDATE**

## Exact lesson

- Lesson ref: `ma-g3-science-u01-l02`
- Canonical title: `Concept model A: testable questions`
- Course: Grade 3 Science
- Unit: Science and Engineering Practices, Unit 1, Day 2
- Learner package: `curriculum-production/final/science/packages/ma-g3-science/student-sheets/ma-g3-science-u01-l02.md`
- Adult authority: `curriculum-production/final/science/packages/ma-g3-science/scoring/ma-g3-science-u01-l02.md`
- Machine record: row 2 of `curriculum-production/final/science/packages/ma-g3-science/work-packages.jsonl`
- Advisory contract: `ma-g3-science-u01-l02.advisory.json`

The completed audit already designates this exact lesson as the representative sample. It exposes the shared elementary concept-family gaps without selecting an unusually strong lab: no worked teaching object, repeated brief/evidence, weak independence, missing vocabulary support, generic remediation, and an oversized safety-first surface.

## What the sample demonstrates

The lesson now begins with a clearly labeled described puddle phenomenon and distinguishes a notice from a record and an explanation. It teaches testability with defined vocabulary, a `Question -> Plan -> Record -> Decide` model, a worked CER, and a limitation check. Guided ramp planning fades support before fresh paper-bridge independent evidence and a protected bird-feeder mastery card.

The evidence-door remediation contrast is a different explanation, not a reordered copy of the original model. Stable prerequisite and misconception IDs appear in the machine record and adult routes.

This is a desk lesson. It requires no hands-on work, equipment, measurement, or experiment. Described observations, proposed plans, and proposed records are labeled; learner observations and results remain blank and are never fabricated. The immediate surface shows only today’s desk-safety rule, while the complete established safety floor remains available as a later policy reference.

## Answer boundary

| Phase | Support policy | Sample sections |
| --- | --- | --- |
| Teach | `TEACHING_VISIBLE` | phenomenon, explanation, vocabulary, worked model, worked CER |
| Guided | `GUIDED_PARTIAL` | ramp plan with decreasing prompts |
| Independent | `INDEPENDENT_WITHHOLD` | fresh paper-bridge case |
| Fresh mastery | `INDEPENDENT_WITHHOLD` | separate bird-feeder card with no definition or completed model |
| Remediate | `GUIDED_PARTIAL` | evidence-door contrast and fresh towel-question retry |

The development preview renders one phase at a time and hides teaching support on the fresh-mastery step. This is review behavior, not production mastery state or scoring authority.

## Real-data Director preview

The preview path is `/__review/science/testable-questions`. It is exact-path and development-build-only. At startup, the existing curriculum build projects the canonical Markdown learner package into the admitted Family Pilot course payload. The preview then resolves the exact lesson through `loadFinalFamilyPilotCatalog`; it does not import a lesson fixture or duplicate the learner transcript in the UI.

Run from this worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open:

`http://127.0.0.1:5173/__review/science/testable-questions`

## Verification

- Science executable-content gate: PASS, 972/972 lessons.
- Science safety gate: PASS, 37/37 checks.
- Science production-quality gate: PASS, 972 ready and zero review/not-ready findings under the existing structural gate.
- Science checksum verification: PASS, 1,981 files.
- Sample and learner-response mapping: PASS, 14 tests.
- Full browser learner projection: PASS, 8,292 lessons and 36,328 response items.
- TypeScript: PASS.
- Production build: PASS; no Science preview chunk is emitted. The build’s browser answer-authority audit reported `NOT_APPLICABLE` because the Family Pilot production-build flag was disabled.
- Live development preview: exact lesson loaded, seven stages reached, fresh-mastery teaching content hidden, no console errors, and no horizontal overflow at 1280px or 390px.

## Scope

Only `ma-g3-science-u01-l02` is repaired. The other 971 Science packages are not rewritten. This candidate does not approve the draft Science standard, declare the corpus depth-ready, change runtime mastery/scoring, or deploy anything.
