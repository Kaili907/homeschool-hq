# Unified state diagram

```mermaid
stateDiagram-v2
  [*] --> CalendarReady
  CalendarReady --> CheckIn: launch
  CheckIn --> SafetyGate: learner input
  SafetyGate --> AdultReviewProposed: urgent / uncertain / invalid
  SafetyGate --> TutorAuthorized: clear + one-time permit
  TutorAuthorized --> CoreInteraction: consume permit
  CoreInteraction --> Quarantined: invalid Core event / collision
  CoreInteraction --> LedgerAccepted: valid unique event
  LedgerAccepted --> StudyProjected: minimized projection
  StudyProjected --> Recommendation
  Recommendation --> Checkpointed: pause / break / save
  Checkpointed --> SafetyGate: exact validated resume
  Recommendation --> Completed: exit ticket
  Completed --> ReviewQueued: idempotent proposal
  ReviewQueued --> CalendarPlaced: explicit local date + timezone
  CalendarPlaced --> ParentEvidence
  ParentEvidence --> [*]
  AdultReviewProposed --> [*]
  Quarantined --> [*]
```

Academic processing cannot bypass the safety gate, permit, Core validation, or accepted-event ledger. A proposed adult-review or outbox item is never represented as delivered.
