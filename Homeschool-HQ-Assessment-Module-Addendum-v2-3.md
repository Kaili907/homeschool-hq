# HOMESCHOOL HQ — ASSESSMENT MODULE ADDENDUM (Spec v2.3)
**Adds milestone MA (Assessments) · Companion to Build-Spec-v2, Tutor v2.1, Stars v2.2**

## Revised build order (assessments must exist before school starts)
M1 ✅ → **M2 → M3 → MA** (the pre-school-year critical path) → MS → MT-1 → M4 → MT-2 → M5 → MT-3 → M6.
Rationale: M3 gives the 4th/6th graders their adaptive Placement Quests (their placement instrument); MA gives the teens their fixed diagnostics on-screen. Stars and tutor land early September without hurting anything.

## What MA is
A **fixed-form test player**: renders a predefined question list, captures answers, auto-scores objective items against an embedded key, and produces a results report for Dad. It is NOT adaptive (that's the quest engine) and it is NOT practice (no hints, no tutor, no stars, no feedback during the test — assessment integrity).

## Source of truth for test content
Dad will place these files at repo root — transcribe their questions, keys, and section structure **verbatim** into typed banks (verify question counts match the source: 34, 15, 15, and the essay/survey items):
- `HS-Math-Full-Diagnostic.md` → test `hs-math-diagnostic` (4 sections, 34 questions)
- `HS-English-Reading-Placement.md` → tests `hs-reading` (2 passages, 15 questions — passages render on-screen above their questions), `hs-grammar` (15 items), `hs-essay` (timed writer, prompt embedded), `hs-essay-senior-b` (untimed-feel, 30-min soft timer, flagged ungraded), `hs-reading-survey` (5 free-text)
- Elementary paper packets are NOT transcribed — the 3rd/4th/6th graders use their adaptive Placement Quests (M1/M3) instead.

```ts
interface FixedTest { id: string; title: string; sections: Section[]; forGrades: string[]; }
interface Section { name: string; passage?: string; items: Item[]; }
interface Item {
  id: string; prompt: string;
  kind: "numeric" | "text" | "choice" | "longtext";
  choices?: string[]; key?: string | string[];   // key absent = human-graded
  keyNote?: string;                               // grading guidance from the MD
}
interface Attempt {
  testId: string; profileId: string; startedAt: ISODate; finishedAt?: ISODate;
  answers: Record<itemId, { value: string; skipped: boolean; msOnItem: number }>;
  autoScore?: { bySection: Record<string, {correct:number; of:number}>; gradedItems: number };
}
```

## Player requirements
- **SKIP is a first-class button on every item**, styled neutrally (not as failure). Skips record as skips, never as blanks. The intro screen states the rule verbatim: "If you genuinely don't know how to start, press SKIP. A skip tells us where the gap is; a guess hides it. This test can't be failed — only honest or dishonest."
- One item at a time, free navigation back/forward within a section, section list shows answered/skipped counts. No per-item feedback, no correct/incorrect indication, ever, during or after (results are Dad-side).
- Math answer input: plain text accepting fractions ("19/12" or "1 7/12"), decimals, negatives, "10pi"/"10π", coordinate pairs, inequalities ("x<=-3"). Auto-scorer normalizes (equivalent fractions, mixed vs improper, spacing, pi forms, >= vs ≥). Anything it can't confidently match is queued for human grading, NOT marked wrong.
- **Essay mode (`longtext`):** distraction-free full-screen editor, visible countdown (45:00), autosave every 10s to the attempt, word count, no spellcheck squiggles (set spellcheck=false — we're assessing her, not the browser). Timer expiry soft-locks the editor after a 60-second grace banner. Senior's Part 3B uses a 30:00 soft timer that warns but never locks.
- Scratch-work ritual: the math tests' intro and outro screens remind: "Use your scratch pad for all work. When you finish, Dad photographs the scratch pad." (One photo per test — the app can't see thinking; paper can.)
- Interrupted attempts resume exactly where they stopped. One completed attempt per test per profile; retakes require Dad unlock (Grown-Ups panel) and are stored as separate attempts.

## Assigning & results (Grown-Ups panel)
- Dad assigns a test to a profile → it appears as a special card on that girl's home ("📋 Placement — see Dad before starting"), gated by a Dad-entered start code so nobody starts it alone at 9pm.
- Results screen per attempt: auto-scored sections with per-item answers vs key, skips highlighted, time-on-item outliers flagged (>4 min or <5 s), human-graded items listed with the girl's typed answers ready to review.
- **Export report**: one click produces a clean plain-text/markdown report of the entire attempt (every question id, her verbatim answer, skip flags, auto-scores, timings) — this is what Dad uploads to Claude for grading and curriculum-building, replacing photographed answer sheets. Also included in the global JSON backup.
- Kids see only: "Finished! Nice work — Dad has it from here." Stars are NOT earned on assessments (Stars spec rule 3 — enforce here too).

## Acceptance criteria
All transcribed tests match source question counts and keys · answer normalizer passes a table of equivalence tests (fractions/mixed/pi/inequality forms) · SKIP recorded distinctly from blank and from wrong · essay autosaves survive a mid-test reload · a full hs-math-diagnostic run auto-scores sections correctly against a scripted answer set including deliberate skips · export report contains every answer verbatim · no feedback leaks to the kid during or after · retake requires parent unlock.
