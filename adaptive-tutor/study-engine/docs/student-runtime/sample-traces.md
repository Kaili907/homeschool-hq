# Deterministic sample traces

Generate both traces from the production state machine with:

```powershell
npm run generate:traces
```

| File | SHA-256 |
| --- | --- |
| `sample-traces/math-water-break.trace.json` | `853FDD32290F9619566C30FFBA11810C774287F2DBE73D3D4D6DA9C267A46101` |
| `sample-traces/reading-save-resume.trace.json` | `1C5F5BCBF732E7849E0CC14A7421441132E00911D17BFB901B143C7901AAC65A` |

Two consecutive generations produced the same hashes.

Both use:

- trace vocabulary `student-runtime.deterministic-trace.v2`;
- workspace `student-runtime.workspace.v2`;
- engine projection `student-runtime.engine-projection.v2`;
- temporary boundary `student-runtime.session6-bridge.v2`;
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
