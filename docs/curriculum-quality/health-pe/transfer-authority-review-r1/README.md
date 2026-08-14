# PE Transfer-Authority Root-Cause Review R1

**Status:** complete, independent, read-only curriculum review.

**Pinned base:** `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

**Branch:** `mac/pe-transfer-authority-review-r1`

**Scope:** all 216 Grade 9–12 PE findings reported by Health/PE Depth Audit R1.

## Outcome

The reported count is reproducible, but “transfer-authority conflict” is not an
actual curriculum or Study contract term. The depth audit defines the cohort
positionally:

```js
lesson.grade >= 9 && /-l(?:0[7-9]|1[0-2])$/.test(lesson.lessonId)
```

That selects the second six-lesson pass in every one of the 36 high-school PE
units: `4 grades × 9 units × 6 lessons = 216`. The predicate does not inspect
the task, rubric, adaptation, scoring path, or Study runtime before calling the
lesson a conflict.

The architecture has only one scoring-authority kind for these lessons:
`RUBRIC`, stored in the paired server-side scoring guide. The student task
card’s `completionCriteria` is learner-facing execution guidance, not a second
scoring authority. The admitted release separately declares
`completionAuthority: LEARNER_AUTHORITY`; the Study plan is completion-only.

Independent semantic review finds:

| Classification | Severity | Count |
| --- | --- | ---: |
| `SCORING_AUTHORITY_CONFLICT` | High | 60 |
| `CONTENT_TRANSFER_CONFLICT` | Moderate | 36 |
| `FALSE_POSITIVE` | Informational | 120 |
| `METADATA_CONFLICT_ONLY` | — | 0 |
| `PROGRESSION_RISK` | — | 0 |
| `UNKNOWN` | — | 0 |
| **Total** |  | **216** |

The 60 scoring conflicts occur where the first rubric criterion requires a
live/real/high-demand condition but another adult-authority field explicitly
authorizes a mutually exclusive full-credit route. The 36 content conflicts
occur where the learner task requires an actual, scored, or extended condition
but the generated learner completion path says one described/no-score sequence
earns equal credit. The other 120 findings are false positives: transfer is
more demanding, but the authorized alternative can preserve the same transfer
condition without contradiction.

No evidence supports calling this a security issue.

## Runtime impact

| Question | Yes | No | Finding |
| --- | ---: | ---: | --- |
| Can affect learner scoring | 60 | 156 | If adult review is invoked, reviewers can apply the conflicting rubric prose differently. The trusted adapter itself never invents a rubric score. |
| Can affect learner progression | 0 | 216 | Current PE Study progression is learner-authority, completion-only, and does not wait for rubric review. |
| Metadata-only | 0 | 216 | The true findings are prose/content conflicts; the false positives have no conflict. |
| Learner-visible content affected | 96 | 120 | The student task and generated completion/adaptation path are both projected to the learner. |
| Adult authority ambiguous | 60 | 156 | Only the scoring-guide contradictions make adult scoring ambiguous. |
| Study can receive contradictory evidence | 0 | 216 | Study receives minimized completion/session state; the separate assessment seam can emit `review-required`, not competing correctness/mastery claims. |

The current default learner integration injects no assessor. Responses are
saved locally as `PENDING_ASSESSMENT`; saving every required response permits
the canonical Study segment to advance. This prevents a rubric contradiction
from programmatically blocking progression, but it does not make the 96
learner/adult prose conflicts acceptable curriculum.

## Root cause

Two independently reasonable generator families were composed without a
cross-field semantic consistency gate:

1. HS PE source generation at
   `mac/hs912-health-pe-r1@e39e2b343c41a1a800825651159e0e962d5288d7`
   writes one unit-level `secondPass` transfer condition into all six cycle-two
   `student_activity` and `success_criteria` records.
2. Final Health/PE generation preserves those source task/rubric fields while
   `src/lib/peExecution.mjs` independently injects universal one-sequence,
   described, solo, no-equipment, stop/rest, and equal-credit completion text.
3. H3 and the existing PE validator check presence, rubric kind, safety,
   privacy, provenance, and executability. They do not compare the source
   transfer demand with the injected equal-credit route.
4. The depth auditor then converted every cycle-two position into a conflict,
   producing 120 false positives alongside 96 genuine prose conflicts.

## Smallest safe repair boundary

Repair the 16 affected **unit-level second-pass families** at the canonical HS
PE source boundary (`course-data.mjs` plus the cycle-two template in
`build-courses.mjs`), regenerate the HS lessons, then regenerate the final
Health/PE corpus. Do not hand-edit 96 emitted packages and guides.

At the final projection boundary, add one semantic validator that rejects
`READY` when a preserved transfer task/rubric and an injected equal-credit path
cannot both be true. This is a guard, not the source of the curricular repair.

## Evidence

- `findings.jsonl` contains all 216 lesson decisions, exact learner/server item
  refs, expected and observed authority text, impact booleans, classification,
  severity, rationale, and source-family trace.
- `summary.json` contains exact counts, grade distribution, hashes of reviewed
  inputs, impact totals, affected unit families, and repair boundary.
- `run-review.mjs` regenerates both JSON artifacts without writing curriculum.
- `VALIDATION.md` records the exact validator/test commands and results.

`PE_TRANSFER_AUTHORITY_REVIEW_COMPLETE`
