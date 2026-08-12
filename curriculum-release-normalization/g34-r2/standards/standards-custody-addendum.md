# Standards Custody Addendum - Normalized Release

Addendum to [`upstream/standards-custody-report.md`](upstream/standards-custody-report.md), which is
carried here verbatim from the candidate. That report stands; this one records only what the
normalization changed about custody, and what it deliberately did not.

## 1. Citation form: resolved by projection, not by rewriting

The candidate recorded that all 20 lanes emit `standards` as plain strings and that
4757 of 4757 citations carried no `mapping_status`, so the release schema's object form and
the contract's canonical/unverified/human-review rollup were both unreachable.

Both are now produced, by projecting each string into
`{code_or_strand, source, mapping_status}` where `code_or_strand` **is the lane's string,
verbatim**. Nothing was re-cited, re-worded, dropped or added - proven per lesson by the citation
sequence digest in [`../provenance/lesson-content-digests.csv`](../provenance/lesson-content-digests.csv).

`mapping_status` is derived by the published rules in
[`../adapters/standards-mapping-policy.json`](../adapters/standards-mapping-policy.json). The rules
exist so no reader has to trust a judgement call:

| Rule | Status | Scope | Grounded in |
| --- | --- | --- | --- |
| R1 | `canonical` | math content codes, ELA codes | the lane catalog names the published MDE document as source of record for those exact codes |
| R2 | `human-review` | math `MP.n` | the math lane states the MP.n string is a Manuel Academy convention the MDE document does not print |
| R3 | `human-review` | financial literacy | `release/standards-reference.md` Gap 1 directs it explicitly |
| R4 | `human-review` | ready for life | no discrete Michigan standards page exists; every citation is an internal anchor |
| R5 | `unverified` | everything else | an official source is named for the subject and no lane recorded a code-level confirmation |

Rollup: **1210 canonical, 2850 unverified,
697 human-review**.

`canonical` is never issued on assembly judgement. 3547 of
4757 citations still need a human before any alignment claim is made to a family. The
normalization made that number *reportable*; it did not make it smaller.

## 2. Standalone standards artifacts: all 20 courses now have one

The candidate recorded that 8 of 20 courses shipped no standards artifact - Gap A (science,
social-studies: no lane document naming which published document the codes came from) and Gap B
(ready-for-life, financial-literacy).

Every course now carries `standards/courses/<course_id>.standards.json`, and each one states which
kind it is:

- **12 courses** with a lane artifact: the artifact is carried verbatim under `sources/` and the
  standalone file cross-references it.
- **8 courses** without one (`ma-g3-science`, `ma-g3-social-studies`, `ma-g3-ready-for-life`, `ma-g3-financial-literacy`, `ma-g4-science`, `ma-g4-social-studies`, `ma-g4-ready-for-life`, `ma-g4-financial-literacy`): the standalone file is
  *projected from the course's own lesson citations*. It lists every distinct citation, its
  `mapping_status` and derivation rule, the lessons and units that cite it, and says plainly that no
  lane artifact exists.

**A projected artifact is a custody record, not a verification.** Gap A and Gap B are not closed by
it: science and social-studies still cite exact codes with no document of record, and the financial
literacy policy question the release contract deferred is still open. What changed is that the gap
is now enumerated per code rather than described in prose, so the lane that closes it has a work
list.

## 3. Health framework mismatch: unchanged, still recorded

The health lane aligned to the Michigan Health Education Standards Guidelines 2025 while the sealed
5/7/8 courses carry pre-2025 anchors. Normalization does not touch this. A family running Grade 4
and Grade 5 health will still see two vocabularies.

## 4. Naming: settled at the release boundary

The candidate answered the subject-slug question by keeping the canonical slugs the lanes authored.
This release keeps that answer and finishes it: the release lesson schema
([`../schemas/schema-delta.md`](../schemas/schema-delta.md)) and the normalized course matrix
([`../release/course-matrix.normalized.json`](../release/course-matrix.normalized.json)) both use
the canonical slugs, and [`../adapters/subject-slug-map.json`](../adapters/subject-slug-map.json)
translates for anything still keyed on the matrix slugs.

Course ids are unchanged. `ma-g{3,4}-tech-cs` stay as authored - renaming them would rewrite 72
lesson ids, 12 unit ids, a schedule and every assessment cross-reference. The normalized matrix
carries `matrix_course_id` alongside so the stale ids resolve.

## 5. Two lanes authored inside the sealed release path

Unchanged and still true of the source branches. This release reads only from the candidate and
writes only under `curriculum-release-normalization/g34-r2/`; the
`sealed-1.0.0-untouched` and `g34-r1-candidate-untouched` checks enforce both.

## 6. What still has no sign-off

Everything the candidate listed: no licensed-educator review of any of the 20 courses, no live
verification of standard codes, no rendered-interface accessibility audit, no host integration.
Health and Physical Education remain an explicit external gate at
`PENDING_FINAL_HEALTH_REVIEW`.
