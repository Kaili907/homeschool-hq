# Technology solution-authority permanent gate R3

Status: `TECHNOLOGY_SOLUTION_AUTHORITY_R3_READY_FOR_ACCEPTANCE`

Parent R2: `4a3b219421c3a4af7eaf5eec0156319ce1ef8932`

## R2 acceptance failure and root cause

Independent R2 acceptance confirmed that the learner corpus itself was clean:
9/9 Technology course payloads, 336/336 lessons, 19/19 legitimate code worked
examples, no semantic learner exposures, no formal adult-key leaks, and 87/87
trusted solution references. R2 was rejected because its permanent gate was
not enforceable against two semantics-preserving mutations.

R2 hashed one sequential normalized token stream and required test-token
similarity. The same defective program and repair could therefore evade the
gate by changing story/test vocabulary. Moving an unused declaration changed
the sequential hash even though the executable dependency slice and repair
were unchanged. R2 also projected all 336 lessons but constructed semantic
comparison records only for the 87 `CODE_OR_DEBUG` lessons, silently omitting
249 non-code lessons from its claimed semantic coverage.

## R3 executable equivalence architecture

`tests/course-payload-solution-equivalence.mjs` now builds a deterministic
structural representation of each JavaScript fixture:

- a lexical pass removes comments and whitespace without retaining story
  literals or source identifiers;
- top-level declarations, executable statements, and test-invoked functions
  establish analysis roots;
- identifier references create a dependency closure from those roots;
- unused pure declarations outside that closure are proven irrelevant and
  excluded, so moving them cannot alter equivalence;
- independent pure relevant declarations are canonicalized, while effectful
  and dependency-bearing source order remains significant;
- operators, control-flow shape, state/data flow, calls, and member-operation
  shape remain in the fingerprint;
- test/input shape is corroborating evidence, not a vocabulary veto; and
- repair-operation signals plus identifier-independent normalized repair
  semantics compare the effective changed operation and repair location.

This is deliberately not a line sorter. An initializer with a call, an update,
or a dependency remains order-sensitive. The analyzer only ignores a moved
declaration after proving it is pure and outside every execution/test root.
Same-concept fixtures with a different condition, state transition, defect, or
repair remain distinct.

## Story/test vocabulary and declaration-order resistance

Permanent controls 6 and 7 reproduce the two R2 acceptance bypasses. Control
6 changes story strings, identifiers, function name, test inputs, and expected
vocabulary while preserving the broken program and effective repair; it
fails. Control 7 moves an unused pure declaration across the protected
program; dependency slicing proves it irrelevant and the exposure fails.

The external mutation suite repeats both attacks using temporary copies of
known-clean generated packages. It also injects a non-code model response that
directly answers a fixed protected deliverable. Every mutation is written only
under an OS temporary directory, the canonical fixture hash is checked before
cleanup, and the worktree corpus is never mutated.

## True full-corpus coverage

`full-corpus-coverage-ledger.json` and `.csv` contain exactly 336 entries. Each
entry records course, lesson ref, task family/type, phase and work mode,
protected classification, analyzer, learner-visible solution/example paths,
trusted-authority paths, and comparison status.

| Coverage measure | R3 result |
| --- | ---: |
| Technology lessons | 336 |
| Lessons with semantic records | 336 |
| Code/debug structural records | 87/87 |
| Non-code deliverable records | 249/249 |
| Explicitly non-protected | 268 |
| Protected executable repairs | 68 |
| Unexplained skips | 0 |

The 249 current `ANALYSIS_OR_DESIGN` tasks are open-ended, rubric-scored
artifacts with multiple valid responses and no fixed answer/model authority in
their adult guides. They are not pretended to be executable code. Each gets
task identity, expected-artifact, specification, visible-exemplar, and adult
authority signatures, then an explicit
`OPEN_ENDED_RUBRIC_NO_FIXED_RESPONSE_AUTHORITY` non-protected classification.
The non-code analyzer still blocks a future or mutated exemplar when the
complete task, artifact, specification, and fixed protected response match;
an analogous example requiring new reasoning passes.

The other 19 explicitly non-protected lessons are the labelled
`MODEL`/formative-no-penalty code worked examples. All 68 non-model code/debug
tasks remain protected.

## Actual visibility boundary

The audit uses the 336 admitted production bindings and the same
`projectJsonLearnerMaterial` projection used by the final family-pilot data
builder. Records are grouped by the nine complete browser course payloads.
Every learner-visible source is compared with every protected task co-shipped
in that payload regardless of package, unit, or lesson order. A later model is
not hidden from an earlier lesson after the course JSON loads.

## Permanent negative and positive controls

`node --test tests/course-payload-solution-equivalence.test.mjs` commits all 13
required outcomes:

1. exact starter/repair with another lesson ID: fail;
2. identifier rename with the same repair: fail;
3. function rename with the same repair: fail;
4. comments/whitespace only: fail;
5. repair paraphrase: fail;
6. different story/test vocabulary with the same executable fix: fail;
7. moved irrelevant declaration with the same fix: fail;
8. earlier model solving a later summative: fail;
9. same concept with a materially different bug/repair: pass;
10. genuinely analogous worked example: pass;
11. similar vocabulary with different executable semantics: pass;
12. non-code exemplar directly solving a protected deliverable: fail;
13. non-code analogous exemplar requiring new reasoning: pass.

`node --test tests/solution-authority-mutations.test.mjs` adds three
external-copy mutations: story/test vocabulary, irrelevant-declaration order,
and direct non-code answer injection. All three are detected.

## Current corpus and false-positive result

| Measure | R2 clean corpus | R3 gate result |
| --- | ---: | ---: |
| Course payloads | 9 | 9/9 |
| Lessons inspected | 336 | 336/336 |
| Legitimate code worked examples | 19 | 19/19 preserved |
| Non-summative semantic exposures | 0 | 0 |
| Summative semantic exposures | 0 | 0 |
| Formal adult-key leaks | 0 | 0 |
| Trusted solution references | 87 | 87/87 |
| False positives | 0 | 0 |

No learner curriculum or scoring guide changed in R3. The package corpus and
browser-projection hashes exactly equal the R2 evidence hashes. R3 changes
only the gate, permanent tests, and evidence/docs.

## Evidence

- `semantic-gate-report.json`: aggregate status, architecture, hashes, control
  inventory, and content-stability proof;
- `full-corpus-coverage-ledger.json` / `.csv`: all 336 lesson records;
- `browser-payload-proof.json`: nine actual payload groupings and hashes;
- `case-mapping.json` / `.csv`: all 56 original exposure mappings rechecked by
  the stronger structural analyzer; and
- `determinism.json`: repeated-evidence hash proof and verification summary.

No master update, merge, deployment, Tutor V2, Dashboard, or Study Engine work
is included.
