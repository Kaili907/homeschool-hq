# Standards Reference — Grades 9-12 Health

**Alignment date:** 2026-08-12
**Jurisdiction:** Michigan (matches the Grades 5/7/8 canonical package)
**Status:** Locally authored curriculum aligned to published standards. This is not a claim of state approval, accreditation, licensure, or automatic credit.

## Framework

**Michigan Health Education Standards Guidelines (HESG) 2025.** Approved by the Michigan State Board of Education on **13 November 2025**; ADA-final document dated **19 December 2025**. The HESG replaces the 2007 standards, cuts the standard count from 514 to 407, and makes four structural changes that this course set is built on:

1. The term *Standard* is replaced by **Practice**. There are **six Practices**, each with **eight indicators** per grade span.
2. Expectations are consolidated into **four grade spans** — K-2, 3-5, 6-8, **9-12** — instead of individual grade levels. All four Manuel Academy high-school health courses therefore sit inside one band and differ by depth, independence, and transfer distance, not by standard.
3. Indicators inside each Practice are grouped by **eight topics**, each with a bracket abbreviation.
4. The document is organized into three sections: **Section 1** is content required by Michigan law (HIV instruction, CPR/AED, and physiology and hygiene as it relates to substance use); **Section 2** is the general health standards; **Section 3** is sex education, governed by specific parental-rights law.

### The six Practices (verbatim)

| # | Practice | Description |
| --- | --- | --- |
| 1 | Self-Awareness and Analyzing Influences | Examine how emotions, thoughts, needs, values, beliefs, and other internal and external factors influence behaviors, and articulate how these influences affect health behaviors and outcomes. |
| 2 | Social Awareness, Relationship, and Communication Skills | Enhance relationships, personal health, and the health of others through social awareness and effective communication. |
| 3 | Information and Resource Seeking | Access, evaluate, and use valid and reliable health information, products, services, and related resources. |
| 4 | Decision Making and Problem Solving | Make health-promoting, informed, responsible decisions and solve problems in a variety of health-related situations. |
| 5 | Self-Management and Goal Setting | Set goals, engage in health-promoting behaviors, and avoid risky behaviors. |
| 6 | Advocacy and Health Promotion | Promote personal, family, and community health and well-being. |

### The eight topics

`BEPA` Balanced Eating and Physical Activity · `CEH` Community and Environmental Health · `HR` Healthy Relationships · `MEH` Mental and Emotional Health · `PHW` Personal Health and Wellness · `SAF` Safety · `SU` Substance Use and Misuse · `SE` Sex Education

### Code format

The HESG codes a grade span by its **terminal grade**. Confirmed examples read from the official source: `5.3.SE`, `5.5.SE`, `8.2.SE`, `8.3.SE` — that is, `<terminal grade>.<practice>.<TOPIC>`. The 9-12 band therefore codes as `12.<practice>.<TOPIC>`, which is the form every unit in this course set carries.

## Verification method and its limits

`www.michigan.gov` returns **HTTP 403** to direct fetch on every standards URL attempted (host bot-protection, not a broken link), so the primary HESG PDF could not be read directly from the state host. The framework details above were instead extracted from a **mirrored copy of the official Michigan State Board of Education presentation on the updated HESG**, whose text was decoded in full — the Practice names and descriptions, the topic abbreviations, the section structure, the grade-span structure, the code examples, and the statutory citations are all read verbatim from that source, not summarized from memory.

**What this session did not do:** it did not read the per-indicator lists for the 9-12 band. No lesson in this course set therefore claims a specific indicator number. Anchors are stated at Practice + Topic level, which is exactly as precise as the verified source supports.

### `mapping_status` assignment

| Status | Used for | Count in this release |
| --- | --- | --- |
| `canonical` | Practice + Topic band anchors (`12.<p>.<TOPIC>`) — practice name and topic abbreviation read verbatim, band code follows the confirmed pattern | 339 |
| `unverified` | HESG Section 1 (content required by Michigan law) — confirmed to exist and be required; internal numbering not read | 42 |
| `human-review` | HESG Section 3 (Sex Education) — content selection is a guardian and, in a district, a Sex Education Advisory Board decision, not an authoring-lane decision | 1 |

Counts are produced by `tools/validate-course.mjs` and re-checked on every run; they are not hand-maintained.

## Michigan law referenced by this course set

- **MCL 380.1502** — "Health and physical education for pupils of both sexes shall be established and provided in all public schools of this state."
- **MCL 380.1507** and **MCL 380.1169** — parental rights: prior notification when HIV/AIDS or sex education is taught, the right to review all materials before instruction, and the right to opt a child out **without penalty**. If a district teaches sex education it must have a Sex Education Advisory Board that is at least 50% parents.

These are why the Grade 9 HIV unit carries a guardian notification and opt-out, and why sex education is a separate, guardian-activated module rather than part of any course sequence. See [`sex-education-module.md`](sex-education-module.md).

## Sources

- Michigan Health Education Standards Guidelines 2025 (MDE): https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/School-Health-and-Safety/Michigan-Health-Education-Standards-Guidelines-2025---ADA-final-with-edits-12-19-25.pdf — live, HTTP 403 to direct fetch
- Michigan State Board of Education presentation, *Updated Michigan Health Education Standards Guidelines* (November 2025) — the mirrored copy decoded for this reference
- Michigan Merit Curriculum, Health and Physical Education: https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/health/ce/michigan-merit-curriculum-health-physical-education
