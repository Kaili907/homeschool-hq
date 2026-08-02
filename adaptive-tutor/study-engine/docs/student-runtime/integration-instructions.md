# Session 7 local integration instructions

## Purpose and boundary

This browser-only package joins the verified Card 1 contracts, Session 2
algorithms, Session 3 Study UX, and Card 5 `DEC-012` policy through Session
7-owned adapters.

It does not connect to calendar/parent runtime, authentication, identity,
Supabase, a database, cloud storage, production systems, GitHub, or deployment.

Tutor Core v0.2 and a genuine Session 6 bridge are absent. The implementation
therefore uses the clearly versioned temporary boundary at
`src/bridges/session6Bridge.v2.ts`. Its bound `continue`/`reteach` receipt is a
lab routing fixture only; mastery and misconception authority are withheld.
The v1 bridge file is a path shim and does not accept the v1 wire protocol.

## Install and run

From the repository root:

```powershell
Set-Location adaptive-tutor/study-engine/integration-labs/student-runtime
npm ci
npm run dev -- --port 4327
```

Open `http://127.0.0.1:4327`.

Drafts and resume envelopes stay in that browser’s local storage. Use the home
reset control or clear site storage between unrelated demonstrations.

## Parent and accommodation mock inputs

Open **Parent + accommodation mock settings** to set:

- timer mode;
- maximum duration;
- break minimum/default/maximum and required breaks;
- reduced motion, no audio, large text, read aloud, and speech input;
- parent manual override and accommodation maximum.

Resolution follows verified Card 5 `DEC-012`: version/integrity/authorization
gates; safety and required-accommodation constraints; authorized adult hard
maximum; feasible interval or manual review; authorized manual target;
accepted evidence-sufficient engine target; established target; grade default;
then clamping with reason-coded provenance.

## Required demonstrations

### Grade 5 mathematics

1. Start mathematics and choose **Ready to begin**.
2. Complete retrieval, visual explanation, and the guided example.
3. Enter work in the independent attempt.
4. Choose **I need a break**, select **Get water**, then return.
5. Confirm the same canonical segment and entered work are restored.
6. Complete reflection and the exit ticket.
7. Inspect the learner-local review recommendation and evidence-gated pacing
   result.

### Grade 5 reading

1. Complete retrieval, teaching support, guided response, and independent
   response.
2. Choose low confidence and verify supportive reason-coded Jarvis language.
3. Enter the exit-ticket choice, then choose **Save and exit**.
4. Refresh and choose **Resume exact step**.
5. Confirm the exit-ticket position and selected response are restored.

### Adversarial lab

Choose **Run adversarial probes**. Seven visible outcomes cover forged
completion, duplicate completion/review commands, PII/raw-answer/prompt
injection minimization, unsupported-version quarantine, blame-language
rejection, pacing-increase capping, and repeated non-punitive breaks with an
adult-review signal.

Add `?media=missing` to exercise the deterministic missing-media text path.

## Validate

```powershell
npm run typecheck
npm test -- --reporter=dot
npm run test:browser
npm run generate:traces
npm run build
```

The browser suite starts or reuses a local server on port 4327. It covers
desktop Chromium, Pixel 7 emulation, a 320×667 task-first flow, keyboard-only
operation, Axe, timer modes, reduced motion, large text, no audio, unavailable
speech, missing media, refresh loops, stale tokens, and all demonstrations.

`npm run generate:traces` rewrites only the two aggregate trace files in
`docs/student-runtime/sample-traces`. Generate twice and compare SHA-256 values
when auditing determinism.

## Replace the temporary bridge

Do not silently change its exported version. Follow the exact twelve-step
procedure in `provisional-adapter-retirement-report.md`: verify the real
packages, add a new versioned adapter, preserve strict ID/revision binding and
privacy, map only authoritative Tutor Core fields, run negative/parity tests,
retain migration/quarantine, then switch the composition root.
