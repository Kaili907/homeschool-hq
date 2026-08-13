#!/usr/bin/env python3
"""Re-fetch each registered record from the repository and report any drift.

Reads era1-verified-sources.json, asks the Smithsonian Open Access API for each
record by its own row id, and compares the title, record id, and culture values
against what this lane registered. A record that no longer resolves, or whose
period-bearing fields have changed, is a resolution that has stopped being true:
treat the unit as unresolved until it is re-selected.

Writes nothing. Exits non-zero on any failure or drift.

  SI_API_KEY  api.data.gov key. DEMO_KEY is capped at 10 requests per day.
"""
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(HERE, "era1-verified-sources.json")
CANDIDATES = os.path.join(HERE, "era1-candidates.json")
UA = {"User-Agent": "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"}
API_KEY = os.environ.get("SI_API_KEY") or "DEMO_KEY"
CONTENT = "https://api.si.edu/openaccess/api/v1.0/content/%s?api_key=%s"


def main():
    doc = json.load(open(SOURCES, encoding="utf-8"))
    cand = json.load(open(CANDIDATES, encoding="utf-8"))
    bad = 0
    for key, src in doc["sources"].items():
        row_id = cand["sources"][key]["rowId"]
        try:
            req = urllib.request.Request(CONTENT % (row_id, API_KEY), headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                body = json.load(r)
            rec = body["response"]
            ft = rec["content"]["freetext"]
            drift = []
            if rec["title"] != src["title"]:
                drift.append("title %r -> %r" % (src["title"], rec["title"]))
            reported = rec["content"]["descriptiveNonRepeating"].get("record_ID")
            if reported != src["recordId"]:
                drift.append("recordId %r -> %r" % (src["recordId"], reported))
            cultures = [x["content"] for x in ft.get("culture", [])]
            if cultures != src["cultureReported"]:
                drift.append("culture %r -> %r" % (src["cultureReported"], cultures))
            if drift:
                bad += 1
                print("DRIFT    %-26s %s" % (key, "; ".join(drift)))
            else:
                print("VERIFIED %-26s %s" % (key, rec["title"][:60]))
        except Exception as e:  # noqa: BLE001 - report, do not guess
            bad += 1
            print("FAILED   %-26s %s" % (key, str(e)[:120]))
        time.sleep(1)
    print("\nchecked=%d problems=%d" % (len(doc["sources"]), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
