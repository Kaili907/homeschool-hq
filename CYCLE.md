# CYCLE — Academy AI/TTS Gateway Security

**Session:** ACADEMY — SESSION 1
**Branch:** `security/academy-ai-gateway`
**Worktree:** `.worktrees/academy-ai-gateway`
**Base:** `origin/master` @ `15644974628ead6704c1e97e959cdbd801fdd1b3`

## Scope

Authenticate and strictly constrain the existing Anthropic and ElevenLabs
Netlify gateways. Verify Supabase bearer tokens server-side, derive the
household identity only from the verified token, move model/prompt/token/voice
policy to the server, enforce bounded request schemas, make only the minimum
disjoint client transport updates, and add mocked contract tests.

## File-disjoint boundary

Do not modify other active worktrees or their owned files, including
`src/tutor/tutorState.ts`, `netlify.toml`, package-manager files,
`src/reading/**`, `netlify/functions/azure-speech.js`, sync-session
implementation files, or identity migrations. No reading mode, migration,
dependency change, UI redesign, merge, or production deployment is authorized.

## Gates

`npm run typecheck` · `npm test` · `npm run build` · `git diff --check` ·
security and overlap scans. The feature branch may be pushed only after all
available validation passes. Never push or merge to `master`.
