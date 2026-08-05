# Netlify routine test gate

Run `npm run test:routine` to execute all `netlify/**/*.test.{js,mjs,ts}`
files through the `netlify-functions` project. It is a Node Vitest project and
provides `ACADEMY_STUDY_ENABLED=true`, matching the enabled server test
fixture.

`root-supabase` remains an independently runnable project because its embedded
database suites require serial execution and exceed the 124-second routine
runner budget. It is not silently included in `test:routine`; invoke it with
`npx vitest run --project root-supabase`.

## Baseline Netlify findings at `3fafb9f`

The root configuration included only `src/**/*.test.{ts,tsx}`,
`supabase/**/*.test.ts`, and `tests/**/*.test.js`, so it ran none of these
Netlify test files. The two pre-existing Netlify-specific configs were:

- `netlify/functions/_shared/study-safety/vitest.config.mjs`: study-safety,
  study-adult-review, and `src/study/safety` tests.
- `netlify/functions/_shared/study-adult-review-operations/vitest.config.mjs`:
  Node defaults only; it did not declare an include pattern.

All 18 Netlify test files now run in `netlify-functions`:

- `study-adult-review/{adult-review,guardian-notifications,recipients.authorization,supabase-ports}.test.js`
- `study-adult-review-operations/worker.test.js`
- `study-delivery/{external-provider,in-app-provider,supabase-in-app}.test.js`
- `study-identity/study-identity.test.js`
- `study-monitoring/{monitoring,supabase-sink}.test.js`
- `study-production/readiness.test.js`
- `study-rate-limit/durable-rate-limit.test.js`
- `study-runtime/verified-academic-runtime.test.js`
- `study-safety/{boundary-security,classifier,gateway,production-boot}.test.js`

Before the project supplied `ACADEMY_STUDY_ENABLED=true`, 16 assertions failed
with `503` / `gateway_disabled` solely because that process environment value
was unset: 2 in `worker.test.js`, 11 in `study-identity.test.js`, 2 in
`readiness.test.js`, and 1 in `verified-academic-runtime.test.js` (five
parameterized identity assertions are among the eleven identity failures).
Those were configuration failures, not assertion changes; the enabled test
project retains every assertion and makes a real server failure fail the gate.
