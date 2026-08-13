# Grade 3/4 Arts and PE - Standards Policy Resolution

`manuel-academy-g34-specialty-arts-pe-standards-policy-r4` - status **G34_ARTS_PE_STANDARDS_POLICY_READY**

The two largest unresolved specialty groups left by `g34-specialty-r3`: **arts/music, 372
citations** and **physical education, 288 citations**. Both are resolved as far as the official
documents allow and no further. **No lesson was read or edited, no file outside this directory was
written, and no PDF was copied - the three official documents are referenced read-only from r3 and
re-verified against michigan.gov.**

## Result

| | Citations | Resolved | Still needs a human |
| --- | ---: | ---: | ---: |
| Arts / Music | 372 | 300 *(standard level only)* | 72 |
| Physical Education (in scope) | 288 | 0 | 288 |
| Physical Education (already alias-resolved in r3) | 252 | 252 | 0 |

**Nothing here became verbatim Michigan. Nothing here was assigned an exact Michigan grade-level
expectation.** Those two sentences are enforced by `tools/validate.py`, not just asserted.

## The distinction the whole package turns on

A citation makes two claims that r3 judged as one:

- **REFERENT** - *which* official element is meant.
- **TEXT** - that the quoted words *are* that element's words.

Collapsing them is why r3 reported 372 arts citations as one undifferentiated block. In fact 300 of
them have an unambiguous Michigan referent and 72 do not - a real distinction for whoever has to
work the queue. Splitting the tiers is also what stops the crosswalk from becoming a laundering
device: every one of the 300 still carries `citation_string_status: MISATTRIBUTED_AS_AUTHORED`,
because resolving a referent does not make the words Michigan's.

## Arts: a crosswalk, and only a crosswalk

Every Grade 3/4 arts citation labels **National Core Arts Standards** process vocabulary as
Michigan. Those words occur **zero times as a capitalised name** in either held Michigan arts
document - the build re-counts this every run and aborts if it is ever non-zero. So no arts citation
can be `VERBATIM_VERIFIED`, `ALIAS_RESOLVED_VERBATIM` or `COMPOSITE_VERIFIED`. That is rule
R4-ARTS-1 and it has no exceptions.

What *can* be done honestly is a crosswalk, warranted by Michigan's own Grade 3/4 expectation text:

| NCAS process | Citations | Michigan target | Class |
| --- | ---: | --- | --- |
| Creating | 120 | Standard 2 CREATE | crosswalk resolved |
| Responding | 108 | Standard 3 ANALYZE | crosswalk resolved |
| Performing | 48 | Standard 1 PERFORM | crosswalk resolved |
| Presenting *(Visual Arts)* | 24 | Standard 1 PERFORM | crosswalk resolved |
| **Performing/Presenting** *(no discipline)* | **24** | **Standards 1 *and* 3** | **HUMAN_REVIEW_REQUIRED** |
| **Connecting** | **48** | **Standards 4 *and* 5** | **HUMAN_REVIEW_REQUIRED** |

**The warrant is expectation text, never a shared word root.** `Presenting` is the case that proves
it twice over. The names share nothing, and Michigan files *visual-arts* presentation under PERFORM -

> `ART.VA.I.3.4` Select, present, and evaluate personal artwork.
> `ART.VA.I.4.4` Prepare, present, and collaboratively evaluate personal artwork.

But Michigan files *dance* presentation under ANALYZE (`ART.D.III.3.4`, `ART.D.III.4.4`). Unlike
Creating, Performing and Responding, **Presenting has no home standard in Michigan** - so it resolves
only when the citation names a discipline. `Visual Arts - Presenting` resolves to Standard 1;
`Performing/Presenting`, which names none, spans Standards 1 and 3 and does not resolve.

Run the same test in reverse and `Creating -> CREATE` earns its mapping from
`ART.M.II.3.1`, `ART.D.II.3.2`, `ART.T.II.3.1`, `ART.VA.II.3.5` being generative outcomes - not from
both words containing `creat-`. The build aborts if any warrant code is absent from the document.

**Connecting stays unresolved, but this is the package's most contested call.** NCAS Connecting
carries both *relate personal experience to make art* and *relate works to societal, cultural and
historical context*, which read onto Michigan Standard 5 (`ART.M.V.3.2`) and Standard 4
(`ART.M.IV.3.2`) respectively. The independent review contests the second half - see *What the
independent review changed* below - and the contest is real enough that these 48 are held open rather
than resolved either way.

**No arts citation gets a code.** Michigan prints **187** exact-grade expectations for Grades 3 and 4
under **186** distinct codes - `ART.VA.III.3.3` is printed twice with different text, once inside the
Dance Grade 3 block where no `ART.D.III.3.3` exists. Both are recorded; neither is reassigned.
By discipline the distinct codes run Dance 53, Music 57, Theatre 32, Visual Arts 44. Picking which one a lesson meets is a curriculum
judgment about that lesson. Each citation instead carries `candidate_expectation_codes` - the
Michigan shortlist under its mapped standard, narrowed by discipline where the citation names one,
between 2 and 25 codes. **A shortlist is not an assignment.**

One caveat is recorded rather than smoothed over: Michigan's Standard 3 is not a clean analogue of
NCAS Responding at the expectation level - `ART.D.III.3.4` ("Demonstrate the ability to create a
dance study for presentation to peers.") is a creation-and-presentation outcome filed under ANALYZE.
The standard-level mapping holds; the expectation-level partition does not. That same expectation is
what forced `Performing/Presenting` open, which is the point: Michigan's five standards and NCAS's
processes do not partition the same way, and the crosswalk only claims what survives that.

## PE: three misquotations, resolved to zero

Michigan prints each standard once per grade band, and **the bands are not identical**. A Grade 3/4
citation is judged against the Grade 3-5 band only - matching against whichever band makes a
citation pass is the error rule R4-PE-1 exists to prevent.

Standards 1 and 4 are verbatim (252 citations, unchanged from r3). Standards 2, 3 and 5 are not, and
**each authored string occurs 0 times anywhere in the 45-page document**:

| | Michigan, Grade 3-5 band | Authored | Change |
| --- | --- | --- | --- |
| Std 2 | ...movement and **performance** | ...movement and **physical activities** | substitution |
| Std 3 | a health-**enhancing** level of physical **activity and fitness** | a health-**enhanced** level of physical **fitness** | narrowing |
| Std 5 | self-expression and/or **social interaction** | self-expression and/or **other benefits** | broadening |

All three are `HUMAN_REVIEW_REQUIRED`. Neither alternative survives contact with the definitions:

- **Not `ALIAS_RESOLVED_VERBATIM`** - the remainder after the house prefix is not official text.
- **Not `COMPOSITE_VERIFIED`** - a composite combines *verified official elements*. These are single
  official elements with a word swapped. Classing that as composite would let any misquotation pass
  by pointing at the words that survived.

The task asked for source meaning rather than string similarity, and meaning is applied here only to
**demote, never to promote**: a citation that presents itself as a quotation of a named standard is
a misquotation when the words differ, whether or not the sense is close. On the merits none of the
three is even close - Std 3 deletes the participation half of the standard, and Std 5 turns Michigan's
final enumerated value into an open-ended catch-all that admits any benefit whatever.

Where `health-enhanced` came from is worth recording: it **is** a Michigan word, but only in the K-2
band (PDF p. 18). The authored string splices it into a truncation that matches no band at all.

Each of the 288 carries a `proposed_correction` holding the exact Grade 3-5 text. **It is recorded,
not applied** - this package edits no lesson. Michigan also prints 119 exact-grade PE outcome codes
for Grades 3/4 (Standard 2: 17, Standard 3: 14, Standard 5: 8) and none is cited.

## Source custody

Three documents, all SHA256-pinned, **none copied here**. Duplicating bytes creates a second copy
that can drift; a pin cannot. Two checks ran on 2026-08-12 and both pass 3/3:

1. the bytes held by r3 match the pins - `tools/build_r4.py` repeats this before reading and aborts on mismatch;
2. **michigan.gov still serves those exact bytes** - re-fetched live, byte-identical. This is the
   check that stops a package from verifying faithfully against a document the state has replaced.

Reproduce with `bash sources/refetch-verify.sh`. No NCAS document is held or needed: every
determination is made against Michigan's bytes, so a reader who disputes an NCAS definition recorded
here can do so without disturbing a single classification.

Independently re-derived from the bytes without consulting r3's extract: **186** arts expectations
(53/57/32/44) and **119** PE outcome codes. Both match r3 exactly - so the disagreements in this
package are about classification, not about what the documents say.

## Layout

```
g34-specialty-arts-pe-r4/
  rules/decision-rules.json          the classes, the rules, and what would change them
  registry/crosswalk-registry.json   machine-readable mapping registry + the crosswalk table
  registry/inverse-index.json        Michigan target -> authored citations (reversibility)
  evidence/arts-citations.jsonl      22 records, 372 citations
  evidence/pe-citations.jsonl        10 records, 540 citations
  evidence/before-after.json         r3 class -> r4 class, by subject
  evidence/unresolved.json           the 360 that still need a human, with what to decide
  sources/source-custody.json        pins, re-fetch results, extraction provenance
  sources/extracts/*.json            official anchors pulled from the pinned bytes at build time
  sources/refetch-verify.sh          re-verify held bytes AND upstream
  tools/build_r4.py                  regenerates everything
  tools/validate.py                  21 invariants + 9 mutations
```

## Reproducing

```bash
python3 curriculum-release-evidence/g34-specialty-arts-pe-r4/tools/build_r4.py
python3 curriculum-release-evidence/g34-specialty-arts-pe-r4/tools/validate.py
```

`validate.py` reports **30 passed, 0 failed**. The 9 mutations matter more than the 21 invariants:
each one deliberately corrupts an input and requires the verdict to change or the build to abort. A
mutation that left the output identical would prove the rule was decorative. They confirm, among
other things, that **PE Standard 2 flips to `ALIAS_RESOLVED_VERBATIM` when the source is edited to
match the authored text** - so the classifier is reading the document, not reciting a hardcoded
verdict - and that **collapsing Connecting to a single standard releases exactly the 48**, so those
48 are held by the two-target rule rather than by a constant.

## What the independent review changed

An adversarial standards review ran against the PDF bytes after the first build and confirmed the
zero-occurrence premise, the roman-numeral-to-standard mapping (859/859), all three PE divergences,
and every count. It also found four real defects, all fixed here:

- **The custody file's central disclaimer was false.** It claimed the NCAS definitions are "never
  evidence" and that disputing one would disturb no classification. The 48 Connecting citations rest
  entirely on the NCAS two-anchor reading - no Michigan byte splits Connecting across Standards 4
  and 5, and the package's own mutation test proves the dependency. Now stated plainly, with the
  places NCAS *is* load-bearing listed.
- **R4-ARTS-3 was applied to one process out of four.** The dance-presentation evidence was recorded
  in the *Responding* caveat and never applied to *Presenting*. Fixed: 24 citations demoted.
- **A printed expectation was silently dropped** by an extractor that kept the longer body on a key
  collision. Now recorded, with the count corrected to 187 printed / 186 distinct.
- **The R4-ARTS-1 premise guard could not see split words** in a document that splits words 38 times
  per page-set (`Demonstr ate`, `mo vement`). A heading rendered `Cr eating` would have scored zero.
  The guard is now split-tolerant; the conclusion is unchanged.

The review also argues Connecting should resolve to Standard 5 alone: of the Grade 3/4 expectations
containing "connect" or "relate", ten sit under Standard 5 and effectively none under Standard 4, and
the Standard 4 half of the split rested on `ART.M.IV.3.2`, which contains neither word and was mapped
by concept - the reasoning R4-ARTS-2 forbids everywhere else. **That inconsistency is conceded.** The
48 stay unresolved anyway, because the remedy for a mapping resting on weak warrant is not a
different mapping resting on a lexical search, and this is the one direction the package is least
willing to be wrong in. The dissent is recorded in full in `rules/decision-rules.json` for a human to
rule on.

## Read before promoting

- **Nothing here is a licensed-educator review.** A crosswalk is a defensible reading of two
  documents, not a curriculum decision.
- **300 "resolved" arts citations are resolved at standard level only.** Not one is verbatim
  Michigan; not one carries an exact grade-level expectation. Any report that cites 300 without that
  qualifier is misreporting this package.
- **360 citations still need a human** - 72 arts (48 Connecting, 24 Performing/Presenting) and
  288 PE (accept the correction, or re-cite against one of the 119 exact-grade outcome codes).
- **PE gained nothing.** 288 in, 288 out. r3's finding was right; this package verified it
  independently, established that each authored string appears nowhere in the document, and recorded
  the exact correction - but resolved none of them, because none of them resolves.
- The same NCAS-vocabulary question likely sits under other arts lanes, and the arts document itself
  is a 2011 Michigan Merit Curriculum publication. Whether Michigan intends it as the current
  elementary arts standard is a question for MDE, not for this package.
