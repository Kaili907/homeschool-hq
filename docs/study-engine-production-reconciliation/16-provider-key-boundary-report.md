# Provider-key boundary report

Tutor and voice production builds use same-origin `/api/anthropic` and `/api/tts` gateways. Browser key entry is hidden in production, local key getters/setters are inert there, and direct provider endpoint/header/key-slot branches are guarded by compile-time development checks.

The production bundle scan found no matches for the direct Anthropic or ElevenLabs domains, provider authentication headers, browser provider-key feature flag, tutor key slot, voice key slot, or service-role markers covered by the scan.

Development may use explicitly enabled browser keys for local work. That capability is not a production port and cannot be promoted by configuration alone. No real provider call occurred.
