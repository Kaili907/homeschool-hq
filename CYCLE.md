# CYCLE claim — SESSION 1 (MT-2/3)

**Cycle:** MT-2/3 — conversational tutor (typed + push-to-talk voice)
**Worktree:** ../hq-mt2 · **Branch:** mt2-conversational-tutor · **Dev port:** 5180
**Base:** master @ c38023e (v2.0-h1/ms/mtv/se-a/mt1v in history)

## Scope (Tutor-Addendum-v2-1 §MT-2 + §MT-3, with integrations)
1. Anthropic key: masked Grown-Ups field, stored EXACTLY like the ElevenLabs key
   (dedicated localStorage store outside AppState → export-excluded by construction).
   Model claude-haiku-4-5, max_tokens 300, dangerous-direct-browser-access header;
   ANTHROPIC_ENDPOINT_BASE swappable to a deploy proxy (one value).
2. Chat surface "Still stuck? Ask the tutor 💬" after beat 3 / after review, scoped
   to THAT question. Hardcoded child-safety constraints verbatim; never states the
   answer (system prompt + local answer-redaction post-filter); one hint at a time;
   ≤3 sentences; grade vocab; off-topic steer; concerning → scripted flag-Dad reply
   + parent flag. 6-exchange max → warm close-out + Needs-Dad flag. Daily cap 20/profile.
3. Voice both ways: replies speak via the MT-V adapter mathTutor slot; MT-3 push-to-
   talk mic (browser SpeechRecognition, hold-to-record, transcript approval before
   send, typing always available, graceful hide, teens typed by default).
4. Transcripts per profile in a Grown-Ups "Tutor chats" view, 60-day prune; usage
   meter (calls today/this month per girl).
5. Degradation: no key / offline / API error → napping reply; app fully functional keyless.

## Out of scope
Assessments (no tutor surface ever), MM, SE-B, MP, stars logic, MT-1V walkthrough
content, any non-tutor Grown-Ups sections.

Claim files never reach main — removed pre-merge. No merge; end at report.
