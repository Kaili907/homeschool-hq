#!/usr/bin/env python3
"""Follow each registered record's own ARK and record where it lands.

Needs no API key. The ARK is the link the repository publishes for the record
(`descriptiveNonRepeating.record_link`); this checks that it still resolves and
stamps the resolved location into era1-verified-sources.json. A record whose
ARK stops resolving is a link-rot failure and must be treated as unresolved.

Uses curl rather than urllib: the NMNH collections site trickles its response
slowly enough that a Python socket timeout does not reliably fire, and curl's
--max-time bounds the whole transfer.
"""
import json
import os
import subprocess
import time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(HERE, "era1-verified-sources.json")
UA = "ManuelAcademy-SourceResolution/1.0 (curriculum sourcing)"
CHECKED_ON = os.environ.get("CHECKED_ON") or time.strftime("%Y-%m-%d")


def follow(url):
    out = subprocess.run(
        ["curl", "-sSL", "--max-time", "60", "-o", os.devnull,
         "-A", UA, "-w", "%{http_code} %{url_effective}", url],
        capture_output=True, text=True, timeout=90)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "curl exit %d" % out.returncode)
    status, _, final = out.stdout.strip().partition(" ")
    return int(status), final


def main():
    doc = json.load(open(SOURCES, encoding="utf-8"))
    ok = 0
    for key, src in doc["sources"].items():
        try:
            status, final = follow(src["publicUrl"])
            if status != 200:
                raise RuntimeError("HTTP %d" % status)
            src["linkCheck"] = {"checkedOn": CHECKED_ON, "status": "RESOLVED",
                                "httpStatus": status, "resolvedTo": final}
            ok += 1
        except Exception as e:  # noqa: BLE001 - report, do not guess
            src["linkCheck"] = {"checkedOn": CHECKED_ON, "status": "FAILED",
                                "error": str(e)[:200]}
        lc = src["linkCheck"]
        print("%-9s %-26s %s" % (lc["status"], key,
                                 lc.get("resolvedTo", lc.get("error", ""))))
    doc["linkCheck"] = {"checkedOn": CHECKED_ON, "resolved": ok,
                        "failed": len(doc["sources"]) - ok}
    with open(SOURCES, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("\nRESOLVED=%d FAILED=%d" % (ok, len(doc["sources"]) - ok))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
