#!/usr/bin/env python3
"""Validate the Grade 8 Mathematics 8.EE.2 180-day integration plan.

Proves, rather than asserts:
  - sealed 1.0.0 and the accepted e9ead0c overlay are both untouched;
  - the resulting schedule is exactly 180 contiguous days with no duplicate IDs;
  - no standard covered before integration loses coverage after it;
  - all 28 official Michigan Grade 8 content standards are covered after it;
  - every displaced day is a recycle-phase day whose standards are instructed
    and assessed in an earlier dedicated unit;
  - the student-work packages and answer keys conform to the shipped schemas,
    leak no answers, and every keyed answer is reproduced by an independent
    oracle from the item's recorded parameters.

Usage:  python3 validate.py     (run from this directory)
Exit code 0 on PASS, 1 on FAIL.
"""
import csv
import json
import os
import re
import subprocess
import sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RELEASE = os.path.join(REPO, "curriculum-content", "manuel-academy", "1.0.0")
G8 = os.path.join(RELEASE, "grades", "grade-8")
COURSE = os.path.join(G8, "courses", "mathematics")
OVERLAY = os.path.join(REPO, "curriculum-release-corrections", "grade8-mathematics")
SWK = os.path.join(REPO, "curriculum-production", "student-work", "mathematics")

OFFICIAL = (
    [f"8.NS.{i}" for i in range(1, 3)]
    + [f"8.EE.{i}" for i in range(1, 9)]
    + [f"8.F.{i}" for i in range(1, 6)]
    + [f"8.G.{i}" for i in range(1, 10)]
    + [f"8.SP.{i}" for i in range(1, 5)]
)
RECYCLE_PHASES = {
    "Reteach and varied practice", "Discussion or problem seminar",
    "Skill consolidation", "Transfer challenge", "Assessment preparation",
    "Targeted correction", "Publication, presentation, or reflection",
}
ID_PATTERN = re.compile(r"^ma-g(5|7|8)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$")

results = []


def check(name, ok, detail):
    results.append((name, bool(ok), detail))


def jl(path):
    with open(path) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def load():
    sealed = sorted(jl(os.path.join(COURSE, "lessons.jsonl")), key=lambda r: r["course_day"])
    overlay = sorted(jl(os.path.join(OVERLAY, "lessons.jsonl")), key=lambda r: r["course_day"])
    l22 = jl(os.path.join(HERE, "lessons.integration.jsonl"))
    with open(os.path.join(HERE, "schedule.csv")) as fh:
        sched = list(csv.DictReader(fh))
    manifest = json.load(open(os.path.join(HERE, "integration-manifest.json")))
    return sealed, overlay, l22, sched, manifest


SEALED, OVERLAY_L, L22, SCHED, MANIFEST = load()
BY_ID = {r["lesson_id"]: r for r in SEALED}
NEW = {r["lesson_id"]: r for r in OVERLAY_L + L22}
WITHDRAWN = [w["lesson_id"] for w in MANIFEST["withdrawn"]]
REQUIRED_IDS = [r["lesson_id"] for r in SCHED]


# --------------------------------------------------------------- sealed state
def git_clean(pathspec):
    out = subprocess.run(["git", "-C", REPO, "status", "--porcelain", "--", pathspec],
                         capture_output=True, text=True).stdout.strip()
    return out == "", out or "clean"


ok, detail = git_clean("curriculum-content/")
check("sealed-1.0.0-no-git-change", ok, detail)

res = subprocess.run(["shasum", "-a", "256", "-c", "SHA256SUMS.txt"],
                     cwd=RELEASE, capture_output=True, text=True)
lines = [l for l in res.stdout.splitlines() if l.strip()]
n_ok = sum(1 for l in lines if l.endswith(": OK"))
check("sealed-1.0.0-checksums-181-ok", res.returncode == 0 and n_ok == 181,
      f"{n_ok}/{len(lines)} OK, exit {res.returncode}")

ok, detail = git_clean("curriculum-release-corrections/grade8-mathematics/")
check("accepted-overlay-no-git-change", ok, detail)

res = subprocess.run([sys.executable, "validate.py"], cwd=OVERLAY,
                     capture_output=True, text=True)
check("accepted-overlay-validator-pass", res.returncode == 0,
      (res.stdout.strip().splitlines() or ["no output"])[-1])


# ------------------------------------------------------------------- schedule
check("schedule-length-180", len(SCHED) == 180, f"{len(SCHED)} days")
days = [int(r["course_day"]) for r in SCHED]
check("schedule-days-1-to-180-contiguous", days == list(range(1, 181)),
      f"{days[0]}..{days[-1]}, {len(set(days))} distinct")
check("schedule-no-duplicate-lesson-ids", len(set(REQUIRED_IDS)) == 180,
      f"{len(set(REQUIRED_IDS))} distinct of {len(REQUIRED_IDS)}")
_schema = json.load(open(os.path.join(RELEASE, "schemas", "lesson.schema.json")))
_cap = _schema["properties"]["course_day"]["maximum"]
_all_days = [int(r["course_day"]) for r in SCHED] + [r["course_day"] for r in OVERLAY_L + L22]
check("course-day-within-sealed-schema-bound", _cap == 180 and max(_all_days) <= _cap,
      f"sealed lesson.schema.json reads maximum={_cap}; highest course_day in the plan is "
      f"{max(_all_days)} (this is the constraint that rules out an extension option)")

authored = {r["lesson_id"]: r["course_day"] for r in OVERLAY_L}
placed = {r["lesson_id"]: int(r["course_day"]) for r in SCHED if r["lesson_id"] in authored}
check("overlay-course-days-as-authored", authored == placed,
      f"authored {sorted(authored.values())} == scheduled {sorted(placed.values())}")

block = [r["lesson_id"] for r in SCHED if 19 <= int(r["course_day"]) <= 22]
check("correction-block-contiguous-after-u01-l18",
      REQUIRED_IDS[17] == "ma-g8-mathematics-u01-l18" and block == [
          "ma-g8-mathematics-u01-l19", "ma-g8-mathematics-u01-l20",
          "ma-g8-mathematics-u01-l21", "ma-g8-mathematics-u01-l22"],
      f"day 18 = {REQUIRED_IDS[17]}, days 19-22 = {block}")

req_sealed = [i for i in REQUIRED_IDS if i in BY_ID]
check("sealed-lessons-accounted",
      len(req_sealed) == 176 and sorted(set(req_sealed) | set(WITHDRAWN)) == sorted(BY_ID),
      f"{len(req_sealed)} required + {len(WITHDRAWN)} reserve = {len(req_sealed) + len(WITHDRAWN)} of {len(BY_ID)} sealed")

bad = [i for i in WITHDRAWN if BY_ID[i]["phase"] not in RECYCLE_PHASES]
check("withdrawn-are-recycle-phase-only", not bad,
      "; ".join(f"{i} [{BY_ID[i]['phase']}]" for i in WITHDRAWN) if not bad else str(bad))

check("withdrawn-all-from-unit-10", all(BY_ID[i]["unit_number"] == 10 for i in WITHDRAWN),
      f"units {sorted({BY_ID[i]['unit_number'] for i in WITHDRAWN})}")

counts = {}
for r in SCHED:
    counts[int(r["unit_number"])] = counts.get(int(r["unit_number"]), 0) + 1
expect = {int(k): v for k, v in MANIFEST["counts"]["unit_day_counts"].items()}
check("unit-day-counts-match-manifest", counts == expect, str(counts))

with open(os.path.join(G8, "daily-schedule.csv"), newline="") as fh:
    sealed_sched = list(csv.reader(fh))
with open(os.path.join(HERE, "daily-schedule-grade8.csv"), newline="") as fh:
    new_sched = list(csv.reader(fh))
same = (len(sealed_sched) == len(new_sched)
        and all(a[:2] == b[:2] and a[3:] == b[3:] for a, b in zip(sealed_sched, new_sched)))
check("daily-schedule-non-math-periods-unchanged", same,
      "every column except period_1 is byte-identical to the sealed grade-8 schedule")
check("daily-schedule-math-column-matches-plan",
      [r[2] for r in new_sched[1:]] == REQUIRED_IDS, "period_1 == schedule.csv order")


# ------------------------------------------------------------------ standards
def codes_of(ids, source):
    out = {}
    for i in ids:
        for c in source[i]["standards"]:
            out.setdefault(c, []).append(i)
    return out


before = codes_of(list(BY_ID), BY_ID)
after_src = dict(BY_ID)
after_src.update(NEW)
after = codes_of(REQUIRED_IDS, after_src)

missing_before = [c for c in OFFICIAL if c not in before]
check("before-27-of-28", len(OFFICIAL) - len(missing_before) == 27 and missing_before == ["8.EE.2"],
      f"{len(OFFICIAL) - len(missing_before)}/28 covered; missing {missing_before}")

missing_after = [c for c in OFFICIAL if c not in after]
check("after-28-of-28-math-expectation", not missing_after,
      f"{len(OFFICIAL) - len(missing_after)}/28 official Michigan Grade 8 content standards covered")

lost = [c for c in before if c not in after]
check("no-standard-loses-coverage", not lost,
      f"{len(before)} codes before, {len(after)} after; lost {lost or 'none'}")

assess = json.load(open(os.path.join(COURSE, "assessments.json")))
assess_codes = {c for a in assess for c in a["standards"]}
owning, practice = {}, {}
for i in WITHDRAWN:
    for c in BY_ID[i]["standards"]:
        if c.startswith("MP."):
            practice.setdefault(c, len([j for j in after.get(c, [])
                                        if after_src[j]["unit_number"] == 10]))
            continue
        owning.setdefault(c, {BY_ID[j]["unit_number"] for j in after.get(c, [])
                              if j in BY_ID and BY_ID[j]["unit_number"] != 10})
bad = {c: u for c, u in owning.items() if not u or c not in assess_codes}
check("withdrawn-content-standards-instructed-and-assessed-elsewhere", not bad,
      "; ".join(f"{c} -> dedicated unit {sorted(u)} + its unit assessment"
                for c, u in sorted(owning.items())) if not bad else str(bad))

# Practice standards are not content standards and have no owning unit; they must
# instead survive on the retained days of the same unit.
check("withdrawn-practice-standards-survive-in-unit", all(n > 0 for n in practice.values()),
      "; ".join(f"{c} on {n} retained Unit 10 days" for c, n in sorted(practice.items())))

# No standard may fall below the day count of the unit that owns it.
floors = []
for c in OFFICIAL:
    if c not in before:
        continue
    owners = {BY_ID[j]["unit_number"] for j in before[c]}
    dedicated = sorted(owners - {10}) or sorted(owners)
    n_after = len(after.get(c, []))
    n_owning = len([j for j in after.get(c, []) if after_src[j]["unit_number"] in dedicated])
    if n_after < n_owning or n_owning < 18:
        floors.append(f"{c}: {n_owning} days in unit {dedicated}")
check("no-standard-falls-below-its-owning-unit", not floors,
      floors[:4] or "every content standard retains all 18 days of the unit that owns it")

sched_phase = {r["lesson_id"]: r["phase"] for r in SCHED}
units_with_assessment = {int(r["unit_number"]) for r in SCHED if r["phase"] == "Unit assessment"}
check("every-unit-retains-its-unit-assessment", units_with_assessment == set(range(1, 11)),
      f"units with a retained unit-assessment day: {sorted(units_with_assessment)}")

c01 = json.load(open(os.path.join(OVERLAY, "assessment.json")))[0]
check("8ee2-has-independent-mastery-evidence",
      "ma-g8-mathematics-u01-l22" in REQUIRED_IDS
      and L22[0]["correction_metadata"]["administers_assessment_id"] == c01["assessment_id"]
      and c01["total_points"] == 30,
      f"day 22 administers {c01['assessment_id']} ({c01['total_points']} points, {len(c01['prompts'])} prompts)")


# ------------------------------------------------------------------------ ids
all_g8 = set()
for course in sorted(os.listdir(os.path.join(G8, "courses"))):
    for r in jl(os.path.join(G8, "courses", course, "lessons.jsonl")):
        all_g8.add(r["lesson_id"])
new_ids = set(NEW)
check("no-duplicate-ids-grade8", not (all_g8 & new_ids) and len(all_g8) == 936,
      f"{len(all_g8)} sealed Grade 8 lesson IDs, {len(new_ids)} new, {len(all_g8 & new_ids)} collisions")

check("new-lesson-ids-match-sealed-pattern", all(ID_PATTERN.match(i) for i in new_ids),
      ", ".join(sorted(new_ids)))

schema = _schema
missing_fields = [f for f in schema["required"] if f not in L22[0]]
check("l22-satisfies-sealed-lesson-schema", not missing_fields
      and len(L22[0]["learning_objectives"]) >= 3
      and len(L22[0]["lesson_flow"]) >= 5
      and len(L22[0]["accessibility_and_accommodations"]) >= 5
      and len(L22[0]["safety_and_privacy"]) >= 2
      and schema["properties"]["course_day"]["minimum"] <= L22[0]["course_day"] <= _cap
      and re.match(schema["properties"]["lesson_id"]["pattern"], L22[0]["lesson_id"]),
      f"missing required fields: {missing_fields or 'none'}")


# ---------------------------------------------------- production materials
PKG_DIR = os.path.join(HERE, "student-work", "packages", "grade-08")
KEY_DIR = os.path.join(HERE, "student-work", "answer-keys", "grade-08")
pkg_schema = json.load(open(os.path.join(SWK, "schema", "student-work-package.schema.json")))
key_schema = json.load(open(os.path.join(SWK, "schema", "answer-key.schema.json")))
LEAK = {"answerIndex", "given", "solutionReasoning", "commonErrors", "verification",
        "answer", "answerType", "referenceExample"}

packages, keys = {}, {}
for lid in sorted(NEW):
    packages[lid] = json.load(open(os.path.join(PKG_DIR, f"{lid}.package.json")))
    keys[lid] = json.load(open(os.path.join(KEY_DIR, f"{lid}.key.json")))
check("production-materials-present-for-every-new-day",
      sorted(packages) == sorted(NEW) and sorted(keys) == sorted(NEW),
      f"{len(packages)} packages and {len(keys)} answer keys for {len(NEW)} new days")


def structural(doc, sch, path="$"):
    errs = []
    if "required" in sch:
        errs += [f"{path}: missing {f}" for f in sch["required"] if f not in doc]
    if sch.get("additionalProperties") is False and "properties" in sch:
        errs += [f"{path}: unexpected {k}" for k in doc if k not in sch["properties"]]
    return errs


errs = []
for lid, p in packages.items():
    errs += structural(p, pkg_schema, lid)
    if not p["packageId"].startswith("swk-"):
        errs.append(f"{lid}: packageId")
    if not p["answerKeyRef"].startswith("answer-keys/"):
        errs.append(f"{lid}: answerKeyRef")
    errs += structural(p["lessonRef"], pkg_schema["properties"]["lessonRef"], f"{lid}.lessonRef")
    for s in p["sections"]:
        errs += structural(s, pkg_schema["$defs"]["section"], f"{lid}.{s['sectionId']}")
        if s["kind"] not in pkg_schema["$defs"]["sectionKind"]["enum"]:
            errs.append(f"{lid}.{s['sectionId']}: kind")
        for it in s["items"]:
            defn = {"worked-example": "workedExampleItem", "multiple-choice": "multipleChoiceItem",
                    "constructed-response": "constructedResponseItem"}[it["kind"]]
            errs += structural(it, pkg_schema["$defs"][defn], it["ref"])
            if it["difficulty"] not in (1, 2, 3):
                errs.append(f"{it['ref']}: difficulty")
check("packages-conform-to-shipped-schema", not errs, errs[:4] or "4/4 packages conform")

errs = []
for lid, k in keys.items():
    errs += structural(k, key_schema, lid)
    for a in k["answers"]:
        errs += structural(a, key_schema["$defs"]["answer"], a["ref"])
        if a["answerType"] != "fixed" or not a["answer"]:
            errs.append(f"{a['ref']}: answerType/answer")
        if a["verification"]["method"] not in ("recomputed", "generator-authority"):
            errs.append(f"{a['ref']}: verification.method")
check("answer-keys-conform-to-shipped-schema", not errs, errs[:4] or "4/4 keys conform")

leaks = []
for lid, p in packages.items():
    blob = json.dumps(p)
    for s in p["sections"]:
        for it in s["items"]:
            if it["kind"] == "worked-example":
                continue
            leaks += [f"{it['ref']}: {f}" for f in LEAK if f in it]
    for f in ("solutionReasoning", "commonErrors", "answerIndex"):
        if f'"{f}"' in blob:
            leaks.append(f"{lid}: serialized {f}")
check("no-answer-leakage-in-packages", not leaks, leaks[:4] or
      "no graded item carries an answer-bearing field; worked examples are the declared exception")

errs = []
for lid, p in packages.items():
    graded = {it["ref"]: it for s in p["sections"] for it in s["items"]
              if it["kind"] != "worked-example"}
    keyed = {a["ref"]: a for a in keys[lid]["answers"]}
    errs += [f"{r}: unkeyed" for r in graded if r not in keyed]
    errs += [f"{r}: key without item" for r in keyed if r not in graded]
    for r, a in keyed.items():
        it = graded.get(r)
        if it and it["kind"] == "multiple-choice":
            if a.get("answerIndex") is None or it["choices"][a["answerIndex"]] != a["answer"]:
                errs.append(f"{r}: answerIndex does not point at the keyed answer")
check("every-graded-item-keyed-and-answerindex-resolves", not errs, errs[:4] or
      f"{sum(len(k['answers']) for k in keys.values())} keyed answers, all resolving")


def _atom(tok):
    """One numeric atom -> Fraction, resolving exact radicals. None if symbolic."""
    tok = tok.replace("\u2212", "-").strip()
    m = re.fullmatch(r"(-?)\u221a\(?(\d+)(?:/(\d+))?\)?", tok)
    if m:
        n, d = int(m.group(2)), int(m.group(3) or 1)
        rn, rd = __import__("math").isqrt(n), __import__("math").isqrt(d)
        if rn * rn == n and rd * rd == d:
            return Fraction(-rn, rd) if m.group(1) else Fraction(rn, rd)
        return None
    m = re.fullmatch(r"(-?)\u221b\(?(\d+)(?:/(\d+))?\)?", tok)
    if m:
        def icb(x):
            r = round(x ** (1 / 3))
            return r if r ** 3 == x else None
        n, d = icb(int(m.group(2))), icb(int(m.group(3) or 1))
        if n is None or d is None:
            return None
        return Fraction(-n, d) if m.group(1) else Fraction(n, d)
    m = re.fullmatch(r"-?\d+\s*/\s*\d+", tok)
    if m:
        return Fraction(tok.replace(" ", ""))
    m = re.fullmatch(r"-?\d+(?:\.\d+)?", tok)
    if m:
        return Fraction(tok)
    return None


def numeric(text):
    """Value-set of a choice, or None if any atom is symbolic/unparseable."""
    t = text.replace("x =", " ").replace("s =", " ").replace("e =", " ")
    t = re.sub(r"\b(or|and|feet|foot|inches|inch|units?|square|cubic)\b", " ", t)
    toks = [x for x in re.split(r"[\s,;]+", t.strip().rstrip(".")) if x]
    if not toks:
        return None
    vals = [_atom(x) for x in toks]
    if any(v is None for v in vals):
        return None
    return frozenset(vals)


errs = []
for lid, p in packages.items():
    prompts = set()
    for s in p["sections"]:
        for it in s["items"]:
            if it["prompt"] in prompts:
                errs.append(f"{it['ref']}: repeated prompt")
            prompts.add(it["prompt"])
            if it["kind"] != "multiple-choice":
                continue
            if len(set(it["choices"])) != len(it["choices"]):
                errs.append(f"{it['ref']}: repeated choice")
            vals = [numeric(c) for c in it["choices"]]
            seen = [v for v in vals if v is not None]
            if len(set(seen)) != len(seen):
                errs.append(f"{it['ref']}: two choices are the same value in different forms")
check("distinct-prompts-choices-and-no-equivalent-distractors", not errs,
      errs[:4] or "no repeated prompt, no repeated option, no option equal in value to another")

errs = []
for lid, p in packages.items():
    claimed = set(p["standards"])
    for s in p["sections"]:
        for it in s["items"]:
            if it["standard"] not in claimed:
                errs.append(f"{it['ref']}: {it['standard']} not claimed by the lesson")
    if claimed != set(NEW[lid]["standards"]):
        errs.append(f"{lid}: package standards != lesson standards")
check("item-standard-in-lesson", not errs, errs[:4] or
      "every item tests a standard its lesson claims; package standards match the lesson record")

sys.path.insert(0, HERE)
try:
    from build_student_work import oracle  # noqa: E402
    errs = []
    for lid, k in keys.items():
        for a in k["answers"]:
            tokens = oracle(a["itemType"], a["verification"]["parameters"])
            missing = [t for t in tokens if t not in a["answer"]]
            if missing:
                errs.append(f"{a['ref']}: oracle produced {tokens} but answer lacks {missing}")
    check("oracle-reproduces-every-keyed-answer", not errs, errs[:4] or
          f"{sum(len(k['answers']) for k in keys.values())} answers re-derived from their recorded "
          f"parameters alone and matched")
except Exception as exc:  # pragma: no cover
    check("oracle-reproduces-every-keyed-answer", False, repr(exc))

# The keyed option is exactly the oracle output for these item types, so the gate
# pins the index rather than only the value. Report how much of the corpus that covers.
from build_student_work import EXACT_MATCH  # noqa: E402

pinned = ambiguous = prose = 0
errs = []
for lid, p_ in packages.items():
    items = {it["ref"]: it for s_ in p_["sections"] for it in s_["items"]}
    for a in keys[lid]["answers"]:
        it = items[a["ref"]]
        if it["kind"] != "multiple-choice":
            continue
        toks = oracle(a["itemType"], a["verification"]["parameters"])
        if a["itemType"] in EXACT_MATCH:
            if len(toks) != 1 or toks[0] != a["answer"] or it["choices"].count(toks[0]) != 1:
                errs.append(f"{a['ref']}: oracle output does not uniquely select the keyed option")
            else:
                pinned += 1
        else:
            prose += 1
            if any(all(t in c for t in toks) for c in it["choices"] if c != a["answer"]):
                ambiguous += 1
check("oracle-output-uniquely-selects-the-keyed-option", not errs,
      errs[:4] or f"{pinned} multiple-choice items have their index pinned by the oracle; "
                  f"{prose} are prose classification items, of which {ambiguous} share the "
                  f"classification with a distractor and are covered by the next check")

# A distractor that states the correct classification is only acceptable if the key
# records why its REASON is invalid. This is the discipline that a containment-only
# gate cannot supply.
errs = []
for lid, p_ in packages.items():
    items = {it["ref"]: it for s_ in p_["sections"] for it in s_["items"]}
    for a in keys[lid]["answers"]:
        it = items[a["ref"]]
        if it["kind"] != "multiple-choice" or a["itemType"] in EXACT_MATCH:
            continue
        toks = oracle(a["itemType"], a["verification"]["parameters"])
        justified = {e["observed"] for e in a["commonErrors"]}
        for c in it["choices"]:
            if c == a["answer"] or not all(t in c for t in toks):
                continue
            if not any(c in o for o in justified):
                errs.append(f"{a['ref']}: distractor {c!r} states the correct classification "
                            f"but the key does not say why its reason is invalid")
check("same-classification-distractors-are-justified", not errs, errs[:4] or
      "every distractor stating the correct classification carries a stated invalid reason")

errs = []
for lid, k in keys.items():
    for a in k["answers"]:
        causes = [e["likelyCause"] for e in a["commonErrors"]]
        if len(set(causes)) != len(causes):
            errs.append(f"{a['ref']}: two distractors share a byte-identical likelyCause")
check("distinct-common-error-causes", not errs, errs[:4] or
      "no item explains two different distractors with the same sentence")

# The assessment day must render the accepted instrument, not a paraphrase of it.
acc = [pr["prompt"] for pr in c01["prompts"]]
rendered = [it["prompt"] for it in packages["ma-g8-mathematics-u01-l22"]["sections"][0]["items"]]
stripped = [re.sub(r"\s*\(\d+ points?\)$", "", t) for t in rendered]
pts = [pr["points"] for pr in c01["prompts"]]
shown = [int(re.search(r"\((\d+) points?\)$", t).group(1)) for t in rendered]
check("l22-renders-the-accepted-assessment-verbatim",
      stripped == acc and shown == pts and sum(pts) == c01["total_points"],
      f"{len(acc)} prompts verbatim, points {shown} summing to {sum(shown)}"
      if stripped == acc and shown == pts else
      f"first divergence: {[i for i, (a_, b_) in enumerate(zip(stripped, acc)) if a_ != b_]}")

methods = {a["verification"]["method"] for k in keys.values() for a in k["answers"]}
check("answer-authority-recorded-per-item", methods == {"recomputed"},
      f"verification methods present: {sorted(methods)}")


# ------------------------------------------------------------------- handoff
note = os.path.join(HERE, "grade9-handoff-note.md")
src = os.path.join(REPO, "curriculum-authoring", "full-family-highschool-9-12", "subjects",
                   "mathematics", "sequence-derivation.md")
upstream = open(src).read()
body = open(note).read() if os.path.exists(note) else ""
quoted = re.findall(r"^\*\*Current[^\n]*\*\*\n\n((?:> .*\n)+)", body, re.M)


def unquote(block):
    return " ".join(l[2:].strip() for l in block.strip().splitlines())


def flat(text):
    return " ".join(text.split())


flat_up = flat(upstream)
unmatched = [q[:60] for q in (unquote(b) for b in quoted) if flat(q) not in flat_up]
check("grade9-note-quotes-upstream-verbatim",
      len(quoted) >= 3 and not unmatched,
      f"{len(quoted)} quoted 'Current' blocks, all found verbatim in sequence-derivation.md"
      if not unmatched else f"not found upstream: {unmatched}")

g9_units = json.load(open(os.path.join(
    REPO, "curriculum-authoring", "full-family-highschool-9-12", "subjects", "mathematics",
    "courses", "grade-9", "units.json")))
root_units = sorted({u["unit_number"] for u in g9_units
                     if any("square and cube roots" in t for t in u.get("topics", []))})
# Unit 2 may appear only inside quoted upstream text; the note's own prose must say Unit 1.
unquoted_u2 = [l.strip()[:70] for l in body.splitlines()
               if "Grade 9 Unit 2" in l and not l.lstrip().startswith(">")]
check("grade9-note-names-the-right-unit",
      root_units == [1] and "Grade 9 **Unit 1**" in body
      and "It does not." in body and not unquoted_u2,
      f"the root bridge topic lives in Grade 9 Unit {root_units[0]} "
      f"(ma-g9-mathematics-u01-l03/-l09/-l15); the note asserts Unit 1 and flags the upstream "
      f"sec 3 'Unit 2' reference as a pre-existing error"
      if not unquoted_u2 else f"note asserts Unit 2 outside a quote: {unquoted_u2}")

check("grade9-handoff-note-present-and-specific",
      os.path.exists(note) and "8.EE.2" in body and "sequence-derivation.md" in body
      and "Identified gap" in upstream,
      "note names the upstream file, its stale sections, and the replacement text")


# --------------------------------------------------------------------- report
width = max(len(n) for n, _, _ in results)
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
print(f"OVERALL: {'PASS' if passed == len(results) else 'FAIL'}")
sys.exit(0 if passed == len(results) else 1)
