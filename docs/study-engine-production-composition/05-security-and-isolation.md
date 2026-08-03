# Sentinel, provider boundary, and preview isolation

## Sentinel retirement classification

| Reference class | Result |
|---|---|
| Production | Rejected. A verified academic runtime must be production-branded, accept verified identity, and declare `containsSyntheticLearnerSentinel: false`. |
| Development preview | Frozen `learner:local-release-candidate` may remain behind `import.meta.env.DEV`, feature flag, and explicit preview opt-in. |
| Test | Synthetic learner/household/session/calendar/review/parent identifiers remain test-only. |
| Documentation/custody | Historical reports may name the sentinel to explain why RC1 cannot be promoted. |

Production port branding rejects implementation IDs that advertise synthetic/demo/local/test/preview/mock/noop provenance. The production bundle scan omits the RC1 sentinel, local synthetic learner prefix, preview-only markers, and Session 12 forced-outcome marker. No production persistence, checkpoint, review, calendar, ledger, safety, parent settings, proposal, or outbox path can receive the preview composition.

## Provider-key boundary

Production `import.meta.env.PROD` overrides `VITE_USE_PROXY=false` and `VITE_ALLOW_BROWSER_PROVIDER_KEYS=true`:

- Tutor endpoint is `/api/anthropic` and requires a verified Supabase bearer.
- Voice endpoint is `/api/tts` and requires a verified Supabase bearer.
- Direct `api.anthropic.com` and `api.elevenlabs.io` client requests are disabled.
- Tutor and voice key getters/setters return no production key and use no production key storage slot.
- Native provider headers and provider URLs are absent from the production bundle.
- Synthetic build-time secret markers and provider environment-variable names are absent from the production bundle.

The static hostile-build test scans the actual minified Vite output while explicitly requesting unsafe flags. It confirms only same-origin gateway routes survive. No external provider was called.

## Preview isolation

The local port loader is a development-only dynamic import. Preview composition additionally requires the Study feature flag and explicit preview opt-in. A production build compiles that loader to `null`, so a browser flag cannot create preview ports or seed synthetic data.

Production and preview composition roots are separate. The production root has no import path to local ports and recognizes only module-private brands. Preview authority and browser-shaped authority objects fail production identity checks. Preview data cannot enter production persistence, safety, adult review, parent evidence, or audit through a cast or recovered symbol.

The legacy application still has a local learner PIN and local profile store outside the new Study production identity flow. Session 16 does not promote those values: production Study uses the opaque verified-session contract, and the new client never persists a PIN or raw learner-session reference. Retirement of legacy host storage is a separate host-wide policy decision.
