# Canonical Mathematics Production Corpus — R1

This directory is the one active Mathematics production corpus for Grades 3, 4,
5, 7, 8, 9, 10, 11, and 12. Each grade schedules exactly 180 active lessons, for
1,620 active school-day lessons total.

`active/` contains the learner package and separately stored scoring authority
for every scheduled lesson. `schedules/` is authoritative for delivery order.
`reserve/` contains four withdrawn Grade 8 Unit 10 recycle lessons for tutor or
reserve use only; `reserve-manifest.json` explicitly excludes them from school
days.

Grade 8 applies the accepted 8.EE.2 integration without changing sealed release
`1.0.0`: three correction lessons and one assessment-delivery day occupy course
days 19–22, while `u10-l10`, `u10-l13`, `u10-l14`, and `u10-l17` remain available
only as `RESERVE_TUTOR`. The active schedule is 180 days and covers all 28
official Grade 8 content standards. The Grade 8 to Grade 9 root bridge is Grade
9 Unit 1.

The upstream oracle sources, accepted Grade 8 integration evidence, exact input
tips, and validation results are retained under `evidence/`. Learner packages do
not contain answer-bearing fields. Keys remain outside the learner projection and
record their oracle or generator authority per item.

Content Repair R2 repairs nine canonical Grade 3/4 lessons whose low-entropy
prompt pools had caused duplicate suppression to omit promised practice or
mastery items. Grade 3 and Grade 4 Day 1 remain low-stakes starting-point
diagnostics, now with grade-appropriate mathematical evidence in addition to
strategy evidence. The exact before/after record is retained in
`evidence/content-repair-r2.json`.

Rebuild derived schedules, manifests, and checksums deterministically:

```bash
python3 curriculum-production/final/mathematics/build.py
```

Validate the corpus:

```bash
python3 curriculum-production/final/mathematics/validate.py
```
