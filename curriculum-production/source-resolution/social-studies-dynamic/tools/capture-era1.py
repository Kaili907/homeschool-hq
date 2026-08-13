#!/usr/bin/env python3
"""Capture the Smithsonian records named in era1-candidates.json, verbatim.

Discovery ran through the repository's own search API -- the queries are listed
in era1-candidates.json under discoveryQueries -- and this script re-runs the
query recorded against each chosen record and stores the row exactly as the API
returned it. Nothing is edited on the way in.

  SI_API_KEY  api.data.gov key for the Smithsonian Open Access API. Falls back
              to DEMO_KEY, which api.data.gov caps at 10 requests per day --
              enough to spot-check, not enough for a full re-capture. Get a key
              before a release re-verification.
"""
import json
import os
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES = os.path.join(HERE, "era1-candidates.json")
OUT = os.path.join(HERE, "era1-raw-captures.json")
UA = {"User-Agent": "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"}
API_KEY = os.environ.get("SI_API_KEY") or "DEMO_KEY"
CHECKED_ON = os.environ.get("CHECKED_ON") or time.strftime("%Y-%m-%d")
SEARCH = "https://api.si.edu/openaccess/api/v1.0/search"


def search(query, rows=100):
    url = SEARCH + "?" + urllib.parse.urlencode(
        {"q": query, "rows": rows, "api_key": API_KEY})
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def main():
    cand = json.load(open(CANDIDATES, encoding="utf-8"))
    wanted = {spec["rowId"]: (key, spec) for key, spec in cand["sources"].items()}
    queries = sorted({spec["discoveredBy"] for spec in cand["sources"].values()})

    found = {}
    for query in queries:
        body = search(query)
        for row in body["response"]["rows"]:
            if row["id"] not in wanted:
                continue
            key, spec = wanted[row["id"]]
            reported = row["content"]["descriptiveNonRepeating"].get("record_ID")
            if reported != spec["recordId"]:
                raise ValueError("%s: row %s reports record_ID %r, candidates say %r"
                                 % (key, row["id"], reported, spec["recordId"]))
            found[key] = {"capturedOn": CHECKED_ON,
                          "capturedBy": "Smithsonian Open Access API search response",
                          "query": query, "endpoint": SEARCH, "record": row}
        time.sleep(1)

    missing = sorted(set(cand["sources"]) - set(found))
    if missing:
        raise SystemExit("not returned by their recorded query: %s" % ", ".join(missing))

    payload = {"generatedBy": "tools/capture-era1.py",
               "note": ("Verbatim rows as the Smithsonian Open Access API returned "
                        "them. Nothing in this file is authored, edited, or recalled."),
               "capturedOn": CHECKED_ON, "recordCount": len(found), "records": found}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("captured=%d -> %s" % (len(found), OUT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
