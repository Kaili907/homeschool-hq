# Start Family Pilot Locally

This is the audited, device-local Mac workflow. It does not need secrets, Supabase, a deployment, or a hosted Tutor.

## First time on this checkout

Open Terminal and run:

```sh
cd "/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-final-family-pilot-launch-audit-r1"
npm ci
npx playwright install chromium
```

The Playwright install is needed only for the automated browser audit, not for ordinary Safari/Chrome use.

## Build and start the audited preview

```sh
cd "/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-final-family-pilot-launch-audit-r1"
VITE_FAMILY_PILOT_ENABLED=true npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Keep that Terminal window open. In a browser on the Mac, open:

`http://127.0.0.1:4173/family-pilot`

The first visit opens family setup. Family Pilot data stays in that browser profile on this Mac. Use the Parent screen's **Download backup** action regularly, especially before clearing browser data or changing computers.

When finished, return to Terminal and press `Control-C` to stop the local preview.

## Safety switch

Family Pilot is off by default. The literal prefix below is what enables it for the build:

```sh
VITE_FAMILY_PILOT_ENABLED=true npm run build
```

If the variable is missing or is not exactly `true`, `/family-pilot` returns to the normal Homeschool HQ experience.

## Optional acceptance recheck

```sh
npm run test:family-pilot-browser
npm run test:family-pilot-flag-default
npm run audit:family-pilot-launch
```

These commands build and serve local production previews only. They do not deploy or contact hosted Study/Supabase services.
