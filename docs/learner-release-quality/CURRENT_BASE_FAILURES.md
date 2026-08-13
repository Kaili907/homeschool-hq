# Learner release quality gate — current base evidence

Classification: **LEARNER_RELEASE_READY**

Audited content base: `c81ddb6e04bc1c3629212327d47817c1b5677477`

The gate inspected 8,292 admitted lessons, 699 assessments, and 90 courses. File existence is only population evidence; it never makes an artifact learner-ready.

## Lesson gate

Ready: **8292**

Blocked: **0**

| Failure code | Lessons | First deterministic samples |
| --- | ---: | --- |


## Assessment gate

Ready: **699**

Blocked: **0**

| Failure code | Assessments | First deterministic samples |
| --- | ---: | --- |


## Subject rules

- **mathematics:** worked examples plus nonempty promised practice/mastery; structured item refs, choices, and supported response kinds must survive projection
- **english-language-arts:** the actual required reading/source and a concrete writing/evidence task must be delivered; facilitator/meta-task shells do not count
- **science:** a bound question, model, data set, or runnable investigation is required; investigation materials, safe alternative, and learner response must be usable
- **social-studies:** named static source metadata/content must reach the learner; dynamic sources remain blocked until their full attachment contract is satisfied
- **health:** meaningful private scenario, instruction, activity, criteria, and equal-credit alternative; no medical/private-disclosure or adult scoring leakage
- **physical-education:** actionable movement activity with cues/steps, visible safety, feasible household equipment or no-equipment alternative, adaptation, and completion criteria
- **ready-for-life:** actionable life-skill task with the declared learner/guardian authority and equal-credit simulation; fixed/open response structure must survive
- **financial-literacy:** visible fictional parameters and both fixed/judgment work where declared; response/scoring mode and choices survive; answers and scoring locators stay adult-only
- **technology:** central model/problem/artifact/environment is supplied; code/debug tasks have a runnable starter or complete paper specification and test criteria
- **arts-and-music:** create/perform/respond task with critique criteria; model/guided/investigation modes include an actual model, excerpt, locator, or scaffold

## Negative controls

`npm run test:learner-release-gate` covers all 23 blocking classifications, including source/data/material removal, empty required work, placeholder shells, flattened choices, lost item refs, response-kind loss, adult/scoring leakage, unsafe source state, missing assessment material/workflow, unrunnable Technology, PE safety/equipment, Arts scaffold loss, and Financial Literacy answer disclosure. A positive control proves PE, Arts/Music, and Ready for Life are not forced through Math-shaped requirements.

## Release contract

The command exits nonzero whenever any blocking code remains, when population totals drift from 8,292 lessons / 699 assessments / 90 courses, or when the browser build cannot be inspected. The tracked JSON and matrix are evidence for this base; the command always recomputes from the current admitted release and generated learner payload.
