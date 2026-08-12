# Credit and Content Matrix — Release Candidate `hs912-r1`

**Derived artifact.** Credit recommendations are read from `release/course-matrix.json`;
unit, lesson and assessment counts are counted from the content actually imported into this
candidate. No count is asserted in advance — `MANIFEST.json` records `counts_asserted: false`.

Grade 8 is the published anchor at `curriculum-content/manuel-academy/1.0.0/grades/grade-8/`.
It is frozen, referenced for continuity only, and carries no credit in this table.

## Delivered content, per course

| Family | Grade | Course id | Course | Credit | Units | Lessons | Assessments | Shape |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| mathematics | 9 | `ma-g9-mathematics` | Algebra I | 1.0 | 10 | 180 | 10 | canonical |
| mathematics | 10 | `ma-g10-mathematics` | Geometry | 1.0 | 10 | 180 | 10 | canonical |
| mathematics | 11 | `ma-g11-mathematics` | Algebra II | 1.0 | 10 | 180 | 10 | canonical |
| mathematics | 12 | `ma-g12-mathematics` | Precalculus with Statistics | 1.0 | 10 | 180 | 10 | canonical |
| english-language-arts | 9 | `ma-g9-english-language-arts` | English 9: Foundations of Literary Analysis and Argument | 1.0 | 10 | 180 | 10 | canonical |
| english-language-arts | 10 | `ma-g10-english-language-arts` | English 10: World Literature and Rhetoric | 1.0 | 10 | 180 | 10 | canonical |
| english-language-arts | 11 | `ma-g11-english-language-arts` | English 11: American Literature, Research, and Synthesis | 1.0 | 10 | 180 | 10 | canonical |
| english-language-arts | 12 | `ma-g12-english-language-arts` | English 12: Global Literature, Composition, and Portfolio Capstone | 1.0 | 10 | 180 | 10 | canonical |
| science | 9 | `ma-hs9-biology` | Biology | 1.0 | 9 | 108 | 9 | native v2 · PENDING_H2_REVIEW |
| science | 10 | `ma-hs10-chemistry` | Chemistry | 1.0 | 9 | 108 | 9 | native v2 · PENDING_H2_REVIEW |
| science | 11 | `ma-hs11-physics` | Physics | 1.0 | 9 | 108 | 9 | native v2 · PENDING_H2_REVIEW |
| science | 12 | `ma-hs12-earth-space-environmental` | Earth, Space, and Environmental Systems | 1.0 | 9 | 108 | 9 | native v2 · PENDING_H2_REVIEW |
| social-studies | 9 | `ma-g9-social-studies` | United States History and Geography (1870 to the Present) | 1.0 | 9 | 108 | 9 | canonical |
| social-studies | 10 | `ma-g10-social-studies` | World History and Geography | 1.0 | 9 | 108 | 9 | canonical |
| social-studies | 11 | `ma-g11-social-studies` | Civics and Economics | 1.0 | 9 | 108 | 9 | canonical |
| social-studies | 12 | `ma-g12-social-studies` | Contemporary Global Issues and Civic Capstone | 1.0 | 9 | 108 | 9 | canonical |
| health | 9 | `ma-g9-health` | Health and Wellness I | 0.5 | 6 | 36 | 6 | canonical |
| health | 10 | `ma-g10-health` | Health II: Mental Health and Community Wellness | 0.25 | 6 | 36 | 6 | canonical |
| health | 11 | `ma-g11-health` | Health III: Consumer Health, Safety, and Emergency Response | 0.25 | 6 | 36 | 6 | canonical |
| health | 12 | `ma-g12-health` | Health IV: Adult Health Transition | 0.25 | 6 | 36 | 6 | canonical |
| physical-education | 9 | `ma-g9-physical-education` | Personal Fitness and Lifetime Activity | 0.5 | 9 | 108 | 9 | canonical |
| physical-education | 10 | `ma-g10-physical-education` | Team, Individual, and Dual Activities | 0.5 | 9 | 108 | 9 | canonical |
| physical-education | 11 | `ma-g11-physical-education` | Strength, Conditioning, and Training Design | 0.5 | 9 | 108 | 9 | canonical |
| physical-education | 12 | `ma-g12-physical-education` | Lifelong Wellness and Independent Training Capstone | 0.5 | 9 | 108 | 9 | canonical |
| ready-for-life | 9 | `ma-g9-ready-for-life` | Ready for Life 9: Personal Management and Learning Systems | 0.25 | 6 | 36 | 6 | canonical |
| ready-for-life | 10 | `ma-g10-ready-for-life` | Ready for Life 10: Career Exploration and Workplace Communication | 0.25 | 6 | 36 | 6 | canonical |
| ready-for-life | 11 | `ma-g11-ready-for-life` | Ready for Life 11: Postsecondary Planning and Portfolio | 0.25 | 6 | 36 | 6 | canonical |
| ready-for-life | 12 | `ma-g12-ready-for-life` | Ready for Life 12: Independent Adult Living Capstone | 0.25 | 6 | 36 | 6 | canonical |
| technology | 9 | `ma-g9-technology` | Computer Science Principles and Digital Citizenship | 0.5 | 6 | 36 | 6 | canonical |
| technology | 10 | `ma-g10-technology` | Programming I | 0.5 | 6 | 36 | 6 | canonical |
| technology | 11 | `ma-g11-technology` | Data, Systems, and Applied Computing | 0.5 | 6 | 36 | 6 | canonical |
| technology | 12 | `ma-g12-technology` | Cybersecurity, AI Literacy, and Computing Capstone | 0.5 | 6 | 48 | 6 | canonical |
| arts-and-music | 9 | `ma-g9-arts-and-music` | Foundations of Visual and Media Arts | 0.5 | 6 | 72 | 6 | canonical |
| arts-and-music | 10 | `ma-g10-arts-and-music` | Music, Theatre, and Performance Foundations | 0.5 | 6 | 72 | 6 | canonical |
| arts-and-music | 11 | `ma-g11-arts-and-music` | Studio Art, Composition, and Applied Design | 0.5 | 6 | 72 | 6 | canonical |
| arts-and-music | 12 | `ma-g12-arts-and-music` | Arts Capstone: Portfolio and Exhibition | 0.5 | 6 | 72 | 6 | canonical |
| financial-literacy | 9 | `ma-g9-financial-literacy` | Personal Finance | 0.5 | 7 | 72 | 7 | canonical |
| financial-literacy | 10 | `ma-g10-financial-literacy` | Consumer Economics and Credit | 0.5 | 7 | 72 | 7 | canonical |
| financial-literacy | 11 | `ma-g11-financial-literacy` | Investing, Insurance, and Risk Management | 0.5 | 7 | 72 | 7 | canonical |
| financial-literacy | 12 | `ma-g12-financial-literacy` | Financial Transition to Adulthood | 0.5 | 7 | 72 | 7 | canonical |
| **total** | 9–12 | 40 courses | | **26.25** | **312** | **3756** | **312** | |

## Credit recommendation by grade

| Grade | Recommended credit |
| ---: | ---: |
| 9 | 6.75 |
| 10 | 6.5 |
| 11 | 6.5 |
| 12 | 6.5 |
| **total** | **26.25** |

26.25 recommended credits against an 18-credit Michigan Merit Curriculum. The surplus is a
Manuel Academy course-design decision, not a state requirement, and `release/high-school-release-contract.md`
§10 flags an annual programme-load review before Grade 10.

## Michigan Merit Curriculum requirements, as claimed by the matrix

| Requirement | Credit claimed | Carried by |
| --- | ---: | --- |
| `MMC_ELA` | 4.0 | `ma-g9-english-language-arts`, `ma-g10-english-language-arts`, `ma-g11-english-language-arts`, `ma-g12-english-language-arts` |
| `MMC_MATHEMATICS` | 4.0 | `ma-g9-mathematics`, `ma-g10-mathematics`, `ma-g11-mathematics`, `ma-g12-mathematics` |
| `MMC_MATHEMATICS_FINAL_YEAR` | 1.0 | `ma-g12-mathematics` |
| `MMC_ONLINE_LEARNING_EXPERIENCE` | 0.5 | `ma-g9-technology` |
| `MMC_PERSONAL_FINANCE` | 0.5 | `ma-g9-financial-literacy` |
| `MMC_PHYSICAL_EDUCATION_AND_HEALTH` | 1.0 | `ma-g9-health`, `ma-g9-physical-education` |
| `MMC_SCIENCE` | 4.0 | `ma-g9-science`, `ma-g10-science`, `ma-g11-science`, `ma-g12-science` |
| `MMC_SCIENCE_BIOLOGY` | 1.0 | `ma-g9-science` |
| `MMC_SCIENCE_CHEMISTRY_OR_PHYSICS` | 1.0 | `ma-g10-science` |
| `MMC_SOCIAL_STUDIES` | 3.0 | `ma-g9-social-studies`, `ma-g10-social-studies`, `ma-g11-social-studies` |
| `MMC_SOCIAL_STUDIES_CIVICS` | 1.0 | `ma-g11-social-studies` |
| `MMC_SOCIAL_STUDIES_ECONOMICS` | 1.0 | `ma-g11-social-studies` |
| `MMC_SOCIAL_STUDIES_US_HISTORY` | 1.0 | `ma-g9-social-studies` |
| `MMC_SOCIAL_STUDIES_WORLD_HISTORY` | 1.0 | `ma-g10-social-studies` |
| `MMC_VISUAL_PERFORMING_APPLIED_ARTS` | 1.0 | `ma-g9-arts-and-music`, `ma-g10-arts-and-music` |

## Declared gaps — nothing here is reported as covered

| Requirement | Verdict | Owner |
| --- | --- | --- |
| `MMC_WORLD_LANGUAGE` | **NOT_COVERED** | DIRECTOR |
| `MMC_ONLINE_LEARNING_EXPERIENCE` | **PARTIALLY_COVERED** | mac/hs912-tech-arts-r1 |
| `MMC_PERSONAL_FINANCE_DISPLACEMENT` | **REQUIRES_DIRECTOR_DECISION** | DIRECTOR |
| `READY_FOR_LIFE_STANDARDS_ANCHOR` | **REQUIRES_DIRECTOR_DECISION** | DIRECTOR |

**Graduation completeness: `NOT_GRADUATION_COMPLETE`.** MMC world language is NOT_COVERED with a 0.5 credit irreducible remainder.

## Personal finance is separate from economics

Two distinct courses in two distinct families, proved by `checkPersonalFinanceSeparation`:

- Personal Finance — `ma-g9-financial-literacy` (financial-literacy), 0.5 credit
- Economics — `ma-g11-social-studies` (social-studies), a half-credit component of a 1.0-credit course

No course claims both. The personal finance half-credit **displaces** an existing credit
rather than adding one; which credit it displaces is an open Director decision recorded as
`MMC_PERSONAL_FINANCE_DISPLACEMENT`.

## World Language

No world-language course exists in this candidate, and none is claimed. The requirement is
`NOT_COVERED`, owned by the Director. At most 1.0 of the 2.0 credits is substitutable by arts
instruction beyond the required VPAA credit or by a department-approved formal CTE programme;
at least 0.5 credit of genuine language study has no home in this programme.

