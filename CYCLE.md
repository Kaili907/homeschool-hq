# CYCLE — SESSION 4 (SE-A)

**Claim of record.** This branch (`se-a-typing`, worktree `../hq-se-a`) is
SESSION 4's local claim for wave-2 parallel dispatch. No push; local branch
containing this file is the claim.

- **Module:** typing trainer "MK" for grades 3/4/6.
- **Worktree:** `../hq-se-a`
- **Branch:** `se-a-typing`
- **Dev port:** 5177 (launch.json entry `hq-se-a`, 8.3 parent path)
- **Base:** master @ ce330a9 (tags v2.0-m1..mt1)

## Scope
New files under `src/typing/**` and `src/components/typing/**`.
Shared-file footprint = `src/App.tsx` mount points ONLY (Screen union + one
Home card + one screen branch).

## Strictly out of scope
- `src/missions.ts` / mission templates (mission auto-check integration is
  DEFERRED to SE-B)
- Grown-Ups panel, attendance logging, service hours, stars logic
- tutor/voice files, assessment files
- schemaVersion bump (typing state = additive OPTIONAL Profile field with
  runtime defaults)

## Standing rules honored
- Functional state updates (prev => next) for every new write; drill finish
  composes record + advance into ONE patch (stale-base double-setState lesson).
- H1 (repo state conversion) merges before SE-A — expect a rebase over it.
- Delegate file-disjoint authoring to subagents; schema / shared-file /
  integration / gates / report stay in the main thread.

End at report. No merge.
