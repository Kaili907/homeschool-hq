# Session 8-R3 final build-evidence handoff

Release version: `0.8.1`  
Node: `v22.23.1`  
Declared engine: `>=22`  
Final ZIP: `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`

The final 27-file executable/validation source-tree digest is
`0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92`.
The clean production build transformed 26 modules and produced four browser
files with authoritative digest
`40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.
The packaged `dist/` and clean-extraction rebuild have that same digest.

Typecheck, build, Node audit, dependency audit, deterministic traces, three
desktop screenshots, the 390x844 mobile view, and all 86 tests pass. No tests
failed. The full regression retains all 13 mappings, review protections,
partial/exact resume, idempotency, all ten parent controls, DEC-012 precedence,
privacy exclusions, Romeo credential/no-network protection, household IANA
timezone behavior, and DST gap/overlap handling.

The machine-readable authority is `release-evidence.json`.
`npm run audit:release` fails on disagreement among package/lock/adapter
versions, Node engine, source digest, bundle file inventory, bundle digest,
module/test totals, ZIP filename, and release reports.

The archive contains 58 files from only the three Session 8 ownership roots.
Its CRC, manifest parity, Windows extraction, neutral path handling, and exact
packaged build are independently verified. The final ZIP SHA-256 and size are
reported externally after sealing because an archive cannot contain its own
checksum without changing it.

Session 8 local runtime status: **PASS**.

Overall Wave 2 and final-assembly status: **not authorized/incomplete**,
reported separately and not a Session 8 blocker.
