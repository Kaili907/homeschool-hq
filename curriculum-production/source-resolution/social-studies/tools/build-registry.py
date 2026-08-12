#!/usr/bin/env python3
"""Build the machine-readable lessonRef -> verified-source registry.

Inputs (all generated or selection-only):
  unit-inventory.json    lesson/unit structure read from the shipped packages
  sources-catalog.json   which repository refs were selected
  verified-sources.json  what those repositories actually returned
  source-advisories.json classroom-handling notes authored for this curriculum

A unit resolves only when every source assigned to it verified. Anything else
is written out UNRESOLVED and keeps sourceIntegrityStatus UNKNOWN.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_SOURCES_PER_UNIT = 2


def load(name):
    return json.load(open(os.path.join(HERE, name), encoding="utf-8"))


def clean(v):
    return html.unescape(v).strip() if isinstance(v, str) else v


CITATION_TITLE_TRIMS = [
    (r"^\s*(The\s+)?Avalon Project\s*[:\-]\s*", ""),
    (r"\s*\|\s*National Archives\s*$", ""),
]


def citation_title(title, repo):
    """Avalon and NARA page <title>s carry site furniture ('... | National
    Archives'). Trim it for the citation field; the untouched HTML title stays
    in verification.repositoryReported."""
    if not title or repo not in ("avalon", "nara"):
        return title
    out = title
    for pattern, repl in CITATION_TITLE_TRIMS:
        out = re.sub(pattern, repl, out)
    return out.strip() or title


def plain(v):
    """Repository rights statements arrive as HTML blobs or lists of them.
    Flatten to one readable plain-text line so the registry stays legible."""
    if v is None:
        return None
    parts = v if isinstance(v, list) else [v]
    text = " ".join(str(p) for p in parts)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def main():
    inv = load("unit-inventory.json")
    catalog = load("sources-catalog.json")
    verified = load("verified-sources.json")["sources"]
    assignments = load("unit-assignments.json")["assignments"]
    advisories = load("source-advisories.json")["advisories"]

    sources = {}
    for key, rec in verified.items():
        if rec["status"] != "VERIFIED":
            continue
        sources[key] = {
            "sourceKey": key,
            "repository": rec["repository"],
            "kind": rec["kind"],
            "title": citation_title(clean(rec.get("title")), rec["repo"]),
            "date": clean(rec.get("date")),
            "createdPublished": clean(rec.get("createdPublished")),
            "creators": rec.get("creators"),
            "format": rec.get("format"),
            "url": rec.get("publicUrl"),
            "rightsAndAccess": plain(rec.get("rights")) or catalog["repositories"][rec["repo"]]["rightsPosture"],
            "repositoryRightsPosture": catalog["repositories"][rec["repo"]]["rightsPosture"],
            "verification": {
                "status": "VERIFIED",
                "checkedOn": rec["checkedOn"],
                "method": ("repository JSON API" if rec["repo"] in ("loc", "met")
                           else "HTTP fetch + document title match"),
                "repositoryReported": rec.get("repositoryReported"),
            },
            "handlingNotes": advisories.get(key, []),
        }

    entries, resolved, unresolved = [], 0, 0
    unit_notes = {}
    for unit in inv["units"]:
        ref = unit["unitRef"]
        spec = assignments.get(ref)
        keys = list(spec["sourceKeys"]) if spec else []
        missing = [k for k in keys if k not in sources]
        declared_unresolved = bool(spec and spec.get("unresolved"))
        ok = (not declared_unresolved and bool(keys) and not missing
              and len(keys) >= MIN_SOURCES_PER_UNIT)
        reason = None
        if declared_unresolved:
            reason = spec.get("reason") or "declared unresolved"
        elif not keys:
            reason = "no anchor sources were selected for this unit"
        elif missing:
            reason = "assigned sources failed verification: %s" % ", ".join(missing)
        elif len(keys) < MIN_SOURCES_PER_UNIT:
            reason = "fewer than %d verified anchor sources" % MIN_SOURCES_PER_UNIT
        unit_notes[ref] = {
            "unitRef": ref, "unitTitle": unit["unitTitle"], "grade": unit["grade"],
            "resolution": "RESOLVED" if ok else "UNRESOLVED",
            "rationale": spec.get("rationale") if spec else None,
            "unresolvedReason": reason,
            "sourceKeys": keys,
        }
        for lesson_ref in unit["lessonRefs"]:
            entries.append({
                "lessonRef": lesson_ref,
                "courseId": unit["courseId"],
                "grade": unit["grade"],
                "unitRef": ref,
                "unitTitle": unit["unitTitle"],
                "resolution": "RESOLVED" if ok else "UNRESOLVED",
                "sourceIntegrityStatus": "VERIFIED" if ok else "UNKNOWN",
                "anchorSourceKeys": keys if ok else [],
                "unresolvedReason": reason,
            })
            if ok:
                resolved += 1
            else:
                unresolved += 1

    payload = {
        "registryVersion": 1,
        "generatedBy": "tools/build-registry.py",
        "scope": {"subject": "social-studies", "grades": inv["grades"],
                  "lessonCount": len(entries)},
        "policy": {
            "noInvention": "Every title, date, creator, and URL in `sources` was returned by the named repository at verification time.",
            "retrievalRequired": "The registry names and verifies a source; it does not reproduce it. The teacher/tutor retrieves the actual document, map, or object from the URL before the lesson is scored.",
            "quotations": "No quoted source text is stored here. Learners transcribe quotations from the retrieved source.",
            "minSourcesPerUnit": MIN_SOURCES_PER_UNIT,
        },
        "totals": {"resolved": resolved, "unresolved": unresolved,
                   "verifiedSources": len(sources),
                   "failedSources": len(verified) - len(sources)},
        "units": [unit_notes[u["unitRef"]] for u in inv["units"]],
        "sources": sources,
        "lessons": entries,
    }
    out = os.path.join(HERE, "source-registry.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("lessons resolved=%d unresolved=%d | sources verified=%d failed=%d"
          % (resolved, unresolved, len(sources), len(verified) - len(sources)))
    print("-> %s" % out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
