# HOMESCHOOL HQ — PREMIUM VOICE ADDENDUM (Spec v2.5)
**Adds milestone MT-V (Voice) · Upgrades MT-1's speech from browser TTS to ElevenLabs, with per-subject voices**
**Build order: wave 2, after MS and MM (MM's read-aloud should exist so it can ride this adapter). Provider: ElevenLabs (Creator tier). Do not remove browser TTS — it becomes the fallback.**

## Architecture: one adapter, ranked providers
Replace direct `speechSynthesis` calls in `src/tutor/voice.ts` with a provider adapter:

```ts
interface VoiceProvider { id: "elevenlabs" | "browser"; speak(req: SpeakRequest): Promise<void>; available(): boolean; }
interface SpeakRequest { text: string; voiceRef: string; rate?: number; }
```

Resolution order per utterance: **cache → ElevenLabs (key present + online) → browser TTS**. Failures degrade silently down the chain — a kid mid-walkthrough must never see an error because wifi dropped; she just hears the browser voice. Log provider used per utterance (dev only).

## ElevenLabs provider
- REST `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `xi-api-key` header; request mp3 output; play via a single shared `Audio` element (respects existing mute/replay controls).
- Model: use the current low-latency/turbo model id; put the model id in ONE constant with a comment, since ElevenLabs revs models.
- Key + settings stored in `AppState` (Grown-Ups panel entry field, masked display, "Test key" button that synthesizes one short phrase). NEVER committed, NEVER in exports. Same rule as MT-2: acceptable on the family machine; after public deploy, calls route through the serverless proxy (build that in the deploy cycle, not here — but keep the provider's fetch layer swappable to a proxy URL via one config value).
- **Usage guard:** track characters synthesized this month (local counter, resets monthly). Grown-Ups shows month-to-date usage vs. a Dad-set soft cap (default 90,000). At cap: adapter quietly stops choosing ElevenLabs and falls back to browser TTS for the rest of the month; banner in Grown-Ups only, never kid-facing.

## Caching (this is what makes Creator tier last)
- Cache key: hash(voiceRef + rate + text). Store mp3 blobs in IndexedDB (localStorage is too small for audio).
- Cache before network, always. Static/recurring lines (offer prompts, step templates that repeat verbatim, mindset lesson paragraphs, celebration phrases) will converge to ~100% cache hits.
- Cap the cache (default 200 MB, LRU eviction). Grown-Ups: cache size display + clear button.
- **Pre-warm command** in Grown-Ups: "Download voices for offline" synthesizes and caches every static line in the app (mindset lessons, fixed tutor phrases) for the currently-mapped voices — pressing this before a trip makes premium voices work offline for all static content. Dynamic walkthrough text still falls back to browser TTS when offline; that's correct behavior, not a bug.

## Per-girl, per-subject voice map (replaces the single per-profile voice)
```ts
type VoiceSlot = "mathTutor" | "mindset" | "japanese" | "default";
// profile.tutor.voiceMap: Partial<Record<VoiceSlot, { provider: "elevenlabs"|"browser"; ref: string; label: string }>>
```
- Grown-Ups → Tutor & Voice becomes a small grid: girl × slot, each cell a picker + ▶ test. ElevenLabs voices are entered as voice-ID + friendly label (Dad casts them in the ElevenLabs library and pastes IDs; provide 3–4 suggested slots pre-labeled). Browser voices remain pickable per slot.
- Unset slots fall through: slot → default slot → browser default. Existing single-voice settings migrate into the `default` slot (additive field, no schemaVersion bump).
- `japanese` slot exists now but is unused until the hiragana trainer ships; Azure may later join the provider enum for it.
- Teens keep their voice-off default and opt-in exactly as MT-1 shipped.

## Touch points (small, additive)
`voice.ts` (adapter + providers + cache), `tutorState.ts` (voiceMap + usage counter, optional fields), `TutorPanel.tsx` (grid UI, key field, usage meter, pre-warm, cache controls), MM's read-aloud call site once MM exists (route through the adapter with slot "mindset"). Nothing else. Walkthrough/QuizSession code should not change — they already call the speak layer.

## Acceptance criteria
Adapter chain proven: with a valid key, walkthrough audio is ElevenLabs; kill the network mid-session → next utterance is browser TTS with no error surfaced; restore → back to ElevenLabs. Cache: same line twice = one API call (verified via counter); pre-warm populates cache and static lines then play offline in premium voice. Usage counter increments by actual characters sent and the soft cap flips the chain to browser-only. Voice map: two different slots for one girl demonstrably use two different voices; unset slot falls through correctly; MT-1's teen opt-in and mute behavior unchanged. Key never appears in exports or commits (test asserts export excludes it). All existing suites still green.
