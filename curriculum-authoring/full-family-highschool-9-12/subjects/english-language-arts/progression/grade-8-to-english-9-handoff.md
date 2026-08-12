# Grade 8 → English 9 Handoff

**Upstream course:** `ma-g8-english-language-arts` (published release `curriculum-content/manuel-academy/1.0.0`, not modified by this work)
**Downstream course:** `ma-g9-english-language-arts` (this lane)

## What Grade 8 actually leaves the learner holding

Read from the published Grade 8 units and course guide, not assumed. Grade 8 exits with
all six strands exercised across ten units, and its capstone is *"a curated transition
portfolio and formal defense with private presentation options."* Its stated purpose is
"preparing learners for high-school reading, writing, research, argument, rhetoric,
discussion, language, media analysis, and independent publication."

Concretely, a learner finishing Grade 8 has:

| Strand | Grade 8 exit position |
| --- | --- |
| Reading literature | Cites the evidence that *most strongly* supports an analysis (8.RL.1); analyzes theme development against character, setting, and plot (8.RL.2); reads at the high end of the 6-8 band independently (8.RL.10) |
| Reading informational | Traces central-idea development (8.RI.2); evaluates argument soundness and relevance/sufficiency of evidence, recognizing irrelevant evidence (8.RI.8); reads at the high end of the 6-8 band independently (8.RI.10) |
| Writing | Argument with acknowledged counterclaim (8.W.1); explanatory synthesis (8.W.2); narrative (8.W.3); short research from a self-generated question with standard citation format (8.W.7, 8.W.8) |
| Speaking and listening | Prepared collegial discussion (8.SL.1); evaluates soundness of a speaker's reasoning (8.SL.3) |
| Language | Verbals, active/passive, mood and voice, punctuation for effect (8.L.1-8.L.3); vocabulary acquisition (8.L.4-8.L.6) |

## The real discontinuity

The gap between Grade 8 and English 9 is **not** topic coverage. Grade 8 already touches
argument, counterclaim, research, citation, rhetoric, and media. Anyone comparing topic
lists would conclude English 9 repeats Grade 8.

The actual gap is in four measurable demands:

1. **Text complexity band changes.** Grade 8 exits at the high end of the *grades 6-8*
   band (8.RL.10, 8.RI.10). English 9 enters the *grades 9-10* band, with scaffolding
   permitted at its high end (9-10.RL.10, 9-10.RI.10, first sentence). This is a band
   change the state itself specifies, and it is the single hardest transition in the
   sequence.

2. **Evidence standard changes wording, and the change is substantive.** Grade 8 cites
   the evidence that "most strongly supports" an analysis. English 9 cites "strong **and
   thorough**" evidence (9-10.RL.1). Grade 8 asks for the best single piece; English 9
   asks for sufficiency across a case. Unit 1 of English 9 is built on precisely this
   distinction.

3. **Counterclaim handling changes from acknowledgment to fair development.** Grade 8's
   8.W.1 acknowledges opposing claims. 9-10.W.1b requires developing claims and
   counterclaims *fairly*, supplying evidence for each, "pointing out the strengths and
   limitations of both in a manner that anticipates the audience's knowledge level and
   concerns." English 9 Unit 5 is written against that clause, not against 8.W.1.

4. **Research moves from short to short-plus-sustained.** 8.W.7 is "short research
   projects." 9-10.W.7 adds "as well as more sustained research projects" and requires
   synthesis of multiple sources. English 9 Unit 6 introduces the sustained form for the
   first time.

## How English 9 picks up each thread

| Grade 8 exit | English 9 entry | Unit | Added demand |
| --- | --- | --- | --- |
| 8.RL.1 strongest evidence | 9-10.RL.1 strong and thorough evidence | U1 | Sufficiency across a case, not the single best quotation |
| 8.RL.3 dialogue/incident propels action | 9-10.RL.3 complex characters with conflicting motivations | U2 | Motivation conflict sustained across a whole text |
| 8.RL.5 compare structures of two texts | 9-10.RL.5 authorial structuring, parallel plots, manipulated time | U2 | Structure as a deliberate authorial instrument producing a named effect |
| 8.RI.2 central idea development | 9-10.RI.2 idea emerges, is shaped and refined by specific details | U4 | Tracing refinement, not just development |
| 8.RI.8 evaluate soundness, spot irrelevant evidence | 9-10.RI.8 validity of reasoning, sufficiency, false statements, fallacious reasoning | U5, U7 | Named fallacy identification and the validity/sufficiency distinction |
| 8.W.1 argument with counterclaim | 9-10.W.1 counterclaims developed fairly with audience anticipation | U5 | Fair development, strengths and limitations of both sides |
| 8.W.7/8.W.8 short research, standard citation | 9-10.W.7/9-10.W.8 sustained research, authoritative sources, usefulness assessment, selective integration | U6 | First sustained inquiry; integration that maintains flow |
| 8.SL.1 collegial discussion | 9-10.SL.1 peers set rules, roles, goals; conversation propelled toward larger ideas | U1, U9 | Learner shares responsibility for the structure of the discussion |
| 8.L.1 verbals and sentence structures | 9-10.L.1 parallel structure; phrase and clause types named and used | U8 | Named grammatical categories deployed for effect |
| 8.L.4-8.L.6 vocabulary acquisition | 9-10.L.4-9-10.L.6 CCR-level acquisition, morphological patterns, euphemism/oxymoron | U3, U8 | Vocabulary work aimed explicitly at college and career readiness level |

## Deliberate non-repetition

English 9 does **not** re-teach: objective summary as a new skill, basic annotation, the
existence of counterclaims, or what a citation is. Grade 8 establishes those. English 9
assumes them from day one and spends its instruction on sufficiency, fairness, structural
effect, and sustained inquiry.

## Handoff verification

`validation/validate.mjs` asserts this handoff mechanically: every Grade 8 strand must
have a named English 9 successor standard, and English 9 must not be assigned any Grade 8
code. See `handoff` checks in the validation report.
