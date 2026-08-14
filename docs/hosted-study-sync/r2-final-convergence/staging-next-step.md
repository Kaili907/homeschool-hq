# Exact future staging next step

Run only from the clean final convergence branch and provide a real, explicit
non-production project reference:

```sh
node scripts/hosted-sync-preflight/preflight.mjs \
  --learner-release-sha 56dd8a45fee1ca03dd5f83e1466c9f081824d6b9 \
  --convergence-sha "$(git rev-parse HEAD)" \
  --target-project-ref <EXPLICIT_NON_PRODUCTION_PROJECT_REF>
```

`git rev-parse HEAD` resolves to the exact final pushed convergence commit at
execution time. The final handoff also prints that value literally. The
preflight has no apply mode and does not enable hosted sync.

