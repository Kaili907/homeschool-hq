# Grade 3/4 Health, Financial Literacy and Ready for Life - Standards Policy

`manuel-academy-g34-health-finlit-rfl-standards-policy-r4` - status **G34_HEALTH_FINLIT_RFL_STANDARDS_POLICY_READY**

The three systemic classifications `manuel-academy-g34-specialty-standards-evidence-r3` left for a human, resolved against the
official documents. **No lesson was edited and no file outside this directory was written.**

## What was open

r3 classified 816 of 1854 Grade 3/4 specialty citations HUMAN_REVIEW_REQUIRED. 156 of those were
systemic - one authored string repeated across a whole course - and are the subject of this
package. The other 660 (arts 372, PE 288) are untouched.

| Subject | Citations | Human-review before | after | Crosswalk | Local composition |
| --- | ---: | ---: | ---: | ---: | ---: |
| Health | 246 | 12 | 0 | 0 | 0 |
| Financial Literacy | 288 | 72 | 0 | 72 | 216 |
| Ready for Life | 288 | 72 | 0 | 72 | 216 |

156 citations across 6 records are reclassified. All 156 leave human review; 0 remain in scope.

## Health - the alias holds, the label does not

`Michigan Health Topic (Grades 3-5): Safety and Injury Prevention`, 12 citations.

The mapping is defensible. Michigan's Grades 3-5 band prints exactly two safety groupings,
`Safety [5.3.SAF]` and `Safety [5.5.SAF]`, and both carry the one topic name on the printed list:
`Safety [SAF]`. Nothing else could be meant, so identifying the referent takes no judgement. And
the extra words are that topic's own content at that band - `[5.5.SAF] 1` says *reduce the risk of
injuries in various situations* and lists fire prevention, water, firearms, motor vehicles and
pedestrian contexts; `[5.5.SAF] 3` covers getting help when someone is poisoned or injured.

The label is still not Michigan's. **`Injury Prevention` occurs zero times in the document.** No
other topic absorbs it either: `Personal Health and Wellness [5.5.PHW] 1` mentions pedestrian and
sun safety only as examples of health-promoting behaviour.

So: **COMPOSITE_VERIFIED under a mandatory relabel** to `Michigan Health Topic (Grades 3-5):
Safety`. It is not held for a human, because the document decides it - the same rule the package
already applies to the other six topics.

## Financial Literacy - two things, separated

`Michigan Personal Finance foundations — introductory`, 72 citations.

Michigan publishes no Grade 3/4 personal finance standard, and this package proves it twice.
r3 proved it from the content expectations (PF1-PF7, `Grade 3` and `Grade 4` each occur zero
times). This package adds the credit rule, which quotes MCL 380.1278a(3): a **high school
diploma** condition for pupils entering grade 8 in 2023 or after. `Grade 3` and `elementary`
occur zero times there too. **No PF code is manufactured.**

What Michigan does publish for these exact grades is economics, in the K-12 Social Studies
Standards: `3 - E1.0.1` through `3 - E3.0.1`, and `4 - E1.01` through `4 - E3.0.1`. Real codes,
right grades, different subject. They become a **supporting crosswalk**, not the course's
governing standard, and the Manuel Academy progression stays what it already was -
LOCAL_COMPOSITION, 216 citations of it.

The crosswalk reports what it does not cover. 2 of 12 financial literacy
units get **no anchor at all** - Grade 3 Unit 4 (saving and goals), Grade 3 Unit 5 (money tools, privacy, and advertising) - because no exact-grade economics
expectation touches them: `needs` and `wants` occur zero times in Michigan's Grade 3 economics,
and so do `saving`, `budget` and `advertis*`. The remaining 10 are `partial`;
0 reach `full`. Every uncovered concept is named in `evidence/crosswalk.json`,
not padded out, and an anchor that was considered and judged too loose says so.

## Ready for Life - support exists, and it is not a standard

`Michigan Health/SEL connections`, 72 citations.

r3 recorded that MDE publishes SEL Competencies and Indicators (2017) but did not retrieve it.
This package holds it. It is real: five competencies, indicators 1A-5C, and a 3-5 benchmark band
for each, with text that genuinely corresponds to Ready for Life units - *identify and organize
materials needed to be prepared for class*, *identify roles they have that contribute to their
school, home, and neighboring community*.

The same bytes say what it is not. Its first page: *Currently, Michigan has Content State
Standards that focus on academics. However, there is little that attend to the other aspects of
learning for children/students.* It places itself beside the standards, and the K-12 competencies
cited here carry no State Board adoption line. (The document does say its separate *Early
Childhood* competencies come from SBE-approved standards - a different band, not cited here.)

Two further facts are **web observations, not bytes**, and are recorded as such in
`sources/source-custody.json#web_observations`: the document is published under MDE's Health &
Safety services rather than Academic Standards, and it is absent from the Academic Standards
index.

So the string becomes a **supporting connection with named anchors** and may never become a
state-standard claim. Ready for Life stays Manuel Academy authorship;
216 of its citations are already
LOCAL_COMPOSITION and stay so. **`Ready for Life` occurs zero times in every Michigan document
held across both packages.** Michigan has approved no part of the sequence, and
`policy/classification-policy.json#never_assert` forbids saying otherwise.

## The new class

`CROSSWALK_SUPPORTING` is the only class r4 adds. It means: governing authority is Manuel
Academy, and one or more official Michigan elements are recorded as a supporting connection -
named, located, and quoted from held bytes. It asserts topical correspondence. It does not assert
that Michigan authored, adopted, approved or aligned anything, and it never turns a non-standard
document into a standard. Invariant `I3` refuses to let one exist without an anchor.

## Two classifications, on purpose

This package mandates labels; it does not edit lessons. So every record carries both:

- `authored_class` - what the release says today
- `policy_class` - what it is entitled to say once `required_label` is applied

6 relabels are required. Until a lesson-editing lane applies them, the
release still reads the authored form, and both counts are published so neither can be mistaken
for the other.

## Package-wide effect

| Class | r3 | r4 |
| --- | ---: | ---: |
| VERBATIM_VERIFIED | 0 | 0 |
| ALIAS_RESOLVED_VERBATIM | 534 | 534 |
| COMPOSITE_VERIFIED | 72 | 84 |
| CROSSWALK_SUPPORTING | 0 | 144 |
| LOCAL_COMPOSITION | 432 | 432 |
| UNVERIFIED | 0 | 0 |
| HUMAN_REVIEW_REQUIRED | 816 | 660 |
| **Total** | **1854** | **1854** |

## Source custody

Three documents are held here byte for byte, pinned by SHA256. Three more are **inherited** from
g34-specialty-r3: not copied, but verified against r3's pinned hashes before a byte is read, so
there is one custody chain rather than two copies that could drift.

| doc_id | custody | pages |
| --- | --- | ---: |
| mde-sel-2017 | held here | 61 |
| mde-health-2025-alt | held here | 70 |
| mde-pf-course-credit | held here | 8 |
| mde-health-2025 | inherited from r3 | 70 |
| mde-social-studies | inherited from r3 | 147 |
| mde-personal-finance | inherited from r3 | 2 |

43 anchors are quoted, and every one is presence-checked against those bytes at build
time. 8 absence assertions are re-counted the same way - including the three that
carry the argument: `Injury Prevention` in the health guidelines, `Grade 3` in the personal
finance documents, and `Ready for Life` in every Michigan document held.

r3's open question Q5 is closed rather than carried. Both health PDF filenames are now held and
diffed page by page: they differ on PDF page 20 only, `abstinence).` against `abstinence,
contraception).`, in the Grades 6-8 Sex Education band. Every anchor this package cites is
byte-identical in both.

## Layout

```
g34-specialty-health-finlit-rfl-r4/
  MANIFEST.json                        identity, counts, input pin, boundary
  SHA256SUMS.txt
  policy/classification-policy.json    the machine-readable policy: classes, resolutions, invariants
  rules/resolution-rules.json          P1-P5, and which r3 rule each supersedes
  sources/documents/*.pdf              the three documents newly in custody
  sources/source-custody.json          url, sha256, pages, retrieval, absence assertions
  sources/extracts/official-anchors.json   every quoted anchor, pulled from bytes at build time
  sources/refetch.sh                   re-fetch and re-check the two held documents
  evidence/registry.jsonl              one record per authored citation string per course
  evidence/crosswalk.json              unit -> official anchors, with honest coverage
  evidence/before-after.json           counts before and after, in scope and package-wide
  evidence/rollup.json                 counts by class, subject, authority, action
  findings/resolutions.json            the three closures, with reasoning and support
  findings/unresolved.json             what is still open, and what a human is actually needed for
  tools/build-r4.py                    regenerates all of the above
```

## Reproducing

```bash
python3 curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/tools/build-r4.py
```

It verifies all five documents and the three pinned r3 inputs before reading a byte, aborts on any
mismatch, aborts if any quoted anchor is not present in the held bytes, aborts if any absence
assertion is violated, and aborts if any invariant fails. Same inputs produce a byte-identical
tree.

## Read before promoting

- Nothing here is a licensed-educator review. `verified` means an authored string was compared
  against an official document's bytes.
- A crosswalk is not an alignment. The unit-to-anchor correspondences are Manuel Academy's claim
  about its own material, not MDE's about it.
- The relabels are not applied. This package writes no lesson; it says what the labels must
  become.
- A `PASS` on invariant I1 is a statement about `required_label`, not about the release as it
  stands. 72 citations still read `Michigan Personal Finance foundations — introductory` today;
  that is exactly what `authored_class` records.
- r3's open question Q2 is inherited, not answered: the health document is titled *guidelines* and
  the approving press release describes guidance to districts under local control. Nothing here
  upgrades it to "standards".
- 660 citations still need a human, all of them arts or PE. Both
  look resolvable the same way these were - printed official text, unambiguous - but neither was
  in this brief.
