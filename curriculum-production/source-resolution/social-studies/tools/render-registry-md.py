#!/usr/bin/env python3
"""Render the human-readable view of source-registry.json."""
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
reg = json.load(open(os.path.join(HERE, "source-registry.json"), encoding="utf-8"))
src = reg["sources"]

lines = ["# Social Studies source registry -- grades 3, 4, 5, 7, 8", "",
         "Machine-readable form: `source-registry.json`. This file is generated; edit the",
         "inputs and re-run `tools/render-registry-md.py`.", "",
         "Every title, date, creator, and URL below was returned by the named repository",
         "when it was checked -- nothing is recalled or reconstructed. The registry names",
         "and verifies a source; it does not reproduce it. Retrieve the actual item before",
         "the lesson is scored.", "",
         "Lessons resolved: **%d** | unresolved: **%d** | distinct verified sources: **%d**"
         % (reg["totals"]["resolved"], reg["totals"]["unresolved"], reg["totals"]["verifiedSources"]),
         ""]

by_grade = {}
for u in reg["units"]:
    by_grade.setdefault(u["grade"], []).append(u)

for grade in sorted(by_grade):
    lines += ["## Grade %d" % grade, ""]
    for u in by_grade[grade]:
        lessons = [l for l in reg["lessons"] if l["unitRef"] == u["unitRef"]]
        lines += ["### %s -- %s" % (u["unitRef"], u["unitTitle"]), "",
                  "**Resolution:** %s | **Lessons covered:** %d" % (u["resolution"], len(lessons)), ""]
        if u["rationale"]:
            lines += ["*Why these sources:* %s" % u["rationale"], ""]
        if u["unresolvedReason"]:
            lines += ["*Unresolved because:* %s" % u["unresolvedReason"], ""]
        for key in u["sourceKeys"]:
            s = src.get(key)
            if not s:
                lines.append("- `%s` -- NOT VERIFIED, unusable" % key)
                continue
            creators = ", ".join(s["creators"]) if isinstance(s["creators"], list) else (s["creators"] or "")
            lines.append("- **%s** (%s) -- %s%s  \n  %s -- <%s>" % (
                s["title"], s["date"] or "date not stated by repository",
                s["repository"], (" -- " + creators if creators else ""),
                s["kind"], s["url"]))
            lines.append("  Rights/access: %s" % s["rightsAndAccess"])
            for note in s["handlingNotes"]:
                lines.append("  Handling: %s" % note)
        lines.append("")

out = os.path.join(HERE, "SOURCE-REGISTRY.md")
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("-> %s (%d lines)" % (out, len(lines)))
