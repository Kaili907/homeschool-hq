# Mathematical Practice Custody — HS Mathematics `MP.1`–`MP.7`

**Lane:** `mac/hs912-release-normalization-r2`
**Subject of the finding:** `STANDARD_UNTRACEABLE`, mathematics, 779 citation sites
**Verified on:** 2026-08-12
**Verdict:** `REFERENT_VERBATIM` / `CODE_FORM_NOT_PRINTED_BY_SOURCE` → class `ALIAS_RESOLVED_VERBATIM`

## The finding as `hs912-r1` left it

Mathematics units and lessons cite `MP.1` through `MP.7` in 779 places — 41 unit citations and 738 lesson citations. Unit assessments carry a further 41, for 820 citation sites in all; the r1 finding counted units and lessons, and this document keeps that scope. The
mathematics lane's `standards-custody.md` documents retrieval of two official Michigan PDFs
with SHA-256 digests and a 22-domain count reconciliation, but the Standards for Mathematical
Practice appear in neither the extracted `michigan-hs-mathematics-standards.json` nor
`standards-map.md`. The assembly classified all seven as `UNTRACEABLE` and blocked.

The assembly was right to block. It was not able to say whether the codes were real.

## What this lane did

Retrieved the primary document directly from `michigan.gov` and hashed it before reading it.

| | |
| --- | --- |
| Document | Michigan K-12 Standards Mathematics (Michigan Department of Education) |
| URL | `https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf` |
| SHA-256 observed by this lane | `dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54` |
| SHA-256 recorded by `mac/hs912-math-r1` | `dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54` |
| Pages observed | 94 — matches the math lane's recorded page count |

The digests match, so this is not a second opinion about a different file. Both lanes read the
same bytes. That is what makes the rest of this document a check on the math lane's extraction
rather than a competing transcription.

> The r1 assembly report records that `www.michigan.gov` returned HTTP 403 to direct fetch
> during the health/PE work, and the PE lane fell back to search-engine indexing because of it.
> A direct request carrying an ordinary browser user agent returned HTTP 200 here. The 403 is a
> user-agent filter, not an access restriction. That is worth knowing for the PE citations too,
> though re-verifying physical education is outside this lane's scope and is **not** done here.

## What the document says

The section is headed, as printed, **"mathematics | Standards for mathematical Practice"** — PDF
pages 8–10, printed pages 6–8, running footer `StandardS for matHematICal praCtICe`. It carries
**eight** practices. Their statements are transcribed verbatim in
[`evidence/mathematical-practice-verbatim.txt`](evidence/mathematical-practice-verbatim.txt).

The document labels them with a **bare ordinal**:

```
1 Make sense of problems and persevere in solving them.
2 Reason abstractly and quantitatively.
...
8 Look for and express regularity in repeated reasoning.
```

The high-school conceptual-category overview pages — for example PDF page 82,
`HIGH SCHool — StatIStICS` — restate the same eight under the heading **"mathematical
Practices"** with a dotted ordinal, `1.` through `8.`

Searched across all 94 pages:

| Token | Occurrences |
| --- | ---: |
| `MP.1` … `MP.8` | **0** |
| `MP1` … `MP8` | **0** |
| `MP` as a standalone token | **0** |

## The verdict, stated precisely

Two separate facts, and collapsing them would be dishonest in either direction.

1. **The referents are real and verbatim.** Every `MP.N` the mathematics lane cites resolves to
   practice *N* of the Standards for Mathematical Practice, printed in full in the official
   Michigan document that the math lane itself pinned by digest. The lane did **not** invent a
   standard, and the r1 wording "the codes are real in the wider framework" understates it: they
   are real in *this* document, on pages the lane's own custody record covers.
2. **The code form is not official.** `MP.N` is a Common Core-community shorthand. This document
   prints no `MP` prefix anywhere. Under `release/authoring-boundaries.md` §7 — copy codes
   verbatim, do not construct or pattern-match — a bare `MP.N` citation with no resolution table
   is a constructed token.

So the defect was custody and traceability, exactly as the brief framed it. The math lane's
extraction script pulled the *content* standards (156 across 22 domains, reconciled by count)
and never touched the practice section, so nothing downstream could evidence the practice codes.
No mathematics instruction is wrong, and none is edited by this lane.

## The repair

[`mathematical-practice-map.json`](mathematical-practice-map.json) publishes all eight practices
with their official ordinal, their printed label form, and their verbatim statement, pinned to
the digest above. The seven cited tokens are reclassified from `UNTRACEABLE` to
`ALIAS_RESOLVED_VERBATIM` in
[`../registries/standards-evidence-registry.json`](../registries/standards-evidence-registry.json).

`ALIAS_RESOLVED_VERBATIM` is deliberately not `VERBATIM`. It means: *the referent is verbatim in
a digest-pinned official source, and the cited token is not printed by that source.* A reader who
wants to know whether Manuel Academy mathematics is aligned to a real Michigan standard gets
"yes". A reader who wants to know whether `MP.4` is a string Michigan publishes gets "no". Both
questions have honest answers in the registry, and the validator fails the run if the class is
ever folded into `VERBATIM`.

## What is still owed, and by whom

| # | Item | Owner | Severity |
| --- | --- | --- | --- |
| 1 | Adopt the printed ordinal form in citations, or reference this map from `mathematics/source-docs/standards/standards-custody.md` as the custody of record | `mac/hs912-math-r1` | Advisory |
| 2 | Extend the extraction script to capture the practice section, so a future re-run does not reproduce the same gap | `mac/hs912-math-r1` | Advisory |
| 3 | Decide whether practice 8, *Look for and express regularity in repeated reasoning*, should be cited at all — 7 of 8 are used, and nothing in the delivered content explains the omission | `mac/hs912-math-r1` | Advisory |

None of the three blocks a release. All three are recorded so that the next lane to touch
mathematics finds them.
