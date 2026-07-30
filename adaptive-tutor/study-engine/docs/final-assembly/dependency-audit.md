# Dependency audit

The release uses npm lockfiles and Node 22.22.3. The Session 9 runtime declares Node `>=22 <23` and pins:

| Development dependency | Version |
|---|---:|
| TypeScript | 5.8.3 |
| Vite | 6.4.3 |
| Vitest | 4.1.10 |
| Playwright Test | 1.54.1 |
| Axe Playwright | 4.10.2 |
| tsx | 4.20.6 |
| `@types/node` | 22.15.32 |

`npm ci` was used in isolated component and clean-extraction validation. No `node_modules` directory is packaged. Production runtime dependencies are not introduced by the Session 9 inspection surface; browser output is a static Vite bundle.

Known non-blocking build note: the accepted Session 7 browser bundle reports a chunk larger than 500 kB. This is a performance optimization opportunity, not a safety, correctness, or portability failure.
