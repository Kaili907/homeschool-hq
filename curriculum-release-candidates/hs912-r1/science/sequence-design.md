# Manuel Academy High School Science, Grades 9–12 — Sequence Design

**Authored:** 2026-08-12
**Schema set:** Curriculum Authoring 2.0.0
**Jurisdictional focus:** Michigan
**Status:** Locally authored curriculum aligned to published standards. This package is not a claim of
state approval, accreditation, licensure, endorsement, or automatic transcript credit.

---

## 1. What the state actually requires

This section separates **statutory requirements** from **convention**. The distinction drives every
sequencing decision below, so the governing text is quoted rather than paraphrased.

### 1.1 The science credit requirement

Michigan's high school credit requirements are set by the Revised School Code. The science
requirement is **MCL 380.1278b(1)(b)**, quoted verbatim:

> At least 3 credits in science that are aligned with subject area content expectations developed by
> the department and approved by the state board under this section, including completion of at
> least biology and either chemistry, physics, anatomy, or agricultural science, or successfully
> completing a program or curriculum that provides the same content as the chemistry or physics
> benchmarks, as determined by the department. A student may fulfill the requirement for the third
> science credit by completing a department-approved computer science program or curriculum or
> formal career and technical education program or curriculum. The legislature strongly encourages
> pupils to complete a fourth credit in science, such as forensics, astronomy, Earth science,
> agricultural science, environmental science, geology, physics, chemistry, physiology, or
> microbiology.

Three findings follow directly from that text, and they are the reason this package does not simply
default to the conventional course names:

| Claim | Status | Basis |
| --- | --- | --- |
| Three science credits are required | **Mandatory** | "At least 3 credits in science" |
| **Biology** must be completed | **Mandatory, and named** | "including completion of at least biology" |
| A second credit must be chemistry, physics, anatomy, **or** agricultural science | **Mandatory as a content set, not as a single named course** | The statute lists four acceptable courses |
| A course must literally be *named* "Chemistry" or "Physics" | **Not mandatory** | The statute accepts "a program or curriculum that provides the same content as the chemistry or physics benchmarks" |
| A standalone Earth Science course is required | **Not required** | Earth science appears only in the encouraged-fourth-credit list |
| A fourth science credit is required | **Not required; explicitly encouraged** | "strongly encourages pupils to complete a fourth credit" |

Michigan's own science content expectations are the **Michigan Science Standards (November 2015)**,
which express high school content as **71 performance expectations** across HS-PS, HS-LS, HS-ESS, and
HS-ETS1. Those 71 performance expectations — not course titles — are the actual content obligation,
and covering them is what this package is designed and audited against.

### 1.2 How this applies to a home school

Manuel Academy is a home school. The Michigan Merit Curriculum in MCL 380.1278a/1278b binds **school
districts and public school academies** issuing a diploma; it does not by its own terms bind a home
school. A Michigan home school's statutory subject obligation is **MCL 380.1561(3)(f)**:

> The child is being educated at the child's home by his or her parent or legal guardian in an
> organized educational program in the subject areas of reading, spelling, mathematics, science,
> history, civics, literature, writing, and English grammar.

That statute requires *science*; it does not prescribe courses, credits, or standards.

**Manuel Academy decision.** This package voluntarily aligns to the Michigan Merit Curriculum content
expectations anyway, because MMC alignment is what makes a home-school transcript legible to Michigan
colleges, dual-enrollment programs, NCAA review, and employers. Alignment is a deliberate quality
choice, not a legal compulsion, and nothing in this package should be read as asserting that the
family is subject to the MMC or that completing it produces state-recognized credit.

### 1.3 One further statutory note that affects the Grade 8 handoff

**MCL 380.1278b(2):** if a pupil completes a required high school credit before entering high school,
"the pupil must be given high school credit for that credit." The Grade 8 course anchoring this
sequence is authored to the **middle-school** performance-expectation band, not the high school band,
so it is a prerequisite — **not** an early high school credit. Section 4 documents that boundary
precisely so no one later mistakes Grade 8 science for a banked HS credit.

---

## 2. The design problem

A four-year sequence has to satisfy four constraints simultaneously:

1. **Statutory naming.** Biology is named in statute. A transcript reader should find "Biology"
   without needing an equivalency argument.
2. **Complete standards coverage.** All 71 high school performance expectations must land somewhere,
   with no unexplained gap.
3. **Continuity from Grade 8.** The Grade 8 course already covered the middle-school band for forces,
   waves, heredity, natural selection, Earth history, space, resources, and engineering. Grade 9 must
   raise those to the high school band rather than repeat them.
4. **Home-school-safe laboratory work.** Every investigation must be runnable safely in a household
   with a guardian, and must have a no-special-equipment alternative.

The conventional US sequence (Biology → Chemistry → Physics → elective) satisfies (1) but routinely
fails (2): the 19 Earth and Space Science performance expectations (HS-ESS1, HS-ESS2, HS-ESS3) have no
home in a Bio/Chem/Physics-only sequence and get silently dropped. **That silent drop is the single
largest standards-coverage risk in high school science, and avoiding it is the main reason this
sequence uses four years rather than three.**

An alternative — fully integrated science (Integrated Science I–IV) — would give elegant coverage and
strong cross-cutting-concept development, but it would put the family in the position of arguing
content equivalency for the statutorily named Biology credit on every transcript review.

---

## 3. The Manuel Academy sequence

**Manuel Academy decision.** The sequence is **disciplinary for the three statutory credits and
integrated for the fourth**. This is a local sequencing decision. Michigan does not mandate grade
placement for any of these courses; the state prescribes content expectations, not the year in which
a student meets them.

| Year | Course | Course ID | Credit role | Organization |
| --- | --- | --- | --- | --- |
| Grade 9 | Biology | `ma-hs9-biology` | Statutory named credit (MCL 380.1278b(1)(b)) | Disciplinary |
| Grade 10 | Chemistry | `ma-hs10-chemistry` | Satisfies the "chemistry, physics, anatomy, or agricultural science" credit **by name** | Disciplinary |
| Grade 11 | Physics | `ma-hs11-physics` | Third credit | Disciplinary |
| Grade 12 | Earth, Space, and Environmental Systems | `ma-hs12-earth-space-environmental` | Encouraged fourth credit (statute names Earth science, astronomy, environmental science, geology) | Integrated |

Each course is **108 instructional sessions** of **55–75 minutes**, three sessions weekly across 36
weeks — the same cadence and week count as the Grade 8 anchor, scaled up in session length for
high-school laboratory work. That is roughly 115 hours of scheduled instruction per course, before
independent reading and project time.

### Why this ordering

- **Biology first (Grade 9).** It is the statutorily named credit, so it should be banked earliest and
  never be the course that gets displaced by a scheduling problem in Grade 12. It also has the
  shortest quantitative on-ramp, which matters when a Grade 9 student is concurrently starting
  Algebra I or Geometry. Its heredity, natural selection, and ecosystem strands continue Grade 8
  Units 3, 4, and 8 directly.
- **Chemistry second (Grade 10).** Chemistry supplies the particle-level model of matter and energy
  that Physics later formalizes, and it satisfies the second statutory credit by name so no
  equivalency determination is ever needed.
- **Physics third (Grade 11).** Physics is the most mathematically demanding course here — it uses
  vectors, quadratic kinematics, proportional reasoning with inverse squares, and algebraic energy
  accounting. Placing it in Grade 11 lets it follow at least Algebra I and Geometry, and run
  alongside Algebra II. **This is a Manuel Academy decision**, not a state requirement.
- **Earth, Space, and Environmental Systems last (Grade 12).** It is the synthesis year. It is the one
  course that genuinely needs the other three: stellar nucleosynthesis needs Chemistry's atomic model
  and Physics's nuclear content; the carbon cycle needs Biology's photosynthesis and respiration;
  climate forecasting needs all three plus quantitative modeling. Running it last converts it from a
  survey course into a capstone.

### Explicitly rejected options

| Option | Why rejected |
| --- | --- |
| Physics First (Physics 9 → Chemistry 10 → Biology 11) | Defensible pedagogically, but it delays the statutorily named Biology credit to Grade 11 and front-loads the most math-dependent course before Algebra I is secure. |
| Three-year Bio/Chem/Physics with no fourth year | Leaves all 19 HS-ESS performance expectations uncovered — an unexplained content gap, and the failure mode this design exists to prevent. |
| Fully integrated Science I–IV | Strong coverage and coherence, but requires arguing content equivalency for the named Biology credit at every transcript review. |
| Anatomy or Agricultural Science as the second credit | Both are statutorily acceptable. Rejected because neither carries the chemistry or physics benchmark content that the Grade 11 and 12 courses build on. |

---

## 4. Grade 8 → Grade 9 handoff

The Grade 8 course (`ma-g8-science`, 108 sessions) is the prerequisite anchor. It is authored to
Michigan's **middle-school (MS-)** band. Every Grade 8 unit has a named continuation in this sequence,
so nothing is orphaned and nothing is repeated at the same depth.

| Grade 8 unit | MS band covered | Continues as | HS band raised to |
| --- | --- | --- | --- |
| 1. Forces, Motion, and Interactions | MS-PS2-1/2/4/5 | Physics U2–U4, U7 | HS-PS2-1/2/3/4/5 |
| 2. Waves and Information Transfer | MS-PS4-1/2/3 | Physics U8–U9 | HS-PS4-1/2/3/4/5 |
| 3. Growth, Reproduction, and Heredity | MS-LS1-4, MS-LS3-1/2 | Biology U7 | HS-LS3-1/2/3 |
| 4. Natural Selection and Adaptation | MS-LS4-1/2/3/4/6 | Biology U8 | HS-LS4-1/2/3/4/5 |
| 5. Earth History and Geologic Processes | MS-ESS1-4, MS-ESS2-1/2/3 | Earth/Space U5–U6 | HS-ESS1-5/6, HS-ESS2-1/2/3/5 |
| 6. Earth, Moon, Sun, and the Solar System | MS-ESS1-1/2/3 | Earth/Space U2–U4 | HS-ESS1-1/2/3/4 |
| 7. Resources, Climate, and Human Systems | MS-ESS3-1/3/4/5 | Earth/Space U7–U9 | HS-ESS2-4/6, HS-ESS3-1/2/3/4/5/6 |
| 8. Applied Biology and Ecosystem Design | MS-LS2-4/5, MS-LS4-5, MS-ETS1-2 | Biology U5, U6, U9 | HS-LS2-1…8, HS-LS4-6 |
| 9. Engineering and Scientific Argument Capstone | MS-ETS1-1/2/3/4 | Every course capstone | HS-ETS1-1/2/3/4 |

**Two content areas in the high school band have no Grade 8 predecessor** and are therefore taught
from foundations, with no assumed prior knowledge:

- **Chemistry at the particle level** (HS-PS1). Grade 8 covered no atomic structure, bonding,
  stoichiometry, kinetics, or equilibrium. Chemistry Units 1–2 begin from measurement and atomic
  structure rather than assuming a middle-school chemistry course.
- **Molecular and cellular biology** (HS-LS1-1/2/3/5/6/7). Grade 8 covered reproduction and heredity
  but not DNA-to-protein, cellular organization, homeostasis, photosynthesis, or respiration at the
  molecular level. Biology Units 1–4 begin from foundations.

This is a stated, deliberate gap in the *prerequisite*, not a gap in *coverage*.

---

## 5. Standards coverage — all 71 performance expectations

Every one of the 71 Michigan high school performance expectations has exactly one **primary** course
that owns it, teaches it to mastery, and assesses it — with the single documented exception of
HS-ETS1-1, HS-ETS1-2, and HS-ETS1-3, which are deliberately distributed across all four engineering
capstones.

A unit that touches an expectation it does not own is doing one of two different things, and the
package does not conflate them. **Reinforcement** looks backwards: the expectation was taught in or
before this unit, and revisiting it is deliberate spiral practice supporting the multi-occasion mastery
rule. **Preview** looks forwards: the expectation is taught later in the sequence, and the unit is
building readiness for it. Neither substitutes for primary coverage, and neither is assessed — a unit
assessment carries its own unit's primary standards only, so nothing is ever assessed before the unit
that teaches it. `validation/checks.mjs` enforces all three rules.

Four units — Biology, Chemistry, Physics, and Earth/Space Unit 1 — teach measurement, uncertainty, and
data practice and claim no performance expectation at all. They say so explicitly rather than borrowing
one from their spiral list, which is what previously put HS-PS2-1 and HS-ESS3-5 on a Unit 1 assessment
before either was taught.

`standards-alignment.md` carries the full machine-checked table, including the exact statement text of
each performance expectation as published by MDE. Summary:

| Course | Primary performance expectations | Count |
| --- | --- | --- |
| Biology (G9) | HS-LS1-1…7, HS-LS2-1…8, HS-LS3-1…3, HS-LS4-1…6 | 24 |
| Chemistry (G10) | HS-PS1-1…8, HS-PS2-6 | 9 |
| Physics (G11) | HS-PS2-1…5, HS-PS3-1…5, HS-PS4-1…5 | 15 |
| Earth, Space, Environmental (G12) | HS-ESS1-1…6, HS-ESS2-1…7, HS-ESS3-1…6 | 19 |
| Engineering, distributed | HS-ETS1-1, HS-ETS1-2, HS-ETS1-3, HS-ETS1-4 | 4 |
| **Total distinct** | | **71** |

### Two placement decisions worth stating

**HS-PS2-6 is taught in Chemistry, not Physics.** Although its code sits in the PS2 (Forces and
Interactions) family, the Michigan Science Standards document itself files HS-PS2-6 — "Communicate
scientific and technical information about why the molecular-level structure is important in the
functioning of designed materials" — under the **Structure and Properties of Matter** heading,
alongside HS-PS1-1, HS-PS1-3, and HS-PS1-8. Teaching it in Chemistry follows the standards document's
own organization rather than the code prefix.

**HS-PS1-8 (fission, fusion, radioactive decay) is taught in Chemistry and reinforced in Earth/Space.**
The standards document files it under Structure and Properties of Matter, so Chemistry owns it.
Earth/Space Unit 2 then reuses it for stellar nucleosynthesis and the sun's energy budget
(HS-ESS1-1, HS-ESS1-3), which is a genuine second mastery occasion in a new context.

**Engineering is distributed, not siloed.** HS-ETS1-1/2/3 anchor the capstone unit of every course,
and HS-ETS1-4 (computer simulation of a solution) is owned by the Earth/Space capstone, where
computational modeling of resource and climate systems (HS-ESS3-3, HS-ESS3-6) makes the simulation
requirement authentic rather than decorative.

---

## 6. Science practice in every course

Every course, in every unit, carries the full practice set the mission requires. These are not
appended to some units; they are structural, and the 12-day unit arc guarantees each one recurs.

| Practice | Where it is structurally guaranteed |
| --- | --- |
| Phenomena | Day 1 of every unit opens on an observable anchoring phenomenon |
| Modeling | Days 2 and 5 (Concept model A / B) |
| Data | Days 3, 4, 6 and the investigation on Day 7 |
| Investigation | Day 7 of every unit, with a documented no-special-equipment alternative |
| Evidence | Success criteria in every lesson require evidence over unsupported answers |
| Scientific explanation | Claim–evidence–reasoning is a named evidence type in the mastery rule |
| Engineering / design | Capstone unit of every course; design-tagged units throughout |
| Quantitative reasoning | Unit 1 of every course establishes the course's measurement and uncertainty practice; carried through data and performance-task days |
| Assessment | Day 11 unit assessment, plus Day 12 correction and reflection |
| Multiple mastery occasions | Policy floor requires ≥2 occasions on ≥2 distinct dates with independent evidence and novel-context transfer |

**No fabricated experimental results.** No lesson, assessment, tutor route, or answer key in this
package contains invented measurements presented as real data. Where an investigation needs numbers
before the student has any, the lesson supplies either (a) a clearly labelled worked *example*
dataset, or (b) a published dataset the family retrieves themselves. The distinction is enforced by a
validation check, not just by convention.

---

## 7. Laboratory safety model

Full detail is in `lab-safety-framework.md`. The design commitments:

- **Home-school-safe by construction.** No investigation requires a fume hood, a compressed gas
  cylinder, concentrated strong acid or base, an open flame of any kind, or any chemical requiring
  institutional disposal. There is no flame test and no flame demonstration anywhere in the four
  courses; Chemistry Unit 2 meets HS-PS1-1 from published emission spectra and a card-tube spectroscope.
- **Learner-visible hazards, not only guardian-visible ones.** Every lesson carries a structured
  `safety_privacy` block with typed hazards (kind, description, mitigation), a supervision level, and a
  guardian visibility level, so a guardian sees the hazard set before the session rather than after.
  Because the 2.0.0 contract strips `safety_privacy` from the student projection, every hazard-bearing
  lesson *also* opens with a student-visible `safety-review` segment carrying the same hazards and
  mitigations plus the supervision level, required PPE, safe order, stop conditions, disposal steps, and
  the equal-credit alternative. Safety never lives only where the person handling the materials cannot
  read it.
- **Day 9 inherits Day 7's safety.** The performance-task build handles the same materials, so it carries
  the same hazard set, supervision level, and safety brief wherever the investigation declares a physical
  or chemical hazard.
- **Supervision is explicit.** Every lesson declares `none`, `nearby-adult`, or `direct-adult`. Any
  lesson with a chemical or thermal hazard declares `direct-adult` and
  `guardian_visibility: confirmation-required`.
- **A safe alternative for every investigation.** Each investigation lesson carries a
  `manuel.academy/lab-alternative` extension giving a no-special-equipment path that meets the same
  learning target — data analysis of a published dataset, a physical model, or a simulation.
- **No camera or video proof.** Nothing in this package requires a photograph, a video, or a voice
  recording as evidence of completion.
- **No learner body or health measurements.** Biology's homeostasis and feedback content (HS-LS1-3) is
  the obvious temptation here and is deliberately taught with **non-learner** data: published
  physiological datasets, a thermal model, or an animal/plant system. No pulse, blood pressure, body
  temperature, weight, height, BMI, or reaction-time measurement of the learner is requested anywhere.

---

## 8. Study Engine integration

Detail is in `study-integration.md`. Summary of the boundary as it exists today:

The Study Engine's host lesson contract (`src/study/curriculumAdapter.ts`) currently recognises the
kinds `math`, `reading`, `writing`, `quiz-practice`, `quiz-assessment`, `review`, `parent-created`,
and `romeo-virtual-academy`, over the subjects `math`, `reading`, `writing`, and `other`. **There is no
science subject or laboratory task type today**, and the same is already true for the published Grade
5, 7, and 8 science courses.

This package therefore authors to the contracts that do exist — the mastery floor, the five controlled
tutor signals, the accessibility block, and the safety/privacy block — and does **not** modify
`src/study/**`, which it does not own. Science lessons map onto the existing seam as `other`/`review`
kinds with completion-only or tutor-core authority exactly as the published science courses do. A
first-class science subject and a laboratory task type are named as integration follow-ups in
`study-integration.md`, not silently assumed.

Two invariants are already satisfiable and are enforced here:

- **Persistence stays minimal.** Lessons declare privacy declarations that limit stored learning
  metadata to target, completion state, evidence type, and next step. No raw reflections, no free-text
  answers, no media, and no health data.
- **Tutor cannot fabricate or complete work.** Every tutor route uses only the five controlled signals
  and their matching strategies. The policy set pins `reveals_answers`, `gives_final_graded_answer`,
  and `controls_graded_work_policy` to `false`, and no curriculum extension may override them.

---

## 9. Summary of Manuel Academy decisions

These are local decisions. Michigan does not mandate them, and a reviewer should read them as
curricular judgment rather than compliance:

1. Four science courses rather than the statutory minimum of three.
2. Disciplinary organization for Grades 9–11; integrated organization for Grade 12.
3. Biology in Grade 9 (statute names the credit but not the year).
4. Chemistry before Physics, and Physics in Grade 11 to follow Algebra I and Geometry.
5. Earth, Space, and Environmental Systems as a Grade 12 synthesis course rather than a Grade 9 survey.
6. 108 sessions of 55–75 minutes per course, three sessions weekly over 36 weeks.
7. HS-PS1-8 owned by Chemistry and reinforced in Earth/Space.
8. Engineering distributed across all four capstones rather than taught as a separate course.
9. Voluntary MMC alignment for a home school that is not legally bound by the MMC.

## 10. What this package does not claim

- It does not claim state approval, accreditation, licensure, or endorsement.
- It does not establish transcript credit; completion and proficiency evidence do that.
- It does not assert that the family is subject to the Michigan Merit Curriculum.
- It does not claim a department determination of chemistry/physics benchmark equivalency; the
  Grade 10 course satisfies that credit by name, so no determination is needed.
- It does not include third-party text, media, or dataset licensing. Sources named in lessons are
  public-domain, openly licensed, library, or family-supplied, and are retrieved by the family.

## 11. Official sources

| Source | URL |
| --- | --- |
| MCL 380.1278b (science credit requirement) | https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-380-1278B |
| MCL 380.1278a (Michigan Merit Curriculum credits) | https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-380-1278a |
| MCL 380.1561 (compulsory attendance; home school subjects) | https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-380-1561 |
| Michigan Science Standards, November 2015 | https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Science_Standards.pdf |
| Michigan K–12 Science Standards and Resources | https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/science |
| Michigan Academic Standards | https://www.michigan.gov/mde/services/academic-standards |
