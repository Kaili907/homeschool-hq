#!/usr/bin/env python3
"""Build the unit inventory for the Social Studies grades that still need
source resolution (3/4/5/7/8), straight from the shipped lesson packages.

Nothing here is authored by hand: unit titles, standards, and lesson refs are
read out of curriculum-production/student-work/social-studies/**.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
WORK = os.path.join(ROOT, "student-work", "social-studies")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "unit-inventory.json")
GRADES = [3, 4, 5, 7, 8]


def parse(path):
    text = open(path, encoding="utf-8").read()

    def grab(pattern):
        m = re.search(pattern, text, re.MULTILINE)
        return m.group(1).strip() if m else None

    unit = re.search(r"^\*\*Unit (\d+):\*\* (.+)$", text, re.MULTILINE)
    return {
        "lessonRef": grab(r"^\*\*Lesson ID:\*\* `(.+?)`$"),
        "title": grab(r"^# (.+)$"),
        "courseId": grab(r"^\*\*Course:\*\* (\S+)"),
        "unitNumber": int(unit.group(1)) if unit else None,
        "unitTitle": unit.group(2).strip() if unit else None,
        "phase": grab(r"^\*\*Day \d+ of unit -- Phase:\*\* (.+)$"),
        "standards": grab(r"^\*\*Standards:\*\* (.+)$"),
        "essentialQuestion": grab(r"^\*\*Essential question:\*\* (.+)$"),
    }


def main():
    units = {}
    for grade in GRADES:
        course = "ma-g%d-social-studies" % grade
        d = os.path.join(WORK, "grade-%d" % grade, course)
        for name in sorted(os.listdir(d)):
            if not name.startswith(course) or not name.endswith(".md"):
                continue
            rec = parse(os.path.join(d, name))
            if not rec["lessonRef"] or rec["unitNumber"] is None:
                print("unparsed: %s" % name, file=sys.stderr)
                return 1
            key = "%s-u%02d" % (course, rec["unitNumber"])
            u = units.setdefault(key, {
                "unitRef": key,
                "courseId": course,
                "grade": grade,
                "unitNumber": rec["unitNumber"],
                "unitTitle": rec["unitTitle"],
                "essentialQuestion": rec["essentialQuestion"],
                "standards": set(),
                "lessonRefs": [],
            })
            u["lessonRefs"].append(rec["lessonRef"])
            if rec["standards"]:
                for s in rec["standards"].split(","):
                    u["standards"].add(s.strip())

    ordered = sorted(units.values(), key=lambda u: (u["grade"], u["unitNumber"]))
    for u in ordered:
        u["standards"] = sorted(u["standards"])
        u["lessonCount"] = len(u["lessonRefs"])

    payload = {
        "generatedBy": "tools/build-unit-inventory.py",
        "sourceOfTruth": "curriculum-production/student-work/social-studies",
        "grades": GRADES,
        "unitCount": len(ordered),
        "lessonCount": sum(u["lessonCount"] for u in ordered),
        "units": ordered,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("units=%d lessons=%d -> %s" % (
        payload["unitCount"], payload["lessonCount"], OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
