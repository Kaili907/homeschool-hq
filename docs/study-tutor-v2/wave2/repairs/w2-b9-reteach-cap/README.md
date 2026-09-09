# W2-B9 reteach loop-cap terminal semantics repair

Session: `STUDY-TUTOR-V2-W2-B9`

At the effective repeated-reteach limit, Tutor now returns a terminal reteach
result:

- `status: "withheld"`;
- `source: "none"`;
- reason `REPEATED_RETEACH_LOOP_CAP_REACHED`;
- zero steps and zero reviewed-content references;
- `studyDecisionRequired: true`;
- no mastery, working-level, sequencing, assignment, progress, grade, course,
  or curriculum-route mutation authority; and
- no automatic escalation action.

The loop-cap reason has a dedicated proposal builder and is excluded from the
reviewed-static fallback builder's accepted reason type. This keeps terminal
loop handling distinct from dependency degradation. Below the cap, an adaptive
dependency outage still produces the existing bounded, reviewed static
fallback proposal for Study to decide.

Safety holds and active graded/mastery assessment holds remain higher-priority
hard stops with their own reason codes. Repeated calls with the same capped
request return the same terminal value and invoke neither reteach dependency.
