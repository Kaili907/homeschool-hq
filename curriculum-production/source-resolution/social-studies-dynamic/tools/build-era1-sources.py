#!/usr/bin/env python3
"""Normalise the verbatim Smithsonian captures into era1-verified-sources.json.

Every value written here is lifted out of era1-raw-captures.json. Nothing is
authored, and nothing is inferred beyond the two mechanical judgements that are
declared explicitly on each record:

  * `repositoryReportedDates` restates the record's own date labels and says
    what they are -- accession and collection events, not the object's age. The
    NMNH anthropology records carry no absolute date for these objects.
  * `periodClaim` says whether the repository's own `culture` values all sit
    inside Era 1 (beginnings to 4000 BCE), and on what basis the assignment
    rests. Both the basis and the culture -> Era 1 mapping come from
    era1-candidates.json, where the mapping is declared as this lane's
    judgement rather than repository fact.
"""
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURES = os.path.join(HERE, "era1-raw-captures.json")
CANDIDATES = os.path.join(HERE, "era1-candidates.json")
OUT = os.path.join(HERE, "era1-verified-sources.json")

PERIOD_BASIS_TEXT = {
    "TYPOLOGICAL": (
        "The period label names a stone-tool industry that is read off the way "
        "the object itself was made, so it travels with the object rather than "
        "with the excavation lot."
    ),
    "SITE_ASSIGNED": (
        "The period label is the excavation's assignment for the site or lot. "
        "It is not an independent date for this object -- the same label sits "
        "on demonstrably later intrusive finds from the same site."
    ),
}

COUNTEREXAMPLE_BASIS_TEXT = (
    "Registered because the repository's period label and the record's own "
    "object type contradict each other. It is the evidence that a site "
    "assignment is not a date, and it anchors nothing."
)


def labelled(freetext, field):
    return [{"label": x.get("label"), "content": x.get("content")}
            for x in freetext.get(field, [])]


def contents(freetext, field, label=None):
    return [x.get("content") for x in freetext.get(field, [])
            if label is None or x.get("label") == label]


def main():
    caps = json.load(open(CAPTURES, encoding="utf-8"))
    cand = json.load(open(CANDIDATES, encoding="utf-8"))
    repos = cand["repositories"]
    # The culture -> Era 1 mapping is this lane's judgement, not the
    # repository's. It is declared in era1-candidates.json so it can be argued
    # with, and read from there rather than hardcoded here.
    mapping = cand["era1CultureMapping"]
    era1_cultures = set(mapping["era1Cultures"])
    out = {}
    for key, spec in cand["sources"].items():
        cap = caps["records"][key]
        rec = cap["record"]
        ft = rec["content"]["freetext"]
        dn = rec["content"]["descriptiveNonRepeating"]
        cultures = contents(ft, "culture")
        in_period = bool(cultures) and all(c in era1_cultures for c in cultures)
        out[key] = {
            "sourceKey": key,
            "repository": repos[spec["repo"]]["name"],
            "kind": "museum object record",
            "title": rec["title"],
            "recordId": dn.get("record_ID"),
            "guid": dn.get("guid"),
            "publicUrl": dn.get("record_link"),
            "metadataAccess": (dn.get("metadata_usage") or {}).get("access"),
            "dataSource": dn.get("data_source"),
            "objectType": contents(ft, "objectType"),
            "cultureReported": cultures,
            "siteName": contents(ft, "name", "Site Name"),
            "place": contents(ft, "place"),
            "collectors": contents(ft, "name", "Collector"),
            "donor": contents(ft, "name", "Donor Name"),
            "identifiers": labelled(ft, "identifier"),
            "physicalDescription": labelled(ft, "physicalDescription"),
            "specimenCount": (contents(ft, "notes", "Specimen Count") or [None])[0],
            "recordLastModified": (contents(ft, "notes", "Record Last Modified") or [None])[0],
            "repositoryNotes": contents(ft, "notes", "Notes"),
            "repositoryReportedDates": {
                "labels": labelled(ft, "date"),
                "objectAgeReported": False,
                "statement": ("The repository reports accession and collection "
                              "events, not the object's age. No absolute date "
                              "for the object is claimed anywhere in this lane."),
            },
            "periodClaim": {
                "labelInEra1": in_period,
                "usableAsEra1Evidence": in_period and spec["role"] == "ERA1_ANCHOR"
                                        and not spec.get("contradiction"),
                "role": spec["role"],
                "basis": spec["periodBasis"],
                "basisStatement": (COUNTEREXAMPLE_BASIS_TEXT
                                   if spec["role"] == "METHOD_COUNTEREXAMPLE"
                                   else PERIOD_BASIS_TEXT[spec["periodBasis"]]),
                "era1MappingIsALaneJudgement": mapping["statement"],
                "restsOn": "the repository's own culture value(s): %s" % "; ".join(cultures),
                "contradiction": spec.get("contradiction"),
                "countsTowardAnchorMinimum": (in_period and spec["role"] == "ERA1_ANCHOR"
                                              and not spec.get("contradiction")),
            },
            "verification": {
                "status": "VERIFIED",
                "checkedOn": cap["capturedOn"],
                "method": "Smithsonian Open Access API",
                "query": cap["query"],
                "endpoint": cap["endpoint"],
                "recordEndpointRecheck": cap.get("recordEndpointRecheck"),
            },
            "quotation": "None. No source text is reproduced in this lane.",
        }
    anchors = [k for k, v in out.items() if v["periodClaim"]["countsTowardAnchorMinimum"]]
    payload = {
        "generatedBy": "tools/build-era1-sources.py",
        "capturedOn": caps["capturedOn"],
        "era1CultureMapping": mapping,
        "sourceCount": len(out),
        "era1AnchorCount": len(anchors),
        "era1AnchorKeys": sorted(anchors),
        "sources": out,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("sources=%d era1Anchors=%d -> %s" % (len(out), len(anchors), OUT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
