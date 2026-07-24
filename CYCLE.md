# CYCLE claim — SESSION D (DEPLOY)

**Cycle:** D1 — GitHub remote + public web deploy + offline support
**Worktree:** ../hq-d1 · **Branch:** d1-deploy
**Base:** master @ 773f049 (all v2.0 tags in history)

## Scope
1. Serverless proxy functions (Netlify) for ElevenLabs TTS + Anthropic Messages;
   keys from host env only, never bundled. Both ENDPOINT_BASE constants route to
   the proxy under a build-time flag (VITE_USE_PROXY); local dev stays direct.
2. Service worker + web manifest: app shell + static assets cached (offline after
   first visit), installable; cache-busted per deploy.
3. Static-hosting build config + SPA fallback; production bundle free of dev-only
   assumptions.
4. DEPLOY.md: Dad's step-by-step (private GitHub repo, push incl. tags, connect
   host, set the two env vars, first deploy + redeploy, verify keys absent from bundle).
5. Do NOT create the GitHub repo or push — prepare everything up to that point.

## Out of scope
M6 Supabase sync (next cycle), MR/MM/SE-B/MP, any feature work.

Claim files never reach main — removed pre-merge. No merge; end at report.
