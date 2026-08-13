# Learner release quality gate

Run the release-blocking audit:

```sh
npm run audit:learner-release
```

Regenerate deterministic evidence for a known failing base without converting the failure to success:

```sh
node scripts/audit-learner-release/audit.mjs --write --allow-fail
```

The gate rebuilds the final learner payload, resolves every admitted production binding, inspects all 8,292 lessons and all 699 assessment records, and exits nonzero if any source, learner-projection, response, safety, scoring-boundary, or assessment-material rule fails. Rules are subject-aware; PE activities, Arts projects, and Ready-for-Life tasks are not required to mimic Math worksheets.

The tracked report is evidence for the named base, not an allowlist. No current failure count is accepted by the gate.

The existing `npm run audit:family-pilot-launch` command runs this quality gate first, so the legacy launch audit cannot approve a release that fails learner quality.
