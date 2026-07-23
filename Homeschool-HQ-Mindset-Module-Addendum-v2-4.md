# HOMESCHOOL HQ — MINDSET MODULE ADDENDUM (Spec v2.4)
**Adds milestone MM (Mindset) · Self-directed replacement for the Dad-led Competitor's Mind curriculum**
**Build order: MM slots after MS (both are light builds on top of M2's mission system). Current order: M3 → MA → MS → MM → MT-1 → M4 → ...**

## What MM is
A weekly self-guided mindset lesson, delivered in-app, completed alone by each girl. One lesson per week, unlocking Fridays, appearing as a Morning Mission item ("🧠 Mindset lesson") that auto-checks on completion. 5–10 minutes. **Never graded, never quizzed, no right answers.**

## Content source
Dad places `Mindset-Lessons-Q1.md` at repo root (Q2–Q4 files will arrive before each quarter). Transcribe verbatim into a typed content bank. Each week contains: core lesson text (written for the 6th grader's level), a littles variant (grades 3–4), a teens extension, one weekly habit, and reflection prompts per band.

```ts
interface MindsetWeek {
  week: number; title: string;
  core: string;            // 6th grade default
  littles: string;         // replaces core for playful-theme profiles
  teensExtra?: string;     // appended after core for teen profiles
  habit: string;           // "try this at practice this week"
  reflectLittles: { prompt: string; kind: "emoji" | "oneword" };
  reflect: string[];       // typed journal prompts, 6th+
}
```

## Player requirements
- **Weekly unlock:** week N available from the Nth Friday of the school year (start date set in Grown-Ups panel); earlier weeks stay revisitable, future weeks locked. No binging ahead — one idea per week is the pedagogy.
- **Littles experience:** lesson displays in large type AND auto-offers read-aloud via speechSynthesis (same voice settings as MT-1). Reflection = tap an emoji or type one word. Total interaction under 5 minutes.
- **6th + teens:** read, then journal. Teens see core + extension. Journal entries support multiple paragraphs, autosave.
- **The habit card:** after the lesson, the week's habit shows as a simple card on her home screen all week ("This week: volunteer first for one thing at practice"). Not tracked, not checked — just present.
- **PRIVACY (load-bearing):** journal entries are private to the profile. The Grown-Ups panel shows completion status ONLY (week done / not done) — no entry content, no excerpts, no word counts. State this to the girls in the module's intro screen: "Your journal is yours. Dad sees that you finished, never what you wrote." Entries are stored in the profile and included in encrypted-in-spirit form in exports: exclude journal text from the standard export-all; a separate per-profile "export MY journal" button lives inside the girl's own signed-in session.
- **Completion** = lesson viewed to the end + reflection submitted (emoji counts). Fires the mission auto-check. Mission completion stars apply normally (MS); the lesson itself awards nothing extra — reflection is not a performance.
- Week 27 ("my toughest loss") and any similarly personal prompts render with an explicit skip option: "Write it, or just think it — tapping done is enough." Never force disclosure to a text box.
- Tone/UI: calm, minimal, no confetti in this module for any theme — including the littles. This is the quiet corner of the app.

## Acceptance criteria
Weekly unlock math correct against a configurable start date · littles get variant text + working read-aloud + emoji reflection · teens get core + extension + journal with autosave · Grown-Ups shows completion only, and no code path exposes journal text to the panel or the standard export · mission auto-check fires on completion · locked weeks inaccessible by navigation or state editing · lesson content matches source file verbatim.
