#!/usr/bin/env python3
"""Run a batch of repository searches with polite pacing; print compact hits."""
import json, sys, time, urllib.parse, urllib.request

UA = {"User-Agent": "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"}
BASE = {"search": "https://www.loc.gov/search/", "maps": "https://www.loc.gov/maps/",
        "photos": "https://www.loc.gov/photos/", "manuscripts": "https://www.loc.gov/manuscripts/",
        "notated": "https://www.loc.gov/notated-music/", "collections": "https://www.loc.gov/collections/"}

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1:
                print("  !! %s" % e)
                return {}
            time.sleep(4 * (i + 1))

def loc(q, kind, n):
    url = BASE[kind] + "?" + urllib.parse.urlencode({"q": q, "fo": "json", "c": n, "at": "results"})
    for r in (get(url).get("results") or [])[:n]:
        ident = r.get("id") or ""
        if not str(ident).startswith("http"):
            ident = r.get("url") or ""
        print("  - %s | %s | %s" % (r.get("date"), (r.get("title") or "")[:88], ident))

def met(q, n):
    url = "https://collectionapi.metmuseum.org/public/collection/v1/search?" + urllib.parse.urlencode(
        {"q": q, "hasImages": "true"})
    for oid in ((get(url).get("objectIDs") or [])[:n]):
        o = get("https://collectionapi.metmuseum.org/public/collection/v1/objects/%d" % oid) or {}
        print("  - %s | %s | %s | PD=%s | %s" % (o.get("objectDate"), (o.get("title") or "")[:70],
              o.get("culture") or o.get("department"), o.get("isPublicDomain"), o.get("objectURL")))

for line in sys.stdin:
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    repo, kind, n, q = line.split("\t")
    print("### [%s/%s] %s" % (repo, kind, q))
    if repo == "loc":
        loc(q, kind, int(n))
    else:
        met(q, int(n))
    time.sleep(1.5)
