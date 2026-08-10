# Server-owned logical TTS voice catalog

The authenticated browser and persisted canonical profile selection use only a
bounded `academy.tts.<slug>` logical reference plus `voiceVersion`. The private
Netlify catalog owns provider, provider voice identifier, approval, status, and
cache policy. Resolution, version/status/approval checks, deployment allowlist,
and provider availability all occur before quota consumption.

The production catalog intentionally contains zero entries because this
repository has no verified audition or deployment mapping. Browser speech is
therefore the production fallback until separately approved data is supplied.
Synthetic provider mappings exist only in server tests.

`GET /api/tts/catalog` returns the authenticated sanitized projection. It never
returns provider identifiers, credentials, or server mapping details. The
client uses the projection to present catalog choices and enforce revocation or
cache-denial policy for local playback.

Historical `tutor.voiceMap` values are not rewritten. Historical browser values
continue to resolve as device-native speech. Historical raw premium values are
hidden from normal display, cannot be encoded into a gateway request, and
degrade to browser speech. New writes use tagged `tutor.voiceSelections` values.

Cache identity is `voiceRef + voiceVersion + rate + text`. A disabled global
synthesis gate blocks new provider work but not an allowed existing cache hit;
revoked or cache-denied entries never play from cache.

The profile contract migration is
`20260809150000_academy_logical_voice_profile_contract.sql`. It is additive,
validates only the new tagged field, preserves all historical rows, and has not
been applied to a hosted project.
