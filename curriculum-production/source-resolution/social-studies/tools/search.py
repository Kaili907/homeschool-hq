#!/usr/bin/env python3
"""Discovery helper: query public repository APIs and print what they return.

Used so candidate sources are *found* in the repositories rather than recalled.
Every field printed here comes back from the repository's own API.

usage: search.py loc  "<query>" [--kind maps|photos|item] [--n 6]
       search.py met  "<query>" [--n 6]
       search.py nara "<query>" [--n 6]
"""
import json
import sys
import urllib.parse
import urllib.request

UA = {"User-Agent": "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"}


def get(url, timeout=45):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def loc(query, kind="search", n=6):
    base = {"search": "https://www.loc.gov/search/",
            "maps": "https://www.loc.gov/maps/",
            "photos": "https://www.loc.gov/photos/",
            "manuscripts": "https://www.loc.gov/manuscripts/",
            "notated": "https://www.loc.gov/notated-music/"}[kind]
    url = base + "?" + urllib.parse.urlencode(
        {"q": query, "fo": "json", "c": n, "at": "results"})
    for r in get(url).get("results", [])[:n]:
        print(json.dumps({
            "url": r.get("id") if str(r.get("id", "")).startswith("http") else r.get("url"),
            "title": r.get("title"),
            "date": r.get("date"),
            "contributor": r.get("contributor"),
            "original_format": r.get("original_format"),
            "online_format": r.get("online_format"),
            "rights": (r.get("rights") or [""])[0] if isinstance(r.get("rights"), list) else r.get("rights"),
        }, ensure_ascii=False))


def met(query, n=6):
    url = ("https://collectionapi.metmuseum.org/public/collection/v1/search?"
           + urllib.parse.urlencode({"q": query, "hasImages": "true"}))
    ids = (get(url).get("objectIDs") or [])[:n]
    for oid in ids:
        o = get("https://collectionapi.metmuseum.org/public/collection/v1/objects/%d" % oid)
        print(json.dumps({
            "objectID": oid,
            "url": o.get("objectURL"),
            "title": o.get("title"),
            "date": o.get("objectDate"),
            "culture": o.get("culture"),
            "department": o.get("department"),
            "medium": o.get("medium"),
            "isPublicDomain": o.get("isPublicDomain"),
        }, ensure_ascii=False))


def nara(query, n=6):
    url = ("https://catalog.archives.gov/api/v2/records/search?"
           + urllib.parse.urlencode({"q": query, "limit": n}))
    body = get(url)
    hits = (((body.get("body") or {}).get("hits") or {}).get("hits")) or []
    for h in hits[:n]:
        d = h.get("_source", {}).get("record", {})
        print(json.dumps({
            "naId": d.get("naId"),
            "url": "https://catalog.archives.gov/id/%s" % d.get("naId"),
            "title": d.get("title"),
            "date": (d.get("productionDates") or d.get("coverageStartDate") or ""),
            "levelOfDescription": d.get("levelOfDescription"),
            "recordType": d.get("recordType"),
        }, ensure_ascii=False, default=str))


if __name__ == "__main__":
    a = sys.argv[1:]
    src, q = a[0], a[1]
    kw = {}
    for i, t in enumerate(a):
        if t == "--n":
            kw["n"] = int(a[i + 1])
        if t == "--kind":
            kw["kind"] = a[i + 1]
    {"loc": loc, "met": met, "nara": nara}[src](q, **kw)
