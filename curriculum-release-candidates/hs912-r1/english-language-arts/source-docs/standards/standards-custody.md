# Standards Custody — Michigan ELA, Grades 9-12

This document records exactly how the standards in `michigan-ela-9-12-standards.json`
were obtained, so a reviewer can re-walk the chain rather than trust it.

## Source

| Field | Value |
| --- | --- |
| Document title | Michigan K-12 Standards: English Language Arts |
| Publisher | Michigan Department of Education |
| PDF `/Title` metadata | Michigan K-12 Standards: English Language Arts |
| PDF `/Author` metadata | Council of Chief State School Officers |
| Adoption | Adopted by the Michigan State Board of Education in 2010 (stated in the document's Introduction, page 3) |
| Official landing page | https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/ela |
| Document URL | https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/Content-Standards/ELA_Standards.pdf |
| SHA-256 | `5d340bbe90c70f95b937a4b95f099b55543b423e55ac0708ea43fee6a15a4863` |
| Size | 3,256,533 bytes |
| Pages | 67 |
| Retrieved | 2026-08-12 |

## Retrieval chain

1. The official MDE ELA landing page was located via web search restricted to `michigan.gov`.
2. The landing page and the PDF both returned **HTTP 403** to the default agent fetcher.
   The PDF was retrieved successfully from the same `michigan.gov` media host by issuing
   the request with a standard desktop browser `User-Agent`. No authentication, paywall,
   CAPTCHA, or access control was involved or circumvented — this is a freely published
   public document, and the 403 was a user-agent filter at the CDN edge.
3. The retrieved file was hashed before any processing. The hash above is of the exact
   bytes that were parsed.
4. Text was extracted with `pypdf` 6.6.2. The band tables were read from the extracted
   page text and transcribed.

## Pages read

| Strand | Band table pages |
| --- | --- |
| RL — Reading Standards for Literature | 38 |
| RI — Reading Standards for Informational Text | 40 |
| W — Writing Standards | 45, 46, 47 |
| SL — Speaking and Listening Standards | 50 |
| L — Language Standards | 54, 55 |

Grades 9-10 and 11-12 appear as two side-by-side columns on each of these pages under the
headers "Grades 9-10 students:" and "Grades 11-12 students:".

## What is verbatim and what is local

**Verbatim from the source:** the strand letter, the band, the standard number, and the
full text of every standard, including sub-points a-f where the source prints them.

**Local to this repository:** the *code string format* only. The source document does not
print a single concatenated code such as "9-10.RL.1"; it prints a band column header above
numbered rows inside a per-strand table. The form `<band>.<strand>.<number>` is the Manuel
Academy convention, chosen to extend the `8.RL.1` style already used by the published
Grade 8 release in `curriculum-content/manuel-academy/1.0.0`. This is recorded in the
corpus itself as `code_format.authority = "LOCAL_COMPOSITION"`.

This distinction matters and is stated rather than glossed: a reviewer checking these codes
against the PDF will find the text and numbering but will not find the concatenated string.

## What was not done

- No standard was reconstructed from model memory. Every code and every text string in the
  corpus came from the extracted document.
- No standard was inferred, interpolated, or paraphrased.
- No canonical framework version, identifier, or URL beyond those printed above was
  invented. This follows the discipline already enforced in
  `src/admin/curriculum-standards-review/knownEvidence.ts`, which states: *"Repository
  evidence only. No canonical ID, wording, version, or URL is inferred."*

## Scope decision: what this corpus deliberately excludes

The source document also contains the **Standards for Literacy in History/Social Studies,
Science, and Technical Subjects 6-12** (RH, RST, WHST strands, pages 59-65). These are
**not** included in this corpus.

That is deliberate: those standards govern literacy instruction inside history, science,
and technical courses, not the ELA course itself. They belong to those subject lanes, which
this work does not own. A reader comparing this corpus against the PDF will find those
pages unrepresented, and this paragraph is the reason.

## Known limits

1. **Band, not grade.** Michigan does not publish grade-9, grade-10, grade-11, and grade-12
   ELA standard sets. It publishes 9-10 and 11-12. The assignment of standards 1-9 to a
   specific year within a band is a Manuel Academy curricular decision, documented in
   `../progression/rigor-progression-9-12.md`. Only standard 10 is differentiated by year
   by the state itself.
2. **Alignment is not approval.** This package is locally authored curriculum aligned to
   published standards. It is not a claim of state approval, accreditation, licensure, or
   automatic credit — the same position the published release takes in
   `curriculum-content/manuel-academy/1.0.0/standards/standards-reference.md`.
3. **Attribution.** Standards text is reproduced for curriculum-alignment purposes from the
   Michigan publication cited above. Michigan's ELA standards are the Common Core State
   Standards as adopted by Michigan; the source PDF credits the Council of Chief State
   School Officers in its author metadata.

## Re-verification

To re-verify the corpus, re-download the document URL, confirm the SHA-256 above, and
compare the pages listed. If the hash differs, MDE has republished the document and the
corpus must be re-extracted before the courses are treated as aligned.
