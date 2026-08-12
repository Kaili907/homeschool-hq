# Starting the family pilot on Windows

`scripts/family-pilot/start-windows.ps1` is the one command to start
Homeschool HQ locally on this PC for the family pilot. It checks that the
checkout is safe to run, then starts the app with the repo's existing
`npm run dev` / `npm run preview` scripts. It never deploys, never writes to
a hosted database, and never touches production Study feature flags.

## Quick start

From the repo root, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\family-pilot\start-windows.ps1
```

This checks the local setup, then starts the dev server
(`npm run dev`) at `http://localhost:5173/`. Press `Ctrl+C` to stop it.

## Check without starting anything

```powershell
powershell -ExecutionPolicy Bypass -File scripts\family-pilot\start-windows.ps1 -Check
```

Runs every verification step and prints `[OK]` / `[BLOCKED]` per check, then
exits — no server is started. Exit code `0` means the pilot is ready to
launch; exit code `2` means at least one blocker needs fixing first (the
blocker text starts with `PILOT_LAUNCH_BLOCKER:` and says exactly what to
do).

## Preview mode

```powershell
powershell -ExecutionPolicy Bypass -File scripts\family-pilot\start-windows.ps1 -Preview
```

Runs `npm run build` then `npm run preview` instead of the dev server —
closer to what a deployed build looks like, still entirely local.

## What it checks

- **Repo checkout** — the script only runs inside a real `homeschool-hq`
  checkout (`package.json` name and a `.git` present). Anything else is
  refused with `PILOT_LAUNCH_BLOCKER`.
- **Node.js and npm** — both must be on `PATH`. If the installed Node major
  version doesn't match the version `netlify.toml` pins for the deployed
  build, the script reports it as a note, not a blocker — local dev on a
  newer Node is not deploy behavior and isn't a reason to refuse the pilot.
- **Dependencies** — `node_modules` must already exist. The script never
  runs an install for you; if it's missing, it tells you to run `npm ci`
  and stops there.
- **Local configuration** — if `.env.local` exists, the script lists which
  keys are configured (never their values). Configuration is entirely
  optional: without it, the app runs local-only, and cloud sync / the Study
  engine simply stay inactive per [DEPLOY.md](../../DEPLOY.md).

## What it deliberately does not do

- Does not install dependencies, run migrations, or write to any database.
- Does not read, set, or clear `ACADEMY_STUDY_ENABLED` or any other
  production Study flag — if one is set in your local `.env.local`, the
  script only reports that it's present.
- Does not deploy, push, or touch Netlify in any way.
- Does not invent an authentication bypass — sign-in behaves exactly as it
  does in any other local run of the app.

If the repo ever lacks a safe local launch mechanism (no working
`npm run dev` / `npm run preview`), this launcher will not paper over that —
it only wraps the scripts that already exist in [package.json](../../package.json).
