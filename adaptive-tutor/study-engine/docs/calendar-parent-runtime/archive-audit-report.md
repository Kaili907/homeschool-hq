# Session 8-R3 archive audit

Release: `0.8.1`  
Node: `v22.23.1`  
Engine: `>=22`  
Archive: `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`

The 27-file source digest is
`0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92`.
The 26-module build and all 86 tests pass. The exact packaged `dist/` digest is
`40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.

The final audit verifies forward slashes, zero backslash/absolute/traversal
paths, duplicates, case collisions, symlinks, nested/source archives,
`node_modules`, personal paths, and out-of-ownership entries. CRC integrity,
file-manifest parity, Windows extraction, and Linux/macOS-neutral path handling
pass.

The final ZIP size, SHA-256, and central-directory count are post-seal evidence
reported in the external handoff. They cannot be embedded without changing the
archive checksum.
