# CYCLE claim — SESSION S (M6 SYNC)

**Cycle:** M6 — Supabase sync + real logins (Dad household owner), travel-ready
**Worktree:** ../hq-m6 · **Branch:** m6-supabase-sync · **Dev port:** 5182
**Base:** master @ 58ef3b7 (all v2.0 tags in history; origin remote live)

## Scope
1. Supabase config via env only (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
   service key NEVER anywhere. Document Netlify env vars in DEPLOY.md.
2. supabase/schema.sql: profiles table (Profile JSONB + profile_id + updated_at +
   household_id) with RLS so a household only reads/writes its own rows. Dad runs
   it in the SQL editor — no remote provisioning.
3. Auth: email/password for DAD (household owner) only; girls have no accounts —
   device binds to household, existing PIN picker chooses the active girl.
   Sign-out clears sync, leaves local data intact.
4. Local-first sync engine: write local first (unchanged UX), push async; pull on
   open + reconnect; LWW per profile field-group by updated_at, per-profile merge
   that never drops a field-group the other side has; offline queue flushes on
   reconnect; UI never blocks on network.
5. First-run migration in Grown-Ups: explicit "Push this device → cloud" and
   "Pull cloud → this device", each with a confirm + summary; never silent overwrite.
6. Sync status UI in Grown-Ups only (identity, last sync, pending count, Sync now,
   offline state). Kid screens show nothing.
7. Service worker: sync/API calls never cached; app-shell caching unchanged.
8. JSON export/import stays the forever escape hatch; app 100% usable with NO
   Supabase config (keyless local mode = today's behavior).

## Out of scope
MR, MM, SE-B, MP, any feature work, any change to signed-out local-first behavior.

Netlify auto-deploys master → a merge ships to production. No merge this cycle;
end at report. Claim files never reach main — removed pre-merge.
