# Security proof matrix

| Threat | Fail-closed control | Test |
|---|---|---|
| Correct-answer leakage | Learner item/result schemas contain no expected answer, index, correct-answer field, or authority locator; bounded responses are scanned in regression tests | G5 Math projection/result leakage assertions |
| Wrong item binding | Resolver requires the item in the exact trusted lesson and section | wrong item and wrong section cases return 404 |
| Wrong lesson | Trusted assignment authority and package/scoring lesson identities must both match | wrong lesson case fails closed; authority unit proof checks exact session lesson |
| Release/assignment tamper | Logical admitted ID, hosted release UUID, version, digest, exact session, and exact lesson must all agree | trusted authority test rejects altered assignment and release |
| Browser answer authority | Exact request/response schemas reject `answerIndex`, expected-answer, answer-location, and score fields | tamper table plus TypeScript parser tests |
| `answerIndex` becomes authority | Multiple choice compares selected choice text with trusted answer text; `answerIndex` is never read | conflicting-index scorer regression |
| Fabricated rubric score | Rubric mode has no numeric scoring branch and requires protected adult-review acceptance | fabricated score is rejected; valid prose returns review-required only |
| Learner certifies guardian work | Learner completion can only create guardian-attestation-required evidence | guardian case never returns certified/correct |
| Offline false correctness | Network failure produces only `PENDING_ASSESSMENT`, with null result/evidence kinds | offline regression |
| Raw-response spread | Normal evidence always says `rawResponseIncluded: false`; prose is passed only to the approved protected review port | rubric evidence excludes response while review port receives it |
| Path traversal/authority disclosure | Trusted locators must match a commit-qualified repository form and resolve beneath the production-content root; locators never enter browser output | resolver allow-list and leakage assertions |

The R1 contract intentionally does not score mastery, change curriculum,
complete Study sessions, or call hosted Supabase during repository tests.
