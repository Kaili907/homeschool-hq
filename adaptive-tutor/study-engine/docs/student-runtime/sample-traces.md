# Deterministic sample traces

Generate both traces from the production state machine with:

```powershell
npm run generate:traces
```

| File | SHA-256 |
| --- | --- |
| `sample-traces/math-water-break.trace.json` | `140D2C34DBA75EA4ACF32EF47D5782AA23391D00B0FE41795F6B18B13C6EC709` |
| `sample-traces/reading-save-resume.trace.json` | `246D94C497B24D3A656872E28F83D881555F8DA1B3AC737460A95111534D009A` |

Two consecutive generations produced the same hashes.

Both use:

- trace vocabulary `student-runtime.deterministic-trace.r2`;
- workspace `student-runtime.workspace.v2`;
- engine projection `student-runtime.engine-projection.v2`;
- accepted Session 6-R2 bridge package `1.0.1`, contract `1`;
- seven canonical `SegmentId` values, also used as the seven task references;
- canonical events, idempotency records, bound Tutor receipts, aggregate
  evidence, review records, duration-policy provenance, and safe message reason
  codes.

The math trace proves an approved water break with
`countsAsFailure: false`, exact independent-attempt resume, all seven canonical
segment completions, one learner-local review record, and an evidence-safe
`insufficient_data` pacing result from one comparable session. It does not
manufacture the four-session history that would be needed to change pacing.

The reading trace proves low-confidence support, intentional pause, refresh,
exact exit-ticket draft resume, aggregate evidence, and a learner-local review
recommendation.

Raw answers and PII are absent. Exact draft preservation is represented only
by a local boolean comparison before serialization. Generation fails if any
known raw fixture value appears in the serialized output.
