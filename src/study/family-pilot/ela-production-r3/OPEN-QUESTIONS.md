# ELA Production R3 — Open Questions

**Every question below is UNDECIDED.** Each one is a choice the ELA production
rewrite will have to make that the frozen R2 artifacts do not make. This harness
deliberately does not answer any of them. It either stays silent, or reports the
matter as a non-failing `observation` so that authoring cannot drift into a
decision by accident.

Answering any of these requires a Director decision and a new versioned freeze,
per the freeze rule in `docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md`.

---

### Q1. Where do production ELA lessons live, and in what format?

The nine approved samples are TypeScript fixtures under
`src/study/family-pilot/ela-director-samples-r2/`. The existing production corpus
is JSON under `curriculum-production/student-work/english-language-arts/packages/`.
Other subjects keep a `curriculum-production/final/<subject>/` tree; ELA has no
`final/` tree.

**Undecided:** whether R3 lessons are TypeScript modules, JSON material files
under `curriculum-production/final/english-language-arts/`, or a generator that
emits into the existing `student-work` tree.

**Harness position:** the builder returns an in-memory `LearnerMaterialDto`
record and commits to no serialization target.

---

### Q2. What happens to the existing 1,620 `student-work` packages?

The existing corpus carries the lesson identities, unit/day placement, standards,
course days, and 1,333 distinct Academy-original readings. It does not carry the
approved learner flow.

**Undecided:** whether R3 replaces those packages, sits beside them as the
learner-facing layer while they remain the source/standards record, or is
generated from them.

**Harness position:** `ElaProductionPlacement` carries the canonical lesson
identity so either path stays open. Nothing in this branch writes to the corpus.

---

### Q3. Must guided practice always be a three-option fixed choice?

All nine approved samples use `CHOICE` with exactly three options. The frozen
contract requires "a real supported response control" and "useful multiple-choice
feedback"; it states no option count, and does not say `CHOICE` is mandatory.

**Undecided:** whether some lessons (grammar editing, writing-process days) may
use `TEXT` or a second constructed response for guided practice, and whether the
option count is fixed at three.

**Harness position:** the required sequence `CHOICE, CONSTRUCTED_RESPONSE,
CONSTRUCTED_RESPONSE` is enforced because all nine approved samples produce it;
a departure from three options is reported as an observation only.

---

### Q4. May a lesson carry more than one guided item, or more than one reading?

Approved samples carry exactly one item per YOUR TURN section and exactly one
reading. Production lessons are scheduled at 40–55 minutes.

**Undecided:** whether a longer production lesson may add guided items, a second
reading, or a paired-text section, and where those would sit in the flow.

**Harness position:** the eighteen-section plan is enforced exactly as approved.
Anything longer fails the gate until this is decided.

---

### Q5. Is there a vocabulary count?

Grade 3 defines two terms; the other eight samples define three. No frozen
artifact states a minimum, a maximum, or a per-grade rule.

**Undecided.** **Harness position:** observation only.

---

### Q6. Is there a passage-length rule per grade?

Measured approved lengths, in words: G3 178, G4 241, G5 224, G7 310, G8 275,
G9 343, G10 206, G11 373, G12 493. This is not monotonic by grade, so it cannot
be read as a progression rule.

**Undecided:** whether production sets per-grade bounds at all.

**Harness position:** a reading outside the observed 178–493 band is reported as
an observation only.

---

### Q7. Does every production lesson need a new reading?

All nine approved samples carry a complete Academy-original reading, including
the Grade 10 editing lesson, whose "reading" is an editing source. A 180-lesson
course contains writing-process, grammar, research, and portfolio days.

**Undecided:** whether a lesson with no new reading is permitted, and if not,
what those days deliver in the source slot.

**Harness position:** a source section is required, because all nine approved
samples have one. If some production days genuinely cannot have one, this gate
will block them and the question must be answered first.

---

### Q8. May one reading serve several lessons?

The existing corpus reuses roughly 36 readings across 180 lessons in Grades 3 and
4, and uses 180 distinct readings per course from Grade 5 up. The approved
samples are one-offs and say nothing about reuse.

**Undecided:** whether a production reading may anchor a multi-lesson arc, and
whether reuse rules differ by grade band.

**Harness position:** no per-lesson rule; the registry check targets duplicated
*instructional copy*, not a shared reading.

---

### Q9. Does near-duplicate copy fail, or only exact duplicates?

The freeze rule forbids replacing the approved samples with "a generic lesson
template". Exact repeated copy is unambiguously that. Near-duplicates — same
sentence with the focus string swapped, which is how the current corpus reads —
are the more likely production failure.

**Undecided:** the similarity threshold, if any.

**Harness position:** exact cross-lesson duplicate copy is an error. No
similarity metric is applied, because choosing one would be setting the rule.

---

### Q10. What should COURSE PROGRESS say in a production lesson?

Every approved sample's COURSE PROGRESS page says the Director sample does not
change the production course record. That copy is true of a sample and false of a
production lesson.

**Undecided:** what a production lesson states there, and whether it may read
real progress state.

**Harness position:** the field is required and author-supplied; the harness
supplies no default.

---

### Q11. Do R3 lessons keep the paired adult scoring guide?

The existing corpus pairs every learner package with a
`scoring-guides/grade-XX/*.scoring.json` under qualitative `RUBRIC` authority.
The frozen contract requires Parent Review but says nothing about that pairing.

**Undecided:** whether R3 keeps, replaces, or drops the paired adult guide, and
whether the parent reviewer sees it.

**Harness position:** the harness models only the learner record and refuses
scoring authority inside it.

---

### Q12. What are the rubric criteria, and who fixes their wording?

Approved samples pass four-ish short criteria into the Parent Review page. No
frozen artifact defines a criteria vocabulary, count, or per-grade progression.

**Undecided.** **Harness position:** author-supplied, count unchecked.
