# Standards Custody — Michigan Personal Finance, Grades 9-12

This document records exactly how the expectations in
`michigan-personal-finance-9-12-expectations.json` were obtained, so a reviewer can
re-walk the chain rather than trust it. It follows the same discipline as the sibling
High School ELA lane's custody record.

## Source

| Field | Value |
| --- | --- |
| Document title | Michigan Merit Curriculum: Personal Finance 9-12 Content Expectations |
| Publisher | Michigan Department of Education |
| PDF `/Title` metadata | Michigan Merit Curriculum: Personal Finance 9-12 Content Expectations |
| PDF `/Author` metadata | Michigan Department of Education |
| PDF `/Creator` metadata | Adobe InDesign 18.5 (Windows) |
| Document version line | `Personal Finance v5/2023` (printed in the page-2 running head) |
| PDF creation date | 2023-09-21 |
| Official landing page | https://www.michigan.gov/mde/services/academic-standards/personal-finance |
| Document URL | https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Personal-Finance/Personal_Finance_Content_Expectations.pdf |
| SHA-256 | `ff97640535d7864de8d3333669a5f8d8ab8134ebfa0af5f9f938cf2e91ab2735` |
| Size | 537,595 bytes |
| Pages | 2 |
| Retrieved | 2026-08-12 |

## Retrieval chain

1. The official MDE Personal Finance landing page was located via web search restricted to
   `michigan.gov`.
2. The content-expectations PDF was retrieved from the `michigan.gov` media host with a
   standard desktop browser `User-Agent`, returning HTTP 200 and 537,595 bytes. No
   authentication, paywall, CAPTCHA, or access control was involved or circumvented — this
   is a freely published public document.
3. The retrieved file was hashed **before** any processing. The hash above is of the exact
   bytes that were parsed.
4. Text was extracted with `pypdf` 6.6.2. Page 1 is a cover; page 2 carries the Introduction
   and the complete expectation list. Both pages were extracted in full and read.

## The seven-versus-six discrepancy — read this before trusting any secondary summary

A secondary web summary encountered during retrieval stated that the half credit is awarded
for "demonstration of proficiency on the **6** recognized personal finance standards."

**The retrieved v5/2023 document prints seven**: PF1 Earning Income, PF2 Buying Goods and
Services, PF3 Budgeting and Saving, PF4 Using Credit (with sub-expectation 4.1 on FAFSA,
student loans, scholarships, work study and grants), PF5 Financial Investing, PF6 Protecting
and Insuring, and **PF7 Paying Taxes**.

This corpus follows the retrieved document. Two independent facts corroborate the
seven-expectation reading:

- The document's own Introduction describes the scope as "earning, spending, saving, credit,
  investing, and insuring" — six *topics* — while the expectation list itself separately
  enumerates a seventh expectation for taxes. A summary counting the Introduction's topic
  nouns would land on six.
- This repository's already-published Grade 8 financial-literacy course
  (`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy`)
  independently organizes its seven units as `PF1`..`PF7`, its seventh being
  "PF7 — Paying Taxes and Financial Plan Capstone", and tags unit 4 with both `PF4` and
  `PF4.1`. That course predates this lane and was authored against the same source.

Had this lane been authored from the secondary summary rather than the document, an entire
required expectation — taxes — would have been silently omitted from the progression.

## What is verbatim and what is local

**Verbatim from the source:** the code strings `PF1`-`PF7`, the expectation titles, and the
full body text of every expectation. Unlike the ELA band tables, this document prints the
`PF<n>` codes literally, so the codes here are source text rather than a repository
convention.

**Local to this repository:**

1. The sub-expectation printed as a bare `4.1` beneath PF4 is represented as `PF4.1`, so that
   every code in the corpus is globally unique and self-identifying. The source rendering is
   preserved in the corpus as `source_code_as_printed`.
2. Whitespace repair of InDesign letter-spacing artifacts in four headings. Every instance is
   enumerated in the corpus under `transcription_notes.whitespace_artifacts`:
   `Earning Inco me` → `Earning Income`; `Buying Go ods and Services` → `Buying Goods and
   Services`; `Pro tecting and Insuring` → `Protecting and Insuring`; `Free A pplication` →
   `Free Application`. Only whitespace changed; no wording was altered.
3. The distribution of PF1-PF7 across grades 9-12 and the depth assigned to each year. See
   `../progression/rigor-progression-9-12.md`.

## What was not done

- No expectation was reconstructed from model memory. Every code and every text string in the
  corpus came from the extracted document.
- No expectation was inferred, interpolated, or paraphrased.
- No canonical framework version, identifier, or URL beyond those printed above was invented.
- The source PDF itself is **not** committed to this repository. It is a third-party
  publication; the corpus records its identity, hash, and location so it can be re-fetched
  and re-verified, which is the same "referenced, not copied" posture the repository already
  takes toward `a5-ready-for-life-v1.zip` in `curriculum-manifest.json`.

## Known limits

1. **Band, not grade.** Michigan publishes one 9-12 expectation set, not four grade-level
   sets. Year-by-year distribution is a Manuel Academy curricular decision, documented rather
   than implied.
2. **Alignment is not approval.** This is locally authored curriculum aligned to published
   expectations. It is not a claim of state approval, accreditation, licensure, credit award,
   or satisfaction of the Section 380.1278a requirement by any particular school or district.
3. **Credit determination is not made here.** Whether a given year of this lane constitutes
   the required half credit, and which credit it offsets, is a district or public school
   academy decision under the Michigan Merit Curriculum.

## Re-verification

To re-verify the corpus, re-download the document URL, confirm the SHA-256 above, and
re-extract page 2. If the hash differs, MDE has republished the document — re-extract the
corpus and re-check the expectation count before treating these courses as aligned.
