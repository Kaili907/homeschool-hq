#!/usr/bin/env python3
"""Validate the Grades 3-4 ELA authoring package.

Emits validation/validation.json and validation/validation-report.md and exits
non-zero if any check fails.

Usage:  python3 tools/validate.py
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", "..", ".."))
G5_UNITS = os.path.join(REPO, "curriculum-content", "manuel-academy", "1.0.0",
                        "grades", "grade-5", "courses", "english-language-arts", "units.json")
LESSON_ID = re.compile(r"^ma-g([34])-english-language-arts-u(\d{2})-l(\d{2})$")
STD_RE = re.compile(r"^[34]\.(RL|RI|RF|W|SL|L)\.\d{1,2}[a-z]?$")

RESULTS = []
def check(name, ok, details):
    RESULTS.append({"check": name, "result": "PASS" if ok else "FAIL", "details": details})

def load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return json.load(fh)

def load_jsonl(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]

def load_csv(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return list(csv.DictReader(fh))

# ---------------------------------------------------------------- load package
G = {}
for g in (3, 4):
    G[g] = dict(
        lessons=load_jsonl("grades", f"grade-{g}", "lessons.jsonl"),
        units=load("grades", f"grade-{g}", "units.json"),
        assessments=load("grades", f"grade-{g}", "assessments.json"),
        texts=load("grades", f"grade-{g}", "original-text-bank.json"),
        pd=load("grades", f"grade-{g}", "public-domain-register.json"),
        schedule=load_csv("grades", f"grade-{g}", "schedule.csv"),
        catalog=load("standards", f"michigan-ela-g{g}.json"),
    )
smap = load("standards", "standards-map.json")
courses = load("indices", "course-index.json")
unit_index = load("indices", "unit-index.json")
lesson_index = load_csv("indices", "lesson-index.csv")

ALL = [l for g in (3, 4) for l in G[g]["lessons"]]

# ------------------------------------------------------------------- structure
check("two-courses", len(courses) == 2 and {c["grade"] for c in courses} == {3, 4},
      f"{[c['course_id'] for c in courses]}")

for g in (3, 4):
    check(f"grade-{g}-full-year",
          len(G[g]["lessons"]) == 180 and len(G[g]["units"]) == 10
          and all(u["days"] == 18 for u in G[g]["units"]),
          f"lessons={len(G[g]['lessons'])}, units={len(G[g]['units'])}, days/unit=18")

check("thirty-six-week-model",
      all(c["weeks"] == 36 and c["days"] == 180 for c in courses),
      f"{[(c['grade'], c['weeks'], c['days']) for c in courses]}")

ids = [l["lesson_id"] for l in ALL]
check("stable-unique-lesson-refs", len(ids) == 360 and len(set(ids)) == 360,
      f"{len(ids)} refs, {len(set(ids))} unique")
bad = [i for i in ids if not LESSON_ID.match(i)]
check("lesson-ref-pattern", not bad, f"all 360 match ^ma-g[34]-english-language-arts-uNN-lNN$"
      if not bad else f"{bad[:5]}")
consistent = [l for l in ALL
              if LESSON_ID.match(l["lesson_id"]).groups()
              != (str(l["grade"]), f"{l['unit_number']:02d}", f"{l['day_in_unit']:02d}")]
check("lesson-ref-matches-fields", not consistent,
      "grade, unit, and day encoded in every ref match the record"
      if not consistent else f"{[l['lesson_id'] for l in consistent[:5]]}")

for g in (3, 4):
    days = sorted(l["course_day"] for l in G[g]["lessons"])
    check(f"grade-{g}-course-days-contiguous", days == list(range(1, 181)),
          f"1..180 with no gap or repeat" if days == list(range(1, 181)) else "gap or repeat")

# -------------------------------------------------------------- schedule
for g in (3, 4):
    sched = G[g]["schedule"]
    sids = [r["lesson_id"] for r in sched]
    lids = {l["lesson_id"] for l in G[g]["lessons"]}
    weeks = sorted({int(r["week"]) for r in sched})
    ok = (len(sched) == 180 and len(set(sids)) == 180 and set(sids) == lids
          and weeks == list(range(1, 37)))
    check(f"grade-{g}-schedule-exact-coverage", ok,
          f"scheduled={len(sched)}, unique={len(set(sids))}, lessons={len(lids)}, "
          f"weeks={weeks[0]}..{weeks[-1]}, unscheduled={len(lids - set(sids))}, "
          f"scheduled-but-missing={len(set(sids) - lids)}")

# -------------------------------------------------------------- unit integrity
prob = []
for g in (3, 4):
    for u in G[g]["units"]:
        actual = [l["lesson_id"] for l in G[g]["lessons"] if l["unit_number"] == u["unit_number"]]
        if actual != u["lesson_ids"] or len(actual) != 18:
            prob.append(u["unit_id"])
        if u["assessment_id"] not in {a["assessment_id"] for a in G[g]["assessments"]}:
            prob.append(u["unit_id"] + ":assessment")
check("unit-lesson-and-assessment-integrity", not prob,
      "all 20 units list exactly their 18 lessons and a resolvable assessment"
      if not prob else f"{prob[:5]}")
check("index-consistency",
      len(unit_index) == 20 and len(lesson_index) == 360
      and {r["lesson_id"] for r in lesson_index} == set(ids),
      f"unit-index={len(unit_index)}, lesson-index={len(lesson_index)}")

# -------------------------------------------------------------- standards
for g in (3, 4):
    cat = set(G[g]["catalog"]["standards"])
    used = set()
    for l in G[g]["lessons"]:
        used |= set(l["standards"])
    for u in G[g]["units"]:
        used |= set(u["standards"])
    excluded = set(G[g]["catalog"]["excluded_codes"])
    check(f"grade-{g}-no-invented-standards", not (used - cat),
          f"{len(used)} codes used, all in the verified catalog" if not (used - cat)
          else f"not in catalog: {sorted(used - cat)}")
    check(f"grade-{g}-standards-coverage-complete", not (cat - used),
          f"all {len(cat)} catalog codes reach at least one lesson or unit"
          if not (cat - used) else f"uncovered: {sorted(cat - used)}")
    check(f"grade-{g}-excluded-codes-absent", not (used & excluded),
          f"none of {sorted(excluded)} appear anywhere"
          if not (used & excluded) else f"present: {sorted(used & excluded)}")
    mapped = smap["grades"][f"grade-{g}"]["standards"]
    mismatch = [c for c in cat if mapped.get(c, {}).get("lesson_count", 0) < 1]
    check(f"grade-{g}-standards-map-nonempty", not mismatch,
          f"standards-map resolves {len(cat)} codes to lessons"
          if not mismatch else f"empty: {mismatch[:5]}")
# Every code a unit's own days cite must be declared on that unit, either as an anchor
# (standards) or as a code the unit additionally touches (additional_standards_touched).
undeclared = []
for g in (3, 4):
    by_id = {l["lesson_id"]: l for l in G[g]["lessons"]}
    for u in G[g]["units"]:
        declared = set(u["standards"]) | set(u.get("additional_standards_touched", []))
        taught = {c for lid in u["lesson_ids"] for c in by_id[lid]["standards"]}
        for c in sorted(taught - declared):
            undeclared.append(f"{u['unit_id']}:{c}")
check("unit-declares-every-code-its-days-cite", not undeclared,
      "every day-level code is declared on its unit"
      if not undeclared else f"undeclared: {undeclared[:6]}")

drift = []
for g in (3, 4):
    declared = {t["id"]: set(t["units"]) for t in G[g]["texts"]}
    for u in G[g]["units"]:
        for t in u["anchor_texts"]:
            if t in declared and u["unit_number"] not in declared[t]:
                drift.append(f"{t} anchors u{u['unit_number']} but declares {sorted(declared[t])}")
check("text-bank-units-match-anchor-usage", not drift,
      "every anchor text declares the unit it anchors" if not drift else f"drift: {drift[:5]}")

badfmt = sorted({s for l in ALL for s in l["standards"] if not STD_RE.match(s)})
check("standards-code-format", not badfmt,
      "every code matches <grade>.<strand>.<number>[letter]" if not badfmt else f"{badfmt}")

# -------------------------------------------------------------- lesson fields
REQUIRED = ["schema_version", "lesson_id", "course_id", "grade", "subject", "course_day",
            "unit_number", "day_in_unit", "title", "phase", "focus", "standards",
            "learning_objectives", "lesson_flow", "formative_check", "mastery_rule",
            "accessibility_and_accommodations", "safety_and_privacy", "text_reference",
            "evidence_mode", "assessed", "student_authorship", "fixed_answer_protection",
            "mastery", "speaking_and_listening_alternatives", "persistence",
            "adaptive_support", "media", "adaptive_tutor_routes"]
missing = [(l["lesson_id"], f) for l in ALL for f in REQUIRED if f not in l]
check("lesson-required-fields", not missing,
      "all 360 lessons carry every v1.1 required field" if not missing else f"{missing[:5]}")
shallow = [l["lesson_id"] for l in ALL
           if len(l["learning_objectives"]) < 3 or len(l["lesson_flow"]) < 5
           or len(l["standards"]) < 1 or len(l["adaptive_tutor_routes"]) < 5]
check("lesson-depth", not shallow,
      "all lessons carry 3+ objectives, 5+ flow segments, 1+ standards, 5+ tutor routes"
      if not shallow else f"{shallow[:5]}")
dupseg = [l["lesson_id"] for l in ALL
          if len({s["teacher_or_tutor_action"] for s in l["lesson_flow"]}) != len(l["lesson_flow"])]
check("lesson-flow-segments-distinct", not dupseg,
      "no lesson repeats the same instructional move in two segments"
      if not dupseg else f"{dupseg[:5]}")

# -------------------------------------------------------------- accessibility
acc_bad = [l["lesson_id"] for l in ALL if len(l["accessibility_and_accommodations"]) < 5]
check("accessibility-depth", not acc_bad,
      "every lesson carries 5+ accessibility provisions" if not acc_bad else f"{acc_bad[:5]}")
need = ["text-only", "read-aloud", "no-audio", "private presentation"]
gaps = []
for l in ALL:
    blob = " ".join(l["accessibility_and_accommodations"]).lower()
    for n in need:
        if n not in blob:
            gaps.append((l["lesson_id"], n))
check("accessibility-required-paths", not gaps,
      "every lesson states a text-only path, read-aloud capability, a no-audio path, "
      "and a private presentation alternative" if not gaps else f"{gaps[:5]}")
sl_bad = [l["lesson_id"] for l in ALL
          if not l["speaking_and_listening_alternatives"].get("no_learner_voice_or_video_required")
          or not l["speaking_and_listening_alternatives"].get(
              "captions_and_transcript_required_when_media_exists")]
check("no-required-learner-voice-or-video", not sl_bad,
      "no lesson requires learner voice or video; captions and transcripts required when media exists"
      if not sl_bad else f"{sl_bad[:5]}")
media_bad = [l["lesson_id"] for l in ALL
             if l["media"].get("required") is not False or not l["media"].get("fallback")]
check("media-optional-with-fallback", not media_bad,
      "media optional with a readable fallback on all 360 lessons" if not media_bad else f"{media_bad[:5]}")

# -------------------------------------------------------------- text provenance
prov, embedded_pd = [], []
for g in (3, 4):
    bank = {t["id"]: t for t in G[g]["texts"]}
    for l in G[g]["lessons"]:
        tr = l["text_reference"]
        if tr["mode"] == "package-supplied":
            if tr.get("text_id") not in bank:
                prov.append((l["lesson_id"], "unresolved text_id"))
            elif not tr.get("rights") or tr.get("source_type") != bank[tr["text_id"]]["source_type"]:
                prov.append((l["lesson_id"], "rights or source_type mismatch"))
        elif tr.get("source_type") != "learner-authored":
            prov.append((l["lesson_id"], "learner-produced without learner-authored source_type"))
        if not tr.get("learner_or_family_selected_texts_permitted"):
            prov.append((l["lesson_id"], "no substitution rule"))
    for w in G[g]["pd"]["works"]:
        if "text" in w or "body" in w:
            embedded_pd.append(w["id"])
check("text-provenance-resolves", not prov,
      "every lesson names a text with a resolvable id, matching source type, and a rights statement"
      if not prov else f"{prov[:5]}")
check("public-domain-referenced-not-reproduced", not embedded_pd,
      f"{sum(len(G[g]['pd']['works']) for g in (3, 4))} public-domain works are references with "
      f"creator, year, and rationale; none is reproduced"
      if not embedded_pd else f"{embedded_pd}")
tb = []
for g in (3, 4):
    tids = [t["id"] for t in G[g]["texts"]]
    if len(tids) != len(set(tids)):
        tb.append(f"grade-{g}: duplicate ids")
    for t in G[g]["texts"]:
        if t["source_type"] != "original" or not t.get("rights") or len(t["text"].split()) < 80:
            tb.append(t["id"])
check("original-text-bank-integrity", not tb,
      f"{len(G[3]['texts'])} Grade 3 and {len(G[4]['texts'])} Grade 4 original texts, each with a "
      f"rights statement and substantive length" if not tb else f"{tb[:5]}")
pdmeta = [w["id"] for g in (3, 4) for w in G[g]["pd"]["works"]
          if not all(k in w for k in ("title", "creator", "first_published", "rationale"))]
check("public-domain-metadata-complete", not pdmeta,
      "every public-domain reference carries title, creator, first-publication year, and rationale"
      if not pdmeta else f"{pdmeta[:5]}")

# -------------------------------------------------------------- integrity
auth = [l["lesson_id"] for l in ALL
        if "must not" not in l["student_authorship"] or len(l["student_authorship"]) < 40]
check("student-authorship-on-every-lesson", not auth,
      "all 360 lessons carry the authorship rule stating what the tutor must not do"
      if not auth else f"{auth[:5]}")
fap = [l["lesson_id"] for l in ALL if "scorer-visible only" not in l["fixed_answer_protection"]]
check("fixed-answer-protection-on-every-lesson", not fap,
      "all 360 lessons restrict fixed-answer keys to scorer-visible only" if not fap else f"{fap[:5]}")
draft_bad = [l["lesson_id"] for l in ALL
             if l["phase"] in ("Writing revise and edit", "Writing revision workshop")
             and "never on the learner" not in " ".join(
                 s["teacher_or_tutor_action"] for s in l["lesson_flow"])]
check("tutor-does-not-touch-assessed-draft", not draft_bad,
      "every revision lesson instructs the tutor to model on a sample, never on the learner's "
      "assessed draft" if not draft_bad else f"{draft_bad[:5]}")
assessed = [l for l in ALL if l["assessed"]]
check("assessed-days-are-independent",
      len(assessed) == 20 and all(l["evidence_mode"] == "independent" for l in assessed),
      f"{len(assessed)} assessed lessons (one per unit), all marked independent")

# -------------------------------------------------------------- mastery
mm = [l["lesson_id"] for l in ALL
      if l["mastery"]["occasions_required"] < 2
      or l["mastery"]["independent_evidence_required"] is not True
      or l["mastery"]["guided_success_is_not_mastery"] is not True
      or len(l["mastery"]["evidence_types"]) < 3]
check("multi-occasion-mastery", not mm,
      "all 360 lessons require 2+ occasions, independent evidence, and 3+ evidence types, "
      "and record that guided success is not mastery" if not mm else f"{mm[:5]}")
ev = []
for g in (3, 4):
    for u in G[g]["units"]:
        ls = [l for l in G[g]["lessons"] if l["unit_number"] == u["unit_number"]]
        modes = {l["evidence_mode"] for l in ls}
        if modes != {"guided", "independent"}:
            ev.append(u["unit_id"])
check("guided-and-independent-evidence-per-unit", not ev,
      "every unit produces both guided and independent evidence" if not ev else f"{ev[:5]}")

# -------------------------------------------------------------- persistence
pp = [l["lesson_id"] for l in ALL
      if l["persistence"]["raw_response_retention_required"] is not False
      or not any("raw essay" in x for x in l["persistence"]["not_required_to_store"])]
check("no-raw-essay-persistence-requirement", not pp,
      "no lesson requires retaining a learner's raw essay or extended response text"
      if not pp else f"{pp[:5]}")

# -------------------------------------------------------------- assessments
ab = []
for g in (3, 4):
    for a in G[g]["assessments"]:
        if not a["guided_evidence"]["collected_on"] or not a["independent_evidence"]["collected_on"]:
            ab.append(a["assessment_id"] + ":evidence-split")
        if a["multi_occasion_mastery"]["occasions_required"] < 2:
            ab.append(a["assessment_id"] + ":occasions")
        if "scorer-visible only" not in a["fixed_answer_protection"]:
            ab.append(a["assessment_id"] + ":keys")
        if "must not" not in a["student_authorship"]:
            ab.append(a["assessment_id"] + ":authorship")
        if a["persistence"]["raw_response_retention_required"] is not False:
            ab.append(a["assessment_id"] + ":persistence")
        if not any(p["fixed_answer"] for p in a["prompts"]):
            ab.append(a["assessment_id"] + ":no-fixed-answer-item")
        if sum(p["points"] for p in a["prompts"]) != a["total_points"]:
            ab.append(a["assessment_id"] + ":points")
        refs = set(a["guided_evidence"]["collected_on"]) | set(a["independent_evidence"]["collected_on"])
        if refs - {l["lesson_id"] for l in G[g]["lessons"]}:
            ab.append(a["assessment_id"] + ":dangling-lesson-ref")
check("assessment-integrity", not ab,
      "all 20 assessments split guided from independent evidence, require 2+ occasions, protect "
      "fixed answers, require student authorship, bound persistence, and balance points"
      if not ab else f"{ab[:5]}")

# -------------------------------------------------------------- progressions
g3w = {s for l in G[3]["lessons"] for s in l["standards"] if s.startswith("3.W.")}
g4w = {s for l in G[4]["lessons"] for s in l["standards"] if s.startswith("4.W.")}
check("writing-progression",
      {"3.W.1", "3.W.2", "3.W.3", "3.W.5"} <= g3w and "3.W.9" not in g3w
      and {"4.W.1", "4.W.2", "4.W.3", "4.W.9a", "4.W.9b"} <= g4w,
      "Grade 3 covers opinion, informative, narrative and revision with no W.9 (which begins at "
      "Grade 4); Grade 4 adds W.9a and W.9b, the evidence-from-texts standard new at this grade")
g3r = {s for l in G[3]["lessons"] for s in l["standards"] if s.startswith(("3.RF.", "3.RL.", "3.RI."))}
g4r = {s for l in G[4]["lessons"] for s in l["standards"] if s.startswith(("4.RF.", "4.RL.", "4.RI."))}
rf3 = sum(1 for l in G[3]["lessons"] if "3.RF.3" in l["standards"])
rf4 = sum(1 for l in G[4]["lessons"] if "4.RF.3" in l["standards"])
fl3 = sum(1 for l in G[3]["lessons"] if "3.RF.4" in l["standards"])
fl4 = sum(1 for l in G[4]["lessons"] if "4.RF.4" in l["standards"])
check("reading-progression",
      {"3.RF.3", "3.RF.4", "3.RL.2", "3.RI.2", "3.RI.5"} <= g3r
      and {"4.RF.3", "4.RF.4", "4.RL.2", "4.RI.2", "4.RI.5", "4.RI.6", "4.RI.8"} <= g4r
      and rf3 > rf4 and fl3 >= 1 and fl4 >= 1,
      f"foundational decoding present at both grades and heavier at Grade 3 as the standards "
      f"require (3.RF.3 on {rf3} lessons vs 4.RF.3 on {rf4}); fluency retained at both "
      f"(3.RF.4 on {fl3}, 4.RF.4 on {fl4}); Grade 4 adds structure, firsthand/secondhand, "
      f"and author's reasoning")

# -------------------------------------- independent progressions, not derived
arc3 = [l["phase"] for l in G[3]["lessons"][:18]]
arc4 = [l["phase"] for l in G[4]["lessons"][:18]]
f3 = {l["focus"] for l in G[3]["lessons"]}
f4 = {l["focus"] for l in G[4]["lessons"]}
t3 = {u["title"] for u in G[3]["units"]}
t4 = {u["title"] for u in G[4]["units"]}
x3 = {t["id"] for t in G[3]["texts"]}
x4 = {t["id"] for t in G[4]["texts"]}
check("grades-independently-authored",
      arc3 != arc4 and not (f3 & f4) and not (t3 & t4) and not (x3 & x4)
      and len(f3) == 180 and len(f4) == 180,
      f"different 18-day arcs; {len(f3)} and {len(f4)} distinct daily foci with zero overlap; "
      f"no shared unit title; no shared text")

g5 = None
if os.path.exists(G5_UNITS):
    with open(G5_UNITS, encoding="utf-8") as fh:
        g5 = json.load(fh)
if g5 is None:
    check("not-derived-from-grade-5", False, "Grade 5 ELA units.json not found; comparison not run")
else:
    g5t = {u["title"] for u in g5}
    g5s = {s for u in g5 for s in u["standards"]}
    g5arc = None
    p5 = os.path.join(os.path.dirname(G5_UNITS), "lessons.jsonl")
    if os.path.exists(p5):
        with open(p5, encoding="utf-8") as fh:
            g5l = [json.loads(x) for x in fh][:18]
        g5arc = [l["phase"] for l in g5l]
    ok = (not (t3 & g5t) and not (t4 & g5t)
          and not ({s for l in ALL for s in l["standards"]} & g5s)
          and (g5arc is None or (arc3 != g5arc and arc4 != g5arc)))
    check("not-derived-from-grade-5", ok,
          "no unit title, no standards code, and neither 18-day arc is shared with the frozen "
          "Grade 5 ELA course" if ok else "overlap with Grade 5 detected")

# -------------------------------------------------------------- adaptive english
ab2 = [l["lesson_id"] for l in ALL
       if l["adaptive_support"]["package_modified"] is not False
       or l["adaptive_support"]["static_help_sufficient"] is not True
       or l["adaptive_support"]["adaptive_english_band_match"] is not (l["grade"] == 4)]
check("adaptive-english-boundary", not ab2,
      "Grade 3 records no band match and runs on static help; Grade 4 records band match for a "
      "future adapter; no lesson modifies the frozen package" if not ab2 else f"{ab2[:5]}")

# -------------------------------------------------------------- ownership
owned = []
for dirpath, _, files in os.walk(ROOT):
    for f in files:
        owned.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
check("package-self-contained", len(owned) > 30 and "authoring/build.py" in owned,
      f"{len(owned)} files, all under "
      f"curriculum-authoring/full-family-grade34/subjects/english-language-arts/")

# -------------------------------------------------------------- schema conformance
def schema_errors(node, sch, path=""):
    """Validate against the JSON Schema keyword subset this package actually uses.

    Avoids a hard dependency on the jsonschema library, which is not installed in
    every environment this package is built in.
    """
    errs = []
    if "const" in sch and node != sch["const"]:
        errs.append(f"{path}: expected const {sch['const']!r}, got {node!r}")
    if "enum" in sch and node not in sch["enum"]:
        errs.append(f"{path}: {node!r} not in {sch['enum']}")
    t = sch.get("type")
    if t:
        ok = {"object": dict, "array": list, "string": str, "boolean": bool,
              "integer": int, "number": (int, float)}[t]
        if t == "integer" and isinstance(node, bool):
            errs.append(f"{path}: expected integer, got bool")
        elif not isinstance(node, ok):
            errs.append(f"{path}: expected {t}, got {type(node).__name__}")
            return errs
    if isinstance(node, str):
        if "pattern" in sch and not re.search(sch["pattern"], node):
            errs.append(f"{path}: {node[:40]!r} does not match {sch['pattern']}")
        if "minLength" in sch and len(node) < sch["minLength"]:
            errs.append(f"{path}: shorter than minLength {sch['minLength']}")
    if isinstance(node, int) and not isinstance(node, bool):
        if "minimum" in sch and node < sch["minimum"]:
            errs.append(f"{path}: {node} below minimum {sch['minimum']}")
        if "maximum" in sch and node > sch["maximum"]:
            errs.append(f"{path}: {node} above maximum {sch['maximum']}")
    if isinstance(node, list):
        if "minItems" in sch and len(node) < sch["minItems"]:
            errs.append(f"{path}: {len(node)} items, minItems {sch['minItems']}")
        if "items" in sch:
            for i, item in enumerate(node):
                errs += schema_errors(item, sch["items"], f"{path}[{i}]")
    if isinstance(node, dict):
        for key in sch.get("required", []):
            if key not in node:
                errs.append(f"{path}: missing required '{key}'")
        for key, sub in sch.get("properties", {}).items():
            if key in node:
                errs += schema_errors(node[key], sub, f"{path}.{key}")
        for clause in sch.get("allOf", []):
            if "if" in clause:
                if not schema_errors(node, clause["if"], path):
                    errs += schema_errors(node, clause["then"], path)
            else:
                errs += schema_errors(node, clause, path)
    return errs

with open(os.path.join(ROOT, "schemas", "lesson.schema.json"), encoding="utf-8") as fh:
    LESSON_SCHEMA = json.load(fh)
sch_errs = []
for l in ALL:
    sch_errs += [f"{l['lesson_id']}{e}" for e in schema_errors(l, LESSON_SCHEMA)]
check("lessons-conform-to-schema-v1_1", not sch_errs,
      f"all 360 lessons validate against schemas/lesson.schema.json"
      if not sch_errs else f"{len(sch_errs)} violations, e.g. {sch_errs[:3]}")

# -------------------------------------------------------------- emit
passed = sum(1 for r in RESULTS if r["result"] == "PASS")
failed = len(RESULTS) - passed
overall = "PASS" if failed == 0 else "FAIL"
os.makedirs(os.path.join(ROOT, "validation"), exist_ok=True)
with open(os.path.join(ROOT, "validation", "validation.json"), "w", encoding="utf-8") as fh:
    json.dump({"package_id": "manuel-academy-grades-3-4-ela-authoring-v1", "version": "1.0.0",
               "validated_on": "2026-08-12", "overall": overall,
               "counts": {"checks": len(RESULTS), "passed": passed, "failed": failed},
               "checks": RESULTS}, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
with open(os.path.join(ROOT, "validation", "validation-report.md"), "w", encoding="utf-8") as fh:
    fh.write("# Validation Report — Grades 3 and 4 English Language Arts\n\n")
    fh.write("**Package:** `manuel-academy-grades-3-4-ela-authoring-v1`  \n**Version:** 1.0.0  \n"
             "**Date:** 2026-08-12  \n")
    fh.write(f"**Overall:** **{overall}** ({passed}/{len(RESULTS)} checks)\n\n")
    fh.write("Regenerate with `python3 tools/validate.py`.\n\n")
    fh.write("| Check | Result | Details |\n| --- | --- | --- |\n")
    for r in RESULTS:
        fh.write(f"| {r['check']} | {r['result']} | {r['details']} |\n")
    fh.write("\n## Interpretation\n\nA PASS verifies structural completeness, unique and stable "
             "lesson references, exact schedule coverage, two-way standards coverage against a "
             "verified Michigan code catalog with no invented codes, required lesson fields, "
             "accessibility paths, text provenance and copyright boundaries, assessment integrity, "
             "the guided-versus-independent evidence split, multi-occasion mastery, the "
             "no-raw-essay persistence boundary, the Adaptive English boundary, and that the two "
             "grades are independently authored rather than derived from Grade 5.\n\n"
             "It does not claim state approval, accreditation, licensure, transcript credit, an "
             "individual learner's proficiency, runtime integration with the Study engine, or "
             "third-party media production.\n")
print(f"{overall}: {passed}/{len(RESULTS)} checks passed")
for r in RESULTS:
    if r["result"] == "FAIL":
        print(f"  FAIL {r['check']}: {r['details']}")
sys.exit(0 if failed == 0 else 1)
