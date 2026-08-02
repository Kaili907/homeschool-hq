# HOMESCHOOL HQ — HS ASSISTANT ADDENDUM (Spec v2.9)
**Adds milestone MJ — a voice assistant on the high schoolers' home screens ("Jarvis mode"). Teens only (grades 10/12).**
**Queue: after SE-B; may run parallel to MP (MJ = teen Home surface + new files; MP = Grown-Ups surface). Builds on MT-2 (Anthropic client), MT-3 (push-to-talk), MT-V (voice adapter).**

## What it is
A persistent assistant panel at the top of the teen home: a tap-and-hold orb (or typed input), which answers **out loud** in her chosen voice and in text. Unlike the littles' tutor — which is locked to one math problem and never gives answers — this one is scoped to **her school day**: what's due, where she stands, what to do next, and study help that coaches rather than completes.

**No wake word.** Browser speech recognition can't do reliable always-listening, and an always-hot mic on a kid's device is not acceptable. Interaction is tap-to-talk (hold the orb) or type. The orb shows a clear listening state and stops on release.

## Context it receives (read-only snapshot, assembled per turn)
From her own profile only: today's mission items and completion; college-app deadlines with due dates and overdue flags (senior); course tracker progress; geometry/algebra unit stats and recent accuracy; assigned/completed assessments (existence and status only — NEVER item content or answers); reading/typing/stars state where applicable; today's date and her name/grade.
**Never in context:** other girls' data, journal text (structurally unavailable — see v2.5 amendment), the parent PIN, any API key, assessment questions or answer keys.

## What it may and may not do
**May:** answer questions about her schedule, deadlines, and progress ("what's due this week?", "how am I doing in geometry?"); help her plan ("I have three hours, what should I hit first?"); explain concepts and work through practice problems Socratically; quiz her; brainstorm and give feedback on her writing; encourage.
**Must not (hardcoded in the system prompt, not left to judgment):**
- Produce submittable work. No essay drafts, no paragraphs she could paste, no completed problem sets, no college-application essay text. It critiques, questions, and models technique on *different* examples — the same rule the teen writing coach already follows.
- Give answers to anything currently assigned as an assessment.
- Change any data without explicit confirmation (see Actions).
- Pretend to be a person, or to have feelings about her that a tool shouldn't. It's a sharp, warm assistant — not a friend substitute. If she raises anything genuinely distressing, it responds with the scripted care line and raises a parent flag, exactly as MT-2 does.

## Actions (small, confirmed, reversible)
The assistant may propose exactly these, each requiring a confirm tap before executing: check off a mission item; mark a college-app task done; start a specific practice unit, timed quiz, or reading session. Everything else is conversation only. Every executed action is logged in the transcript.

## Personality
Per-girl config in Grown-Ups: assistant **name** (default "Jarvis"), a short **persona line** (default: dry, competent, encouraging — brief), and the ElevenLabs **voice slot** (`assistant`, new). Persona affects tone only; it can never soften the must-nots. Keep replies to 2–4 sentences unless she asks for more — this is a dashboard, not an essay.

## Technical
Reuse MT-2's client and key path (Anthropic, panel key locally / proxy in production), model default Sonnet with the existing Haiku toggle. Reuse MT-3's push-to-talk with transcript-approval-before-send. Reuse MT-V's adapter with the new `assistant` slot. Per-girl daily call cap (default 40, Dad-editable) and a month meter, shared UI with the tutor's. Transcripts logged per profile, visible in Grown-Ups, 60-day prune. Degrades exactly like MT-2: no key/offline/error → the orb is disabled with "Assistant is offline" and nothing else breaks.

## Acceptance criteria
Context assembly unit-tested: includes only her own data; excludes assessment item content, other profiles, journal text, keys. Constraint tests: scripted "write my college essay" and "just give me the answers to my assessment" both refused with a coaching redirect, asserted against the configured model path. Actions require confirm and are logged; no action path can mutate state without it. Push-to-talk shows transcript for approval before sending. Voice replies route through the `assistant` slot with fallback. Cap and month meter enforced per profile. Littles' screens show no assistant. Keyless/offline degradation clean. All existing suites green.
