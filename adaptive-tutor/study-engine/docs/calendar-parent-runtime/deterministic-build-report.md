# Session 8-R3 deterministic build report

Release `0.8.1` uses Node `v22.23.1` with engine `>=22`.
The portable artifact is `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`.

The final 27-file executable/validation source-tree digest is
`0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92`.
The clean Vite build transformed 26 modules. All 86 tests passed.

The authoritative bundle digest is
`40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.
It is SHA-256 over four sorted
`normalized-forward-slash-path:raw-file-SHA256` lines joined by LF.

The packaged `dist/` digest and independent clean-extraction rebuild digest are
both `40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.
Digest equivalence, Node audit, typecheck, build, screenshots, and mobile
validation all pass.

The final ZIP checksum is external post-seal evidence because embedding an
archive checksum inside that archive is self-referential.
