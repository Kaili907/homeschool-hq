# Example payloads

The checked-in examples are synthetic and contain no real student records.

## Root examples

- [Study plan](../../fixtures/valid/study-plan.json)
- [Focus profile — insufficient data](../../fixtures/valid/focus-profile-insufficient-data.json)
- [Focus profile — established](../../fixtures/valid/focus-profile-established.json)
- [Learning evidence — low accuracy without an engagement conclusion](../../fixtures/valid/learning-evidence-low-accuracy.json)
- [Skill review schedule](../../fixtures/valid/review-schedule.json)
- [Parent/teacher controls](../../fixtures/valid/parent-teacher-controls.json)
- [Adult-private record](../../fixtures/valid/parent-teacher-private.json)

## Study-session state examples

- [Planned](../../fixtures/valid/session-planned.json)
- [Active](../../fixtures/valid/session-active.json)
- [Paused](../../fixtures/valid/session-paused.json)
- [Approved break](../../fixtures/valid/session-approved-break.json)
- [Student-requested break](../../fixtures/valid/session-student-requested-break.json)
- [Technical interruption](../../fixtures/valid/session-technical-interruption.json)
- [Completed](../../fixtures/valid/session-completed.json)
- [Abandoned](../../fixtures/valid/session-abandoned.json)

## Invalid examples

[mutations.json](../../fixtures/invalid/mutations.json) defines focused invalid
fixtures as a valid base plus JSON Pointer operations. Each case declares the
expected stable validation issue code and path. Cases cover sequencing,
references, terminal/resume rules, insufficient-data safety, low-accuracy
inference, canonical review intervals, adult caps, private-note leakage, and
adult-only visibility.

