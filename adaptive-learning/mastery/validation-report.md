# Mastery engine validation report

Date: 2026-07-28  
Scope: `adaptive-learning/mastery/**`

## Result

Focused engine validation: **PASS**

Commands run from the repository root:

```powershell
npx tsc -p adaptive-learning/mastery/tsconfig.json --noEmit
node --experimental-strip-types adaptive-learning/mastery/scripts/validate.ts
```

TypeScript completed with exit code 0.

Runtime validation completed with exit code 0 and reported:

- 2 skill graphs validated;
- 18 evidence fixtures validated;
- 9 student mastery records validated;
- all 6 required states covered;
- circular prerequisite graph rejected;
- completion/assessment evidence alone did not produce mastery;
- manual override changed only effective state and appended audit history;
- unknown raw-answer property rejected;
- future schema version rejected.

## Invariants reviewed

| Invariant | Result |
|---|---|
| Canonical Study Engine ID/type compatibility | Pass — direct aliases plus compile-time assertions |
| Canonical ID pattern and 128-character limit | Pass |
| Directed edges and dangling/self/duplicate rejection | Pass |
| Circular dependency detection | Pass |
| Evidence discriminants and count/criterion consistency | Pass |
| Unknown property/raw content rejection | Pass |
| Unknown/future payload quarantine | Pass |
| Duplicate and missing evidence-reference rejection | Pass |
| Independent-performance mastery gate | Pass |
| Decay to reinforcement after policy threshold | Pass in seed fixture |
| Six required state projections | Pass |
| Manual override does not fabricate evidence | Pass |
| Append-only override audit operations | Pass |
| Student-safe explanation projection | Pass |

## Session-level gates

Repository typecheck/build, the integrated UI build, focused mastery tests,
browser/accessibility checks, scoped existing regressions, and final
ZIP/source-hash verification are recorded in
`../../tests/mastery/VALIDATION-REPORT.md`.
