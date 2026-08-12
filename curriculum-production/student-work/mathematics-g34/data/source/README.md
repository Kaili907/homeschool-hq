# Vendored Grade 3/4 authoring source

Read-only lesson metadata, mirrored from the `mac/g34-math-r1` authoring
branch so this pipeline has a pinned, self-contained input. Nothing in this
directory is generated here; nothing outside `mathematics-g34/` is modified by
this pipeline.

- Source worktree: `mac-g34-math-r1`
- Source branch: `mac/g34-math-r1`
- Source commit: `64c1a5e80ea44c1da4d54a1a22c64b81be74d0ca` (tip at the time this
  pipeline was built)
- Source path: `curriculum-authoring/full-family-grade34/subjects/mathematics/`

Files copied verbatim, byte-for-byte:

| File here | Source file |
| --- | --- |
| `grade-3/lessons.jsonl` | `courses/grade-3/mathematics/lessons.jsonl` (180 lines) |
| `grade-3/units.json` | `courses/grade-3/mathematics/units.json` (10 units) |
| `grade-4/lessons.jsonl` | `courses/grade-4/mathematics/lessons.jsonl` (180 lines) |
| `grade-4/units.json` | `courses/grade-4/mathematics/units.json` (10 units) |
| `standards/standards-map.json` | `standards/standards-map.json` (Michigan-aligned Grade 3/4 codes) |

`units.json` and `standards-map.json` are consulted only for authoring
reference (which standards belong to which unit, domain ceilings, scope
notes); the generation pipeline itself reads only `lessons.jsonl`, matching
the pattern the grades 5-12 pipeline uses for its own lesson sources.

If the `mac/g34-math-r1` branch is later merged or its authoring content
moves, refresh these files from the merged location and update the commit
pin above.
