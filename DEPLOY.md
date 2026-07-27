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
   is safe in the browser; **never** use or paste the *service_role* key anywhere.
2. **Create the table through the reviewed migration workflow**: apply
   `supabase/migrations/20260724074106_academy_profiles_base.sql` with the
   approved Supabase migration runner. It creates one `profiles` table with
   row-level security so each household only sees its own rows.
   `supabase/schema.sql` is a legacy/reference snapshot, not an independent
   deployment source.
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
   email/password. The first device: use **"Push this device's data to the cloud →"**
   (it shows a summary first). Other devices: sign in, then **"← Pull cloud data to
   this device"** (this **merges** — it never erases local data). After that, sync is
   automatic (local-first: writes save instantly and push in the background; offline
   edits queue and flush on reconnect).

Security notes: the anon key + Supabase URL are the only sync values in the client
bundle (both are public by design; RLS protects the data). No service key, and the
sync session token lives only in the browser's localStorage on that device.

## Rolling back
Netlify → **Deploys** → pick a previous green deploy → **Publish deploy**. Or in
git, deploy an older tag by pushing it as `main`.
