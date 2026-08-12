# Sex Education — Optional, Guardian-Activated Module

## The decision, stated plainly

Michigan HESG 2025 **Section 3** is sex education, and Michigan law treats it differently from every other part of the health standards. `MCL 380.1507` and `MCL 380.1169` give parents and caregivers:

- **prior notification** when HIV/AIDS or sex education is taught,
- the right to **review all materials before instruction occurs**, and
- the right to **opt their child out without penalty**.

A district that teaches sex education must also convene a Sex Education Advisory Board that is at least 50% parents.

"Without penalty" is the constraint that shapes the design. If sex education were embedded in a required 36-day course sequence, a family that declined it would receive a course with a hole in it — six missing days, a missing unit assessment, and a shortened sequence. That is a penalty, however it is labelled.

**So this module is not part of any course.** It is authored separately, it is never scheduled automatically, it does not count toward any course's 36 days, and it is not required for course completion or for any credit recommendation. A family that declines it receives four complete, unmodified health courses. A family that elects it receives standards-aligned instruction rather than nothing.

The validator enforces all four properties (`health-privacy-guard` gate), and the test suite asserts that no module lesson id appears in any course sequence.

## What the module contains

| | |
| --- | --- |
| Module id | `ma-hs-health-sex-education-optional` |
| Recommended grade | 10 |
| Days | 6 (not counted in any course) |
| Practices | 2 (Social Awareness, Relationship, and Communication Skills), 3 (Information and Resource Seeking), 5 (Self-Management and Goal Setting) |
| Topic | `SE` Sex Education |
| `mapping_status` | `human-review` |

Topics: anatomy, reproduction, and development in medically accurate terms; consent, boundaries, and communication; abstinence and risk reduction presented accurately; sexually transmitted infections including HIV — transmission, prevention, testing, and treatment; locating medically accurate sources and confidential health services; recognizing coercion and exploitation and where to report it.

## Privacy floor

No sexual history, activity, orientation, identity, relationship status, or any personal disclosure is requested, recorded, or shared at any point. Every task can be completed using supplied fictional scenarios. No group discussion, role-play, presentation, photograph, or recording is required.

## Why `mapping_status` is `human-review` and not `canonical`

Content selection inside Section 3 is a guardian decision — and, in a district setting, a Sex Education Advisory Board decision. It is not settled by an authoring lane, and marking it `canonical` would imply this lane had made a decision it has no standing to make. The status is a statement about who decides, not a statement that the source is unreliable.

## What is *not* in this module

**HIV instruction is not here.** It sits in Grade 9 Health Unit 6 (`Personal Wellness, Communicable Conditions, and HIV Basics`) as part of the required course sequence, because HESG Section 1 lists HIV instruction as content required by Michigan law rather than as sex education. That unit carries its own prior notification, materials review, and opt-out; when a family opts out, the unit's remaining five topics are taught on their own and the course is not shortened.

## Related

- [`standards-reference.md`](standards-reference.md) — the framework, the verification method, and its limits
- [`validation-contract.md`](validation-contract.md) — the gate that enforces the four gating properties
- [`pacing-and-credit.md`](pacing-and-credit.md) — why the 6 days are excluded from every credit figure
