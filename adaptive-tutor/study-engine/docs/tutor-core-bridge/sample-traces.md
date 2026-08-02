# Sample Trace Guide

The machine-readable source is
`bridges/tutor-core/traces/sample-traces.json`. It contains 16 deterministic,
privacy-minimal traces:

1. Math misconception: diagnostic evidence → visual teaching → guided practice
   → independent attempt → minimized Study evidence.
2. Reading prerequisite request: Core graph validates, but the bridge
   withholds a gap/remediation claim because v0.2 has no result envelope;
   Study receives `collect-more-evidence`.
3. Correct guided response followed by failed independent work: guided success
   is not promoted to mastery.
4. Correct work with low confidence: review recommendation, not mastery
   failure.
5. Urgent safety: pre-Core stop → fixed learner message → proposed adult hook;
   zero Tutor submissions.
6. Missing voice: visible caption/fallback keeps lesson usable.
7. Missing media: readable visual alternative keeps lesson usable.
8. Unknown visual command: command not executed; valid `add-text` fallback.
9. Unsupported version: metadata-only quarantine; no evidence.
10. Approved break: preserved as neutral Study state; no mastery effect.
11. Tutor review to Study scheduling: Study owns local review date.
12. Adult-private note: removal action; no learner projection content.
13. Raw answer: aggregate counts only.
14. Email address: direct contact detail absent from projection.
15. Stale checkpoint: quarantine; resume stopped.
16. Duplicate event: identical replay is a no-op; conflicting replay
    quarantines.

The trace file deliberately contains no raw test answer, transcript, name,
email address, credential, diagnosis statement, or adult note body.
