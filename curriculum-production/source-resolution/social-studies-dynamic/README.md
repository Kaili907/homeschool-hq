# Social Studies dynamic source handling -- the last 24 lessons

The upstream lane
(`curriculum-production/source-resolution/social-studies/`) resolved 516 of 540
Social Studies lessons against four repositories and stopped, honestly, at two
units it could not resolve without guessing:

- **`ma-g3-social-studies-u09`** -- *Capstone: Taking Informed Action on a
  Michigan Public Issue* (12 lessons)
- **`ma-g7-social-studies-u02`** -- *Era 1: Beginnings of Human Society*
  (12 lessons)

This directory finishes those 24. It does not finish them the same way, because
they are not stuck for the same reason.

## The rule this directory inherits

**Nothing here is recalled from memory.** No title, date, creator, URL, or
quotation is authored anywhere in this lane -- not in the registry, not in the
contract, and not in an attachment a tutor records later. Sources are named and
verified; they are never reproduced. No source text is stored here.

## Grade 7, Era 1: resolved against a fifth repository

The upstream lane searched the Library of Congress, the Met, Avalon, and NARA.
None of them holds much inside Era 1, and the lane refused to pad the unit to
its two-source minimum with a later object. That refusal was right. It was a
statement about four repositories, though, not about the world.

The **Smithsonian Institution, National Museum of Natural History, Department
of Anthropology** publishes its excavated collections through the Smithsonian
Open Access API. Four records anchor the unit, discovered through the
repository's own search API and captured verbatim:

| Source key | Record title and place, verbatim | Repository's culture value, verbatim |
|---|---|---|
| `si-nmnhanthro-8197795` | Paleoliths, Coup De Poings -- Nsongezi, Ankole, Uganda | Acheulian |
| `si-nmnhanthro-8179176` | Mousterian Type Point, Broken -- Shanidar Cave, Iraq | Upper Paleolithic, Baradostian; Middle Paleolithic, Mousterian |
| `si-nmnhanthro-14944765` | Obsidian Bladelet -- Shanidar Cave, Iraq | Protoneolithic |
| `si-nmnhanthro-8177415` | Querns -- Zawi Chemi Shanidar, Iraq | Protoneolithic |

### What these records do and do not establish

They carry **no absolute date for the object**. The repository's date fields are
accession and collection events -- when the museum received the material and
when it was dug -- and `era1-verified-sources.json` records them as exactly
that, with `objectAgeReported: false`.

The Era 1 claim therefore rests on two things, and the second one is not the
repository's: its own culture value for each record, and **this lane's reading
of those culture names as falling inside Era 1**. The repository never says
`Acheulian` is older than 4000 BCE. That mapping is a judgement, so it is
declared as data in `era1-candidates.json` under `era1CultureMapping` and read
from there by the build tool rather than buried in it. It is the right place to
argue with this resolution.

Two of those assignments are **typological**: an Acheulian coup-de-poing and a
Mousterian point are typed by how they were made, so the label travels with the
object. Two are **site-assigned**: `Protoneolithic` is the excavation's label
for the layer or lot.

A site assignment is not a date for an individual object, and this collection
proves it. The same `Protoneolithic` label sits on two Zawi Chemi Shanidar
records that cannot be Era 1, so both are registered:

| Source key | Record title, verbatim | Repository's culture value, verbatim |
|---|---|---|
| `si-nmnhanthro-8177446` | Iron Spearpoint | Protoneolithic |
| `si-nmnhanthro-8177447` | Copper Coin Or Medallion | Protoneolithic |

Each is a `METHOD_COUNTEREXAMPLE`, `usableAsEra1Evidence: false`, counting
toward nothing. They are the unit's honest material for lesson 6, *limits of
archaeological evidence*: a catalogue label is not a date, and here are the
museum's own records proving it.

The unit's two-source minimum is met by the two typologically assigned anchors
alone, so the resolution does not depend on the site-assigned pair.

## Grade 3, the capstone: a contract, not a source

The Grade 3 capstone argues about a public issue **the learner picks at
teaching time**. Evidence about that issue does not exist until the issue does.
No amount of searching fixes this, because the problem is not that the source
is hard to find -- it is that the source is not determined yet. Registering a
Michigan map here would be a source check nobody performed.

So the unit is governed by `DYNAMIC_SOURCE_REQUIREMENT`
(`dynamic-source-contract.json`), which states in advance and in
machine-checkable form:

- **what qualifies** -- six clauses every source must satisfy, five qualifying
  kinds of source, and six disqualifiers (no responsible party, no date, model-
  generated text, unidentified reposts, anything the adult could not open,
  anything that is about the topic but not about the learner's issue);
- **source authority** -- four tiers, with the rule that a unit needs at least
  one official record or named independent reporting, that an interested
  party's own statement or the learner's own interview can never stand alone,
  and that a contested issue needs two different responsible parties;
- **who selects and how** -- the adult reads the whole source before attaching
  it, previews it for safety and reading level, records who chose it and when,
  and does not write the learner's claim or citation; privacy rules keep the
  learner out of their own evidence base;
- **evidence metadata** -- 21 fields every attachment must carry, each one
  copied from the retrieved source or recorded by the adult who retrieved it;
- **what happens when there is no source** -- the lesson is
  `PENDING_SOURCE_ATTACHMENT`, reported as pending. Not READY. Not verified.

**The contract makes the requirement checkable. It does not satisfy it.**
`attachments.json` is empty, so all 12 lessons are pending, and the projection
and the readiness report both say so.

## The projection

`source-projection.json` is the deliverable release admission reads. One row
per lesson across all 972 Social Studies lessons, classified:

| Class | Meaning for admission |
|---|---|
| `STATIC_VERIFIED_SOURCE` | A named source set was verified against the repository that holds it. Admit. |
| `DYNAMIC_SOURCE_REQUIRED` | Evidence is chosen at teaching time. Admit only when `dynamicState` is `ATTACHED_SATISFIED`. |
| `UNRESOLVED` | Neither. Hold back. |
| `NOT_ASSESSED_BY_SOURCE_REGISTRY` | Grades 9-12, whose gate input already asserts `VERIFIED`. This lane checked nothing there, so `admissible` is `null` -- and a release must not read `null` as `true`. |

The static classification is not a stored verdict. `tools/build-projection.py`
re-derives it every run from what the anchor records on disk say, and demotes a
unit to `UNRESOLVED` if an anchor is missing, is marked failed, has no link
check recorded, or the minimums stop being met. What it cannot do is notice
that a record changed at the repository: only `tools/verify-era1.py` re-fetches,
and it writes nothing. So a rebuild that skips `--recapture` re-derives from
stale captures. Run `verify-era1.py` before a release and act on any `DRIFT` or
`FAILED` yourself -- that one is a human obligation, not machine behaviour.

The dynamic classification checks the *shape* of an attestation: required
fields, the declared kind and tier against the contract's own vocabularies and
against each other, the adult's read-in-full and preview record, recorded dates
inside the 180-day revalidation window, and the unit's authority rules. It
cannot check that the source says what the adult says it says. That is the
adult's attestation and no validator settles it -- which is why the contract
puts reading the whole source before attaching it on a named person.

## Files

| File | What it is |
|---|---|
| `source-projection.json` | **The deliverable.** Per-lesson class, admissibility, and blocker, for release admission. |
| `SOURCE-PROJECTION.md` | Generated human-readable view. |
| `dynamic-source-contract.json` | `DYNAMIC_SOURCE_REQUIREMENT`: what a teaching-time source must be, who may attach it, what metadata it carries, and what happens when there is none. |
| `attachments.json` | The tutor attachment ledger. Empty, deliberately. |
| `unit-resolutions.json` | The two units' resolutions, their rationales, and the disclosures the Grade 7 resolution depends on. Editorial judgement, kept separate from repository fact. |
| `era1-candidates.json` | Selection input: repository, row id, record id, role, period basis, and the declared culture-to-Era-1 mapping. No repository metadata is authored here. |
| `era1-raw-captures.json` | Verbatim API rows. The audit trail. |
| `era1-verified-sources.json` | Normalised from the captures, with the period claim and the link check stated per record. |
| `readiness-policy.json` | How release admission must read the projection, and the invariants it must not break. |
| `readiness-after-policy.json` / `.md` | The shipped readiness gate re-run with the projection applied. |

## Re-running

```bash
tools/rebuild-all.sh              # sources -> link check -> projection -> markdown -> readiness
tools/rebuild-all.sh --recapture  # same, but re-capture every record from the repository first
tools/verify-era1.py              # re-fetch each record and report drift; exits non-zero on any
```

Both Smithsonian tools read `SI_API_KEY` (an api.data.gov key). Without one
they fall back to `DEMO_KEY`, which api.data.gov caps at **10 requests per
day** -- enough to spot-check a record, not enough for a full re-capture. Get a
key before a release re-verification. The ARK link check needs no key.

Link rot and label drift are both real: `verify-era1.py` compares the title,
record id, and culture values against what was registered, and any `DRIFT` or
`FAILED` result means the unit is unresolved again until someone re-selects.

## Scope

This directory is the only thing this lane writes. The shipped packages under
`curriculum-production/student-work/social-studies/`, their `_gate/` outputs,
and the upstream `source-resolution/social-studies/` registry are read-only
inputs. Folding either registry into the packages themselves is a separate
change.
