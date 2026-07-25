# Academy AI and TTS gateway contract

The deployed Academy uses authenticated, same-origin Netlify gateways for
Anthropic and ElevenLabs. The gateways are not generic provider proxies: every
upstream URL, model, prompt, token setting, voice, and output setting is chosen
or allowlisted by the server.

## Runtime configuration

The functions require:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY`, or the existing
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values with Functions runtime
  scope.
- `ANTHROPIC_API_KEY` for the AI gateway.
- `ELEVENLABS_API_KEY` for TTS.
- `ELEVENLABS_ALLOWED_VOICE_IDS`, a comma-separated allowlist of the small set
  of voice IDs approved for the Academy.

`ACADEMY_AI_ENABLED=false` and `ACADEMY_TTS_ENABLED=false` are optional
administrator kill switches. Missing keys, missing Supabase configuration, or
an empty TTS voice allowlist fail closed.

The Supabase anon key is public by design. A service-role key is neither needed
nor accepted by the browser contract.

## Authentication

Both gateways require:

```http
Authorization: Bearer <supabase-access-token>
```

For every request, the function calls the configured Supabase project's fixed
`/auth/v1/user` endpoint with the bearer token and public anon key. A successful
top-level user `id` is the verified household identity used by the repository's
current RLS policy. Request bodies do not contain—and the functions never
trust—user IDs, household IDs, or profile IDs.

Invalid or expired tokens return `401`. A Supabase outage or missing server
configuration returns `503`; token details and upstream bodies are never
returned.

## Anthropic

Endpoint:

```text
POST /api/anthropic/v1/messages
```

Exact envelope:

```json
{
  "mode": "tutor",
  "modelTier": "sonnet",
  "context": {
    "grade": "3",
    "problem": "365 - 128 = ?",
    "correctAnswer": "237",
    "studentAnswer": "243",
    "graded": false
  },
  "messages": [{ "role": "user", "content": "Can I have one hint?" }]
}
```

Allowed modes are `tutor` and `jarvis`; allowed logical tiers are `sonnet` and
`haiku`. The server maps those tiers to its fixed model allowlist. Provider
model IDs, `system`, `max_tokens`, tools, sampling settings, metadata, and
unknown fields are rejected.

Tutor context is question-scoped and explicitly rejects `graded: true`. Its
static server policy provides hints one step at a time, refuses assessed or
submittable work, limits replies to three short sentences, and never reveals
the `correctAnswer`. The answer is retained only for response leak detection
and is omitted from the Anthropic request entirely. A server answer-leak filter
supplements the existing client filter.

Jarvis accepts only bounded school-day data: teen grade, date, mission status,
deadlines, course/practice aggregates, assessment title/status, and confirmable
action key/label pairs. A strict `assistant` object preserves the configured
display name (40 characters) and tone preference (160 characters); both are
serialized as untrusted data and can affect only label/surface tone. Jarvis
accepts no assessment items, answers, start codes, journal text, profile IDs,
arbitrary prompt, assistant policy instruction, or action target. Its static
server policy prohibits assessment answers and submittable work and permits
only confirm-gated action keys.

The provider system string is static and server-owned. Validated context is
serialized into an explicitly untrusted data envelope in the final user
message, so client text never becomes a system instruction.

The current question-scoped Tutor architecture has no server-side assignment
record that can prove a practice problem is ungraded. The gateway denies
`graded: true`, sends no fixed-assessment content, and applies the static
assessment-refusal policy on every request; trusted assignment verification
requires a later data-model session rather than trusting an added client ID.

Limits:

- decoded request body: 32 KiB;
- conversation messages: 1–12;
- each message: 2,000 characters;
- aggregate message text: 8,000 characters;
- Tutor problem: 1,000 characters;
- Tutor answer fields: 200 characters;
- context collections: at most 24 entries each;
- Tutor output: 300 tokens;
- Jarvis output: 400 tokens.

Success is always:

```json
{ "text": "bounded provider reply" }
```

Provider IDs, usage, stop reasons, errors, and other internals are discarded.

## ElevenLabs TTS

Endpoint:

```text
POST /api/tts/synthesize
```

Exact body:

```json
{
  "text": "Let's work through one small step.",
  "voiceId": "approved-voice-id"
}
```

All other paths and query strings are rejected. `voiceId` must match the
server-owned `ELEVENLABS_ALLOWED_VOICE_IDS` allowlist. Provider model, output
format, voice settings, URL/path, latency, seed, and unknown fields are
rejected.

Limits:

- decoded request body: 8 KiB;
- text: 1–1,000 characters;
- voice ID: at most 64 characters using letters, numbers, `_`, or `-`;
- returned MP3: at most 4 MiB before base64 encoding.

The function calls one fixed ElevenLabs text-to-speech endpoint with a
server-owned model and MP3 format. It accepts only `audio/mpeg` upstream and
returns base64-encoded MP3 with `private, no-store` and `nosniff` headers.

## Errors and usage controls

Errors use a stable minimal shape:

```json
{ "error": { "code": "invalid_request" } }
```

Status codes distinguish malformed/invalid input (`400`), unauthenticated
requests (`401`), graded assistance (`403`), unknown operations (`404`), wrong
methods (`405`), oversized bodies (`413`), unsupported content types (`415`),
provider throttling (`429`), provider failures (`502`), and unavailable or
disabled gateways (`503`).

This session enforces per-request byte, text, history, output-token, model, and
voice limits. Existing browser counters remain user-experience indicators and
are not security controls. Durable per-household Tutor, Jarvis, and TTS quotas
remain deferred because they require an atomic database-backed ledger keyed by
the verified Supabase user. No in-memory serverless limiter is used.

Local development may still call providers directly with the family's locally
stored keys. Production builds use the authenticated proxy contract; direct
mode is not presented as a production security boundary.

The gateway client intentionally does not refresh Supabase sessions in this
file-disjoint change. It uses only the currently stored, unexpired access token
and fails closed after expiry. Canonical same-tab refresh propagation is
deferred to the active household-sync work; rotating a refresh token here would
leave that session's in-memory state stale.
