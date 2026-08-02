# HOMESCHOOL HQ — READING FLUENCY ADDENDUM (Spec v2.8)
**Adds milestone MR (Reading) — read-aloud sessions with WCPM tracking, stumble detection, and tap-to-pronounce.**
**Queue: after MT-2/3 (shares its SpeechRecognition plumbing and the MT-V speak adapter). Grades 3/4/6.**

## The kid experience
From her Home: **📖 Reading** → today's passage displays large and clean → she taps **🎙 Start**, reads aloud, taps done (or the 1-minute timer version for fluency-check days). While reading or after: **tap any word to hear it** — spoken slowly in her tutor's voice (MT-V adapter; ElevenLabs when mapped, browser otherwise), tap again for syllable-paced ("won-der-ful"). After the session: gentle summary — words read, time, "words we practiced" list — **never a red-marked failure screen**; stumbled words become tomorrow's warm-up row.

## Measurement design (honesty built in)
- **v1 engine — browser SpeechRecognition + alignment:** continuous recognition transcribes her reading; a sequence-alignment pass against the passage text yields approximate words-correct, skips, and stumble candidates. WCPM = aligned-correct ÷ minutes.
- **Label it what it is:** the UI and Grown-Ups both display "estimated" WCPM; trend charts are the product, single readings are noise. Recognition requires being online; offline sessions still run as **timer + tap-to-pronounce + Dad-scored** (a simple "how many words correct?" entry field), so travel reading never breaks.
- **Stumble detection:** words with low alignment confidence, retries (same word region repeated), or long pauses get flagged as practice words — presented as "words to practice," never "words you got wrong" (recognition isn't reliable enough to accuse).
- **v2 engine — Azure Pronunciation Assessment (optional, flag-gated):** purpose-built per-word accuracy/fluency scoring for oral reading. Free tier covers family volume. Adapter-pattern like MT-V: `RecognitionProvider = azure | browser`, Azure key panel-entered (same export-excluded store), silent fallback to v1. Ship the seam in this cycle; wire Azure in a follow-up micro-cycle when Dad creates the (free) resource.
- **Calibration ritual:** Grown-Ups shows a reminder every ~2 weeks: "Manual 1-minute check — enter Dad-counted WCPM," stored alongside estimates so the trend chart carries both series. Dad's number is ground truth; the estimate is the everyday proxy.

## Passages
- Content lives in `curriculum/reading/` as markdown passage banks per grade: original authored passages (no imported copyrighted text), leveled by grade with word counts, ~36+ per grade so dailies don't repeat within a quarter. **Claude authors the banks** (delivered as content files, same pipeline as Mindset lessons); the parser ingests them like other curriculum content.
- Fluency-check days (Fridays) use a fresh unseen passage; dailies may reuse with spacing.
- Benchmarks (displayed to Dad only, never as a kid-facing bar): entering-year ≈ g3 ~80, g4 ~95, g6 ~130 WCPM, year-end targets a band above — shown as trend context lines on the Grown-Ups chart.

## Data & surfaces
`profile.reading` (optional field): sessions log {date, passageId, mode: estimated|assessed|manual, wcpm, wordsPracticed[], duration}. Kid sees: streak of reading days, "words I conquered" (practice words later read cleanly — celebrate these). Grown-Ups (folds into MP's Status later): per-girl WCPM trend chart with benchmark band, practice-word frequency list (a recurring word across sessions = phonics signal for the grade cards), calibration entries. Mission integration: "📖 Reading" auto-checks the existing read-to-self mission item on session completion (SE-B owns template text; this cycle only fires the existing auto hook pattern).

## Privacy & recording rules
Mic captures ONLY during an active session she started; hold-to-read is not required (continuous during session) but a visible 🔴 reading indicator shows whenever recognition is live, and stopping is one tap. **No audio is stored ever** — only transcript alignment results. States this plainly on the first-run screen.

## Boundaries
Assessments untouched. Tutor escalation untouched (reading has its own gentle loop, no Needs-Dad gating in v1 — persistent same-word stumbles surface in Grown-Ups as information, not locks). Teens excluded (their reading program is book-based by design). No stars beyond normal mission completion.

## Acceptance criteria
Alignment unit-tested against scripted transcripts (perfect read, skipped line, repeated word, recognizer-substitution) producing expected WCPM ± tolerance and correct practice-word flags. Tap-to-pronounce speaks the tapped word (and syllable mode) through the speak adapter. Offline mode runs timer + manual entry with recognition UI hidden. Estimated label present everywhere a number renders. Session logs persist (functional updates); mission auto-check fires; no audio persisted (test asserts no blob storage from reading paths). Passage parser ingests the bank format and never serves a repeat within its spacing window. All existing suites green.
