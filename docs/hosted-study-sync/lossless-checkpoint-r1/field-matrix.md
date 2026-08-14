# Lossless checkpoint R1 field and authority matrix

This matrix was completed before implementation. A row is one schema path family; `[]` means every repeated instance and `{…}` lists every leaf in that family. The 32 families cover every field accepted by `HostedSyncStateSnapshotR2`, `DurableStudyDocumentV1`, its referenced Study types, and the Calendar runtime record.

| # | Canonical path family (all leaves) | R2 snapshot before | hosted DB before | Classification after repair |
|---:|---|---|---|---|
| 1 | `contractVersion` | exact | absent | `DERIVABLE_FROM_CANONICAL_AUTHORITY` and stored exact |
| 2 | `identity.{householdRef,studentRef,learnerRef}` | exact | household/student server IDs plus local refs; no learner ref in checkpoint | `EXACTLY_REPRESENTED` with server-bound household/student identity |
| 3 | `sync.{serverRevision,baseRevision,operationId,idempotencyKey,operationKind,deviceRef,localSequence,createdAt}` | exact | per-session receipts/revisions only; no canonical document revision | `EXACTLY_REPRESENTED`; device timestamps are metadata, never merge authority |
| 4 | `student.{studentRef,displayName,createdAt,updatedAt,activeAssignmentRef}` | exact | absent from session hydrate | `EXACTLY_REPRESENTED` |
| 5 | `student.assignments[].{assignmentRef,lessonRef,subject,title,state,sessionRef,completedAt,createdAt,updatedAt,rawAnswerIncluded,transcriptIncluded}` | exact | selected session only | `EXACTLY_REPRESENTED` |
| 6 | `student.assignments[].progress.{completedSegmentRefs,totalSegments,lastSegmentRef,activeSeconds}` | exact | partial selected recovery checkpoint | `EXACTLY_REPRESENTED` |
| 7 | `student.assignments[].pause.{pausedAt,resumedAt,pausedSeconds,resumeSegmentRef}` | exact | only aggregate selected checkpoint pause seconds | `EXACTLY_REPRESENTED` |
| 8 | `studentProfile.{studentRef,displayName,nominalGrade,workingGradeBySubject.{subject},enabledSubjects[],createdAt,updatedAt}` | exact | absent | `EXACTLY_REPRESENTED` |
| 9 | `appUpdatedAt`, `setupCompletedAt` | exact | absent | `EXACTLY_REPRESENTED` |
| 10 | `assignments[].{record,authorityRevision}` | exact | selected assignment/session, different revision domains | `EXACTLY_REPRESENTED` |
| 11 | `assignments[].sessionIdentity.{assignmentRef,lessonRef,blockRef,sessionRef,lineageRootRef,continuationKey}` | exact | mapping has assignment/session; block/lineage absent | `EXACTLY_REPRESENTED` |
| 12 | `assignments[].completion.{kind,completedAt}` | exact | selected session completion only | `EXACTLY_REPRESENTED`; certified completion is absorbing |
| 13 | `assessmentStates[].{assignmentRef,assessmentRef,studentRef,courseRef,subject,grade,title,authorityClass,status,createdAt,updatedAt,completedAt,evidenceRefs[],authorityRevision}` | exact | selected assessment metadata; no evidence refs, scored state, or authority revision | `EXACTLY_REPRESENTED` |
| 14 | `assessmentStates[].outcome.{assessmentRecordRef,decision,assessedAt,assessorRef}` | exact | absent | `EXACTLY_REPRESENTED` |
| 15 | `rflStates[].{studentRef,assignmentRef,lessonRef,sessionRef,learnerAssertionState,learnerAssertedAt,guardianState,certifiedAt,attesterRef,evidenceMode,authorityRevision}` | exact | selected attestation except canonical revision | `EXACTLY_REPRESENTED`; certified guardian state is absorbing |
| 16 | `socialSources[].{studentRef,assignmentRef,lessonRef,readiness,sourceRef,kind,title,publisher,publishedAt,metadata[],adultAttestedAt,attachedAt,sourceRevision}` | exact | selected source without canonical kind/revision or Web R3 dynamic-source metadata authority | `EXACTLY_REPRESENTED`; metadata is validated as body-free, adult-attested source metadata and accepted sources are create-only/absorbing |
| 17 | `safetyHolds[].{holdRef,studentRef,sessionRef,reasonCode,category,source,dedupeKey,createdAt,status,acknowledgedAt,clearedAt,clearAuthority,clearerRef,logicalRevision}` | exact | selected local hold shape without category/clear authority/logical revision | `EXACTLY_REPRESENTED`; cleared holds cannot reopen |
| 18 | `privacy.{pinIncluded,bearerIncluded,rawLearnerResponseIncluded,rawTutorConversationIncluded,rawAudioIncluded,inferenceIncluded,adultAnswerAuthorityIncluded,answerMaterialIncluded}` | literal false | implicit filters | `DERIVABLE_FROM_CANONICAL_AUTHORITY`; also stored and revalidated as literal false |
| 19 | `indexedDbDocument.{schemaVersion,updatedAt,scope.householdRef,scope.learnerRef}` | exact | absent | `EXACTLY_REPRESENTED` |
| 20 | `indexedDbDocument.preferences.accessibility.{largeText,reducedMotion,noAudio,captions,transientTranscript,highContrast,oneTaskAtATime}` and `.timerPreference.{visibility,milestonesOnly}` | exact nullable authority | absent | `EXACTLY_REPRESENTED` |
| 21 | `indexedDbDocument.parentSettings.{maximumWorkMinutes,breakMinutes,timerHidden,revision}` | exact nullable authority | absent | `EXACTLY_REPRESENTED` |
| 22 | `indexedDbDocument.parentSettings.accommodations[].{accommodationRef,functionalDescription,studentMessage,maximumWorkMinutes?,breakMinutes?,timerHidden?}` | exact | absent | `EXACTLY_REPRESENTED` |
| 23 | `indexedDbDocument.parentSettings.recommendationDecisions[].{recommendationRef,decision,reasonCode}`, `.interruptions[].{blockRef,kind,at}`, `.reschedules[].{blockRef,replacementStart}`, `.adultReviewRequests[].{requestRef,audience,status,reason}` | exact minimized parent control state | absent | `EXACTLY_REPRESENTED` |
| 24 | `indexedDbDocument.calendar[].plan.{lessonRef,title,subject,skillRefs[],masteryAuthority,source}` and `.segments[].{segmentRef,title,taskType,customTaskTypeId?,estimatedMinutes,required}` | exact | lesson/segment fragments only | `EXACTLY_REPRESENTED` |
| 25 | `indexedDbDocument.calendar[].block.{schemaVersion,internalBlockId,learnerRef,title,subject?,blockType,householdTimeZone,scheduledLocalStart,scheduledStartInstant,intendedLocalDate,placementSource,estimatedDurationMinutes,actualDurationSeconds,timerVisibility,state,activeSince?,revision,lastEventAt}` | exact | selected session fragments; DB substituted UTC/default placement | `EXACTLY_REPRESENTED`; no current time or receiving template used |
| 26 | `.block.sourceIdentity.{source,externalItemId}`, `.lineage.{rootInternalBlockId,continuationKey,continuationOf?,completedBeforeOccurrence[]}`, `.canonicalTask.{taskType,customTaskTypeId?}` | exact | absent | `EXACTLY_REPRESENTED` |
| 27 | `.block.segments[].{segmentId,planOrdinal,title,canonicalTaskType,customTaskTypeId?,estimatedMinutes,required,actualActiveSeconds,elapsedActiveSecondsBeforeBlock,completedAt?}` | exact | selected completed IDs and aggregate time only | `EXACTLY_REPRESENTED` |
| 28 | `.block.resumePoint`, `.currentInterruption.resumePoint`, `.interruptionHistory[].resumePoint` each `{segmentId,segmentOrdinal,elapsedActiveSecondsInSegment,responseDraftRef?,completedSegmentIds[],remainingSegmentIds[],capturedAt}`; interruption record `{category,approvalState,interruptedAt,actor}` | exact | incompatible recovery cursor; history absent | `EXACTLY_REPRESENTED`; response draft is an opaque reference only |
| 29 | `.block.events[]`: common `{type,at,actor}` and union leaves `{segmentId,category,approvalState,fromLocalStart,toLocalStart,fromStartInstant,toStartInstant,fromIntendedLocalDate,toIntendedLocalDate,changedFields[],continuationBlockId,continuationKey}` | exact | absent | `EXACTLY_REPRESENTED` |
| 30 | `indexedDbDocument.sessions[].{scope.householdRef,scope.learnerRef,scope.sessionRef,lessonRef,segmentRef,status,updatedAt,lastAcceptedEventRef,rawAnswerIncluded,transcriptIncluded}` | exact | one hosted session with a different state vocabulary | `EXACTLY_REPRESENTED` |
| 31 | `indexedDbDocument.checkpoints[].{checkpointRef,householdRef,learnerRef,sessionRef,lessonRef,segmentRef,revision,capturedAt,completedSegmentRefs[],elapsedActiveSecondsInSegment,responseDraftRef,rawAnswerIncluded,transcriptIncluded}` | exact | one incompatible `study-core-bridge.recovery-checkpoint.v1` | `EXACTLY_REPRESENTED` |
| 32 | `indexedDbDocument.reviews[].{recommendationRef,householdRef,learnerRef,sourceEvidenceRef,lessonRef,dueDate,reasonCodes[],status,rawAnswerIncluded,transcriptIncluded}`; `.events[].{sessionRef,eventRef,semanticKey,event.eventRef,event.occurredAt,event.type,event.payload.<type-allowlisted-key>}`; `.outbox[].{proposalRef,route,evidenceRefs[],status}` | exact minimized records | absent | `EXACTLY_REPRESENTED` |

## Explicitly outside hosted authority

| Field/state family | Classification | Reason |
|---|---|---|
| PIN plaintext, `studentAccessVerifiers`, `parentAccessVerifier`, legacy `pinDigests`, PIN verifier/digest, `pinRequired` enrollment | `DEVICE_LOCAL_ONLY` | Local access control; receiving device reenrolls locally |
| Bearer/access/refresh token, authorization header, session/launch grant | `DEVICE_LOCAL_ONLY` | Ephemeral authentication, never state |
| Raw learner response bodies and response drafts | `DEVICE_LOCAL_ONLY` | Only opaque evidence/draft references may cross the boundary |
| Tutor conversation, prompts, provider output, transient transcript | `DEVICE_LOCAL_ONLY` | Not continuation authority |
| Audio/blob/media capture | `DEVICE_LOCAL_ONLY` | Forbidden private content |
| Emotional/personality/diagnostic inference | `DEVICE_LOCAL_ONLY` | Forbidden inference |
| Adult answer authority, answer keys, expected/correct answers, scoring guides, restricted rubrics | `DEVICE_LOCAL_ONLY` | Separate adult/scoring authority |
| Provider credentials/service-role secrets | `DEVICE_LOCAL_ONLY` | Server secret, never browser state |
| Sibling rows and other learners' documents | `SAFE_TO_OMIT` | The checkpoint is one explicitly mapped student; import preserves local siblings |
| Device UI selection outside the selected learner, caches, transient timers, open component state | `SAFE_TO_OMIT` | Recreated locally and has no Study continuation authority |

## Counts

- Canonical path families: **32**.
- `EXACTLY_REPRESENTED` after repair: **30 families** (two also have derivable envelope semantics).
- `DERIVABLE_FROM_CANONICAL_AUTHORITY`: **2 families** (`contractVersion`; literal-false privacy markers), both retained exact for tamper evidence.
- `MISSING_HOSTED_REPRESENTATION` before repair: **25 families**; **0 after repair**.
- `AUTHORITY_AMBIGUOUS` after classification: **0**.
- Explicit device-local forbidden/private families: **8**.
- Safe-to-omit local families: **2**.
