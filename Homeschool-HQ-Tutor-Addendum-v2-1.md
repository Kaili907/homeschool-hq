# HOMESCHOOL HQ — TUTOR ADDENDUM (Spec v2.1)
**Companion to Homeschool-HQ-Build-Spec-v2.md · Adds milestone MT (Tutor) in three tiers**
**Build order: MT-1 can slot in any time after M1. MT-2 after M3. MT-3 last.**

## Principle
The tutor is the assistant coach; Dad is the teacher. The tutor handles the moment of a wrong answer. Repeated struggle escalates to Dad, never to more tutoring. Nothing the tutor does stores grades (gradebook Excel remains system of record).

---

## MT-1 — Scripted Walkthroughs + Voice (no API, free, offline)

Every question generator gains an `explain()` method returning an ordered array of steps, with the ACTUAL generated numbers interpolated:

```ts
interface Explanation {
  steps: { say: string; show?: string }[];  // say = spoken text, show = optional visual (highlight, SVG annotation)
}
```

Example, 3-digit subtraction 703 − 458:
1. "Let's solve it together. We start in the ones place. Can we take 8 away from 3?"
2. "Not yet! So we borrow. But the tens place has a zero, so we go to the hundreds..."
3. (each step highlights the relevant digits in the displayed problem)

**Trigger flow:** wrong answer → gentle "Not quite — want to see how it works?" button → walkthrough plays step-by-step (kid taps "next" to advance; no autoplay walls of speech) → then a fresh "try one like it" question from the same generator at same difficulty. Getting the retry right counts toward mastery at reduced weight.

**Voice:** Web Speech API `speechSynthesis`. Voice picker in Grown-Ups panel (list available system voices, save per profile — let each girl pick hers). Rate slightly slowed for the littles. Global mute toggle; text always displays alongside speech (never voice-only). Teens default to text-only with voice opt-in.

**Coverage:** write `explain()` for every grade 3 generator first, then 4, then 6. Geometry practice sets (M4) get them too — these are the highest-value ones for the teens.

**Escalation rule (build into MT-1):** same skill triggers walkthroughs 3+ times in one session, or 5+ times in a week → skill flagged "Needs Dad" on the parent dashboard and the app STOPS offering that skill in practice until Dad clears the flag (whiteboard reteach happened). This is the skill-gap-vs-careless diagnostic, automated.

**Accept when:** every live generator explains with correct interpolated numbers; retry flow works; voice plays and mutes; escalation flag appears on dashboard and gates the skill.

## MT-2 — AI Tutor via Claude API (conversational help + writing feedback)

**Setup:** Dad creates an Anthropic API key (console.anthropic.com), enters it in the Grown-Ups panel. Stored in localStorage only, never committed, never leaves the machine except to Anthropic's API. Show estimated month-to-date usage counter (count requests × rough per-request estimate).

**API call (from the browser, local family app):**
- Endpoint: `POST https://api.anthropic.com/v1/messages`
- Model: `claude-haiku-4-5` (fast + cheapest — right for this)
- Required headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`, and `anthropic-dangerous-direct-browser-access: true` (enables CORS for direct browser calls; acceptable here because this is a local family app — do NOT ship this pattern to a public deployment)
- `max_tokens: 300` (forces brevity)

**When it appears:** after an MT-1 walkthrough, a button: "Still stuck? Ask the tutor." Opens a small chat panel scoped to THAT question. Not a free-roaming chatbot — context is locked to the current problem.

**System prompt requirements (hardcode, per-profile grade interpolated):**
- You are a patient tutor for a grade-{N} student working this exact problem: {problem}. Correct answer: {answer}. Her answer: {kidAnswer}.
- NEVER state the final answer. Guide with one question or one hint at a time.
- Maximum 3 sentences per reply. Vocabulary appropriate for grade {N}.
- Warm, encouraging, zero sarcasm. If the student asks for the answer directly, cheerfully decline and offer the next-smallest hint.
- If the student says anything unrelated to the problem, gently steer back. If she seems upset or says anything concerning, reply only: "That sounds like something to talk to your dad about — let's flag him." and the app raises a parent flag.

**Session rules:** max 6 exchanges per question, then: "Let's flag this one for Dad — you've worked hard on it." (raises Needs-Dad flag). Daily cap per profile (default 20 tutor calls, editable). All transcripts saved per profile, visible in parent dashboard, auto-pruned after 60 days.

**Teen writing coach (same API, second surface):** in HS mode, a "Writing feedback" tool: paste a paragraph/essay → structured feedback (what works, top 3 improvements, one rewritten sentence as a model — never a full rewrite). Senior's version adds a college-essay mode with the same never-write-it-for-her constraint. Feedback sessions logged for Dad.

**Failure handling:** no API key / offline / API error → tutor button hidden or replies "The tutor's napping — ask Dad!" App fully functional without MT-2.

**Accept when:** tutor guides without revealing answers across 10 manual test conversations; caps + flags fire; transcripts visible to Dad; app degrades gracefully with no key.

## MT-3 — Voice Input (littles talk to the tutor)

Web Speech API `SpeechRecognition` (Chrome). Push-to-talk mic button in the tutor chat (never always-listening). Transcript shows before sending so she can see what it heard. Falls back to typing where unsupported. Teens keep keyboard default.

**Accept when:** grade-3 profile can complete a tutor exchange hands-free via push-to-talk; nothing records without the button held.

---

## Out of scope
No third-party audio/voice APIs (browser TTS/STT only) · no tutoring outside a question context · no always-on assistant · no AI-generated questions (generators stay procedural) · no AI grading of tests (photos still go to Dad's Claude workflow → grade cards → Excel).
