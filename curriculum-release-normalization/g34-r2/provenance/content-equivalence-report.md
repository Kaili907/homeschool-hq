# Content Equivalence - Grades 3/4 Normalized Release

The claim this release has to earn: **the instructional content copied out of
`curriculum-release-candidates/g34-r1` is unchanged, and the only differences in any lesson record
are metadata fields named in advance.**

Three independent proofs, all machine-checked by [`tools/normalize.py`](../tools/normalize.py) on
every run, all reported in [`validation/validation.json`](../validation/validation.json).

## 1. The normalization surface is closed

Exactly 3 fields may differ on a lesson record: `standards`, `schema_version`, `authored_schema_version`.
The check `normalization-surface-closed` compares **every other key** of every one of the 1800
lesson records against the candidate's and requires equality. Result: `PASS`.

Nothing else in the release touches a lesson: `subject` keeps the canonical slug the lane authored,
every id, `course_day`, `unit_number`, `lesson_flow`, `formative_check`, `mastery_rule`,
`accessibility_and_accommodations`, `safety_and_privacy`, and every other field is passed through
untouched, in its original key order.

## 2. The adapters are invertible, and the inverse reproduces the original bytes

Both lesson normalizations have a documented inverse:

| Normalization | Forward | Inverse |
| --- | --- | --- |
| N1 `standards` | `"3.NBT.1"` -> `{"code_or_strand": "3.NBT.1", "source": ..., "mapping_status": ...}` | take `code_or_strand`, in order |
| N2 `schema_version` | `"1.1"` -> `"1.0"` + `authored_schema_version: "1.1"` | restore `authored_schema_version`, drop the field |

For each of the 1800 lessons the run computes `denormalize(normalize(lesson))`, re-serializes it
with the separator style detected from the candidate's own JSONL line, and compares **bytes**.

Result: 1800 of 1800 lines reproduce byte for byte.

This is stronger than a field diff: it proves key order, spacing, unicode escaping, numeric
formatting and value identity are all preserved, so the normalization loses nothing.

## 3. Digests over the untouched fields match

For each lesson, a SHA256 is taken over every field outside the normalized set, and separately over
the standards citation sequence (the raw strings, in order). Both are computed on the candidate
record and on the released record.

| | Equal | Of |
| --- | ---: | ---: |
| Instructional-field digest | 1800 | 1800 |
| Standards citation sequence digest | 1800 | 1800 |

Per-lesson evidence, all 1800 rows with both hashes:
[`lesson-content-digests.csv`](lesson-content-digests.csv).

The citation digest matters on its own: it proves N1 added structure around the citations without
adding, dropping, reordering, deduplicating or editing a single one of the
4757 citation strings.

## 4. Everything that is not a lesson is byte-identical

167 files - `units.json`, `assessments.json`, all 20 schedule CSVs and the
schedule index, every course guide, the ELA text banks and public-domain registers, the mathematics
practice/projects/mastery-evidence files, and every lane standards artifact - are copied with no
transformation and re-hashed after writing.
Byte-identical: 167 of 167
([`verbatim-files.json`](verbatim-files.json)).

`lesson-index.csv`, regenerated from the *normalized* lessons, is byte-identical to the candidate's.
That single hash fixes every lesson id, course id, grade, subject, unit number, course day, phase
and title across all 1800 lessons.

## What actually changed, in full

| Change | Records | Layer |
| --- | ---: | --- |
| `standards` string -> object | 1800 lessons, 4757 citations | lesson metadata |
| `schema_version` pinned, authored value preserved | 360 lessons | lesson metadata |
| release lesson schema `subject` enum canonicalized | 0 lessons | schema |
| standalone standards artifacts added | 0 lessons | release artifact |
| course matrix / cadence regenerated | 0 lessons | release artifact |

## Chain back to the source branches

This release proves equivalence to `g34-r1`. `g34-r1` proved, by its own
`content-byte-identical-to-source` check, that its 138 copied course files re-hash to the files in
the pinned lane commits recorded in [`ledger/source-branches.json`](../ledger/source-branches.json).
The two proofs compose: the instructional content here is the content the lanes authored.
