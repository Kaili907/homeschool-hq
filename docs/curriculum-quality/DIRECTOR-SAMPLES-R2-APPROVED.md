# Director Samples R2 — Approved

**Status: FROZEN**

The binding artifact for this approval freeze is [`curriculum/approvals/director-samples-r2-approved.json`](../../curriculum/approvals/director-samples-r2-approved.json). It contains exactly 36 approved sample records: Mathematics, ELA, Science, and Social Studies across Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 is excluded.

## Approval

The samples were reviewed by the Manuel Academy Director in the browser gallery at `/director-review/curriculum-r2`, using the real `FamilyPilotLessonPlayer`, Rich Study Player, learner-response controls, feedback, and end-of-lesson reviews.

The exact approval statement was: **“I approve all 36”.**

The reviewed gallery was based at commit `416664e1656c6eb21517249d3a8cfbc616d35eee`, tree `f1f5a80e0240fc4d9fbc18ba9bb4cc101eb7da03`. Freeze date: `2026-08-18`.

## Source branches

| Subject | Source branch | Observed SHA | Expected SHA | Result |
|---|---|---|---|---|
| Mathematics | `mac/math-director-samples-r2` | `a9cb6e36458f4f30a52f48b48170bee57a7988b0` | `a9cb6e36458f4f30a52f48b48170bee57a7988b0` | Match |
| ELA | `mac/ela-director-samples-r2` | `144dd03f8a92ec8d348a13839ed3e56590f3280f` | `144dd03f8a92ec8d348a13839ed3e56590f3280f` | Match |
| Science | `mac/science-director-samples-r2` | `98354655a3d5b2979938606a41b811c8450ea3cd` | `98354655a3d5b2979938606a41b811c8450ea3cd` | Match |
| Social Studies | `mac/social-director-samples-r2` | `cbf75dfa7ce039c9c850accdec3ed9edf53bfec5` | `cbf75dfa7ce039c9c850accdec3ed9edf53bfec5` | Match |

## Frozen inventory

Every row is marked `DIRECTOR_APPROVED_FOR_PRODUCTION` in the binding manifest. `richPlayerCompatible` is `true` and `legacyFallbackRequired` is `false` for every row.

| Subject | Grade | Course | Topic | Sample ID | Path | Content SHA-256 |
|---|---:|---|---|---|---|---|
| Mathematics | 3 | Grade 3 Mathematics | A digit is worth ten times as much one place to the left | `director-math-r2-g3-place-value` | `curriculum-review-samples/director/mathematics-r2/samples/grade-3.json` | `163852852b2d99e13c56c46bb5d91c44dafab5cb6823a47559452839435e21aa` |
| ELA | 3 | Grade 3 English Language Arts | Naming a character trait and proving it with one action from the text | `director-ela-r2-g3` | `src/study/family-pilot/ela-director-samples-r2/grade3.ts` | `9d1037131ceb6dfb1571e1579c73fad06bb07fbee977a5728b18ca39d0be04d3` |
| Science | 3 | Grade 3 Science | Patterns in motion | `ma-g3-science-u02-l03` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-03-patterns-in-motion.json` | `74f9465c8c6f92caa7285beb21593b50fb25ef93dffef13cb1958a11434f1207` |
| Social Studies | 3 | Grade 3 Social Studies — Michigan Studies | Major eras in early Michigan | `ma-g3-social-studies-u06-l03` | `curriculum-production/director-samples/social-studies-r2/grade-03/ma-g3-social-studies-u06-l03.lesson.json` | `8a3244f862156faf06a59955a53cabe6e9b848d6fff8523d54af143b97eb6c24` |
| Mathematics | 4 | Grade 4 Mathematics | Use place value to explain a ten-times relationship | `director-math-r2-g4-ten-times-place-value` | `curriculum-review-samples/director/mathematics-r2/samples/grade-4.json` | `99b3fd5ac81a2c972ad93567f51e8b66459b39d2da6ac6e056e02a49a68a3e44` |
| ELA | 4 | Grade 4 English Language Arts | Stating a main idea and naming the key details that carry it | `director-ela-r2-g4` | `src/study/family-pilot/ela-director-samples-r2/grade4.ts` | `f4e09deff5612d2c83c7462c71c6df94ad3e01ddeb2943f4cf396b2bd5351c4e` |
| Science | 4 | Grade 4 Science | Tracing energy paths | `ma-g4-science-u03-l06` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-04-tracing-energy-paths.json` | `a06f8ed0b59802e147b805994a7ddf0905aada30d84b8f6a8081ea9e75f05084` |
| Social Studies | 4 | Grade 4 Social Studies — United States Geography and Civics | Comparing regions to the Great Lakes region | `ma-g4-social-studies-u02-l06` | `curriculum-production/director-samples/social-studies-r2/grade-04/ma-g4-social-studies-u02-l06.lesson.json` | `98b7299341e1a9cd8d870673ccffea99a84a0e1099bbdbbcc47e824d94037c01` |
| Mathematics | 5 | Grade 5 Mathematics | Read decimals through thousandths using place value | `director-math-r2-g5-decimal-place-value` | `curriculum-review-samples/director/mathematics-r2/samples/grade-5.json` | `714b291d7c253eb6873f8156aa66461e50d7f7903fea6868af5384dd1158d190` |
| ELA | 5 | Grade 5 English Language Arts | Word relationships and nuance | `director-ela-r2-g5` | `src/study/family-pilot/ela-director-samples-r2/grade5.ts` | `17207fba2a3ff82f371858889682ba982c200b5a7c9865ca97e0cd839f5a0c60` |
| Science | 5 | Grade 5 Science | Daily shadow patterns | `ma-g5-science-u07-l03` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-05-daily-shadow-patterns.json` | `e27a10d821144e849d6190db90f9a84097cf6b4a6533df570f00226faf197fac` |
| Social Studies | 5 | Grade 5 Social Studies — United States History and Geography | Source reliability in European exploration | `ma-g5-social-studies-u03-l06` | `curriculum-production/director-samples/social-studies-r2/grade-05/ma-g5-social-studies-u03-l06.lesson.json` | `a27a09f1e699751cd4ea3a4fe3003ee2e27b48085341f3a452291e36acb4c2fe` |
| Mathematics | 7 | Grade 7 Mathematics | Find and interpret the constant of proportionality | `director-math-r2-g7-constant-of-proportionality` | `curriculum-review-samples/director/mathematics-r2/samples/grade-7.json` | `247016d27fb6df3a6b4108dbf7e05c8c643888e2f596b170cea6fe94405116cc` |
| ELA | 7 | Grade 7 English Language Arts | Tracing how a theme develops through character interaction and choice | `director-ela-r2-g7` | `src/study/family-pilot/ela-director-samples-r2/grade7.ts` | `453b3e83c436dc0e6704601ced718661ad1a6fbcea3f0c4e5be4c08d474e0950` |
| Science | 7 | Grade 7 Science | Energy transfer | `ma-g7-science-u03-l09` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-07-energy-transfer.json` | `d7533786a8a2fb204bce45d1422503c90862eb352d0778fa571daa6d06be4b48` |
| Social Studies | 7 | Grade 7 Social Studies — World History and Geography | Limits of archaeological evidence | `ma-g7-social-studies-u02-l06` | `curriculum-production/director-samples/social-studies-r2/grade-07/ma-g7-social-studies-u02-l06.lesson.json` | `4ea18c9438349cc39cb410e45062a33d7b0bc7e20ebf16e432263ce092a07feb` |
| Mathematics | 8 | Grade 8 Mathematics | Use decimal expansions to distinguish rational and irrational numbers | `director-math-r2-g8-decimal-expansions` | `curriculum-review-samples/director/mathematics-r2/samples/grade-8.json` | `bd18d38f5a2df503bd71bc7c6876940db59f771e8f780e8e194f8201ca21dd5c` |
| ELA | 8 | Grade 8 English Language Arts | Counterclaim and rebuttal in civic argument | `director-ela-r2-g8` | `src/study/family-pilot/ela-director-samples-r2/grade8.ts` | `d2fd3eefa704a2ad5f78fd8c97125e7e2383a4d18a8fd5b1c33f9209608f6e6e` |
| Science | 8 | Grade 8 Science | Force and mass | `ma-g8-science-u01-l02` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-08-force-and-mass.json` | `eb2646fb2905281bb9c0131e5d3aed57b5a4b69fa2b3bd09de616aceabfb12a0` |
| Social Studies | 8 | Grade 8 Social Studies — United States History and Civics | Historical evidence and argument through founding-document comparison | `ma-g8-social-studies-u01-l07` | `curriculum-production/director-samples/social-studies-r2/grade-08/ma-g8-social-studies-u01-l07.lesson.json` | `fe1a3ca1fef213bba147cf104d4e9a829aa061ad952dbf6bab4ffae51187aeb7` |
| Mathematics | 9 | Grade 9 Mathematics | Explain the sign-reversal rule for linear inequalities | `director-math-r2-g9-inequality-reversal` | `curriculum-review-samples/director/mathematics-r2/samples/grade-9.json` | `52c02b97898c9980e695bc24082f5b441a6cf35736e669d0f19aa85194871893` |
| ELA | 9 | Grade 9 English Language Arts | Cumulative impact of specific word choices | `director-ela-r2-g9` | `src/study/family-pilot/ela-director-samples-r2/grade9.ts` | `ee4fa34d920d58fba7ca45ba877f422289894ad778ed776c3d1c5d1eb306adcb` |
| Science | 9 | High School Biology (Grade 9) | The four factors driving natural selection | `ma-hs9-biology-u09-l02` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-09-natural-selection.json` | `f20cae0762a01e2133ca41a41d862ecc2a28c6f82f6c7f98f7ef212d0e6717ad` |
| Social Studies | 9 | Grade 9 Social Studies — United States History and Geography | The changing role of the federal government during the New Deal | `ma-g9-social-studies-u05-l06` | `curriculum-production/director-samples/social-studies-r2/grade-09/ma-g9-social-studies-u05-l06.lesson.json` | `4bbf4010ab882eada3b39aa60cb1e458aeda750b2636a861d77a7b14f0951991` |
| Mathematics | 10 | Grade 10 Mathematics | Specify and verify a sequence of rigid transformations | `director-math-r2-g10-transformation-sequences` | `curriculum-review-samples/director/mathematics-r2/samples/grade-10.json` | `033d20be5cbc998cb8598cf4d8eb0b1f8799ccd5e75454a523ff8ec2e279dd4d` |
| ELA | 10 | Grade 10 English Language Arts | Semicolon and colon control in authentic revision | `director-ela-r2-g10` | `src/study/family-pilot/ela-director-samples-r2/grade10.ts` | `e976a8dd991523e8abde98ede4f38ba9eb8db1383e1b4180f2fd0ff0c68b1f7c` |
| Science | 10 | High School Chemistry (Grade 10) | Balancing equations as bookkeeping | `ma-hs10-chemistry-u05-l02` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-10-balancing-equations.json` | `69abe803f00afb490fc87103ab2458fd4b0c44b4cef7b318d1b48b9fe9f022a2` |
| Social Studies | 10 | Grade 10 Social Studies — World History and Geography | Cross-cultural contact and exchange before 1500 | `ma-g10-social-studies-u02-l03` | `curriculum-production/director-samples/social-studies-r2/grade-10/ma-g10-social-studies-u02-l03.lesson.json` | `8f8ac9f0187b8927816392c6ed508416eea3c8e89f7f5fc04321c096ed3ff19e` |
| Mathematics | 11 | Grade 11 Mathematics | Detect extraneous solutions in radical equations | `director-math-r2-g11-extraneous-solutions` | `curriculum-review-samples/director/mathematics-r2/samples/grade-11.json` | `39d24c4ef927670400834ac466f37be2fde8dcbccd61a90c60a1a98c2da0d594` |
| ELA | 11 | Grade 11 English Language Arts | How style and content create rhetorical power and persuasiveness | `director-ela-r2-g11` | `src/study/family-pilot/ela-director-samples-r2/grade11.ts` | `3e5fde3464b55780d1f7e453584ecd03c244bf742f4a01507ff21cf29c8733db` |
| Science | 11 | High School Physics (Grade 11) | Newton's second law as a mathematical relationship | `ma-hs11-physics-u02-l03` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-11-newtons-second-law.json` | `434e252d78ce4d38b19861bab5af7b3ad0c8d9b1b12dc2dc7499aa15a8de9e94` |
| Social Studies | 11 | Grade 11 Social Studies — Civics and Economics | Evaluating national economic conditions | `ma-g11-social-studies-u08-l06` | `curriculum-production/director-samples/social-studies-r2/grade-11/ma-g11-social-studies-u08-l06.lesson.json` | `daaebe01dc44999f5f8c737f8b6174be38ac2e25f5e5304caee96352dc56f04c` |
| Mathematics | 12 | Grade 12 Mathematics | Derive trigonometric values from unit-circle symmetry and periodicity | `director-math-r2-g12-unit-circle-symmetry` | `curriculum-review-samples/director/mathematics-r2/samples/grade-12.json` | `738f0a7f6fe5899d29a61923179ca266cdf869c702ef0bb1c6323de27bbabf76` |
| ELA | 12 | Grade 12 English Language Arts | Synthesis when authoritative sources disagree | `director-ela-r2-g12` | `src/study/family-pilot/ela-director-samples-r2/grade12.ts` | `a2caaeeb12389c8a35d15e396b76ffa1d59593754cdc7f1170dab073685354e4` |
| Science | 12 | High School Earth, Space, and Environmental Science (Grade 12) | Climate models and their uncertainty | `ma-hs12-earth-space-environmental-u07-l05` | `docs/curriculum-quality/science/director-samples-r2/samples/grade-12-climate-model-uncertainty.json` | `925235a5e3c3aeb20a27637df37660d4a885bec056983e9f553a04da78783bcc` |
| Social Studies | 12 | Grade 12 Social Studies — Advanced Inquiry and Civic Research | Corroboration and triangulation | `ma-g12-social-studies-u03-l03` | `curriculum-production/director-samples/social-studies-r2/grade-12/ma-g12-social-studies-u03-l03.lesson.json` | `c81848ce8e46c84a294a2cc3283b7e5dc451dcc446557afbb5af85d11daeab58` |

## Production control

These 36 approved samples are the controlling production model for the Math, ELA, Science, and Social Studies rewrites. They must not be regenerated, reinterpreted, re-modelled, or replaced by a generic lesson template. Their lesson substance is frozen; future work may add only explicitly approved metadata or documentation around this freeze.
