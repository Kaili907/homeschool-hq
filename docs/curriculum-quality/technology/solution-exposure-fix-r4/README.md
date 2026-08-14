# Technology solution-authority permanent gate R4

Status: `TECHNOLOGY_SOLUTION_AUTHORITY_R4_READY_FOR_ACCEPTANCE`

Parent R3: `9b6185599a24444144d9b5ac9d549ef8e3698372`

## R3 root causes corrected

R3 correctly reported a clean learner corpus, but its permanent enforcement
model had two acceptance blockers. It marked every non-code lesson
non-protected before examining trusted/adult authority, so a future fixed
response plus learner exemplar could bypass the full gate. Its JavaScript
representation was token-based: it erased numeric values and top-level
binding identity, sorted selected declarations, did not model lexical scopes,
and did not bind repairs to structural function locations. Consequently it
could both split equivalent braced/braceless programs and conflate materially
different boundaries, roots, providers, effect order, TDZ order, and repair
locations.

## Authority-first classification

For every one of the 336 admitted Technology lessons, R4 projects and inspects
the learner material and reads the matching adult scoring guide before it
decides protection. The deterministic authority parser recognizes fixed
responses, accepted conclusions, correct answers, exact reference artifacts,
and required repairs by authority structure and key, independent of the
lesson's task family.

The current 249 `ANALYSIS_OR_DESIGN` lessons remain open-ended rubric tasks
with no fixed authority, so they are explicitly non-protected after inspection.
The 87 code/debug lessons contain trusted exact-repair authority: 68 are
protected and 19 are labelled `MODEL` / `FORMATIVE_NO_PENALTY` instructional
examples. The full coverage ledger records the classification, protection
reason, analyzer, learner comparator paths, trusted references, and result for
all 336 lessons, with zero unexplained skips.

External-copy mutation tests exercise the real learner projection, authority
parser, record builder, and payload exposure gate. Adding fixed adult authority
and a direct learner exemplar fails. Replacing that exemplar with an analogous
case requiring independent reasoning passes. Canonical curriculum files are
hash-checked and never mutated by these tests.

## Semantics-preserving JavaScript representation

R4 uses Acorn to parse each starter program into a real JavaScript AST. Its
canonical representation retains:

- AST node kinds and control-flow/branch nesting;
- lexical scope kind and alpha-normalized binding identity across references;
- numeric, boolean, null, regular-expression, operator, member/property, and
  call-target semantics;
- loop initializer, test, update, and boundary structure;
- top-level provider and dependency edges;
- source order for relevant declarations and all unknown/effectful calls;
- test-root declaration roles and behavioral expected-value kinds; and
- mutation-sensitive repair locations tied to enclosing function bindings and
  structural AST paths.

Identifier renaming, comments, whitespace, and story-string vocabulary
normalize. Braced and braceless single-statement control bodies normalize
equivalently when braces introduce no lexical declaration boundary. Relevant
statements are never sorted. Calls are effectful/unknown. Only pure top-level
declarations outside the execution/test dependency closure are omitted, which
permits a genuinely irrelevant declaration move without erasing TDZ,
dependency, or side-effect order.

## Permanent controls

`node --test tests/course-payload-solution-equivalence.test.mjs` contains 20
controls. In addition to the prior identifier, function, formatting, repair
paraphrase, story/test vocabulary, summative, and analogy cases, it proves:

1. braced/braceless equivalent program plus the same repair is exposed;
2. different numeric boundaries are distinct;
3. different test roots are distinct;
4. different top-level data providers are distinct;
5. reordered unknown side effects are distinct;
6. TDZ-invalid and valid declaration order are distinct;
7. the same textual repair in different functions is distinct;
8. identifier renaming still exposes the same solution;
9. story/test vocabulary changes still expose the same solution;
10. a moved pure irrelevant declaration still exposes the same solution;
11. a non-code fixed-response mutation is detected;
12. a non-code analogous exemplar passes; and
13. the full audit preserves all 19 legitimate model positives.

`node --test tests/solution-authority-mutations.test.mjs` adds four external
copy mutations: story/test vocabulary, irrelevant declaration movement,
non-code fixed authority with a direct exemplar, and fixed authority with an
analogous exemplar.

## Results

| Measure | R4 result |
| --- | ---: |
| Browser course payloads | 9/9 |
| Lessons inspected/accounted | 336/336 |
| Code/debug records | 87/87 |
| Non-code records | 249/249 |
| Protected tasks | 68 |
| Explicitly non-protected | 268 |
| Legitimate models | 19/19 |
| Current semantic leaks | 0 |
| Formal adult-key leaks | 0 |
| Trusted code authorities | 87/87 |
| Unexplained skips | 0 |

No real current leak appeared. Learner packages, adult scoring guides, and the
browser learner projection remain byte-identical to the accepted clean corpus:
`LEARNER_CURRICULUM_CHANGED = NO`.

## Regression and evidence

The R4 semantic gate, all permanent controls, external mutations, Technology
actionability, production quality, duplicate validation, corpus validation,
schema validation, checksums, structured learner projection, learner release,
web release, and both default-off and enabled production builds pass.

- `semantic-gate-report.json`: status, architecture, counts, controls, and
  clean-corpus hashes;
- `full-corpus-coverage-ledger.json` / `.csv`: the complete 336-row ledger;
- `browser-payload-proof.json`: all nine admitted browser payloads;
- `case-mapping.json` / `.csv`: all 56 historical exposure mappings rechecked;
  and
- `determinism.json`: two-run byte-identity proof and regression summary.
