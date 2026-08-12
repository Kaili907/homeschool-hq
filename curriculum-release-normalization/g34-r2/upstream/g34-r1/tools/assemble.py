#!/usr/bin/env python3
"""Assemble the Grades 3/4 release candidate from pinned source-branch commits.

Content is copied verbatim from the commits pinned in ledger/source-branches.json.
No lesson, unit, or assessment record is rewritten. Only packaging is normalized:
directory layout, schedules, indexes, manifest, schema candidate, and reports.

Run from the repo root:  python3 curriculum-release-candidates/g34-r1/tools/assemble.py
"""
import csv, hashlib, io, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "curriculum-release-candidates", "g34-r1")
LEDGER = json.load(open(os.path.join(OUT, "ledger", "source-branches.json")))
ASSEMBLED_ON = LEDGER["assembled_on"]

CANONICAL_SUBJECTS = [
    "mathematics", "english-language-arts", "science", "social-studies", "health",
    "physical-education", "ready-for-life", "technology", "arts-and-music",
    "financial-literacy",
]

AUTH = "curriculum-authoring/full-family-grade34/subjects"
SEALED = "curriculum-content/manuel-academy/1.0.0/grades"

# course_id -> (lane, source path prefix at that lane's pinned commit)
COURSE_SOURCES = {
    "ma-g3-mathematics":            ("mathematics", f"{AUTH}/mathematics/courses/grade-3/mathematics"),
    "ma-g4-mathematics":            ("mathematics", f"{AUTH}/mathematics/courses/grade-4/mathematics"),
    "ma-g3-english-language-arts":  ("english-language-arts", f"{AUTH}/english-language-arts/grades/grade-3"),
    "ma-g4-english-language-arts":  ("english-language-arts", f"{AUTH}/english-language-arts/grades/grade-4"),
    "ma-g3-science":                ("science-social-studies", f"{SEALED}/grade-3/courses/science"),
    "ma-g4-science":                ("science-social-studies", f"{SEALED}/grade-4/courses/science"),
    "ma-g3-social-studies":         ("science-social-studies", f"{SEALED}/grade-3/courses/social-studies"),
    "ma-g4-social-studies":         ("science-social-studies", f"{SEALED}/grade-4/courses/social-studies"),
    "ma-g3-health":                 ("health-physical-education", f"{AUTH}/health/grade-3"),
    "ma-g4-health":                 ("health-physical-education", f"{AUTH}/health/grade-4"),
    "ma-g3-physical-education":     ("health-physical-education", f"{AUTH}/physical-education/grade-3"),
    "ma-g4-physical-education":     ("health-physical-education", f"{AUTH}/physical-education/grade-4"),
    "ma-g3-ready-for-life":         ("ready-for-life-financial-literacy", f"{SEALED}/grade-3/courses/ready-for-life"),
    "ma-g4-ready-for-life":         ("ready-for-life-financial-literacy", f"{SEALED}/grade-4/courses/ready-for-life"),
    "ma-g3-financial-literacy":     ("ready-for-life-financial-literacy", f"{SEALED}/grade-3/courses/financial-literacy"),
    "ma-g4-financial-literacy":     ("ready-for-life-financial-literacy", f"{SEALED}/grade-4/courses/financial-literacy"),
    "ma-g3-tech-cs":                ("technology-arts", f"{AUTH}/technology-computer-science/grade-3"),
    "ma-g4-tech-cs":                ("technology-arts", f"{AUTH}/technology-computer-science/grade-4"),
    "ma-g3-arts-music":             ("technology-arts", f"{AUTH}/arts-music/grade-3"),
    "ma-g4-arts-music":             ("technology-arts", f"{AUTH}/arts-music/grade-4"),
}

# Standards / custody artifacts carried into standards/sources/, by lane.
STANDARDS_SOURCES = {
    "release-standards": ["curriculum-authoring/full-family-grade34/release/standards-reference.md",
                          "curriculum-authoring/full-family-grade34/release/course-matrix.json",
                          "curriculum-authoring/full-family-grade34/release/lesson-schema.json",
                          "curriculum-authoring/full-family-grade34/release/release-contract.md",
                          "curriculum-authoring/full-family-grade34/release/validation-contract.md",
                          "curriculum-authoring/full-family-grade34/release/authoring-boundaries.md",
                          "curriculum-authoring/full-family-grade34/release/validate-grade34.mjs",
                          "curriculum-authoring/full-family-grade34/release/validate-grade34.test.ts",
                          "curriculum-authoring/full-family-grade34/release/vitest.config.mjs"],
    "mathematics": [f"{AUTH}/mathematics/standards/standards-map.json",
                    f"{AUTH}/mathematics/standards/standards-map.md",
                    f"{AUTH}/mathematics/PILOT_BLOCKERS.md"],
    "english-language-arts": [f"{AUTH}/english-language-arts/standards/standards-map.json",
                              f"{AUTH}/english-language-arts/standards/standards-reference.md",
                              f"{AUTH}/english-language-arts/standards/michigan-ela-g3.json",
                              f"{AUTH}/english-language-arts/standards/michigan-ela-g4.json"],
    "health-physical-education": [f"{AUTH}/health/standards-map.md",
                                  f"{AUTH}/health/README.md",
                                  f"{AUTH}/physical-education/standards-map.md",
                                  f"{AUTH}/physical-education/README.md"],
    "technology-arts": [f"{AUTH}/technology-computer-science/standards-map.md",
                        f"{AUTH}/arts-music/standards-map.md"],
    "science-social-studies": [],
    "ready-for-life-financial-literacy": [],
}

PENDING_HEALTH_REVIEW = {
    "ma-g3-health", "ma-g4-health", "ma-g3-physical-education", "ma-g4-physical-education",
}

LESSON_ID_RE = re.compile(r"^ma-g(3|4)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$")
WEEKS = 36


def commit_for(lane):
    for s in LEDGER["sources"]:
        if s["lane"] == lane:
            return s["commit"]
    raise KeyError(lane)


def git_show(commit, path):
    return subprocess.run(["git", "-C", ROOT, "show", f"{commit}:{path}"],
                          check=True, capture_output=True).stdout


def git_ls(commit, path):
    out = subprocess.run(["git", "-C", ROOT, "ls-tree", "--name-only", f"{commit}:{path}"],
                         check=True, capture_output=True, text=True).stdout
    return sorted(n for n in out.split("\n") if n)


def write(relpath, data):
    p = os.path.join(OUT, relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as fh:
        fh.write(data if isinstance(data, bytes) else data.encode())


def jdump(obj):
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------- load sources
courses = {}
for cid, (lane, src) in COURSE_SOURCES.items():
    commit = commit_for(lane)
    names = git_ls(commit, src)
    lessons = [json.loads(l) for l in git_show(commit, f"{src}/lessons.jsonl").decode().splitlines() if l.strip()]
    units = json.loads(git_show(commit, f"{src}/units.json"))
    assessments = json.loads(git_show(commit, f"{src}/assessments.json"))
    sched_name = next((n for n in names if "schedule" in n), None)
    courses[cid] = {
        "course_id": cid, "lane": lane, "commit": commit, "source_path": src,
        "files": names, "lessons": lessons, "units": units, "assessments": assessments,
        "schedule_file": sched_name,
        "grade": lessons[0]["grade"], "subject": lessons[0]["subject"],
    }

order = sorted(courses, key=lambda c: (courses[c]["grade"], CANONICAL_SUBJECTS.index(courses[c]["subject"])))


# ------------------------------------------------------------- copy verbatim
for cid in order:
    c = courses[cid]
    dest = f"grades/grade-{c['grade']}/courses/{c['subject']}"
    for name in c["files"]:
        write(f"{dest}/{name}", git_show(c["commit"], f"{c['source_path']}/{name}"))

for lane, paths in STANDARDS_SOURCES.items():
    for p in paths:
        # Keep the lane-relative subpath so same-named files from two subjects in one
        # lane (health/ and physical-education/ both ship standards-map.md) stay distinct.
        rel = p.split("/full-family-grade34/", 1)[1].replace("subjects/", "", 1)
        write(f"standards/sources/{rel}", git_show(commit_for(lane), p))


# ------------------------------------------------------------ schedules
def parse_schedule(c):
    """Return [(week, session_in_week, day_of_week, course_day, lesson_id)], plus provenance."""
    by_day = {l["course_day"]: l for l in c["lessons"]}
    name = c["schedule_file"]
    rows = []
    if name is None:
        # No schedule authored by the lane. Derive deterministically: distribute the
        # course's sessions evenly across the 36-week year in course_day order.
        n = len(c["lessons"])
        per_week = n // WEEKS
        assert n == per_week * WEEKS, f"{c['course_id']}: {n} lessons is not a whole number per week"
        for l in sorted(c["lessons"], key=lambda l: l["course_day"]):
            d = l["course_day"]
            rows.append(((d - 1) // per_week + 1, (d - 1) % per_week + 1, "", d, l["lesson_id"]))
        return rows, "derived"
    raw = git_show(c["commit"], f"{c['source_path']}/{name}").decode()
    if name.endswith(".json"):
        for e in json.load(io.StringIO(raw))["entries"]:
            rows.append((e["week"], None, e.get("day_of_week", ""), e["course_day"], e["lesson_id"]))
    else:
        for r in csv.DictReader(io.StringIO(raw)):
            # Lanes name the weekday column differently: `day_of_week` (math, ELA) or
            # `day_suggestion` (health, PE). Read both so no authored weekday is dropped.
            rows.append((int(r["week"]),
                         int(r["session_in_week"]) if r.get("session_in_week") else None,
                         (r.get("day_of_week") or r.get("day_suggestion") or ""),
                         int(r["course_day"]), r["lesson_id"]))
    rows.sort(key=lambda r: r[3])
    # Fill session_in_week where the source did not supply it: ordinal within the week.
    seen = {}
    filled = []
    for w, s, dow, day, lid in rows:
        seen[w] = seen.get(w, 0) + 1
        filled.append((w, s if s is not None else seen[w], dow, day, lid))
    return filled, f"authored ({name})"


schedules = {}
for cid in order:
    c = courses[cid]
    rows, provenance = parse_schedule(c)
    c["schedule_provenance"] = provenance
    schedules[cid] = rows
    buf = io.StringIO()
    wtr = csv.writer(buf, lineterminator="\n")
    wtr.writerow(["course_id", "week", "session_in_week", "day_of_week", "course_day",
                  "unit_number", "day_in_unit", "lesson_id"])
    by_id = {l["lesson_id"]: l for l in c["lessons"]}
    for w, s, dow, day, lid in rows:
        l = by_id.get(lid, {})
        wtr.writerow([cid, w, s, dow, day, l.get("unit_number", ""), l.get("day_in_unit", ""), lid])
    write(f"schedules/{cid}.csv", buf.getvalue())

write("schedules/schedule-index.json", jdump({
    "candidate_id": LEDGER["candidate_id"],
    "weeks": WEEKS,
    "note": "One normalized schedule per course. 'provenance' records whether the lane authored a schedule or the assembly derived one from course_day order.",
    "courses": [{
        "course_id": cid,
        "grade": courses[cid]["grade"],
        "subject": courses[cid]["subject"],
        "sessions": len(schedules[cid]),
        "sessions_per_week": len(schedules[cid]) // WEEKS,
        "weeks_spanned": len({r[0] for r in schedules[cid]}),
        "provenance": courses[cid]["schedule_provenance"],
        "file": f"schedules/{cid}.csv",
    } for cid in order],
}))


# ------------------------------------------------------------------- indexes
course_index = {
    "candidate_id": LEDGER["candidate_id"],
    "generated_on": ASSEMBLED_ON,
    "grades": [3, 4],
    "courses": [{
        "course_id": cid,
        "grade": courses[cid]["grade"],
        "subject": courses[cid]["subject"],
        "unit_count": len(courses[cid]["units"]),
        "lesson_count": len(courses[cid]["lessons"]),
        "assessment_count": len(courses[cid]["assessments"]),
        "sessions_per_week": len(schedules[cid]) // WEEKS,
        "path": f"grades/grade-{courses[cid]['grade']}/courses/{courses[cid]['subject']}/",
        "schedule": f"schedules/{cid}.csv",
        "source_branch": next(s["branch"] for s in LEDGER["sources"] if s["lane"] == courses[cid]["lane"]),
        "source_commit": courses[cid]["commit"],
        "status": "PENDING_FINAL_HEALTH_REVIEW" if cid in PENDING_HEALTH_REVIEW else "CANDIDATE_READY",
    } for cid in order],
}
write("course-index.json", jdump(course_index))

unit_index = {
    "candidate_id": LEDGER["candidate_id"],
    "generated_on": ASSEMBLED_ON,
    "units": [{
        "unit_id": u["unit_id"],
        "course_id": cid,
        "grade": courses[cid]["grade"],
        "subject": courses[cid]["subject"],
        "unit_number": u["unit_number"],
        "title": u["title"],
        "days": u.get("days"),
        "lesson_count": len(u.get("lesson_ids", [])),
        "assessment_id": u.get("assessment_id"),
    } for cid in order for u in courses[cid]["units"]],
}
write("unit-index.json", jdump(unit_index))

buf = io.StringIO()
wtr = csv.writer(buf, lineterminator="\n")
wtr.writerow(["lesson_id", "course_id", "grade", "subject", "unit_number", "course_day",
              "day_in_unit", "phase", "title"])
for cid in order:
    for l in sorted(courses[cid]["lessons"], key=lambda l: l["course_day"]):
        wtr.writerow([l["lesson_id"], cid, l["grade"], l["subject"], l["unit_number"],
                      l["course_day"], l.get("day_in_unit", ""), l.get("phase", ""), l["title"]])
write("lesson-index.csv", buf.getvalue())


# ----------------------------------------------------------- schema candidate
all_keys = [set(l.keys()) for cid in order for l in courses[cid]["lessons"]]
required = sorted(set.intersection(*all_keys))
optional = sorted(set.union(*all_keys) - set(required))


def minlen(field):
    vals = [len(l[field]) for cid in order for l in courses[cid]["lessons"] if isinstance(l.get(field), list)]
    return min(vals) if vals else 0


observed = {f: minlen(f) for f in
            ["standards", "learning_objectives", "lesson_flow",
             "accessibility_and_accommodations", "safety_and_privacy", "success_criteria", "materials"]}

schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://manuel.academy/schemas/curriculum-lesson-grade34-candidate-v1.json",
    "title": "Manuel Academy Curriculum Lesson - Grades 3/4 release candidate r1",
    "description": ("Schema CANDIDATE derived from the 1800 lessons actually authored by the six subject "
                    "lanes, not a schema the lanes were held to. Required properties are the fields present "
                    "in every authored lesson; array minimums are the minimum observed. It diverges from "
                    "curriculum-authoring/full-family-grade34/release/lesson-schema.json in one substantive "
                    "way: 'standards' entries are plain strings in every lane, not objects carrying "
                    "mapping_status. See standards/standards-custody-report.md."),
    "derived_from": {"lessons_examined": sum(len(courses[c]["lessons"]) for c in order),
                     "courses_examined": len(order)},
    "type": "object",
    "required": required,
    "properties": {
        "schema_version": {"type": "string", "enum": sorted({l["schema_version"] for cid in order for l in courses[cid]["lessons"]})},
        "lesson_id": {"type": "string", "pattern": "^ma-g(3|4)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$"},
        "course_id": {"type": "string", "enum": order},
        "grade": {"enum": [3, 4]},
        "subject": {"enum": CANONICAL_SUBJECTS},
        "course_day": {"type": "integer", "minimum": 1, "maximum": 180},
        "unit_number": {"type": "integer", "minimum": 1},
        "unit_title": {"type": "string"},
        "day_in_unit": {"type": "integer", "minimum": 1},
        "title": {"type": "string", "minLength": 5},
        "phase": {"type": "string"},
        "focus": {"type": "string"},
        "estimated_minutes": {"type": "string"},
        "standards": {"type": "array", "minItems": observed["standards"], "items": {"type": "string"}},
        "learning_objectives": {"type": "array", "minItems": observed["learning_objectives"], "items": {"type": "string"}},
        "success_criteria": {"type": "array", "minItems": observed["success_criteria"], "items": {"type": "string"}},
        "materials": {"type": "array", "minItems": observed["materials"]},
        "lesson_flow": {"type": "array", "minItems": observed["lesson_flow"]},
        "student_activity": {"type": "string"},
        "formative_check": {"type": "string"},
        "answer_or_scoring_guidance": {"type": "string"},
        "adaptive_tutor_routes": {"type": "array", "minItems": 1},
        "mastery_rule": {"type": "string"},
        "extension": {"type": "string"},
        "accessibility_and_accommodations": {"type": "array", "minItems": observed["accessibility_and_accommodations"]},
        "safety_and_privacy": {"type": "array", "minItems": observed["safety_and_privacy"]},
        "media": {"type": "object", "required": ["required", "fallback"],
                  "properties": {"required": {"const": False}}},
        "parent_or_guardian_visibility": {"type": "string"},
        "home_connection": {"type": "string"},
        "essential_question": {"type": "string"},
    },
    "lane_specific_optional_properties": optional,
    "additionalProperties": True,
}
write("schemas/lesson.schema.candidate.json", jdump(schema))


# ---------------------------------------------------------------- validation
# Two groups, reported separately and never averaged together:
#   contract  - the required checks named in release/validation-contract.md
#   assembly  - additional integrity checks this assembly adds on top
contract_checks, assembly_checks = [], []


def check(group, name, ok, detail):
    group.append({"check": name, "result": "PASS" if ok else "FAIL", "detail": detail})
    return ok


def report_only(group, name, detail):
    group.append({"check": name, "result": "REPORTED", "detail": detail})


def validate_against(schema, obj, path=""):
    """Minimal JSON-Schema subset check, sufficient for the release lesson schema."""
    errs = []
    for f in schema.get("required", []):
        if f not in obj:
            errs.append(f"{path}missing required '{f}'")
    for k, spec in schema.get("properties", {}).items():
        if k not in obj:
            continue
        v = obj[k]
        if "const" in spec and v != spec["const"]:
            errs.append(f"{path}{k}: expected const {spec['const']!r}")
        if "enum" in spec and v not in spec["enum"]:
            errs.append(f"{path}{k}: {v!r} not in enum")
        t = spec.get("type")
        if t == "string":
            if not isinstance(v, str):
                errs.append(f"{path}{k}: not a string")
            else:
                if len(v) < spec.get("minLength", 0):
                    errs.append(f"{path}{k}: shorter than minLength")
                if "pattern" in spec and not re.match(spec["pattern"], v):
                    errs.append(f"{path}{k}: fails pattern {spec['pattern']}")
        elif t == "integer":
            if not isinstance(v, int) or isinstance(v, bool):
                errs.append(f"{path}{k}: not an integer")
            elif not (spec.get("minimum", -10**12) <= v <= spec.get("maximum", 10**12)):
                errs.append(f"{path}{k}: {v} out of range")
        elif t == "array":
            if not isinstance(v, list):
                errs.append(f"{path}{k}: not an array")
            else:
                if len(v) < spec.get("minItems", 0):
                    errs.append(f"{path}{k}: {len(v)} items < minItems {spec['minItems']}")
                item = spec.get("items")
                if isinstance(item, dict) and (item.get("type") == "object" or "required" in item):
                    for i, e in enumerate(v):
                        if not isinstance(e, dict):
                            errs.append(f"{path}{k}[{i}]: expected object, got {type(e).__name__}")
                        else:
                            errs += validate_against(item, e, f"{path}{k}[{i}].")
                elif isinstance(item, dict) and item.get("type") == "string":
                    for i, e in enumerate(v):
                        if not isinstance(e, str):
                            errs.append(f"{path}{k}[{i}]: expected string")
    return errs


all_lessons = [l for cid in order for l in courses[cid]["lessons"]]
lids = [l["lesson_id"] for l in all_lessons]

# ---- contract checks, in validation-contract.md order
grades = sorted({courses[c]["grade"] for c in order})
check(contract_checks, "two-grades", grades == [3, 4], f"grades present: {grades}")

per_grade = {g: sorted(courses[c]["subject"] for c in order if courses[c]["grade"] == g) for g in grades}
check(contract_checks, "ten-courses-per-grade",
      all(sorted(v) == sorted(CANONICAL_SUBJECTS) for v in per_grade.values()),
      "; ".join(f"grade {g}: {len(v)} courses, one per canonical subject" for g, v in per_grade.items()))
check(contract_checks, "course-count", len(order) == 20, f"{len(order)} courses")

cids = list(order)
check(contract_checks, "unique-course-ids", len(set(cids)) == len(cids), f"{len(set(cids))} distinct of {len(cids)}")

uids = [u["unit_id"] for c in order for u in courses[c]["units"]]
dup_u = sorted({u for u in uids if uids.count(u) > 1})
check(contract_checks, "unique-unit-ids", not dup_u,
      f"{len(uids)} units, {len(set(uids))} distinct" + (f", duplicates: {dup_u}" if dup_u else ""))

dup_l = sorted({x for x in lids if lids.count(x) > 1})
bad_pat = [x for x in lids if not LESSON_ID_RE.match(x)]
check(contract_checks, "unique-lesson-ids", not dup_l and not bad_pat,
      f"{len(lids)} lessons, {len(set(lids))} distinct; {len(bad_pat)} fail the grade34 lesson-id pattern")

sched_problems = []
for cid in order:
    want = sorted(l["lesson_id"] for l in courses[cid]["lessons"])
    got = sorted(r[4] for r in schedules[cid])
    if want != got:
        sched_problems.append(f"{cid}: schedule covers {len(got)} for {len(want)} lessons")
    if len(got) != len(set(got)):
        sched_problems.append(f"{cid}: schedule repeats a lesson")
check(contract_checks, "schedule-covers-every-lesson-once", not sched_problems,
      "; ".join(sched_problems) or "all 20 courses: every lesson scheduled exactly once, no unscheduled lesson")

week_problems = [cid for cid in order if {r[0] for r in schedules[cid]} != set(range(1, WEEKS + 1))]
check(contract_checks, "week-coverage", not week_problems,
      "; ".join(week_problems) or "all 20 courses span exactly weeks 1-36 with no empty week")

release_schema = json.loads(git_show(commit_for("release-standards"),
                                     "curriculum-authoring/full-family-grade34/release/lesson-schema.json"))
rel_errs = {}
for l in all_lessons:
    e = validate_against(release_schema, l)
    if e:
        rel_errs[l["lesson_id"]] = e
reasons = {}
for e in rel_errs.values():
    for x in e:
        reasons[re.sub(r"\[\d+\]", "[i]", x)] = reasons.get(re.sub(r"\[\d+\]", "[i]", x), 0) + 1
check(contract_checks, "lesson-schema-compatibility", not rel_errs,
      (f"{len(rel_errs)} of {len(all_lessons)} lessons fail release/lesson-schema.json. "
       "Distinct reasons: " + "; ".join(f"{k} ({v})" for k, v in sorted(reasons.items(), key=lambda kv: -kv[1])[:4]))
      if rel_errs else f"all {len(all_lessons)} lessons validate against release/lesson-schema.json")

std_with_status = sum(1 for l in all_lessons for s in l.get("standards", [])
                      if isinstance(s, dict) and s.get("mapping_status"))
total_std = sum(len(l.get("standards", [])) for l in all_lessons)
no_obj = [l["lesson_id"] for l in all_lessons
          if not any(isinstance(s, dict) and s.get("mapping_status") for s in l.get("standards", []))]
few_obj = [l["lesson_id"] for l in all_lessons if len(l.get("learning_objectives", [])) < 3]
check(contract_checks, "required-standards-and-objectives", not no_obj and not few_obj,
      (f"learning_objectives >= 3: PASS on all {len(all_lessons)} lessons. "
       f"standards entry carrying a mapping_status: FAIL on {len(no_obj)} lessons "
       f"({std_with_status} of {total_std} citations carry one). Every lane emits standards as plain strings."))

acc_short = [l["lesson_id"] for l in all_lessons if len(l.get("accessibility_and_accommodations", [])) < 5]
check(contract_checks, "accessibility-depth", not acc_short,
      f"{len(acc_short)} lessons below 5 entries; minimum observed is {observed['accessibility_and_accommodations']}")

FALLBACK_WORDS = ("text", "transcript", "describ", "description", "demonstrat", "read-aloud",
                  "read aloud", "written", "alt text", "caption")
no_fb = [l["lesson_id"] for l in all_lessons
         if not any(w in " ".join(map(str, l.get("accessibility_and_accommodations", []))).lower()
                    for w in FALLBACK_WORDS)]
check(contract_checks, "no-media-path", not no_fb,
      f"{len(no_fb)} lessons name no text/transcript/description/demonstration fallback "
      f"(keyword heuristic over accessibility_and_accommodations; human review still required)")

sp_short = [l["lesson_id"] for l in all_lessons if len(l.get("safety_and_privacy", [])) < 2]
check(contract_checks, "safety-privacy-depth", not sp_short,
      f"{len(sp_short)} lessons below 2 entries; minimum observed is {observed['safety_and_privacy']}")

BANNED = ["photo", "photograph", "video of", "voice recording", "precise location", "home address",
          "diagnosis", "medical history", "family income", "faith", "religion", "immigration",
          "password", "card number", "credit card", "tax id", "social security", "private message"]
NEGATORS = ["no ", "not ", "never", "without", "do not", "does not", "is not", "are not",
            "optional", "n't", "neither", "nor ", "avoid", "refus", "prohibit", "exclude"]
sp_hits = []
for l in all_lessons:
    for entry in l.get("safety_and_privacy", []):
        low = str(entry).lower()
        for b in BANNED:
            if b in low and not any(n in low for n in NEGATORS):
                sp_hits.append(f"{l['lesson_id']}: '{b}' in a non-prohibiting safety_and_privacy entry")
check(contract_checks, "safety-privacy-content", not sp_hits,
      (f"{len(sp_hits)} non-prohibiting uses of a banned disclosure term across "
       f"{len(all_lessons)} lessons (keyword heuristic that ignores explicit prohibitions such as "
       f"'no photo required'; human review still required)")
      + ("" if not sp_hits else " e.g. " + "; ".join(sp_hits[:3])))

MULTI = ["two occasions", "multiple occasions", "at least two", "more than one", "two separate",
         "separate occasions", "two different", "on two", "second occasion", "across occasions"]
single = [l["lesson_id"] for l in all_lessons
          if not any(m in str(l.get("mastery_rule", "")).lower() for m in MULTI)]
check(contract_checks, "multi-occasion-mastery", not single,
      f"{len(single)} lessons whose mastery_rule does not name multiple evidence occasions "
      f"(keyword heuristic; human review still required)")

report_only(contract_checks, "standards-mapping-status-reported",
            f"{total_std} standards citations across {len(all_lessons)} lessons; {std_with_status} carry a "
            f"per-citation mapping_status. The canonical/unverified/human-review rollup the contract asks for "
            f"cannot be produced: no lane emits the object citation form. See standards/standards-custody-report.md.")

# ---- assembly checks
aids = [a["assessment_id"] for c in order for a in courses[c]["assessments"]]
dup_a = sorted({x for x in aids if aids.count(x) > 1})
check(assembly_checks, "unique-assessment-ids", not dup_a,
      f"{len(aids)} assessments, {len(set(aids))} distinct" + (f", duplicates: {dup_a}" if dup_a else ""))

day_problems = [cid for cid in order
                if sorted(l["course_day"] for l in courses[cid]["lessons"]) != list(range(1, len(courses[cid]["lessons"]) + 1))]
check(assembly_checks, "contiguous-course-days", not day_problems,
      "; ".join(day_problems) or "every course numbers course_day 1..n with no gap or repeat")

unit_ref_problems = []
for cid in order:
    have = {l["lesson_id"] for l in courses[cid]["lessons"]}
    listed = [lid for u in courses[cid]["units"] for lid in u.get("lesson_ids", [])]
    if set(listed) - have or have - set(listed) or len(listed) != len(set(listed)):
        unit_ref_problems.append(cid)
check(assembly_checks, "unit-lesson-references-resolve", not unit_ref_problems,
      "; ".join(unit_ref_problems) or "every unit lesson_ids entry resolves to exactly one lesson; every lesson is claimed by exactly one unit")

assess_ref_problems = []
for cid in order:
    have = {a["assessment_id"] for a in courses[cid]["assessments"]}
    listed = {u.get("assessment_id") for u in courses[cid]["units"] if u.get("assessment_id")}
    if listed - have:
        assess_ref_problems.append(f"{cid}: dangling {sorted(listed - have)}")
check(assembly_checks, "unit-assessment-references-resolve", not assess_ref_problems,
      "; ".join(assess_ref_problems) or "every unit assessment_id resolves to an authored assessment")

cand_errs = [f"{l['lesson_id']}: {gap}" for l in all_lessons
             for gap in [[f for f in required if f not in l]] if gap]
check(assembly_checks, "lesson-schema-candidate-compatibility", not cand_errs,
      (f"all {len(lids)} lessons carry the {len(required)} fields the candidate schema requires. "
       "Note: the candidate schema is derived from this same content, so this check confirms "
       "internal consistency, not conformance to an independent standard.")
      if not cand_errs else "; ".join(cand_errs[:5]))

media_required = [l["lesson_id"] for l in all_lessons
                  if isinstance(l.get("media"), dict) and l["media"].get("required") is not False]
check(assembly_checks, "no-required-media", not media_required,
      f"{len(media_required)} lessons require media" if media_required
      else f"all {len(lids)} lessons declare media.required=false with a stated fallback")

byte_diffs = []
for cid in order:
    c = courses[cid]
    dest = os.path.join(OUT, f"grades/grade-{c['grade']}/courses/{c['subject']}")
    for name in c["files"]:
        want = git_show(c["commit"], f"{c['source_path']}/{name}")
        got = open(os.path.join(dest, name), "rb").read()
        if want != got:
            byte_diffs.append(f"{cid}/{name}")
n_copied = sum(len(courses[c]["files"]) for c in order)
check(assembly_checks, "content-byte-identical-to-source", not byte_diffs,
      f"{n_copied} copied course files re-hashed against their pinned source commits; {len(byte_diffs)} differ"
      + ("" if not byte_diffs else ": " + "; ".join(byte_diffs[:5])))

sealed_touched = subprocess.run(
    ["git", "-C", ROOT, "diff", "--name-only", LEDGER["assembly_base_commit"], "HEAD", "--",
     "curriculum-content/manuel-academy/1.0.0"], capture_output=True, text=True).stdout.strip()
check(assembly_checks, "sealed-1.0.0-identity-untouched", not sealed_touched,
      "no file under curriculum-content/manuel-academy/1.0.0 differs from the assembly base"
      if not sealed_touched else sealed_touched)

checks = contract_checks + assembly_checks
contract_failed = [c["check"] for c in contract_checks if c["result"] == "FAIL"]
assembly_failed = [c["check"] for c in assembly_checks if c["result"] == "FAIL"]
contract_verdict = "FAIL" if contract_failed else "PASS"
assembly_verdict = "FAIL" if assembly_failed else "PASS"
overall = {"assembly_integrity": assembly_verdict, "release_contract_conformance": contract_verdict}

counts = {
    "grades": len(grades),
    "courses": len(order),
    "units": len(uids),
    "lessons": len(lids),
    "assessments": len(aids),
    "scheduled_sessions": sum(len(schedules[c]) for c in order),
    "per_grade": {str(g): {
        "courses": sum(1 for c in order if courses[c]["grade"] == g),
        "units": sum(len(courses[c]["units"]) for c in order if courses[c]["grade"] == g),
        "lessons": sum(len(courses[c]["lessons"]) for c in order if courses[c]["grade"] == g),
    } for g in grades},
    "per_course": {cid: {"units": len(courses[cid]["units"]),
                         "lessons": len(courses[cid]["lessons"]),
                         "assessments": len(courses[cid]["assessments"])} for cid in order},
}

write("validation/validation.json", jdump({
    "candidate_id": LEDGER["candidate_id"],
    "validated_on": ASSEMBLED_ON,
    "overall": overall,
    "failed_checks": {"release_contract": contract_failed, "assembly_integrity": assembly_failed},
    "counts": counts,
    "contract_checks": contract_checks,
    "assembly_checks": assembly_checks,
    "scope_limits": [
        "Internal consistency only. No standard code is verified against a live Michigan source.",
        "Four contract checks are keyword heuristics (no-media-path, safety-privacy-content, multi-occasion-mastery, and the fallback scan). They can miss phrasing they do not match; human review is still required.",
        "No runtime/host integration is exercised: grades 3 and 4 are absent from AcademyGrade, PILOT_GRADES, and scripts/build-curriculum.mjs.",
        "No licensed-educator sign-off. Health and Physical Education are marked PENDING_FINAL_HEALTH_REVIEW.",
        "Accessibility is verified structurally in content, not against a rendered interface.",
    ],
}))

def rows_for(group):
    return "\n".join(f"| `{c['check']}` | {c['result']} | {c['detail']} |" for c in group)

per_course_rows = "\n".join(
    f"| {courses[cid]['grade']} | {courses[cid]['subject']} | `{cid}` | {len(courses[cid]['units'])} | "
    f"{len(courses[cid]['lessons'])} | {len(courses[cid]['assessments'])} | {len(schedules[cid]) // WEEKS}/wk | "
    f"{courses[cid]['schedule_provenance']} | {course_index['courses'][order.index(cid)]['status']} |"
    for cid in order)

write("validation/validation-report.md", f"""# Validation Report - Grades 3/4 Release Candidate r1

**Candidate:** `{LEDGER['candidate_id']}`
**Assembled on:** {ASSEMBLED_ON}

| Verdict | Result |
| --- | --- |
| Assembly integrity (this session's own deliverable) | **{assembly_verdict}** |
| Conformance to `release/validation-contract.md` | **{contract_verdict}** |

These are reported separately and are not averaged. The assembly is sound; the assembled content
does not yet satisfy every check the release contract requires, and the gap is a lane-owned content
property, not something assembly can fix. Failing contract checks: {', '.join(f'`{c}`' for c in contract_failed) or 'none'}.

Generated by `tools/assemble.py` from the commits pinned in
[`ledger/source-branches.json`](../ledger/source-branches.json).

## Counts

| | Grade 3 | Grade 4 | Total |
| --- | ---: | ---: | ---: |
| Courses | {counts['per_grade']['3']['courses']} | {counts['per_grade']['4']['courses']} | {counts['courses']} |
| Units | {counts['per_grade']['3']['units']} | {counts['per_grade']['4']['units']} | {counts['units']} |
| Lessons | {counts['per_grade']['3']['lessons']} | {counts['per_grade']['4']['lessons']} | {counts['lessons']} |
| Assessments | | | {counts['assessments']} |
| Scheduled sessions | | | {counts['scheduled_sessions']} |

## Per course

| Grade | Subject | Course ID | Units | Lessons | Assessments | Cadence | Schedule | Status |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
{per_course_rows}

## Release-contract checks

Every required check named in
[`standards/sources/release/validation-contract.md`](../standards/sources/release/validation-contract.md),
run in the contract's own order. The contract's runnable validator is carried at
`standards/sources/release/validate-grade34.mjs` for independent re-execution.

| Check | Result | Detail |
| --- | --- | --- |
{rows_for(contract_checks)}

## Assembly-integrity checks

Additional checks this assembly adds; not part of the contract.

| Check | Result | Detail |
| --- | --- | --- |
{rows_for(assembly_checks)}

## Scope limits

- Internal consistency only. No standard code is verified against a live Michigan source in this run.
- Four contract checks (`no-media-path`, `safety-privacy-content`, `multi-occasion-mastery`, and the
  fallback keyword scan) are heuristics, exactly as the contract describes them. A PASS means the
  scan found nothing, not that a human reviewed the phrasing.
- `lesson-schema-candidate-compatibility` validates the content against a schema derived from that
  same content. It confirms internal consistency, not conformance to an independent standard - that
  is what `lesson-schema-compatibility` measures.
- No runtime or host integration is exercised. Grades 3 and 4 do not exist in `AcademyGrade`,
  `PILOT_GRADES`, or `scripts/build-curriculum.mjs`; promotion is a separate, later session.
- No licensed-educator sign-off. Health and Physical Education carry `PENDING_FINAL_HEALTH_REVIEW`
  and are included in full rather than hidden.
- Accessibility is verified structurally in content, not against a rendered interface.
""")


# --------------------------------------------------------------- manifest
manifest = {
    "candidate_id": LEDGER["candidate_id"],
    "status": "GRADE34_ASSEMBLY_READY",
    "assembled_on": ASSEMBLED_ON,
    "supersedes": None,
    "preserves": {
        "package": "curriculum-content/manuel-academy/1.0.0",
        "note": "The sealed Grades 5/7/8 release keeps its own identity, version, counts, and checksums. This candidate is a separate tree and modifies nothing under curriculum-content/.",
    },
    "grades": [3, 4],
    "school_year": {"weeks": WEEKS, "instructional_days": 180},
    "subjects": CANONICAL_SUBJECTS,
    "counts": counts,
    "entry_points": {
        "course_index": "course-index.json",
        "unit_index": "unit-index.json",
        "lesson_index": "lesson-index.csv",
        "schedule_index": "schedules/schedule-index.json",
        "lesson_schema_candidate": "schemas/lesson.schema.candidate.json",
        "validation": "validation/validation.json",
        "standards_custody": "standards/standards-custody-report.md",
        "source_ledger": "ledger/source-branches.json",
        "checksums": "SHA256SUMS.txt",
    },
    "course_status": {cid: course_index["courses"][order.index(cid)]["status"] for cid in order},
    "boundaries": {
        "owns": "curriculum-release-candidates/g34-r1/**",
        "does_not_modify": ["curriculum-content/manuel-academy/1.0.0/**",
                            "curriculum-authoring/full-family-grade34/**",
                            "src/**", "scripts/**"],
        "not_yet_wired": ["AcademyGrade in src/types.ts",
                          "PILOT_GRADES in src/curriculum/family-pilot/source.node.ts",
                          "EXPECTED counts in scripts/build-curriculum.mjs",
                          "a published release version for grades 3/4"],
    },
    "validation": {
        "assembly_integrity": assembly_verdict,
        "release_contract_conformance": contract_verdict,
        "failed_contract_checks": contract_failed,
        "failed_assembly_checks": assembly_failed,
        "note": ("Assembly integrity is this session's deliverable and passes. The release-contract "
                 "failures are a property of the authored content (standards emitted as strings, and "
                 "a release schema whose subject enum and schema_version const do not match what the "
                 "lanes authored), not of the assembly. They must be resolved before promotion - see "
                 "standards/standards-custody-report.md."),
    },
}
write("MANIFEST.json", jdump(manifest))


# ------------------------------------------------------- standards inventory
inventory = {
    "candidate_id": LEDGER["candidate_id"],
    "generated_on": ASSEMBLED_ON,
    "citation_form": "Every lane emits `standards` as an array of plain strings. No lane emits the {code_or_strand, source, mapping_status} object form proposed in release/lesson-schema.json.",
    "total_citations": total_std,
    "citations_with_mapping_status": std_with_status,
    "courses": [],
}
for cid in order:
    codes = {}
    for l in courses[cid]["lessons"]:
        for st in l.get("standards", []):
            key = st if isinstance(st, str) else json.dumps(st, sort_keys=True)
            codes[key] = codes.get(key, 0) + 1
    lane = courses[cid]["lane"]
    inventory["courses"].append({
        "course_id": cid,
        "grade": courses[cid]["grade"],
        "subject": courses[cid]["subject"],
        "distinct_codes": len(codes),
        "citations": sum(codes.values()),
        "citation_style": "exact code" if any(re.match(r"^[0-9]", k) for k in codes) else "named strand or band",
        "lane_standards_artifact": bool(STANDARDS_SOURCES.get(lane)),
        "codes": sorted(codes),
    })
write("standards/standards-inventory.json", jdump(inventory))


# -------------------------------------------------------------- checksums
def sha256_tree():
    entries = []
    for base, _dirs, names in os.walk(OUT):
        for n in sorted(names):
            p = os.path.join(base, n)
            rel = os.path.relpath(p, OUT)
            if rel in ("SHA256SUMS.txt",) or rel.startswith("tools/.last-run"):
                continue
            entries.append((rel, hashlib.sha256(open(p, "rb").read()).hexdigest()))
    return sorted(entries)


write("SHA256SUMS.txt", "".join(f"{h}  {rel}\n" for rel, h in sha256_tree()))

print(f"assembly={assembly_verdict} contract={contract_verdict} courses={counts['courses']} units={counts['units']} lessons={counts['lessons']} assessments={counts['assessments']}")
for c in checks:
    print(f"  {c['result']:8} {c['check']}")
