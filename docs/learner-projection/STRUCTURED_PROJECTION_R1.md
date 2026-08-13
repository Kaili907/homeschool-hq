# Structured Learner Projection R1

## Status

`manuel-academy.learner-structured-projection.v1` is the learner-safe browser DTO for the admitted Family Pilot R1 production packages. It replaces the previous lossy projection that concatenated choices into prompt strings and discarded item, task, and source structure.

The production build projects 8,292 of 8,292 admitted lessons into the existing 90 course-addressed payloads under `public/family-pilot-final/2.0.0/courses/`. The root manifest contains metadata and projection totals only. It does not contain lesson bodies.

## Contract

Every material contains:

- `dtoVersion`, `materialRef`, `lessonRef`, `title`, `subject`, and `format`;
- a stable `sectionRef` and `sectionKind` for every projected section;
- a stable `itemRef`, `itemKind`, `itemType`, `prompt`, `choices`, and `responseType` when the source package has an item;
- `materials`, `essentialQuestion`, `successCriteria`, `rubricCriteria`, `taskSteps`, `simulationAlternative`, `sourceMetadata`, `workMode`, and scoring `mode` when those values exist and are learner-safe.

Compatibility `section.body` and `section.prompts` fields remain for the current read-only Family Pilot material view. They are derived without choices or answers. The authoritative item representation is `section.items`; a choice is never appended to prompt text.

Stable identity rules are deterministic:

- existing package refs already prefixed with the lesson ref are retained;
- task-local and section-local refs become `<lessonRef>#<sourceRef>`;
- source elements without an authored ref receive a deterministic lesson-scoped ordinal ref;
- task steps receive `<lessonRef>#task-step-<ordinal>`.

## Subject projections

### Mathematics

The DTO preserves all section identities and kinds plus all 15,937 item identities, item kinds/types, prompts, choice arrays, response expectations, response types, and standards. It exposes a `workedSolution` only when both conditions hold: the section is `instructional-example` and the item is `worked-example`. Independent-practice, mastery-check, guided-practice, and extension items cannot carry a worked solution through this projector.

### English Language Arts

`sourceReference` becomes an allowlisted `sourceMetadata` object. Reference ID, title, author, form, rights category, acquisition note, accessibility representation, and facilitator-selection instructions are retained when present. Source bodies and unknown source fields are not copied. This keeps public-domain, original, library, licensed, and family-approved reference instructions actionable without reproducing unauthorized copyrighted text.

### Health and Physical Education

The projection retains `essentialQuestion`, learner materials, the student task, completion/success criteria, accessibility supports, learner safety constraints, adaptation choices, and optional reflection. Adult notes are not projected.

### Financial Literacy and Ready for Life

Tasks remain task sections with stable section identity. Prompts remain items with stable identity, prompt type, response mode, choice arrays, and units/inputs. The lesson-level scoring `mode` may be projected because it describes response handling and does not contain answers or scoring authority. `scoringRef`, response-scoring prompt duplicates, answer-bearing adult references, source production paths, and every `/scoring/` locator are excluded. A learner-safe simulation alternative is retained when present.

### Social Studies

Each static lesson retains the admitted source-readiness state and all approved source records referenced by that lesson. Each source record is allowlisted to source key, repository, kind, title, date/created-published metadata, creator metadata, retrieval URL, rights/access note, verification status/date/link state, and the explicit no-quotation marker. No source body or quotation is projected.

The 12 dynamic lessons retain the dynamic contract ID/version, runtime state, learner-launch state, required adult action, transition target, required attachment-field names, and attachment state. The DTO does not fabricate an attachment or source.

### Science, Technology, Arts, and Music

Science markdown is divided into stable structured sections while retaining the learner sheet for current renderer compatibility. Learner-facing rubric criteria, materials, essential question, success criteria, and equal-credit alternative location are projected separately. The adult pre-session section and adult scoring-sheet locator language are removed.

Technology and Arts/Music retain explicit task steps with stable step identity, material lists, essential questions, task briefs, work modes, success criteria, and rubric-facing critique/check criteria.

## Learner safety boundary

Projection is allowlist-based. It never emits:

- `answerKeyRef`, `answerIndex`, or `correctAnswer`;
- `scoringAuthorityRef`, `scoringRef`, or an adult scoring guide;
- worked solutions outside instructional worked examples;
- teacher guides, adult remediation or acceptable-answer oracles, adult pre-session instructions, private notes, credentials, or secrets;
- answer-key, `/scoring/`, scoring-guide, or teacher-guide locators in either materials or lesson-row resource refs;
- source-registry provenance file paths or source bodies.

The builder validates every material recursively before serialization and validates every course payload after serialization. Projection tests also inject negative controls for graded worked solutions, adult markdown, unauthorized ELA source fields, and FinLit scoring locators.

## R1 reconciled totals

| Measure | Result |
| --- | ---: |
| Lessons projected | 8,292 |
| Lazy course payloads | 90 |
| Structured items projected | 21,556 |
| Unique item refs | 21,556 |
| Choice-bearing items | 13,480 |
| Choice values preserved | 53,462 |
| Task groups projected | 3,023 |
| Explicit task steps projected | 3,042 |
| ELA source records preserved | 1,868 |
| Social source references preserved | 1,992 |
| Dynamic Social contracts preserved | 12 |
| Instructional worked solutions preserved | 1,574 |
| Adult answer/scoring fields and sections removed | 26,352 |
| Adult resource locators removed | 7,320 |
| Adult leaks found after projection | 0 |
| FinLit `/scoring/` locators after projection | 0 |

`sourceMetadataPreserved` in the generated manifest is 3,860, the sum of 1,868 ELA reference objects and 1,992 Social lesson-to-source references. Repeated Social references are intentional because each lazy lesson material must carry the source metadata needed to act on that lesson without loading another course payload.

## Verification

Run:

```sh
node --test scripts/learner-projection/structured-projection-r1.test.mjs
node scripts/audit-final-family-pilot-launch.mjs
npm run build
```

The projection test rebuilds and audits the complete 8,292-lesson corpus. The release audit verifies the 90-payload boundary, admitted counts, source runtime states, and zero adult leakage. The production build supplies the final bundle proof: lesson bodies remain in the 90 copied course JSON payloads and are absent from the initial Family Pilot JavaScript chunk and root manifest.
