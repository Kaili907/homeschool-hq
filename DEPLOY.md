# Deploying Homeschool HQ (D1)

A step-by-step for putting Homeschool HQ on the web with **Netlify**, with the AI
tutor and premium voice keys kept **server-side** (never in the browser bundle).
You do the GitHub + Netlify account steps yourself; everything in the code is ready.

> **Why Netlify?** The whole deploy — static app + two key-injecting API proxies +
> single-page-app routing — is expressed in one `netlify.toml`, on a free tier that
> suits a private family app. (Vercel would work the same way with `vercel.json`
> and `/api` functions; if you prefer it, the two functions in `netlify/functions/`
> map 1:1 to Vercel `api/` handlers.)

## What's already in the repo
- `netlify.toml` — build command, `dist` publish dir, the `/api/*` → function
  redirects, the SPA fallback, and `VITE_USE_PROXY=true` for the deployed build.
- `netlify/functions/anthropic.js` and `netlify/functions/tts.js` — the proxies.
  They read the keys from **host environment variables only** and forward to
  Anthropic / ElevenLabs. The keys are never in the repo or the client bundle.
- Service worker (`public/sw.js`) + web manifest → installable, works offline
  after the first visit.

## One-time prerequisites
1. A **GitHub** account.
2. A **Netlify** account (sign in with GitHub is easiest — free tier is fine).
3. Your two API keys ready to paste:
   - **Anthropic**: `sk-ant-…` from console.anthropic.com
   - **ElevenLabs** (only if you use premium voices): from elevenlabs.io → Profile

## Step 1 — Create a PRIVATE GitHub repo
1. On GitHub → **New repository** → name it (e.g. `homeschool-hq`), set it to
   **Private**, do **not** add a README/.gitignore (the repo already has them).
2. Copy the repo URL, e.g. `https://github.com/<you>/homeschool-hq.git`.

## Step 2 — Push the code (including all tags)
From the project folder (`homeschool-hq`), in a terminal:

```bash
git remote add origin https://github.com/<you>/homeschool-hq.git
git push -u origin main
git push origin --tags
```

`--tags` publishes the milestone tags (`v2.0-m1` … `v2.0-mt2`). Confirm on GitHub
that the code and the **Tags** list are both there.

## Step 3 — Connect Netlify to the repo
1. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo.
2. Netlify reads `netlify.toml`, so the build settings are pre-filled:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   Leave them as detected.
3. **Don't deploy yet** — set the keys first (Step 4). If it auto-deploys, that's
   fine; just redeploy after Step 4.

## Step 4 — Set the two SECRET environment variables
Netlify → your site → **Site configuration → Environment variables → Add**:

| Key | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-…` | used by the tutor proxy |
| `ELEVENLABS_API_KEY` | your ElevenLabs key | only if you use premium voices |

- Scope: "All" (build + functions) is fine.
- **Do NOT** put these in `netlify.toml` or the repo — they live only here.
- `VITE_USE_PROXY=true` is already in `netlify.toml`; you don't add it.

## Step 5 — First deploy
Netlify → **Deploys → Trigger deploy → Deploy site**. When it's green, open the
site URL. Add a key in **Grown-Ups → AI Tutor** is **no longer needed** on the
deployed site — the proxy supplies it. (The in-app key field still works and is
only used if you ever run the direct/local build.)

## Step 6 — Redeploying later
Any `git push` to `main` auto-deploys. To redeploy without code changes:
Netlify → **Deploys → Trigger deploy → Clear cache and deploy site**. Each deploy
gets a fresh service-worker cache id, so returning visitors pick up the new
version automatically (old offline caches are cleared).

## Step 7 — Verify the keys are NOT in the client bundle
Two easy checks:

1. **In the browser** (on the live site): open DevTools → **Network** → do a tutor
   turn. The request goes to **`/api/anthropic/v1/messages`** (your own domain),
   not `api.anthropic.com`, and carries **no** `x-api-key` header. Then DevTools →
   **Sources** → search all files for `sk-ant` and for `ANTHROPIC_API_KEY` — you'll
   find **nothing**.
2. **From the build output** (locally):
   ```bash
   VITE_USE_PROXY=true npm run build
   grep -rniE "sk-ant-[a-z0-9]|ANTHROPIC_API_KEY|ELEVENLABS_API_KEY" dist/   # → no matches
   grep -o "/api/anthropic\|/api/tts" dist/assets/*.js | sort -u             # → the proxy paths
   ```
   No key strings appear; only the proxy paths do.

## Step 8 — Install & offline
- On a phone (Chrome/Safari): open the site → browser menu → **Add to Home Screen**.
  It installs with the app icon and opens full-screen.
- Offline: after one online visit, turn on Airplane Mode and reopen — the app shell
  and practice load from the service-worker cache. (Live AI tutor/voice need the
  network; everything else — practice, walkthroughs, missions, typing, stars —
  works offline.)

## Optional: Cloud sync across devices (M6)
Sync lets the girls' progress follow them between devices (e.g. a teen's laptop and
the family machine). It's **entirely optional** — with none of this set up, the app
works exactly as before and the JSON backup/export stays your escape hatch.

1. **Create a Supabase project** (supabase.com → New project, free tier). Note the
   project's **URL** and **anon public key** (Project Settings → API). The anon key
   is safe in the browser; **never** use or paste the _service_role_ key anywhere.
2. **Apply the tracked database migrations through the approved migration
   workflow and in timestamp order:**
   `20260724074106_academy_profiles_base.sql`,
   `20260724230000_academy_student_identity_foundation.sql`, then
   `20260726120000_academy_household_revision_cas.sql`.
   The base migration creates the RLS-protected `profiles` table only after
   validating the exact effective `public`/`auth` schema privileges, including
   inherited and `PUBLIC` grants. Missing privileges or unexpected browser-role
   `CREATE` access aborts without repairing the platform ACL. The identity
   migration adds the durable private and relationship foundation. The CAS
   migration removes direct authenticated profile writes and adds the
   transactional household revision boundary.
   `supabase/schema.sql` is a legacy/reference snapshot, not an independent
   deployment source. Do not paste SQL into an unverified project or guess
   which project belongs to Manuel Academy.
3. **Create Dad's login**: Supabase → **Authentication → Users → Add user** with your
   email + a password (or enable email sign-up). The girls do **not** get accounts —
   after Dad signs in on a device, the existing PIN picker still chooses who's active.
4. **Add two Netlify env vars** (Site configuration → Environment variables):

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your project URL, e.g. `https://abcd.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |

   These are build-time vars (they start with `VITE_`), so **redeploy** after adding
   them. Do **not** add the service_role key — it must never reach the client.

5. **First run**: on each device, **Grown-Ups → Cloud sync ☁️** → sign in with Dad's
   email/password. Signing in first performs a read-only cloud check; it never uploads
   or replaces Academy data. The panel then offers only choices that fit the verified
   state: upload this device when the household cloud is successfully empty, use the
   household cloud after a local safety backup, or review profile differences. A true
   two-sided conflict requires Dad to choose the device or cloud copy for that profile.
   Cancel keeps the app in local-only mode. After Dad explicitly binds the device to
   that household, one-sided changes sync automatically; offline edits remain queued
   for that household only. The binding includes a fingerprint of the exact persisted
   Academy dataset. Every cloud write rechecks that fingerprint, the authenticated
   Supabase user, the server revision, and a cross-tab mutation lease immediately before
   dispatch. The browser Web Lock and localStorage lease serialize tabs in one browser;
   they do not provide cross-device atomicity. The database RPC atomically compares and
   advances the per-household server revision, so only one device can consume a
   revision. A loser retains local data and returns to reviewed conflict handling rather
   than overwriting the winner. If another tab, an interrupted replacement, or an imported backup changes
   the dataset, automatic sync pauses without deleting local data and asks Dad to review
   the household again. Imports create a local safety backup, advance a durable import
   generation, and always invalidate the previous ownership claim even when the restored
   file is byte-for-byte equivalent. Dataset fingerprints use the browser's Web Crypto
   SHA-256 implementation over validated canonical JSON. A cloud response is committed
   locally only after the mounted operation, pinned access token, household identity,
   dataset fingerprint, import generation, cloud baseline, Web Locks, and mutation lease
   are revalidated after the response. For writes, Supabase first completes its internal
   token/header preparation. Its operation-scoped custom fetch then re-verifies the
   pinned identity and canonical current session, synchronously runs the complete
   lifecycle/provenance/lease/revision guard, and invokes native fetch in that same call
   stack. A denied guard never calls native fetch. Browsers without Web Locks remain fully usable
   offline but cannot perform cloud mutations.

   Local ownership/replacement finalization remains operation-bound through every
   asynchronous persistence and hashing checkpoint. The monotonic replacement states
   are `prepared → dataset-written → ownership-written → committed → removed`;
   `review` is a terminal fail-closed state that is never auto-adopted. Recovery waits
   for a server-verified canonical session, requires exactly one matching transition,
   and never lets storage enumeration order choose an owner. The final verified
   ownership write, transition advancement, React publication, and cleanup are guarded
   as one no-await local sequence. A failure before coherent commit preserves the data
   unbound and review-required. A cleanup failure after coherent commit may retain the
   verified replacement, provenance, bound ownership, server revision, React
   publication, and a `committed` recovery marker while still returning an operation
   error. A later matching, server-verified household session may remove only that
   marker after revalidation; it never auto-adopts `review`. The household lease uses
   an owner-checked heartbeat while both Web Locks and
   the original operation remain valid; lifecycle or provenance loss stops renewal and
   aborts the request. Optional synchronized Academy containers are structurally bounded
   and validated before provenance is trusted. Malformed imported or persisted data is
   preserved under a quarantine key, is not published into React, and pauses cloud sync
   for explicit recovery/review. Future Grade 5 or other additive state containers must
   extend the bounded allowlist in `src/sync/provenance.ts` and add compatibility,
   malformed-input, and payload-limit tests before becoming syncable.

Security notes: the anon key + Supabase URL are the only sync values in the client
bundle (both are public by design; RLS protects the data). No service key is used.
One canonical Supabase browser client owns and refreshes the persisted session. A
second, operation-scoped sessionless pinned-token transport client is created only for
one write; it has
session persistence, URL detection, and automatic refresh disabled and cannot become an
auth-state owner. Its custom fetch owns only that operation's guard; no mutable global
authorization closure is shared. Canonical identity is reverified at the true fetch
boundary and after response.
Academy sync metadata, pending ownership transitions, and mutation
leases are separately namespaced by verified household. Obsolete pre-SDK custom token
and global metadata keys are removed and are never migrated into a household binding.

The PostgreSQL mutation is a transactional **partial upsert** of the supplied profile
rows. Existing household profiles omitted from a request are retained; there is no
profile deletion path. Existing valid pre-CAS profile rows intentionally begin as one
lazy revision-zero snapshot. The first successful CAS mutation consumes revision zero.
Both applied and conflict results create immutable household-scoped mutation receipts.
An identical replay returns the original result; changing the expected revision or
payload under the same mutation ID is rejected. Resolving a conflict requires a new
mutation ID.

The RPC enforces the current Academy profile contract in PostgreSQL before a receipt,
profile write, or revision change. It checks required and optional containers,
JavaScript-finite numerics, strict timestamps, recursive reserved keys, profile IDs,
and the same depth/node/entry/string/key/payload limits used by the browser boundary.
Shared fixtures run through both validators. PGlite covers fast migration and contract
tests; a development-only embedded PostgreSQL server proves independent backend PIDs,
row-lock contention, first-writer contention, and identical concurrent retry behavior.
Neither local gate proves hosted Supabase JWT/PostgREST/owner behavior. This branch
remains not merge-ready until the exact Manuel Academy project is authoritatively
identified, the migration is applied there, and the hosted role plus two-client probes
pass.

## Rolling back
Netlify → **Deploys** → pick a previous green deploy → **Publish deploy**. Or in
git, deploy an older tag by pushing it as `main`.
