# Grade 8 → Grade 9 Handoff — Technology and Computer Science

Entry point for the 9–12 progression is the existing Grade 8 course
`ma-g8-technology` (6 units, 36 sessions), which lives in the frozen production
release at `curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/`.

That course is **not modified by this work**. This file records what Grade 9
assumes the learner already did, and where each Grade 8 thread is picked up.

## Grade 8 exit state assumed by Grade 9

| Grade 8 unit | Exit capability carried into Grade 9 |
| --- | --- |
| 1 — Digital Identity, Information, and AI Literacy | Can evaluate sources, describe data trails, and treat AI output as a draft to verify. |
| 2 — Programming and Software Design | Can write a small program using variables, selection, iteration, and simple procedures. |
| 3 — Web, App, and Accessible Interface Design | Can build an accessible multi-screen prototype and act on user-test feedback. |
| 4 — Data Science and Computational Models | Can clean a small dataset, visualize it, and state limitations. |
| 5 — Networks and Cybersecurity | Knows routing, encryption, and authentication at a conceptual level; has worked only in sandboxes. |
| 6 — Technology Capstone and Impact Review | Has delivered one documented project with privacy, accessibility, and impact evidence. |

## Thread continuity into 9–12

Each Grade 8 thread continues without a gap or a restart:

| Thread | G8 | G9 | G10 | G11 | G12 |
| --- | --- | --- | --- | --- | --- |
| Algorithms | informal procedures | decomposition, pseudocode, hand-tracing (U1) | searching, sorting, recursion, complexity (U2) | — | graphs, dynamic programming, intractability (U1) |
| Programming | selection and iteration | typing, compound logic, nested iteration, composed functions, scope (U2) | data structures (U1) | modular and object-oriented design (U2) | concurrency and performance (U2) |
| Debugging and testing | informal fixing | systematic debugging, test design, version control (U3) | correctness arguments (U2) | continuous testing and code review (U1) | verification under concurrency (U2) |
| Systems | device basics | abstraction layers, binary, OS (U4) | — | web and application architecture (U3) | systems, memory, reliability (U2) |
| Data | cleaning and visualizing | — | representation, structures, databases (U1, U3) | applied data science, provenance, uncertainty (U4) | — |
| Networks | routing concepts | — | protocols, addressing, name resolution (U4) | interfaces and data exchange (U3) | — |
| Cybersecurity | conceptual, sandboxed | — | threat modeling and secure coding, sandboxed (U5, U6) | — | privacy engineering, risk, incident response (U3) |
| Privacy and ethics | impact review | privacy and data minimization review (U6) | privacy impact review (U6) | bias, fairness, disclosed AI use (U5) | law, policy, algorithmic accountability (U4) |
| Human-centered design | accessible prototype | user research, responsive layout, validated forms, assistive-tech testing (U5) | — | accessibility budgets and conformance (U3, U6) | accessibility verification in capstone (U5) |
| Projects | one documented project | foundations project (U6) | secure data project (U6) | engineered application (U6) | substantial defended capstone (U5, U6) |

## How Grade 9 advances beyond Grade 8

Grade 9 does not restage Grade 8. Each Grade 9 unit is strictly above its Grade 8
counterpart:

| Grade 9 unit | Grade 8 counterpart | What is new in Grade 9 |
| --- | --- | --- |
| U1 Computational Thinking | U2 informal procedures | Formal decomposition, pseudocode, trace tables, and comparison of candidate algorithms — none of which Grade 8 requires. |
| U2 Programming Foundations | U2 variables, selection, iteration, simple procedures | Type conversion, operator precedence, compound boolean logic, nested iteration, composed functions, and explicit scope and modularity. |
| U3 Debugging, Testing, Version Control | informal fixing | Defect classes, systematic isolation, test-case and edge-case design, assertions, and version control with commit history. |
| U5 Human-Centered Design | U3 accessible multi-screen prototype | Adds responsive layout, form validation and error handling, assistive-technology testing, and consent-aware usability testing — strictly more demanding than the Grade 8 prototype. |
| U6 Foundations Project | U6 capstone with privacy, accessibility, impact review | Adds version history, a failing-test-to-fix evidence trail, and a **security** review alongside privacy — Grade 8's capstone had no security component. |

## Prerequisite ordering

Version control is **taught in Grade 9 Unit 3** (`version control commits and
history`) before Grade 9 Unit 6 requires a commit history in its performance
task. Grade 11 Unit 1 then extends it to branching, merge-conflict resolution,
and code review. No Grade 9 or 10 task requires a tool that has not been taught.

## Placement note

A learner who has not completed `ma-g8-technology` can still enter
`ma-g9-technology`, but should expect Units 1–3 to move quickly: they assume
comfort with variables, selection, and iteration rather than teaching them from
zero. Units 4–6 assume only Units 1–3.
