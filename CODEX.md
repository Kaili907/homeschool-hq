# CODEX.md — Handoff for Codex / non-Claude sessions

You do not inherit CLAUDE.md automatically. Read it NOW — it is the
contract. This file adds only what differs for you.

## The one-paragraph version if you read nothing else
This repo runs a LIVE app used daily by five children, with a
hosted database and locked manual publishing. You build on a
branch, run the gates, and END AT A REPORT. You never merge to
master, never push master, never deploy, never touch hosted
Supabase or Netlify, never handle real student data — unless Dad's
message contains an explicit AUTHORIZATION block naming that exact
action. Pushing to master triggers a production build of the
children's school. Treat it that way.

## Report discipline
- Tag claims [VERIFIED] only with command output pasted in the
  same turn. Otherwise [RECALLED] or [UNKNOWN]. UNKNOWN is a good
  answer; a confident wrong answer has already cost this project a
  bad production release.
- NEVER invent command output. Sessions have fabricated gate
  results, push transcripts, and ls-remote lines; each fabrication
  was caught in Dad's terminal and voided the entire report. If a
  command fails or cannot run, report that plainly — a stopped
  line is a success here; an invented success ends trust in the
  session.
- Empty search/API results are not proof of absence. Say "lookup
  returned empty" — not "confirmed absent."
- Branch naming: short scope prefix (feat/, fix/, security/,
  integration/, release/) + descriptive name. Declare your branch
  in your first commit message.

## Environment notes (you will hit these)
- Windows PowerShell: npm.ps1 is blocked → use npm.cmd / npx.cmd.
- node may be off PATH → prepend C:\Program Files\nodejs,
  session-scope only.
- Supabase CLI: node_modules\.bin\supabase.cmd, absolute path when
  unsure of cwd. Hosted contact requires authorization ANYWAY.
- Gates: `npm.cmd run typecheck`, `npx.cmd vitest run` (default
  invocation must be green), `npm.cmd run build`.

## Sensitive boundaries (identical to CLAUDE.md, restated because
they are the ones that must never depend on which AI is reading)
- SUPABASE_SERVICE_ROLE_KEY and all API keys: never read, print,
  or move.
- No real student data in your context, ever.
- Child-safety constraints in tutor prompts and curriculum rules
  are load-bearing. You do not relax them to make a test pass.
- Safety flags fail closed. You do not invert defaults.

When in doubt: STOP and report. A stopped line is a success here.
