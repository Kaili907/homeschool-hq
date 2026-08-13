# Grade 3/4 Specialty Standards - Evidence Resolution

`manuel-academy-g34-specialty-standards-evidence-r3` - status **G34_SPECIALTY_STANDARDS_EVIDENCE_READY**

Six specialty subjects of the normalized Grade 3/4 release, resolved against the official
Michigan documents themselves. **No lesson was edited and no file outside this directory was
written.**

## The premise that changed

`curriculum-release-normalization/g34-r2` says michigan.gov "blocks automated retrieval of its own
copy" and that "No code inside a PDF was fetched and transcribed by this session." That was true of
the tooling, not of the host: michigan.gov answers `403` to a default User-Agent and `200` to a
desktop browser one. Seven official documents were fetched on 2026-08-12 and are held here byte for byte,
pinned by SHA256 (`sources/documents/`, `sources/refetch.sh`).

That is why **0 of 1854 citations are UNVERIFIED here, against 1278 in the release**. The reduction is
not a softer standard - it is the documents actually being read.

## Result

| Class | Citations |
| --- | ---: |
| VERBATIM_VERIFIED | 0 |
| ALIAS_RESOLVED_VERBATIM | 534 |
| COMPOSITE_VERIFIED | 72 |
| LOCAL_COMPOSITION | 432 |
| UNVERIFIED | 0 |
| HUMAN_REVIEW_REQUIRED | 816 |
| **Total** | **1854** |

| Subject | Citations | Verbatim/alias | Composite | Local | Unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| Health | 246 | 162 | 72 | 0 | 12 |
| Physical Education | 540 | 252 | 0 | 0 | 288 |
| Technology / Computer Science | 120 | 120 | 0 | 0 | 0 |
| Arts / Music | 372 | 0 | 0 | 0 | 372 |
| Financial Literacy | 288 | 0 | 0 | 216 | 72 |
| Ready for Life | 288 | 0 | 0 | 216 | 72 |

`VERBATIM_VERIFIED` is zero by construction: no lane wrote a bare official sentence. Every citation
that does resolve carries a Manuel Academy prefix (`Michigan PE Standard 1: ...`), which is what
`ALIAS_RESOLVED_VERBATIM` means here.

## What honesty cost

**Ready for Life is Manuel Academy LOCAL_COMPOSITION.** Michigan publishes no Ready for Life
framework and this package never labels one. 216 of its 288 citations are classified exactly that
way. The remaining 72 are the single string `Michigan Health/SEL connections`, which is the one
place the boundary is blurred, and it is reported, not resolved.

**Financial Literacy separates two things the release ran together.** Michigan's only standalone
personal-finance standards document is titled *Personal Finance 9 - 12 Content Expectations*
(PF1-PF7, republished from the Personal Finance category of the K-12 Social Studies Standards) and
never mentions Grade 3 or Grade 4. So `Michigan Personal Finance foundations -
introductory` is HUMAN_REVIEW_REQUIRED, while the Manuel Academy unit and sequence anchors are
LOCAL_COMPOSITION - a real elementary progression, honestly labelled. Michigan *does* publish
exact-grade economics expectations for both grades in the Social Studies standards; they are the
available anchor and they are not cited.

**Arts is the largest single problem.** Every arts citation attributes National Core Arts Standards
process vocabulary to Michigan. Those words - Creating, Performing, Presenting, Producing,
Responding, Connecting - never appear as a capitalised standard or process name in either held
Michigan arts document; they occur only in lower-case prose. Michigan's five standards are PERFORM,
CREATE, ANALYZE, ANALYZE IN CONTEXT and ANALYZE AND MAKE CONNECTIONS, and it prints 186 exact-grade
expectations for Grades 3 and 4 across all four disciplines (D 53, M 57, T 32, VA 44).

**Health and PE resolve well, with named exceptions.** All six Health Practice names are verbatim;
six of the seven topic names are verbatim and the seventh is not (Michigan's topic is `Safety`, not
`Safety and Injury Prevention`). PE Standards 1 and 4 are verbatim; 2, 3 and 5 are cited with text
Michigan does not print.

**Computer Science clears.** The release's Gap 4 suspected the 2019 standards had been superseded.
The live MDE page serves that exact document; the "archive" page is an archive of public information
session presentations. All five authored strand labels are the Core Concept names Michigan's
adopted document prints. Those names originate in the K-12 CS Framework, which Michigan adopted -
and that is exactly what separates this case from arts: Michigan's own document prints these words,
and prints none of the arts ones.

## Grade-band honesty

Health (grade span 3-5) and Computer Science (Level 1B, Grades 3-5) are genuinely banded: no
Grade-3-only or Grade-4-only standard exists to cite, so `grade_resolution` is `grade-band-3-5`.
Physical Education and Arts are not banded - Michigan prints 119 Grade 3/4 PE outcome codes and 186
Grade 3/4 arts expectation codes and none is cited, so both read
`exact-grade-available-not-used`. Anchor locators throughout are **PDF page indices**, not the
documents' own printed page numbers; the two differ by a few pages in every document except the
health guidelines.

## Findings

| id | severity | citations | summary |
| --- | --- | ---: | --- |
| F1-arts-wrong-framework | high | 372 | Every Grade 3/4 arts citation labels National Core Arts Standards process vocabulary as Michigan. |
| F2-pe-label-text-diverges | high | 288 | PE Standards 2, 3 and 5 are cited with text Michigan does not print. |
| F3-financial-literacy-michigan-attribution | high | 72 | 'Michigan Personal Finance foundations - introductory' attributes a Michigan framework to Grades 3/4. |
| F4-ready-for-life-michigan-string | medium | 72 | 'Michigan Health/SEL connections' is the one string that puts Michigan's name on a Ready for Life lesson. |
| F5-health-safety-topic-name | medium | 12 | The health topic is cited as 'Safety and Injury Prevention'; Michigan's topic is 'Safety' [SAF]. |
| F6-gap-4-computer-science-closed | resolved | 120 | The release's Gap 4 (computer science currency unconfirmed) is closed in favour of the lane. |
| F7-source-retrieval-claim-was-wrong | resolved | 1854 | The input release's premise - that michigan.gov cannot be fetched and that no PDF code could be transcribed - does not hold. |

Full text in [`findings/findings.json`](findings/findings.json); what is still undecided in
[`findings/open-questions.json`](findings/open-questions.json). 5 findings are open.

## Layout

```
g34-specialty-r3/
  MANIFEST.json                        identity, counts, input pin, boundary
  SHA256SUMS.txt
  rules/classification-rules.json      the six classes and the rules that assign them
  sources/documents/*.pdf              seven official documents, held byte for byte
  sources/source-custody.json          url, sha256, pages, how and when retrieved
  sources/extracts/official-anchors.json   official text pulled from those bytes at build time
  sources/refetch.sh                   re-fetch and re-check every pinned hash
  evidence/citations.jsonl             one record per distinct citation string per course
  evidence/courses/*.evidence.json     twelve per-course files
  evidence/rollup.json                 counts by class, subject, grade resolution, authority
  findings/                            what is wrong, and what is still undecided
  tools/build-evidence.py              regenerates all of the above
```

## Reproducing

```bash
python3 curriculum-release-evidence/g34-specialty-r3/tools/build-evidence.py
```

It verifies all seven held PDFs against their pinned SHA256 before reading a byte and aborts on a
mismatch. Every classification is computed by comparing the authored string against text extracted
from those PDFs at build time. Where the script does name an official string literally - the five
computer science Core Concepts, the five arts standard headings, the health grade-span label, the
Level 1B label, the personal finance title - that literal is presence-checked against the held
bytes and the build aborts if it is not found, so none of them can drift silently. Same inputs
produce a byte-identical tree.

## Read before promoting

- Nothing here is a licensed-educator review. `verified` means the authored string was compared
  against the official document's bytes.
- The Michigan Health Education Standards Guidelines are titled *guidelines* and the approving
  press release describes guidance to districts under local control. This package cites them as
  such and does not upgrade them to "standards".
- 816 citations still need a human. That is a real number, not a formality: it is every arts
  citation, three of the five PE standards, the Michigan financial-literacy string, the Michigan
  Ready for Life string, and one health topic name.
- The same wrong retrieval premise sits under the science, social studies, mathematics and ELA
  lanes. They were not touched here.
