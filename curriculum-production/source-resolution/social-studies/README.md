# Social Studies source resolution -- grades 3, 4, 5, 7, 8

The shipped Social Studies packages for these five grades named *repositories*
("Library of Congress", "National Archives DocsTeach") but no specific source.
The production readiness gate therefore left all 540 of their lessons at
`NEEDS_HUMAN_REVIEW` with the note *"source integrity requires verification but
has not been checked"*. This directory resolves that: it selects an item-level
anchor source set for each of the 45 units, verifies every source against the
repository that holds it, and records the result as a machine-readable registry
keyed by `lessonRef`.

## The rule this directory is built around

**Nothing here is recalled from memory.** Every title, date, creator, and URL in
`verified-sources.json` and `source-registry.json` was returned by the named
repository at verification time. Candidate items were *discovered* through the
repositories' own search APIs (`tools/search.py`, `tools/batch_search.py`) rather
than remembered, then re-fetched and recorded verbatim by `tools/verify.py`.

The registry **names and verifies** a source. It does not reproduce one. No
source text or quotation is stored here; the teacher/tutor retrieves the actual
document, map, or object from the recorded URL, and the learner transcribes any
quotation from what they retrieved. That is the same rule the lesson packages
already state under **Source integrity**.

## Files

| File | What it is |
|---|---|
| `source-registry.json` | **The deliverable.** `lessonRef` -> resolution status, unit, anchor source keys; plus the full verified metadata for every source and a per-unit rationale. |
| `SOURCE-REGISTRY.md` | Generated human-readable view of the same thing. |
| `verified-sources.json` | Raw capture of what each repository returned, per source, with the check date. The audit trail. |
| `sources-catalog.json` | Selection input: repository + item ref per source key. No metadata is authored here. |
| `unit-assignments.json` | Which verified sources anchor which unit, and why. |
| `source-advisories.json` | Classroom-handling notes authored for this curriculum (sensitive content, primary-vs-secondary cautions). Editorial judgement, clearly separated from repository fact. |
| `unit-inventory.json` | Unit/lesson structure extracted from the shipped packages. Generated. |
| `readiness-reevaluation.json` / `.md` | The production readiness gate re-run with this registry applied. |

## Repositories used

- **Library of Congress** -- maps, photographs, printed documents. Verified through the item JSON API (`/item/<ref>/?fo=json`).
- **The Metropolitan Museum of Art (Open Access)** -- objects for world-history units where no text survives. Verified through the collection API; the `isPublicDomain` flag is captured as returned.
- **The Avalon Project, Yale Law School** -- transcriptions of public-domain legal and historical documents. Where a transcription carries a named translator or editor (Hammurabi, for one), that layer is disclosed in `source-advisories.json` so the learner cites it.
- **U.S. National Archives, Milestone Documents** -- federal records with transcripts and links to the digitized originals. Slugs were taken from the Archives' own index page, not guessed.

Avalon and NARA pages are verified by HTTP fetch plus a document-title match
**and** a body-content assertion: a frameset shell or a navigation stub answers
200 with a plausible `<title>` while carrying none of the document, so
`tools/verify.py` rejects any page containing a `<frameset>` or fewer than 800
characters of text. That check is what caught Avalon's Magna Carta and Code of
Hammurabi entry points, which are frame wrappers rather than the texts.

## Resolution rule

A unit resolves only when **every** source assigned to it verified and it has at
least two verified anchor sources. Anything else is written out `UNRESOLVED`
and keeps `sourceIntegrityStatus: UNKNOWN`, so the gate continues to hold those
lessons back rather than passing them on a guess. A unit can also be *declared*
unresolved in `unit-assignments.json` with a stated reason, which is what the
two below do.

### Result

| | |
|---|---|
| Units resolved | 43 of 45 |
| Lessons resolved | 516 of 540 |
| Lessons left unresolved | 24 |
| Distinct verified sources | 108 |

Two units are deliberately unresolved:

- **`ma-g3-social-studies-u09`** -- *Capstone: Taking Informed Action on a Michigan
  Public Issue.* The capstone turns on an issue the learner chooses now, so no
  anchor fixed in advance is evidence about it. The teacher attaches the issue's
  own sources when the issue is chosen.
- **`ma-g7-social-studies-u02`** -- *Era 1: Beginnings of Human Society.* Nothing
  in these four repositories sits reliably inside Era 1. Padding the unit to the
  two-source minimum with a later object would have been a guess dressed as a
  check.

## Re-running

```bash
tools/rebuild-all.sh              # inventory -> registry -> markdown -> readiness re-run
tools/rebuild-all.sh --reverify   # same, but re-check every source against its repository first
```

Regenerate through that script rather than running the steps by hand: it keeps
the registry, its rendered view, and the readiness report from sitting on disk
in a mutually stale state.

`tools/verify.py` records a `checkedOn` date per source. Links rot: re-run it
before a release and treat any `FAILED` source as an unresolved unit again.

## Scope

This directory is the only thing this lane writes. The shipped packages under
`curriculum-production/student-work/social-studies/` and their `_gate/` outputs
are read-only inputs here; folding the registry into the packages themselves is
a separate change.
