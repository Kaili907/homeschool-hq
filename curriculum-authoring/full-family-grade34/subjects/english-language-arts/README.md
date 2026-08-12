# Manuel Academy — Grades 3 and 4 English Language Arts v1.0.0

**Authoring release date:** 2026-08-12
**Grades:** 3 and 4
**Courses:** 2
**Units:** 20
**Lesson blueprints:** 360
**School-year model:** 36 weeks / 180 instructional days per grade

Two complete, independently authored full-year English Language Arts courses, aligned to verified Michigan Grade 3 and Grade 4 ELA standards and built on the existing Manuel Academy ELA schema, mastery rule, accessibility floor, and policy set.

## What is here

```
README.md                    this file
package-manifest.json        package identity, counts, boundaries
MANIFEST.json                per-file sizes and SHA-256
SHA256SUMS.txt               same, in sha256sum format
schemas/lesson.schema.json   lesson schema v1.1 (extends the shared v1 schema)
standards/                   verified Michigan G3 and G4 catalogs, alignment notes, standards map
policies/                    policy binding plus the four ELA-specific policy documents
grades/grade-3/              the complete Grade 3 course
grades/grade-4/              the complete Grade 4 course
indices/                     course, unit, and lesson indices across both grades
authoring/                   the authored source of truth and the deterministic build script
tools/validate.py            the executable validator
validation/                  validation.json and validation-report.md
```

Each grade folder contains:

| File | Contents |
| --- | --- |
| `course-guide.md` | Scope and sequence, instructional model, mastery policy, integrity, accessibility |
| `course-overview.md` | Year map, weekly plan, daily cadence, family use |
| `units.json` | 10 units with anchors, essential questions, topics, performance tasks, lesson ids |
| `lessons.jsonl` | 180 complete lesson blueprints |
| `lesson-sequence.md` | The readable day-by-day plan |
| `assessments.json` | 10 unit assessments with the guided/independent evidence split |
| `schedule.csv` | The 36-week, 180-day calendar |
| `original-text-bank.json` / `.md` | Every original passage the course supplies, in full |
| `public-domain-register.json` | Public-domain works as references with provenance, never reproduced |

## Two independent progressions

Grade 4 is not Grade 5 with lowered labels, and it is not Grade 3 with harder texts. The two courses use different unit sequences, different 18-day unit arcs, different daily cadences, different text banks, and 180 distinct daily foci each with zero overlap between them. The validator enforces all of that, and separately enforces that neither course shares a unit title, a standards code, or its unit arc with the frozen Grade 5 ELA course.

**Grade 3** is built for the year a learner moves from learning to read toward reading to learn. Foundational decoding carries a dedicated daily segment and a full unit, because the Grade 3 standard names four discrete phonics sub-skills.

**Grade 4** is built around evidence. It carries the genuine Grade 3 to Grade 4 shifts: theme and summary, analytic text structure, an author's reasons and evidence, firsthand versus secondhand accounts, and drawing evidence from texts — a standard that does not exist at Grade 3. Foundational reading stays real but leaner, as one consolidated morphology thread, because the Grade 4 standard collapses to a single integrated expectation.

`standards/standards-reference.md` documents the twelve shifts and the foundational-skills weighting decision.

## Standards

Verified 2026-08-12 against the Michigan-published K-12 ELA standards document. Grade 3 carries 42 codes and Grade 4 carries 44; every code maps to at least one lesson, and every code cited by a lesson exists in the verified catalog.

Codes that the official text does not define are deliberately absent rather than invented: `3.RL.8` and `4.RL.8` ("Not applicable to literature"), `3.W.9` ("Begins in grade 4"), `RF.1` and `RF.2` at both grades, and `4.RF.3b`.

**Code order:** this package uses the Manuel Academy house order `3.RL.1`. Michigan publishes `RL.3.1`. They denote the same standard; transpose the first two segments when comparing against a state document. See `standards/standards-reference.md`.

## Text and copyright

Every passage supplied by these courses is an original Manuel Academy text — 16 for Grade 3 and 18 for Grade 4, embedded in full with a rights statement. Public-domain works are **referenced** with creator, first-publication year, translator where applicable, and public-domain rationale; none is reproduced. No full or partial copyrighted trade text appears anywhere. Facilitators may substitute library, licensed, or family-approved texts at the same target and record it locally. See `policies/source-integrity.md`.

## Assessment integrity

- The learner writes every assessed response. The tutor may question, model on a separate example, and name criteria, but must not draft, dictate, outline, reword, or supply sentences for an assessed essay or extended response.
- Fixed-answer keys are scorer-visible only and are never exposed on the tutor or learner surface before the learner responds.
- Guided and independent evidence are recorded separately; only independent evidence supports a mastery decision.
- Mastery requires accurate independent evidence on at least two occasions separated by time, text, or representation.
- No lesson requires persisting a learner's raw essay text.

See `policies/academic-integrity.md`.

## Accessibility

Every one of the 360 lessons carries a text-only path, read-aloud-capable content, a no-audio path, a caption-and-transcript requirement where media exists, a private presentation alternative, and no requirement for learner voice or video. These are structured lesson fields, so the validator fails the package if any lesson omits one. See `policies/accessibility.md`.

## Adaptive English

The frozen Adaptive English package covers approximately Grades 4-6 and is referenced, never modified, embedded, or duplicated. Grade 4 records band compatibility so a future adapter could expose intervention capability; no adapter is implemented or required. Grade 3 is below the band and operates fully through static help. See `policies/adaptive-english-boundary.md`.

## Reproducing and validating

```
python3 authoring/build.py     # regenerate every artifact from the authored source
python3 tools/validate.py      # 50 checks; exits non-zero on failure
```

The build is deterministic: running it twice produces byte-identical output. All authored content lives in `authoring/`; everything under `grades/`, `indices/`, `standards/*.json`, and `validation/` is generated from it.

## Boundary

"Curriculum complete" here means the authored and validated curriculum package is complete for these two courses. It does not mean the package has been merged into a runtime, mounted in the Study engine, connected to production identity or persistence, granted third-party text licenses, or produced as custom media. Those are separate integration stages. No repository code, database, hosted service, route, or deployment outside this directory is modified by this package.
