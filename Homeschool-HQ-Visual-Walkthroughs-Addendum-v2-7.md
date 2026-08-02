# HOMESCHOOL HQ — VISUAL WALKTHROUGHS ADDENDUM (Spec v2.7)
**Adds milestone MT-1V — upgrades MT-1's walkthroughs from narrated text to visual, example-driven teaching.**
**Build order: serial queue, FIRST after the current wave lands (before MM) — it upgrades the core daily learning loop. Touches Walkthrough.tsx, explainers, Viz; must not run parallel with anything.**

## The teaching model: I do → we do → you do
Wrong answer now triggers a three-beat sequence (beats 2–3 optional, kid-controlled):
1. **"Show me how"** — walkthrough of HER exact problem, now with a visual per step (below).
2. **"Watch another ▶"** (new, optional) — the app generates a fresh same-skill/same-difficulty problem and auto-plays its walkthrough end-to-end, visuals and voice, no input required. A worked example she just watches.
3. **"Your turn ✏️"** — the existing retry (fresh problem, same difficulty, reduced mastery weight). Unchanged.
Review mode ("Explain this one" on a correct answer) gets beat 1 with visuals; no beats 2–3.

## Per-step visuals
Extend the explain layer: each step may carry a viz descriptor rendered above the step text:
```ts
interface ExplainStep { say: string; show?: string; viz?: VizStep }
type VizStep =
  | { kind: "column"; rows: string[]; highlights: CellRef[]; annotations?: {cell: CellRef; text: string}[] } // vertical arithmetic: borrows/carries drawn ON the digits
  | { kind: "numberLine"; min: number; max: number; marks: number[]; jumps?: {from:number;to:number;label:string}[] }
  | { kind: "fractionBar"; parts: number; shaded: number; compare?: {parts:number;shaded:number} }
  | { kind: "array"; rows: number; cols: number; highlightRows?: number }
  | { kind: "equationLedger"; lines: {left:string; right:string; op?:string}[]; activeLine: number } // g6 algebra: the do-to-both-sides ledger
  | { kind: "grid" | "clock" | "ratioTable" | "shape"; /* reuse existing Viz props */ }
```
- **All numbers in a viz MUST come from the actual question** (or the generated example in beat 2) — same interpolation rule as text, fuzz-tested: no placeholder, no mismatch between viz numbers and prompt numbers.
- Column arithmetic is the flagship: add/sub with regrouping, multi-digit ×, long division render the problem vertically and each step highlights/annotates the live digits (the borrow slash, the carried 1, the brought-down digit).
- Steps that are genuinely conceptual (word-problem reasoning) may omit viz — but every skill's explainer must use viz on at least the steps where the math moves, audited per skill in review.

## Distractor-aware first step (the diagnosis line)
Generators construct wrong answers from known error patterns (swapped digits, forgot to regroup, added instead of multiplied, off-by-one denominators). Where her chosen wrong answer matches a recognizable pattern, the walkthrough's FIRST line names it kindly and specifically: "Looks like the 8 and the 5 traded places — easy slip. Let's line them up." Where no pattern matches, open with the concept line as today. Implement as an optional `diagnose(question, chosenAnswer)` per explainer; coverage target: the arithmetic-heavy skills first (g3/g4 operations, g6 decimals/equations), others fall back gracefully.

## Depth floor
Every explainer: minimum 3 steps; first step is concept-or-diagnosis (never mechanics), last step states the answer AND the one-line takeaway rule ("When the ones can't pay, the tens lend."). Audit all 33 explainers against the floor; expand the thin ones.

## Boundaries
- **Assessments remain untouched** — no walkthroughs, no visuals, no feedback in the assessment player, ever.
- Voice: each step's `say` speaks as today; visuals are per-step so speech and picture stay in sync. No dependency on MT-V (works with browser voice now, premium voice when MT-V lands).
- Escalation rule unchanged — beat 2 counts as part of one walkthrough, not a second one.
- Theme-aware styling; teens' HS practice inherits nothing here (HS explainers are a future cycle as already planned).

## Acceptance criteria
Fuzz per skill × difficulty: every viz's numbers appear in (or derive arithmetically from) the actual question; no placeholder leakage; depth floor met (≥3 steps, concept-first, takeaway-last) asserted for all 33 explainers. "Watch another" generates a distinct problem, auto-advances through all steps with voice, and returns to the retry offer. Column viz renders borrows/carries on the correct digits for a scripted set of regrouping cases. Diagnosis line appears for a seeded wrong answer matching a known distractor pattern and is absent otherwise. Review mode shows visuals, no beats 2–3. Assessment player byte-identical. All existing suites green.
