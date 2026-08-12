#!/usr/bin/env python3
"""Validate the Grade 8 Mathematics 8.EE.2 correction overlay.

Proves, rather than asserts:
  - the overlay closes exactly the gap it claims;
  - the sealed 1.0.0 release is untouched;
  - no new ID collides with a sealed ID and no sealed ID changes;
  - overlay lessons satisfy the sealed lesson schema.

Usage:  python3 validate.py        (run from this directory)
Exit code 0 on PASS, 1 on FAIL.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RELEASE = os.path.join(REPO, "curriculum-content", "manuel-academy", "1.0.0")
COURSE = os.path.join(RELEASE, "grades", "grade-8", "courses", "mathematics")

# The 28 official Michigan Grade 8 content standards.
# Source: Michigan K-12 Standards - Mathematics, pp. 52-56,
# sha256 dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54
OFFICIAL = (
    [f"8.NS.{i}" for i in range(1, 3)]
    + [f"8.EE.{i}" for i in range(1, 9)]
    + [f"8.F.{i}" for i in range(1, 6)]
    + [f"8.G.{i}" for i in range(1, 10)]
    + [f"8.SP.{i}" for i in range(1, 5)]
)
CLAIMED_GAP = {"8.EE.2"}

results = []


def check(name, ok, detail):
    results.append((name, bool(ok), detail))


def sealed_codes():
    codes = set()
    with open(os.path.join(COURSE, "lessons.jsonl")) as fh:
        for line in fh:
            line = line.strip()
            if line:
                codes.update(json.loads(line).get("standards", []))
    for fname in ("units.json", "assessments.json"):
        with open(os.path.join(COURSE, fname)) as fh:
            for rec in json.load(fh):
                codes.update(rec.get("standards", []))
    return codes


def sealed_ids():
    lessons, assessments = set(), set()
    with open(os.path.join(COURSE, "lessons.jsonl")) as fh:
        for line in fh:
            line = line.strip()
            if line:
                lessons.add(json.loads(line)["lesson_id"])
    with open(os.path.join(COURSE, "assessments.json")) as fh:
        for rec in json.load(fh):
            assessments.add(rec["assessment_id"])
    return lessons, assessments


overlay = [json.loads(l) for l in open(os.path.join(HERE, "lessons.jsonl")) if l.strip()]
overlay_assess = json.load(open(os.path.join(HERE, "assessment.json")))
manifest = json.load(open(os.path.join(HERE, "correction-manifest.json")))

# 1 -- the gap this overlay claims is real in the sealed release
have = sealed_codes()
missing = [c for c in OFFICIAL if c not in have]
check("sealed-release-gap-is-real", set(missing) == CLAIMED_GAP,
      f"missing from 1.0.0: {missing or 'none'}")

# 2 -- 27 of 28 covered before the correction
check("baseline-coverage-27-of-28", len(OFFICIAL) - len(missing) == 27,
      f"{len(OFFICIAL) - len(missing)}/{len(OFFICIAL)} covered in 1.0.0")

# 3 -- overlay closes exactly the gap, adding nothing else
ov_codes = set()
for rec in overlay:
    ov_codes.update(rec["standards"])
for rec in overlay_assess:
    ov_codes.update(rec["standards"])
content = {c for c in ov_codes if not c.startswith("MP.")}
check("overlay-closes-exactly-the-gap", content == CLAIMED_GAP,
      f"overlay content standards: {sorted(content)}")

# 4 -- union closes every official standard
check("union-covers-all-28", not [c for c in OFFICIAL if c not in (have | ov_codes)],
      "28/28 covered after correction")

# 5 -- no invented standards: every overlay code is official or a practice standard
invented = [c for c in ov_codes if c not in OFFICIAL and not re.fullmatch(r"MP\.[1-8]", c)]
check("no-invented-standards", not invented, f"invented codes: {invented or 'none'}")

# 6 -- no Grade 8 inequality content was authored
blob = json.dumps(overlay + overlay_assess).lower()
check("no-inequality-content-authored", "inequalit" not in blob,
      "0 occurrences of 'inequalit' in overlay content")

# 7 -- new IDs do not collide with sealed IDs
s_lessons, s_assess = sealed_ids()
new_lessons = [r["lesson_id"] for r in overlay]
new_assess = [r["assessment_id"] for r in overlay_assess]
collisions = [i for i in new_lessons if i in s_lessons] + [i for i in new_assess if i in s_assess]
check("no-id-collisions", not collisions, f"collisions: {collisions or 'none'}")

# 8 -- no sealed ID is changed or removed by the overlay
check("sealed-ids-unchanged", len(s_lessons) == 180 and len(s_assess) == 10,
      f"sealed course still has {len(s_lessons)} lessons / {len(s_assess)} assessments")

# 9 -- overlay lesson IDs satisfy the sealed schema pattern
schema = json.load(open(os.path.join(RELEASE, "schemas", "lesson.schema.json")))
pat = schema["properties"]["lesson_id"]["pattern"]
bad = [i for i in new_lessons if not re.fullmatch(pat, i)]
check("lesson-ids-match-sealed-pattern", not bad, f"non-conforming: {bad or 'none'}")

# 10 -- overlay lessons satisfy the sealed schema's required fields and minimums
req = schema["required"]
problems = []
for r in overlay:
    for f in req:
        if f not in r:
            problems.append(f"{r['lesson_id']}: missing {f}")
    if len(r.get("learning_objectives", [])) < 3:
        problems.append(f"{r['lesson_id']}: <3 objectives")
    if len(r.get("lesson_flow", [])) < 5:
        problems.append(f"{r['lesson_id']}: <5 flow segments")
    if len(r.get("accessibility_and_accommodations", [])) < 5:
        problems.append(f"{r['lesson_id']}: <5 accessibility items")
    if len(r.get("safety_and_privacy", [])) < 2:
        problems.append(f"{r['lesson_id']}: <2 safety items")
    if r.get("schema_version") != "1.0" or r.get("grade") != 8:
        problems.append(f"{r['lesson_id']}: bad schema_version/grade")
check("overlay-lessons-schema-valid", not problems, f"problems: {problems or 'none'}")

# 11 -- assessment points reconcile
pts_ok = all(sum(p["points"] for p in a["prompts"]) == a["total_points"] for a in overlay_assess)
check("assessment-points-reconcile", pts_ok, "declared totals match prompt sums")

# 12 -- the sealed release is byte-for-byte untouched
proc = subprocess.run(["shasum", "-a", "256", "-c", "SHA256SUMS.txt"],
                      cwd=RELEASE, capture_output=True, text=True)
ok_n = proc.stdout.count(": OK")
failed = [l for l in proc.stdout.splitlines() if l.strip().endswith("FAILED")]
check("sealed-release-untouched", proc.returncode == 0 and ok_n == 181 and not failed,
      f"{ok_n}/181 files OK, {len(failed)} failed")

# 13 -- the overlay wrote nothing inside the sealed tree
git = subprocess.run(["git", "status", "--porcelain", "--", "curriculum-content/"],
                     cwd=REPO, capture_output=True, text=True)
check("no-writes-in-sealed-tree", not git.stdout.strip(),
      f"git changes under curriculum-content/: {git.stdout.strip() or 'none'}")

# 14 -- manifest agrees with what is actually on disk
m_ok = (manifest["closes_standards"] == ["8.EE.2"]
        and manifest["added_lesson_ids"] == new_lessons
        and manifest["added_assessment_ids"] == new_assess
        and manifest["sealed_release_modified"] is False)
check("manifest-matches-disk", m_ok, "manifest IDs and claims match artifacts")

print("Grade 8 Mathematics — 8.EE.2 correction overlay validation")
print("=" * 68)
for name, ok, detail in results:
    print(f"[{'PASS' if ok else 'FAIL'}] {name:<34} {detail}")
passed = sum(1 for _, ok, _ in results if ok)
print("=" * 68)
print(f"{passed}/{len(results)} checks passed")
overall = passed == len(results)
print("OVERALL:", "PASS" if overall else "FAIL")
sys.exit(0 if overall else 1)
