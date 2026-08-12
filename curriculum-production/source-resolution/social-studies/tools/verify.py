#!/usr/bin/env python3
"""Verify every catalogued source against its repository and record what the
repository itself reports.

Titles, dates, creators, and rights notes in verified-sources.json are copied
out of the repository response -- they are never authored here. A source that
does not resolve is written out with status FAILED and is not usable.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(HERE, "sources-catalog.json")
OUT = os.path.join(HERE, "verified-sources.json")
UA = {"User-Agent": "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"}
CHECKED_ON = os.environ.get("CHECKED_ON") or time.strftime("%Y-%m-%d")


def fetch(url, as_json, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                return (json.loads(raw) if as_json
                        else raw.decode("utf-8", "replace")), r.status
        except Exception as e:  # noqa: BLE001 - report, do not guess
            last = e
            time.sleep(3 * (i + 1))
    raise last


def first(v):
    if isinstance(v, list):
        return v[0] if v else None
    return v


def verify_loc(ref):
    url = "https://www.loc.gov/item/%s/?fo=json" % ref
    body, _ = fetch(url, True)
    item = body.get("item") or {}
    if not item:
        raise ValueError("no item payload")
    return {
        "publicUrl": "https://www.loc.gov/item/%s/" % ref,
        "title": item.get("title"),
        "date": item.get("date") or first(item.get("dates")),
        "createdPublished": first(item.get("created_published")),
        "creators": item.get("contributor_names") or item.get("contributors"),
        "format": item.get("format") or item.get("type"),
        "rights": item.get("rights") or item.get("rights_advisory")
                  or item.get("access_advisory"),
        "repositoryReported": {"id": item.get("id"), "sourceCollection": first(item.get("partof"))},
    }


def verify_met(ref):
    body, _ = fetch(
        "https://collectionapi.metmuseum.org/public/collection/v1/objects/%s" % ref, True)
    if not body.get("objectID"):
        raise ValueError("no objectID")
    return {
        "publicUrl": body.get("objectURL"),
        "title": body.get("title"),
        "date": body.get("objectDate"),
        "createdPublished": body.get("objectDate"),
        "creators": [x for x in [body.get("artistDisplayName"), body.get("culture"),
                                 body.get("period")] if x] or None,
        "format": body.get("medium"),
        "rights": ("Public domain / CC0 (Met Open Access)" if body.get("isPublicDomain")
                   else body.get("rightsAndReproduction") or "Not flagged public domain"),
        "repositoryReported": {
            "department": body.get("department"),
            "creditLine": body.get("creditLine"),
            "isPublicDomain": body.get("isPublicDomain"),
            "accessionYear": body.get("accessionYear"),
        },
    }


MIN_BODY_CHARS = 800


def body_text(html_doc):
    stripped = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", html_doc)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", stripped)).strip()


def verify_html(url, rights):
    html, status = fetch(url, False)
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    title = re.sub(r"\s+", " ", m.group(1)).strip() if m else None
    if status != 200 or not title or "Page Not Found" in title or "404" in (title or ""):
        raise ValueError("bad page: status=%s title=%r" % (status, title))
    # A 200 and a plausible <title> are not enough: a frameset shell or a
    # navigation stub answers both and carries none of the document.
    if re.search(r"(?i)<frameset\b", html):
        raise ValueError("frameset shell, not the document itself")
    text = body_text(html)
    if len(text) < MIN_BODY_CHARS:
        raise ValueError("page carries only %d chars of text; expected >= %d"
                         % (len(text), MIN_BODY_CHARS))
    return {
        "publicUrl": url,
        "title": title,
        "date": None,
        "createdPublished": None,
        "creators": None,
        "format": "text/html transcription or presentation page",
        "rights": rights,
        "repositoryReported": {"httpStatus": status, "htmlTitle": title,
                               "bodyTextChars": len(text)},
    }


def main():
    cat = json.load(open(CATALOG, encoding="utf-8"))
    repos = cat["repositories"]
    out = {}
    ok = 0
    for key, spec in sorted(cat["sources"].items()):
        repo, ref = spec["repo"], spec["ref"]
        rec = {"sourceKey": key, "repository": repos[repo]["name"], "repo": repo,
               "ref": ref, "kind": spec["kind"], "checkedOn": CHECKED_ON}
        try:
            if repo == "loc":
                rec.update(verify_loc(ref))
            elif repo == "met":
                rec.update(verify_met(ref))
            else:
                rec.update(verify_html(repos[repo]["publicUrl"].replace("{ref}", ref),
                                       repos[repo]["rightsPosture"]))
            rec["status"] = "VERIFIED"
            ok += 1
        except Exception as e:  # noqa: BLE001
            rec["status"] = "FAILED"
            rec["error"] = str(e)[:200]
        out[key] = rec
        print("%-9s %-40s %s" % (rec["status"], key, (rec.get("title") or rec.get("error") or "")[:70]))
        time.sleep(0.8)

    payload = {"generatedBy": "tools/verify.py", "checkedOn": CHECKED_ON,
               "verifiedCount": ok, "failedCount": len(out) - ok, "sources": out}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("\nVERIFIED=%d FAILED=%d -> %s" % (ok, len(out) - ok, OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
