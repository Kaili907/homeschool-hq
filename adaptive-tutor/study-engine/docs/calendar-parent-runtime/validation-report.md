# Session 8-R3 final validation report

Date: 2026-07-29  
Release version: `0.8.1`  
Node: `v22.23.1`  
Declared engine: `>=22`  
Final ZIP: `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`

## Final R3 validation

| Evidence | Final result |
| --- | --- |
| Final executable/validation source files | 27 |
| Source-tree digest | `0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92` |
| Typecheck | PASS |
| Test files | 6 passed |
| Tests | 86 passed, 0 failed |
| Production build | PASS |
| Transformed modules | 26 |
| Browser bundle files | 4 |
| Final bundle digest | `40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B` |
| Packaged `dist/` digest | `40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B` |
| Clean-extraction rebuild digest | `40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B` |
| Digest equivalence | PASS |
| Node bundle audit | PASS |
| Dependency audit | PASS, 0 vulnerabilities |
| Deterministic traces | PASS |
| Desktop screenshots | PASS, 3 |
| Mobile screenshot | PASS, 390x844 |
| Clean extraction | PASS |
| Archive audit | PASS |

The source-tree digest covers the 27 runtime-root, script, and Session 8 test
files. It excludes documentation, `dist/`, screenshots, traces, release ZIPs,
and `node_modules`, so release evidence can be recorded without a circular
source digest.

The bundle digest uses SHA-256. Each of the four `dist/` files is hashed as raw
bytes. Lines of `normalized-relative-path:FILE_SHA256` are sorted by ascending
Unicode code point, joined with LF, and hashed again. Paths use `/` on every
platform.

Included bundle files:

- `assets/index-C4dNgVJX.js`
- `assets/index-C4dNgVJX.js.map`
- `assets/index-DAyrtZlt.css`
- `index.html`

## Complete regression result

The 86-test suite passed canonical contract conformance, all 13 block mappings,
review priority/overload/reserve behavior, same-day retry intents, placement,
partial completion, exact resume, continuation and result/outbox idempotency,
DEC-012 precedence, all ten parent controls, adult-private isolation, PII/raw
answer/transcript exclusion, Romeo credential and no-network boundaries,
household IANA zones, DST gaps/overlaps, host-zone independence, and all
preserved demonstrations.

The four screenshot scenarios passed, including the parent-control mobile view.
Trace digests are:

- `deterministic-traces.json`:
  `2E0FDC6FD89C790722CAB1A778C4C9F497B2F1AEBFFBDCDCE73949486AE06615`
- `parent-precedence-traces.json`:
  `0D8D6B3C3DE0E1830FB60AC050B5EDD2CD6074DA8C9D257C307FA02BDFF90ED9`

## Historical validation

Historical R1/R2 module counts and platform-dependent bundle digests are
intentionally omitted. They are not final packaged-release evidence.

The final ZIP SHA-256 is reported externally after sealing. An archive cannot
contain its own checksum without changing that checksum; this prevents
self-referential inconsistency.

Session 8 local runtime status: **PASS**. Overall Wave 2/final assembly remains
separately unauthorized.
