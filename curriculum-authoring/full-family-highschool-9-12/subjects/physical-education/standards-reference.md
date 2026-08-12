# Standards Reference — Grades 9-12 Physical Education

**Alignment date:** 2026-08-12
**Jurisdiction:** Michigan (matches the Grades 5/7/8 canonical package)
**Status:** Locally authored curriculum aligned to published standards. This is not a claim of state approval, accreditation, licensure, or automatic credit.

## Framework

**Michigan K-12 Physical Education Standards**, approved by the Michigan State Board of Education in **2017** (document dated May 2017, ADA-compliant revision 2018). Five standards, applied K-12.

| # | Standard |
| --- | --- |
| 1 | Demonstrates competency in a variety of motor skills and movement patterns. |
| 2 | Applies knowledge of concepts, principles, strategies and tactics related to movement. |
| 3 | Demonstrates the knowledge and skills to achieve and maintain a health-enhancing level of physical fitness. |
| 4 | Exhibits responsible personal and social behavior that respects self and others. |
| 5 | Recognizes the value of physical activity for health, enjoyment, challenge, self-expression and/or social interaction. |

These replaced the older six-content-standard set ("A physically educated person…") used in the 2007/2008 Michigan documents. Material still circulating against the older six-standard framing is not current.

## The grades 9-12 LEVEL structure

Unlike every other band, the 2017 standards organize **grades 9-12 into two LEVELS** rather than four grade sets, so a school can run a basic high-school course (**LEVEL 1**) and a second, more advanced course (**LEVEL 2**) as an elective.

Manuel Academy maps that structure onto four years:

| Grade | Michigan PE level | Role |
| --- | --- | --- |
| 9 | LEVEL 1 | Opens LEVEL 1 — safe self-management, movement competence across every activity category |
| 10 | LEVEL 1 | Completes LEVEL 1 — analysis, tactics, and the learner's first self-designed program |
| 11 | LEVEL 2 | Opens LEVEL 2 — periodization, specialization, inclusive leadership |
| 12 | LEVEL 2 | Completes LEVEL 2 — independent adult activity, access realities, capstone |

Every unit, lesson, and `standards_mapping` entry carries its level, and the `grade-progression` gate fails if a grade is assigned the wrong one.

## Verification method and its limits

`www.michigan.gov` returns **HTTP 403** to direct fetch on the PE standards PDF and on the MDE PE pages (host bot-protection, not a broken link). The five standard statements and the LEVEL 1 / LEVEL 2 structure were confirmed through **search-engine indexing of the official MDE documents**, which reflects current live content but does not permit quoting exact PDF text at scale.

**What this session did not do:** the per-outcome codes (the numbered outcomes beneath each standard, in the `S1.…` family) were not legible from any source reached. **No lesson in this course set claims a per-outcome code.** Anchors are stated at Standard + LEVEL granularity, which is exactly as precise as the verified sources support.

### `mapping_status` assignment

| Status | Used for | Count in this release |
| --- | --- | --- |
| `unverified` | Every Standard + LEVEL anchor — statement and level structure confirmed against official MDE sources, exact per-outcome codes not read | 1417 |
| `canonical` | *(none)* — deliberately. Nothing here was read verbatim off the primary PDF, so nothing claims to be. | 0 |
| `human-review` | *(none)* | 0 |

This is a lower confidence rating than the health course set carries, and that difference is real rather than cosmetic: the health framework was decoded from a full official source document, and the PE framework was not. A reviewer with access to the PE PDF should upgrade these to `canonical` and add per-outcome codes. The `standards-mapping` gate reports the split on every run so the ratio is visible rather than buried.

## Michigan law referenced by this course set

**MCL 380.1502** — "Health and physical education for pupils of both sexes shall be established and provided in all public schools of this state."

## Sources

- Michigan K-12 Physical Education Standards (May 2017, ADA revision 2018): https://www.michigan.gov/-/media/Project/Websites/mde/2019/02/22/K_12_PE_Standards_Aug_17_ADA_compliance918.pdf — live, HTTP 403 to direct fetch
- Approval of K-12 Physical Education Standards, State Board item (August 2017): https://www.michigan.gov/-/media/Project/Websites/mde/2017/08/31/Item_N_K-12_Physical_Education_Standards.pdf
- Michigan Merit Curriculum, Health and Physical Education: https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/health/ce/michigan-merit-curriculum-health-physical-education
