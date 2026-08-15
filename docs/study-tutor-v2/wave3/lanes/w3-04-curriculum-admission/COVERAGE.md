# Canonical curriculum coverage

## Source authority

Inventory date: 2026-08-15.

The current accepted source is
`curriculum-release-admitted/family-pilot-r1`, release `2.0.0`, classified
`ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1` with admission state `ADMITTED`.
The coverage test compiles the runtime manifest and every exact unit/lesson
binding from the admitted release; the report does not treat authored source
directories or release candidates as Tutor authority.

Pinned repository-file SHA-256 digests:

| File | SHA-256 |
| --- | --- |
| `MANIFEST.json` | `24db0ace842a8b83cb5e3f396e6bf275239c36cc2e746eefad3980211014d0b0` |
| `runtime/runtime-manifest.json` | `3847e944c20674d01200bfa650a9bf549221e42f9f8b46369179be04054fc086` |
| `runtime/lesson-rows-by-course.json` | `6d2ca8b36baffbe03a9641d3433748e5fb0f988eea6cdfaefe0c505b11ac6a9d` |
| `admission/release-registry-entry.json` | `3eadcb12b44ddc68b5e197e157e89bcd4b663875408ad4da5b10e5c8b571bd37` |

## Totals

| Courses | Units | Lessons | Assessments | Grades | Subject identifiers |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 90 | 698 | 8,292 | 699 | 9 | 10 |

## Coverage by subject identifier

These are metadata values, not a Tutor enum.

| Subject ref | Courses | Units | Lessons |
| --- | ---: | ---: | ---: |
| `arts-and-music` | 9 | 54 | 648 |
| `english-language-arts` | 9 | 90 | 1,620 |
| `financial-literacy` | 9 | 59 | 504 |
| `health` | 9 | 54 | 324 |
| `mathematics` | 9 | 90 | 1,620 |
| `physical-education` | 9 | 81 | 972 |
| `ready-for-life` | 9 | 54 | 324 |
| `science` | 9 | 81 | 972 |
| `social-studies` | 9 | 81 | 972 |
| `technology` | 9 | 54 | 336 |

## Coverage by official working level

| Working level | Courses | Units | Lessons |
| ---: | ---: | ---: | ---: |
| 3 | 10 | 77 | 900 |
| 4 | 10 | 77 | 900 |
| 5 | 10 | 77 | 900 |
| 7 | 10 | 77 | 900 |
| 8 | 10 | 78 | 936 |
| 9 | 10 | 78 | 936 |
| 10 | 10 | 78 | 936 |
| 11 | 10 | 78 | 936 |
| 12 | 10 | 78 | 948 |

Grade 6 is intentionally absent. The admitted manifest lists Grade 6 in
`unsupportedGrades`, and the compiled registry contains neither a Grade 6
working-level tuple nor any `ma-g6-*` course. Tutor admission therefore cannot
manufacture a Grade 6 course by parsing or incrementing identifiers.

## Actual course identifiers

| Working level | Course refs |
| ---: | --- |
| 3 | `ma-g3-arts-music`, `ma-g3-english-language-arts`, `ma-g3-financial-literacy`, `ma-g3-health`, `ma-g3-mathematics`, `ma-g3-physical-education`, `ma-g3-ready-for-life`, `ma-g3-science`, `ma-g3-social-studies`, `ma-g3-tech-cs` |
| 4 | `ma-g4-arts-music`, `ma-g4-english-language-arts`, `ma-g4-financial-literacy`, `ma-g4-health`, `ma-g4-mathematics`, `ma-g4-physical-education`, `ma-g4-ready-for-life`, `ma-g4-science`, `ma-g4-social-studies`, `ma-g4-tech-cs` |
| 5 | `ma-g5-arts-and-music`, `ma-g5-english-language-arts`, `ma-g5-financial-literacy`, `ma-g5-health`, `ma-g5-mathematics`, `ma-g5-physical-education`, `ma-g5-ready-for-life`, `ma-g5-science`, `ma-g5-social-studies`, `ma-g5-technology` |
| 7 | `ma-g7-arts-and-music`, `ma-g7-english-language-arts`, `ma-g7-financial-literacy`, `ma-g7-health`, `ma-g7-mathematics`, `ma-g7-physical-education`, `ma-g7-ready-for-life`, `ma-g7-science`, `ma-g7-social-studies`, `ma-g7-technology` |
| 8 | `ma-g8-arts-and-music`, `ma-g8-english-language-arts`, `ma-g8-financial-literacy`, `ma-g8-health`, `ma-g8-mathematics`, `ma-g8-physical-education`, `ma-g8-ready-for-life`, `ma-g8-science`, `ma-g8-social-studies`, `ma-g8-technology` |
| 9 | `ma-g9-arts-and-music`, `ma-g9-english-language-arts`, `ma-g9-financial-literacy`, `ma-g9-health`, `ma-g9-mathematics`, `ma-g9-physical-education`, `ma-g9-ready-for-life`, `ma-g9-science`, `ma-g9-social-studies`, `ma-g9-technology` |
| 10 | `ma-g10-arts-and-music`, `ma-g10-english-language-arts`, `ma-g10-financial-literacy`, `ma-g10-health`, `ma-g10-mathematics`, `ma-g10-physical-education`, `ma-g10-ready-for-life`, `ma-g10-science`, `ma-g10-social-studies`, `ma-g10-technology` |
| 11 | `ma-g11-arts-and-music`, `ma-g11-english-language-arts`, `ma-g11-financial-literacy`, `ma-g11-health`, `ma-g11-mathematics`, `ma-g11-physical-education`, `ma-g11-ready-for-life`, `ma-g11-science`, `ma-g11-social-studies`, `ma-g11-technology` |
| 12 | `ma-g12-arts-and-music`, `ma-g12-english-language-arts`, `ma-g12-financial-literacy`, `ma-g12-health`, `ma-g12-mathematics`, `ma-g12-physical-education`, `ma-g12-ready-for-life`, `ma-g12-science`, `ma-g12-social-studies`, `ma-g12-technology` |

Identifiers are looked up exactly. This matters where release identifiers do
not follow a single construction rule: Grades 3–4 use `tech-cs`, later grades
use `technology`; Grades 3–4 use `arts-music`, later grades use
`arts-and-music`; and high-school science unit/lesson refs use authored names
such as `ma-hs9-biology-u01` beneath course `ma-g9-science`.
