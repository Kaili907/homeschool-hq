# Elementary Reading / ELA Placement — Grades 3, 4 and 6

Source document for the three elementary reading and writing placement
instruments built in session CURRICULUM-CE3. Follows the same root-document
pattern as `HS-English-Reading-Placement.md`.

Code: `src/assessment/banks/eleElaG3.ts`, `eleElaG4.ts`, `eleElaG6.ts`
Scoring model: `src/assessment/banks/placementModel.ts`
Rules, rubrics and parent guidance: `Elementary-Placement-Scoring-Guide.md`

## Passages

**Every passage in this bank is original prose written for this assessment.** No
copyrighted text is quoted, adapted, excerpted, or paraphrased. Each instrument
carries one narrative passage and one informational passage, both self-contained
— a child needs no prior knowledge of the topic to answer any question about it.

| Instrument | Narrative | Informational |
| --- | --- | --- |
| `ele-ela-g3` | *The Loose Tooth* (~150 words) | *How Honey Bees Share Directions* (~215 words) |
| `ele-ela-g4` | *The Last Row* (~250 words) | *The Museum That Fights Its Own Lights* (~290 words) |
| `ele-ela-g6` | *Understudy* (~340 words) | *The Cost of a Straight Line* (~360 words) |

The passages render on screen above their section's questions, and the child may
scroll back to them at any point — every comprehension item is open-book by
design, because this measures comprehension, not memory.

## Fluency — read honestly, or not at all

This app cannot listen to a child read. Rather than fake a fluency measure, each
ELA instrument carries **one parent-administered read-aloud item**, and it is
constrained:

- **Untimed.** No stopwatch, no pacing, no target.
- **Accuracy only.** The parent listens once and marks an accuracy band.
- **No rate is recorded anywhere.** The rubric explicitly forbids a
  words-per-minute figure, and a test asserts that no ELA instrument's fluency
  prompt or note contains one.

The read-aloud item sits as the FIRST item of the passage section so the text is
already on screen when the child is asked to read it aloud.

A single untimed accuracy observation is weak evidence, and the scoring model
treats it that way: it is one rubric item out of ~32, and leaving it ungraded
lowers reported confidence rather than silently vanishing.

## Reading the tier column

| Tier | Column | Meaning |
| --- | --- | --- |
| foundation | **F** | prerequisite skill from the PRIOR grade |
| current | **C** | beginning-of-nominal-year readiness |
| stretch | **S** | NEXT-grade signal |

## Answer authority

- **auto** — machine-keyed, judged by `src/assessment/normalizer.ts`. Almost all
  ELA auto items are multiple choice, which the scorer judges confidently in
  both directions.
- **rubric** — open response, scored 0..max by a human against the rubric in the
  scoring guide. Ungraded rubric items are *pending*, never guessed.

**Capitalisation is deliberately never tested by a multiple-choice item in this
bank.** The shared answer matcher is case-insensitive, so an option differing
from the key only by case would score as correct. Capitals are judged in the
writing rubrics instead. A test asserts that no two options of any item collapse
to the same string under the matcher's normalisation — this caught three real
items during the build and they were rewritten.

Open responses are scored for reasoning and structure, never for whether the
child's opinion is agreeable. The argument rubrics say so explicitly.

---

## Item tables

### Grade 3 Reading and Writing — Beginning-of-Year Placement

Test id `ele-ela-g3` · nominal grade 3 · 31 items · 4 sections · untimed

Tier counts — foundation: 8 (8 auto, 0 rubric) · current: 17 (13 auto, 4 rubric) · stretch: 6 (4 auto, 2 rubric)

#### Section 1 — Word Study

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3e01` | F | Word analysis and decoding | 2.RF.3b — long vowel patterns | choice | 1 | `play` |
| `e3e02` | F | Word analysis and decoding | 2.RF.3d — irregularly spelled words | choice | 1 | `friend` |
| `e3e03` | F | Word analysis and decoding | 2.RF.3c — syllables in multisyllable words | choice | 1 | `3` |
| `e3e04` | C | Word analysis and decoding | 3.RF.3a — common prefixes | choice | 1 | `again` |
| `e3e05` | C | Word analysis and decoding | 3.RF.3a — common suffixes | choice | 1 | `without` |
| `e3e06` | C | Word analysis and decoding | 3.L.1b — irregular plural nouns | choice | 1 | `shelves` |
| `e3e07` | S | Word analysis and decoding | 4.RF.3a — affixes and roots | choice | 1 | `review` |

#### Section 2 — Reading a Story

_Original passage shown on screen, ~154 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3e08` | C | Reading accuracy (read-aloud) | 3.RF.4b — read aloud accurately, untimed | longtext | 1 | _rubric 0–3_ |
| `e3e09` | F | Literal comprehension | 2.RL.1 — answer questions about key details | choice | 1 | `the twelfth day` |
| `e3e10` | F | Literal comprehension | 2.RL.1 — answer questions about key details | choice | 1 | `biting an apple` |
| `e3e11` | C | Vocabulary in context | 3.RL.4 — words and phrases in a story | choice | 1 | `a sound and a feeling` |
| `e3e12` | C | Inference | 3.RL.1 — draw inferences from a story | longtext | 1 | _rubric 0–3_ |
| `e3e13` | C | Inference | 3.RL.3 — what a character’s words reveal | choice | 1 | `did it her own way` |
| `e3e14` | S | Main idea and evidence | 4.RL.2 — determine a theme | longtext | 1 | _rubric 0–3_ |

#### Section 3 — Reading to Learn

_Original passage shown on screen, ~186 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3e15` | F | Literal comprehension | 2.RI.1 — key details in a text | choice | 1 | `She dances at the hive.` |
| `e3e16` | C | Literal comprehension | 3.RI.1 — refer explicitly to the text | choice | 1 | `runs in a straight line and shakes` |
| `e3e17` | C | Vocabulary in context | 3.RI.4 — domain words in a text | choice | 1 | `to shake back and forth` |
| `e3e18` | C | Main idea and evidence | 3.RI.2 — main idea with supporting detail | longtext | 1 | _rubric 0–3_ |
| `e3e19` | C | Inference | 3.RI.1 — infer a cause from the text | choice | 1 | `The hive is dark.` |
| `e3e20` | C | Literal comprehension | 3.RI.1 — locate a specific fact | choice | 1 | `two million` |
| `e3e21` | S | Main idea and evidence | 4.RI.8 — how a sentence supports the point | choice | 1 | `why sharing directions matters` |
| `e3e22` | S | Vocabulary in context | 4.L.4a — use context to fix meaning | choice | 1 | `use up with nothing to show for it` |

#### Section 4 — Writing and Conventions

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3e23` | F | Grammar and conventions | 2.L.1f — complete sentences | choice | 1 | `The dog barked loudly.` |
| `e3e24` | F | Grammar and conventions | 2.L.2 — capitalisation and end punctuation | choice | 1 | `Where is my book?` |
| `e3e25` | C | Grammar and conventions | 3.L.1a — identify parts of speech | choice | 1 | `jumped` |
| `e3e26` | C | Grammar and conventions | 3.L.1d — irregular past-tense verbs | choice | 1 | `went` |
| `e3e27` | C | Grammar and conventions | 3.L.2c — commas in a series | choice | 1 | `I packed apples, bread, and cheese.` |
| `e3e28` | C | Grammar and conventions | 3.L.1h — coordinating conjunctions | choice | 1 | `but` |
| `e3e29` | S | Grammar and conventions | 4.L.1f — correct run-on sentences | choice | 1 | `I finished my chores and went outside.` |
| `e3e30` | C | Writing | 3.W.2 — informative paragraph | longtext | 1 | _rubric 0–4_ |
| `e3e31` | S | Writing | 4.W.1 — opinion with a reason | longtext | 1 | _rubric 0–3_ |

### Grade 4 Reading and Writing — Beginning-of-Year Placement

Test id `ele-ela-g4` · nominal grade 4 · 32 items · 4 sections · untimed

Tier counts — foundation: 7 (7 auto, 0 rubric) · current: 19 (15 auto, 4 rubric) · stretch: 6 (4 auto, 2 rubric)

#### Section 1 — Word Study and Vocabulary

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4e01` | F | Word analysis and decoding | 3.RF.3a — common prefixes | choice | 1 | `not` |
| `e4e02` | F | Word analysis and decoding | 3.L.1b — regular plural spelling changes | choice | 1 | `cities` |
| `e4e03` | F | Vocabulary in context | 3.L.4a — sentence context clues | choice | 1 | `thin from side to side` |
| `e4e04` | C | Word analysis and decoding | 4.RF.3a — roots within familiar words | choice | 1 | `telegraph` |
| `e4e05` | C | Vocabulary in context | 4.L.4b — how an affix changes a word | choice | 1 | `a describing word (adjective)` |
| `e4e06` | C | Vocabulary in context | 4.L.5a — figurative language | choice | 1 | `a metaphor` |
| `e4e07` | S | Word analysis and decoding | 5.L.4b — Greek and Latin roots | choice | 1 | `hear` |
| `e4e08` | S | Vocabulary in context | 5.L.5a — personification | choice | 1 | `personification` |

#### Section 2 — Reading a Story

_Original passage shown on screen, ~220 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4e09` | C | Reading accuracy (read-aloud) | 4.RF.4b — read aloud accurately, untimed | longtext | 1 | _rubric 0–3_ |
| `e4e10` | F | Literal comprehension | 3.RL.1 — refer explicitly to the text | choice | 1 | `It was the only seat left` |
| `e4e11` | C | Vocabulary in context | 4.RL.4 — word meaning in a story | choice | 1 | `the other choice` |
| `e4e12` | C | Inference | 4.RL.1 — inference from the text | choice | 1 | `is repeating a phrase he has heard grown-ups say` |
| `e4e13` | C | Inference | 4.RL.3 — describe a character’s change | longtext | 1 | _rubric 0–3_ |
| `e4e14` | C | Main idea and evidence | 4.RL.2 — determine a theme | choice | 1 | `A place can change when you share it with someone.` |
| `e4e15` | C | Literal comprehension | 4.RL.1 — details drawn from the text | choice | 1 | `He saved the seat` |
| `e4e16` | S | Inference | 5.RL.1 — quote accurately when inferring | longtext | 1 | _rubric 0–3_ |

#### Section 3 — Reading to Learn

_Original passage shown on screen, ~274 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4e17` | F | Literal comprehension | 3.RI.1 — key details in a text | choice | 1 | `light` |
| `e4e18` | C | Literal comprehension | 4.RI.1 — explicit information | choice | 1 | `leave out the wavelengths that cause the most fading` |
| `e4e19` | C | Vocabulary in context | 4.RI.4 — domain vocabulary in context | choice | 1 | `look after a museum’s collection` |
| `e4e20` | C | Main idea and evidence | 4.RI.2 — main idea with two details | longtext | 1 | _rubric 0–4_ |
| `e4e21` | C | Inference | 4.RI.3 — explain a comparison in a text | choice | 1 | `adds up light over time` |
| `e4e22` | C | Main idea and evidence | 4.RI.5 — text structure | choice | 1 | `a problem, then solutions that improved over time` |
| `e4e23` | C | Literal comprehension | 4.RI.1 — locate a specific quantity | numeric | 1 | `40` |
| `e4e24` | S | Inference | 5.RI.1 — inference from a concluding passage | choice | 1 | `slow the loss so future visitors still have something to see` |

#### Section 4 — Writing and Conventions

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4e25` | F | Grammar and conventions | 3.L.1f — subject–verb agreement | choice | 1 | `The team is winning.` |
| `e4e26` | F | Grammar and conventions | 3.L.2 — capitalisation and punctuation | choice | 1 | `My birthday is on June 4.` |
| `e4e27` | C | Grammar and conventions | 4.L.1f — correct sentence fragments | choice | 1 | `We ate dinner by candlelight because the power went out.` |
| `e4e28` | C | Grammar and conventions | 4.L.1g — frequently confused words | choice | 1 | `there` |
| `e4e29` | C | Grammar and conventions | 4.L.2b — punctuate quotations | choice | 1 | `"Wait for me," said Jonah.` |
| `e4e30` | S | Grammar and conventions | 5.L.1a — join independent clauses | choice | 1 | `The rain stopped, so we walked home.` |
| `e4e31` | C | Writing | 4.W.2 — explanatory paragraph | longtext | 1 | _rubric 0–4_ |
| `e4e32` | S | Writing | 5.W.1 — opinion with a counter-reason | longtext | 1 | _rubric 0–3_ |

### Grade 6 Reading and Writing — Beginning-of-Year Placement

Test id `ele-ela-g6` · nominal grade 6 · 32 items · 4 sections · untimed

Tier counts — foundation: 7 (7 auto, 0 rubric) · current: 20 (14 auto, 6 rubric) · stretch: 5 (4 auto, 1 rubric)

#### Section 1 — Word Study and Vocabulary

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6e01` | F | Vocabulary in context | 5.L.4b — roots and affixes | choice | 1 | `life` |
| `e6e02` | F | Vocabulary in context | 5.L.4a — sentence context clues | choice | 1 | `convincing` |
| `e6e03` | F | Word analysis and decoding | 5.L.2e — spell correctly | choice | 1 | `definitely` |
| `e6e04` | C | Word analysis and decoding | 6.L.4b — common prefixes | choice | 1 | `between` |
| `e6e05` | C | Vocabulary in context | 6.L.5a — figures of speech | choice | 1 | `a simile` |
| `e6e06` | C | Vocabulary in context | 6.L.5c — connotation | choice | 1 | `stingy` |
| `e6e07` | S | Word analysis and decoding | 7.L.4b — Greek and Latin roots | choice | 1 | `time` |

#### Section 2 — Reading Literature

_Original passage shown on screen, ~300 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6e08` | C | Reading accuracy (read-aloud) | 6.RF — read aloud accurately, untimed | longtext | 1 | _rubric 0–3_ |
| `e6e09` | F | Literal comprehension | 5.RL.1 — explicit details | choice | 1 | `Beatrice lost her voice` |
| `e6e10` | C | Vocabulary in context | 6.RL.4 — figurative meaning in a story | choice | 1 | `earning a chance through unglamorous work` |
| `e6e11` | C | Inference | 6.RL.1 — inference supported by the text | choice | 1 | `imagined it so often that it seemed familiar` |
| `e6e12` | C | Main idea and evidence | 6.RL.2 — theme with supporting details | longtext | 1 | _rubric 0–4_ |
| `e6e13` | C | Inference | 6.RL.3 — how a character responds and changes | choice | 1 | `How it lands depends on the choice the actor makes` |
| `e6e14` | C | Inference | 6.RL.6 — author’s choice and point of view | longtext | 1 | _rubric 0–3_ |
| `e6e15` | S | Main idea and evidence | 7.RL.3 — how story elements interact | choice | 1 | `make her sudden understanding on stage meaningful` |

#### Section 3 — Reading Informational Text

_Original passage shown on screen, ~328 words._

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6e16` | F | Literal comprehension | 5.RI.1 — explicit details | choice | 1 | `They lose speed` |
| `e6e17` | C | Literal comprehension | 6.RI.1 — cite explicit textual evidence | choice | 1 | `to learn what lies under the surface before committing` |
| `e6e18` | C | Vocabulary in context | 6.RI.4 — technical meaning in a text | choice | 1 | `the steepness of a slope` |
| `e6e19` | C | Main idea and evidence | 6.RI.2 — central idea with details | longtext | 1 | _rubric 0–4_ |
| `e6e20` | C | Main idea and evidence | 6.RI.5 — text structure | choice | 1 | `by listing categories of cost one at a time` |
| `e6e21` | C | Inference | 6.RI.6 — author’s point of view | choice | 1 | `reasonable results of decisions drivers never see` |
| `e6e22` | C | Main idea and evidence | 6.RI.8 — distinguish supported claims | choice | 1 | `Bridges are the most expensive structures on most highway projects.` |
| `e6e23` | S | Inference | 7.RI.1 — analyse figurative claim against evidence | longtext | 1 | _rubric 0–3_ |

#### Section 4 — Writing and Conventions

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6e24` | F | Grammar and conventions | 5.L.1 — pronoun case | choice | 1 | `Between you and me, the plan is risky.` |
| `e6e25` | F | Grammar and conventions | 5.L.2b — comma after an introductory element | choice | 1 | `After the storm passed, we cleared the road.` |
| `e6e26` | C | Grammar and conventions | 6.L.1d — correct vague pronouns | choice | 1 | `When Maya met Elena, Maya was nervous.` |
| `e6e27` | C | Grammar and conventions | 6.L.2a — punctuate non-restrictive elements | choice | 1 | `My oldest brother, who lives in Denver, is a nurse.` |
| `e6e28` | C | Grammar and conventions | 6.L.1e — correct inappropriate tense shifts | choice | 1 | `She opened the door and saw the package.` |
| `e6e29` | S | Grammar and conventions | 7.L.2 — semicolons between clauses | choice | 1 | `The bus was late; we walked instead.` |
| `e6e30` | C | Writing | 6.W.2 — explanatory paragraph | longtext | 1 | _rubric 0–4_ |
| `e6e31` | C | Writing | 6.W.1 — argument with a counter-reason | longtext | 1 | _rubric 0–4_ |
| `e6e32` | S | Grammar and conventions | 7.L.3a — eliminate wordiness | choice | 1 | `Because it rained, we left.` |
