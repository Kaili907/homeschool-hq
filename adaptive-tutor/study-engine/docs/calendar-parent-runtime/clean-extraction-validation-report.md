# Session 8-R3 clean-extraction validation

Release: `0.8.1`  
Node: `v22.23.1`  
Engine: `>=22`  
Package: `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`

The 27-file source digest is
`0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92`.

The candidate archive was extracted into an isolated Windows directory and
layered only with the verified Contracts, Study Engine, and accepted Session
5-R2 inputs required by the lab. `npm ci`, typecheck, all 86 tests, the
26-module production build, and the Node bundle audit pass under
`v22.23.1`. Dependency audit reports zero vulnerabilities and lock metadata is
unchanged.

The packaged and rebuilt four-file bundle digests are both
`40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.
Deterministic equivalence is PASS. Desktop/mobile screenshots, privacy, Romeo,
parent precedence, timezone, and DST checks are PASS.

The final ZIP checksum is reported externally after the immutable archive is
sealed.
