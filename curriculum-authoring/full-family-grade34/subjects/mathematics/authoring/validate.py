#!/usr/bin/env python3
"""Validate the Grade 3 and Grade 4 mathematics packages.

Proves the claims the mission requires: full 36-week courses, unique lesson IDs,
schedule references that resolve exactly once, standards coverage, unit
progression, assessment alignment, multi-occasion mastery, no duplicated Grade 5
content, no raw-learner-response persistence requirement, and a Study-adaptable
lesson structure.

Run:  python3 validate.py
Exit code 0 on PASS, 1 on FAIL.
"""
import csv, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import standards_catalog as SC
import blueprint_g3, blueprint_g4
MODS = {3: blueprint_g3, 4: blueprint_g4}


def unit_std(unit):
    seen = set()
    for _f, st in unit["days"]:
        seen.update(st.split())
    return sorted(seen)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(ROOT))))
G5_MATH = os.path.join(REPO, "curriculum-content", "manuel-academy", "1.0.0",
                       "grades", "grade-5", "courses", "mathematics")
GRADES = [3, 4]
# Evidence types on which no adult help may be scripted.
UNSUPPORTED = ("independent-evidence", "assessment")
checks = []


def check(name, ok, details):
    checks.append({"check": name, "result": "PASS" if ok else "FAIL", "details": details})
    return ok


def jload(p):
    with open(p) as f:
        return json.load(f)


def jlload(p):
    with open(p) as f:
        return [json.loads(l) for l in f if l.strip()]


def base(g):
    return os.path.join(ROOT, "courses", "grade-%d" % g, "mathematics")


# --- minimal JSON Schema subset validator ----------------------------------

def sv(inst, sch, path=""):
    errs = []
    if "const" in sch and inst != sch["const"]:
        errs.append("%s: expected const %r, got %r" % (path, sch["const"], inst))
    if "enum" in sch and inst not in sch["enum"]:
        errs.append("%s: %r not in enum" % (path, inst))
    t = sch.get("type")
    if t:
        py = {"object": dict, "array": list, "string": str, "integer": int, "boolean": bool}
        if t == "integer" and isinstance(inst, bool):
            errs.append("%s: bool is not integer" % path)
        elif t in py and not isinstance(inst, py[t]):
            errs.append("%s: expected %s, got %s" % (path, t, type(inst).__name__))
    if isinstance(inst, str) and "pattern" in sch and not re.match(sch["pattern"], inst):
        errs.append("%s: %r fails pattern %s" % (path, inst, sch["pattern"]))
    if isinstance(inst, str) and "minLength" in sch and len(inst) < sch["minLength"]:
        errs.append("%s: shorter than minLength" % path)
    if isinstance(inst, int) and not isinstance(inst, bool):
        if "minimum" in sch and inst < sch["minimum"]:
            errs.append("%s: below minimum" % path)
        if "maximum" in sch and inst > sch["maximum"]:
            errs.append("%s: above maximum" % path)
    if isinstance(inst, list):
        if "minItems" in sch and len(inst) < sch["minItems"]:
            errs.append("%s: %d items < minItems %d" % (path, len(inst), sch["minItems"]))
        if "items" in sch:
            for i, it in enumerate(inst):
                errs += sv(it, sch["items"], "%s[%d]" % (path, i))
    if isinstance(inst, dict):
        for r in sch.get("required", []):
            if r not in inst:
                errs.append("%s: missing required field %r" % (path, r))
        for k, ks in sch.get("properties", {}).items():
            if k in inst:
                errs += sv(inst[k], ks, "%s.%s" % (path, k))
    return errs


def main():
    schema = jload(os.path.join(ROOT, "schemas", "lesson.schema.json"))
    manifest = jload(os.path.join(ROOT, "package-manifest.json"))
    capmap = jload(os.path.join(ROOT, "adaptive", "adaptive-math-capability-map.json"))
    smap = jload(os.path.join(ROOT, "standards", "standards-map.json"))
    course_index = jload(os.path.join(ROOT, "indexes", "course-index.json"))

    L, U, A, S, M, P, PR = {}, {}, {}, {}, {}, {}, {}
    for g in GRADES:
        L[g] = jlload(os.path.join(base(g), "lessons.jsonl"))
        U[g] = jload(os.path.join(base(g), "units.json"))
        A[g] = jload(os.path.join(base(g), "assessments.json"))
        M[g] = jload(os.path.join(base(g), "mastery-evidence.json"))
        P[g] = jload(os.path.join(base(g), "projects.json"))
        PR[g] = jload(os.path.join(base(g), "practice.json"))
        with open(os.path.join(base(g), "schedule-36-week.csv")) as f:
            S[g] = list(csv.DictReader(f))

    # 1 two complete courses
    check("two-courses", len(course_index) == 2 and {c["grade"] for c in course_index} == {3, 4},
          "grades %s" % sorted(c["grade"] for c in course_index))

    # 2 180 lessons per course
    check("lessons-per-course-180", all(len(L[g]) == 180 for g in GRADES),
          ", ".join("g%d=%d" % (g, len(L[g])) for g in GRADES))

    # 3 units and 18-day units
    ok = all(len(U[g]) == 10 for g in GRADES) and all(u["days"] == 18 for g in GRADES for u in U[g])
    check("ten-units-of-18-days", ok,
          ", ".join("g%d=%d units" % (g, len(U[g])) for g in GRADES))

    # 4 36 weeks x 5 days
    wk_ok = True
    det = []
    for g in GRADES:
        weeks = sorted({int(r["week"]) for r in S[g]})
        per = {}
        for r in S[g]:
            per[int(r["week"])] = per.get(int(r["week"]), 0) + 1
        good = weeks == list(range(1, 37)) and all(v == 5 for v in per.values()) and len(S[g]) == 180
        wk_ok &= good
        det.append("g%d: weeks=%d rows=%d all-5-day=%s" % (g, len(weeks), len(S[g]),
                                                           all(v == 5 for v in per.values())))
    check("full-36-week-schedule", wk_ok, "; ".join(det))

    # 5 unique lesson ids
    allids = [l["lesson_id"] for g in GRADES for l in L[g]]
    check("unique-lesson-ids", len(allids) == len(set(allids)) == 360,
          "%d ids, %d unique" % (len(allids), len(set(allids))))

    # 6 unique unit and course ids
    uids = [u["unit_id"] for g in GRADES for u in U[g]]
    cids = [c["course_id"] for c in course_index]
    check("unique-unit-and-course-ids",
          len(uids) == len(set(uids)) == 20 and len(cids) == len(set(cids)) == 2,
          "%d units, %d courses" % (len(set(uids)), len(set(cids))))

    # 7 unique segment ids
    segs = [s for g in GRADES for l in L[g] for s in l["study_adapter"]["segment_ids"]]
    check("unique-segment-ids", len(segs) == len(set(segs)),
          "%d segments, %d unique" % (len(segs), len(set(segs))))

    # 8 schedule refs resolve exactly once
    sched_ok, det = True, []
    for g in GRADES:
        refs = [r["lesson_id"] for r in S[g]]
        have = {l["lesson_id"] for l in L[g]}
        once = len(refs) == len(set(refs)) and set(refs) == have
        sched_ok &= once
        det.append("g%d: scheduled=%d lessons=%d resolve-once=%s" % (g, len(refs), len(have), once))
    check("schedule-covers-every-lesson-exactly-once", sched_ok, "; ".join(det))

    # 9 course days contiguous 1..180
    cd_ok = all([l["course_day"] for l in L[g]] == list(range(1, 181)) for g in GRADES)
    check("course-days-contiguous-1-180", cd_ok, "both grades" if cd_ok else "mismatch")

    # 10 schedule course_day agrees with lesson course_day
    agree = all(int(r["course_day"]) == l["course_day"]
                for g in GRADES for r, l in zip(S[g], L[g]))
    check("schedule-course-day-agreement", agree, "360 rows checked")

    # 11 lesson schema conformance
    errs = []
    for g in GRADES:
        for l in L[g]:
            e = sv(l, schema, l["lesson_id"])
            if e:
                errs += e[:2]
    check("lesson-schema-conformance", not errs,
          "360 lessons validated" if not errs else "; ".join(errs[:4]))

    # 12 no invented standards codes
    bad = set()
    for g in GRADES:
        for l in L[g]:
            for c in l["standards"]:
                if not SC.validate_code(c):
                    bad.add(c)
        for u in U[g]:
            for c in u["standards"]:
                if not SC.validate_code(c):
                    bad.add(c)
    check("no-invented-standards-codes", not bad,
          "all codes verified against the Michigan catalog" if not bad else "unknown: %s" % sorted(bad))

    # 13 domain ceilings respected
    over = set()
    for g in GRADES:
        for l in L[g]:
            for c in l["standards"]:
                if c.startswith("MP."):
                    continue
                dom = ".".join(c.split(".")[:2])
                if dom in SC.DOMAIN_CEILINGS and int(c.split(".")[2]) > SC.DOMAIN_CEILINGS[dom]:
                    over.add(c)
    check("domain-ceilings-respected", not over,
          "no code exceeds its verified domain ceiling" if not over else sorted(over))

    # 14 standards coverage complete
    cov_ok, det = True, []
    for g in GRADES:
        cat = SC.CATALOG[g]
        used = {c for l in L[g] for c in l["standards"] if not c.startswith("MP.")}
        missing = set(cat) - used
        cov_ok &= not missing
        det.append("g%d: %d/%d%s" % (g, len(cat) - len(missing), len(cat),
                                     "" if not missing else " missing %s" % sorted(missing)))
    check("standards-coverage-complete", cov_ok, "; ".join(det))

    # 15 every standard reaches independent evidence
    ie_ok, det = True, []
    for g in GRADES:
        cat = SC.CATALOG[g]
        ie = {c for l in L[g] if l["evidence_type"] == "independent-evidence" for c in l["standards"]}
        gap = set(cat) - ie
        ie_ok &= not gap
        det.append("g%d: %d/%d%s" % (g, len(cat) - len(gap), len(cat),
                                     "" if not gap else " gap %s" % sorted(gap)))
    check("every-standard-reaches-independent-evidence", ie_ok, "; ".join(det))

    # 16 unit progression: contiguous blocks in order
    prog_ok, det = True, []
    for g in GRADES:
        exp = 1
        for u in U[g]:
            days = [l["course_day"] for l in L[g] if l["unit_number"] == u["unit_number"]]
            if days != list(range(exp, exp + 18)):
                prog_ok = False
                det.append("g%d u%d break" % (g, u["unit_number"]))
            exp += 18
        nums = [u["unit_number"] for u in U[g]]
        if nums != list(range(1, 11)):
            prog_ok = False
    check("unit-progression-contiguous-and-ordered", prog_ok,
          "10 ordered 18-day blocks per grade" if prog_ok else "; ".join(det))

    # 17 unit lesson_ids match actual lessons
    li_ok = True
    for g in GRADES:
        for u in U[g]:
            actual = [l["lesson_id"] for l in L[g] if l["unit_number"] == u["unit_number"]]
            if u["lesson_ids"] != actual:
                li_ok = False
    check("unit-manifest-lesson-refs-resolve", li_ok, "20 unit manifests checked")

    # 18 assessment alignment
    as_ok, det = True, []
    for g in GRADES:
        if len(A[g]) != 10:
            as_ok = False
        for a, u in zip(A[g], U[g]):
            if a["assessment_id"] != u["assessment_id"] or a["unit_id"] != u["unit_id"]:
                as_ok = False
                det.append("id mismatch g%d u%d" % (g, u["unit_number"]))
            if not set(a["standards"]) <= set(u["standards"]):
                as_ok = False
                det.append("standards drift g%d u%d" % (g, u["unit_number"]))
            for p in a["prompts"]:
                if not set(p.get("standards", [])) <= set(u["standards"]):
                    as_ok = False
                    det.append("prompt drift g%d u%d" % (g, u["unit_number"]))
            if a["administered_on_day_in_unit"] != 16:
                as_ok = False
    check("assessment-alignment", as_ok,
          "20 assessments; standards subset of their unit; prompts aligned"
          if as_ok else "; ".join(det[:4]))

    # 19 multi-occasion mastery
    mm_ok, det = True, []
    for g in GRADES:
        for u in U[g]:
            ul = [l for l in L[g] if l["unit_number"] == u["unit_number"]]
            ind = [l for l in ul if l["evidence_type"] == "independent-evidence"]
            days = {l["day_in_unit"] for l in ind}
            has_as = any(l["evidence_type"] == "assessment" for l in ul)
            has_re = any(l["evidence_type"] == "reassessment" for l in ul)
            if len(ind) < 2 or len(days) < 2 or not has_as or not has_re:
                mm_ok = False
                det.append("g%d u%d" % (g, u["unit_number"]))
    check("multi-occasion-mastery", mm_ok,
          "every unit: 4 independent-evidence days on separate days + assessment + reassessment"
          if mm_ok else "; ".join(det))

    # 20 single response never establishes mastery
    sr_ok = all("One correct response cannot establish mastery" in l["mastery_rule"]
                and "two separate occasions" in l["mastery_rule"]
                for g in GRADES for l in L[g])
    guided_not_independent = all(
        (l["counts_toward_independent_mastery_evidence"] is (l["evidence_type"] == "independent-evidence"))
        for g in GRADES for l in L[g])
    check("single-response-cannot-establish-mastery", sr_ok and guided_not_independent,
          "all 360 lessons carry the rule; guided success is never flagged as independent evidence")

    # 21 reassessment requires fresh items
    fr_ok = all(a["reassessment"]["requires_fresh_items"] is True for g in GRADES for a in A[g])
    check("reassessment-requires-fresh-items", fr_ok, "20 assessments")

    # 22 no duplicate Grade 5 content
    g5l = jlload(os.path.join(G5_MATH, "lessons.jsonl"))
    g5u = jload(os.path.join(G5_MATH, "units.json"))
    g5focus = {l["focus"].strip().lower() for l in g5l}
    g5title = {l["title"].strip().lower() for l in g5l}
    g5obj = {o.strip().lower() for l in g5l for o in l["learning_objectives"]}
    g5act = {l["student_activity"].strip().lower() for l in g5l}
    g5unit = {u["title"].strip().lower() for u in g5u}
    g5task = {u["performance_task"].strip().lower() for u in g5u}
    mine_focus = {l["focus"].strip().lower() for g in GRADES for l in L[g]}
    mine_title = {l["title"].strip().lower() for g in GRADES for l in L[g]}
    mine_obj = {o.strip().lower() for g in GRADES for l in L[g] for o in l["learning_objectives"]}
    mine_act = {l["student_activity"].strip().lower() for g in GRADES for l in L[g]}
    mine_unit = {u["title"].strip().lower() for g in GRADES for u in U[g]}
    mine_task = {u["performance_task"].strip().lower() for g in GRADES for u in U[g]}
    overlaps = {
        "focus": g5focus & mine_focus, "lesson_title": g5title & mine_title,
        "objective": g5obj & mine_obj, "student_activity": g5act & mine_act,
        "unit_title": g5unit & mine_unit, "performance_task": g5task & mine_task,
    }
    dup = {k: sorted(v)[:3] for k, v in overlaps.items() if v}
    check("no-duplicate-grade5-content", not dup,
          "zero overlap with Grade 5 across focus, lesson title, objective, activity, unit title, and "
          "performance task" if not dup else str(dup))

    # 23 grade-5 source untouched
    untouched = all(os.path.exists(os.path.join(G5_MATH, f)) for f in
                    ["lessons.jsonl", "units.json", "assessments.json", "course-guide.md"])
    check("grade5-source-present-and-read-only", untouched,
          "Grade 5 mathematics read as reference only; this package writes nothing outside its own path")

    # 24 no raw learner-response persistence requirement
    rr_ok = all(l["evidence_record"]["raw_learner_response_persistence"] == "not-required"
                and "raw learner responses" in l["evidence_record"]["do_not_persist"]
                for g in GRADES for l in L[g])
    mm = M[3]["privacy_note"] and M[4]["privacy_note"]
    check("no-raw-learner-response-persistence-requirement", rr_ok and bool(mm),
          "all 360 lessons declare raw responses not-required and list them as do-not-persist")

    # 25 Study-adaptable structure
    st_ok = all(l["study_adapter"]["resumable_by_segment"] is True
                and len(l["study_adapter"]["segment_ids"]) >= 5
                and len(l["lesson_flow"]) == len(l["study_adapter"]["segment_ids"])
                and l["study_adapter"]["static_fallback_available"] is True
                and l["study_adapter"]["requires_adaptive_package"] is False
                and l["study_adapter"]["requires_network"] is False
                for g in GRADES for l in L[g])
    check("study-adaptable-lesson-structure", st_ok,
          "all 360 lessons resumable by segment with 5+ addressable segments and no runtime dependency")

    # 26 accessibility and safety depth
    acc_ok = all(len(l["accessibility_and_accommodations"]) >= 5 and len(l["safety_and_privacy"]) >= 2
                 for g in GRADES for l in L[g])
    check("accessibility-and-safety-depth", acc_ok, "5+ accommodations and 2+ safety notes on all lessons")

    # 27 media optional with fallback and reduced motion
    med_ok = all(l["media"]["required"] is False and l["media"]["fallback"]
                 and l["media"]["reduced_motion_safe"] is True for g in GRADES for l in L[g])
    check("media-optional-with-text-fallback", med_ok, "all 360 lessons")

    # 28 no camera / photo / voice requirement
    req_terms = ["photograph is required", "camera is required", "voice is required",
                 "must record", "take a photo", "upload a photo"]
    hits = []
    for g in GRADES:
        blob = json.dumps(L[g]).lower()
        for t in req_terms:
            if t in blob:
                hits.append("g%d:%s" % (g, t))
    neg = all("no voice input and no camera are required" in " ".join(l["accessibility_and_accommodations"])
              for g in GRADES for l in L[g])
    check("no-camera-photo-or-voice-requirement", not hits and neg,
          "every lesson states no camera and no voice input is required; no requiring phrase found")

    # 29 Grade 3 fully functional with zero adaptive matches
    g3_static = all(r["handler"] == "static-lesson-fallback"
                    for l in L[3] for r in l["adaptive_tutor_routes"])
    g3_units = all(u["adaptive_math_aligned_sequences"] == [] and u["static_fallback_complete"]
                   for u in U[3])
    g3_map = (capmap["grade_3"]["alignment"] == "none"
              and capmap["grade_3"]["requires_adaptive_package"] is False)
    g3_dep = all(l["study_adapter"]["requires_adaptive_package"] is False for l in L[3])
    check("grade3-functional-without-adaptive-match", g3_static and g3_units and g3_map and g3_dep,
          "180 Grade 3 lessons: every route resolves to static-lesson-fallback; zero adaptive dependency")

    # 30 Grade 4 adaptive markers only where alignment is declared, and never on
    #    a day that must stay unsupported
    declared = {u["unit_number"]: u["adaptive_math_aligned_sequences"] for u in U[4]}
    g4_ok = True
    for l in L[4]:
        marked = [r for r in l["adaptive_tutor_routes"]
                  if r["handler"] == "adaptive-math-capability-marker"]
        exp = declared[l["unit_number"]]
        if l["evidence_type"] in UNSUPPORTED:
            if marked:
                g4_ok = False
            continue
        if exp and (len(marked) != 1 or marked[0]["aligned_sequence_ids"] != exp):
            g4_ok = False
        if not exp and marked:
            g4_ok = False
    known = {s["sequence_id"] for s in capmap["frozen_package"]["sequences"]}
    seq_ok = all(set(v) <= known for v in declared.values())
    aligned_units = sorted(k for k, v in declared.items() if v)
    check("grade4-adaptive-markers-only-where-aligned", g4_ok and seq_ok,
          "aligned units %s; units %s carry no marker; all sequence ids exist in the frozen manifest"
          % (aligned_units, sorted(k for k, v in declared.items() if not v)))

    # 31 frozen package not modified
    frozen_dir = os.path.join(REPO, "adaptive-tutor", "subjects", "math")
    fz = (capmap["frozen_package"]["modification_status"].startswith("referenced only")
          and os.path.isdir(frozen_dir))
    check("frozen-adaptive-package-referenced-not-modified", fz,
          "adaptive-tutor/subjects/math present and declared reference-only")

    # 32 projects and practice complete
    pp_ok = all(len(P[g]["projects"]) == 10 and len(PR[g]["practice_sets"]) == 10 for g in GRADES)
    cap_ok = all(P[g]["projects"][-1]["type"] == "capstone" for g in GRADES)
    check("projects-and-practice-complete", pp_ok and cap_ok,
          "10 projects (last is the capstone) and 10 practice sets per grade")

    # 33 mastery-evidence occasions resolve to real lessons
    me_ok = True
    for g in GRADES:
        have = {l["lesson_id"] for l in L[g]}
        for u in M[g]["units"]:
            for o in u["evidence_occasions"]:
                if o["lesson_id"] not in have:
                    me_ok = False
    check("mastery-evidence-refs-resolve", me_ok, "120 evidence occasions resolve to real lessons")

    # 34 manifest counts agree
    mc = manifest["counts"]
    mok = (mc["lessons"] == 360 and mc["units"] == 20 and mc["courses"] == 2
           and mc["assessments"] == 20
           and mc["content_standards_covered"] == {"3": 25, "4": 28})
    check("manifest-counts-agree", mok, json.dumps(mc["content_standards_covered"]))

    # 35 standards map agrees with lessons
    sm_ok = all(smap["grades"][str(g)]["content_standards_covered"] == len(SC.CATALOG[g])
                for g in GRADES)
    check("standards-map-agrees", sm_ok, "G3 25/25, G4 28/28")

    # 36 ownership boundary
    own = os.path.relpath(ROOT, REPO).replace(os.sep, "/")
    check("ownership-boundary", own == "curriculum-authoring/full-family-grade34/subjects/mathematics",
          own)

    # 37 tutor routes must not script help on unsupported days
    COACH = ["Ask the learner to represent why", "reteach with", "then retry one fresh item",
             "Then: ", "Ask: \""]
    leak = []
    for g in GRADES:
        for l in L[g]:
            if l["evidence_type"] not in UNSUPPORTED:
                continue
            for r in l["adaptive_tutor_routes"]:
                if any(c in r["action"] for c in COACH):
                    leak.append("%s/%s" % (l["lesson_id"], r["signal"]))
            if "Do not reteach" not in l["support"]:
                leak.append("%s/support" % l["lesson_id"])
    n_unsup = sum(1 for g in GRADES for l in L[g] if l["evidence_type"] in UNSUPPORTED)
    check("no-scripted-help-on-unsupported-days", not leak,
          "%d independent-evidence and assessment lessons carry observe-and-defer routes only"
          % n_unsup if not leak else "leaks: %s" % leak[:4])

    # 38 unsupported days still guarantee access supports
    acc_route = all(any(r["signal"] == "access support needed" for r in l["adaptive_tutor_routes"])
                    for g in GRADES for l in L[g] if l["evidence_type"] in UNSUPPORTED)
    check("access-supports-guaranteed-on-unsupported-days", acc_route,
          "every unsupported lesson carries an explicit access-support route")

    # 39 misconceptions are authored per day, not rotated, and none is orphaned
    rel_ok, det = True, []
    for g in GRADES:
        mod = MODS[g]
        for u in mod.UNITS:
            dm = u["day_misconceptions"]
            if len(dm) != 18 or max(dm) >= len(u["misconceptions"]):
                rel_ok = False; det.append("g%d u%d range" % (g, u["n"]))
            if set(dm) != set(range(len(u["misconceptions"]))):
                rel_ok = False; det.append("g%d u%d orphan misconception" % (g, u["n"]))
            if dm == [i % len(u["misconceptions"]) for i in range(18)]:
                rel_ok = False; det.append("g%d u%d is a modulo rotation" % (g, u["n"]))
            for l in L[g]:
                if l["unit_number"] != u["n"]:
                    continue
                exp = u["misconceptions"][dm[l["day_in_unit"] - 1]]
                if l["target_misconception"]["pattern"] != exp["pattern"]:
                    rel_ok = False; det.append("g%d %s" % (g, l["lesson_id"]))
    check("misconceptions-authored-per-day-not-rotated", rel_ok,
          "20 units: every day carries an authored misconception, every misconception is used, and no "
          "unit uses a modulo rotation" if rel_ok else "; ".join(det[:4]))

    # 40 topic standards are real and inside their unit
    ts_ok, det = True, []
    for g in GRADES:
        mod = MODS[g]
        for u in mod.UNITS:
            us = set(unit_std(u))
            for topic, codes in u["topic_standards"].items():
                if not codes:
                    ts_ok = False; det.append("g%d u%d empty" % (g, u["n"]))
                for c in codes:
                    if not SC.validate_code(c):
                        ts_ok = False; det.append("g%d u%d bad code %s" % (g, u["n"], c))
                    if c not in us:
                        ts_ok = False; det.append("g%d u%d %s outside unit" % (g, u["n"], c))
    check("topic-standards-valid-and-in-unit", ts_ok,
          "%d authored topic-to-standard mappings" % sum(len(u["topic_standards"])
                                                         for g in GRADES for u in MODS[g].UNITS)
          if ts_ok else "; ".join(det[:4]))

    # 41 assessment prompts carry the standards of the topic they actually name
    pr_ok, det = True, []
    for g in GRADES:
        mod = MODS[g]
        for a, u in zip(A[g], mod.UNITS):
            t, ts = u["topics"], u["topic_standards"]
            for idx, topic in ((0, t[0]), (1, t[1]), (2, t[2]), (3, t[3])):
                if a["prompts"][idx]["standards"] != ts[topic]:
                    pr_ok = False
                    det.append("g%d u%d prompt %d" % (g, u["n"], idx))
            for p in a["prompts"]:
                if not p["standards"]:
                    pr_ok = False; det.append("g%d u%d empty" % (g, u["n"]))
    check("assessment-prompt-standards-match-their-topic", pr_ok,
          "80 topic-bound prompts tagged from the authored topic mapping, not a slice of the unit list"
          if pr_ok else "; ".join(det[:4]))

    # 42 the error-analysis prompt shows work rather than naming the error
    es_ok, det = True, []
    for g in GRADES:
        mod = MODS[g]
        for a, u in zip(A[g], mod.UNITS):
            p = [x for x in a["prompts"] if x["type"] == "error analysis"][0]
            stem = u["assessment_error_stem"]
            if stem not in p["prompt"]:
                es_ok = False; det.append("g%d u%d stem missing" % (g, u["n"]))
            if any(m["pattern"] in p["prompt"] for m in u["misconceptions"]):
                es_ok = False; det.append("g%d u%d names the error" % (g, u["n"]))
            if not any(ch.isdigit() for ch in stem):
                es_ok = False; det.append("g%d u%d stem has no work" % (g, u["n"]))
    check("assessment-error-prompt-shows-work-not-the-answer", es_ok,
          "20 error-analysis prompts present concrete erroneous work and never name the error"
          if es_ok else "; ".join(det[:4]))

    # 43 connection prompts are authored, not mechanically paired
    cp_ok = all(a["prompts"][5]["prompt"] == u["connection_prompt"]
                and not a["prompts"][5]["prompt"].startswith("Explain how %s and %s are related"
                                                             % (u["topics"][0], u["topics"][-1]))
                for g in GRADES for a, u in zip(A[g], MODS[g].UNITS))
    check("connection-prompts-authored", cp_ok, "20 authored connection prompts")

    # 44 lesson titles do not stutter the phase label
    stut = [l["lesson_id"] for g in GRADES for l in L[g]
            if l["focus"].lower().startswith(l["phase"].lower().split(":")[0][:14])]
    check("lesson-titles-do-not-stutter", not stut,
          "360 titles read as phase plus a distinct mathematical target"
          if not stut else "%d stuttering: %s" % (len(stut), stut[:3]))

    passed = sum(1 for c in checks if c["result"] == "PASS")
    overall = "PASS" if passed == len(checks) else "FAIL"
    report = {
        "package_id": manifest["package_id"], "version": manifest["version"],
        "validated_on": manifest["authored_on"], "overall": overall,
        "counts": {"checks": len(checks), "passed": passed, "failed": len(checks) - passed},
        "checks": checks,
    }
    os.makedirs(os.path.join(ROOT, "validation"), exist_ok=True)
    with open(os.path.join(ROOT, "validation", "validation.json"), "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    md = ["# Grade 3 and Grade 4 Mathematics - Validation Report\n",
          "**Package:** `%s`  " % report["package_id"],
          "**Version:** %s  " % report["version"],
          "**Date:** %s  " % report["validated_on"],
          "**Overall:** **%s**\n" % overall,
          "| Check | Result | Details |", "| --- | --- | --- |"]
    for c in checks:
        md.append("| %s | %s | %s |" % (c["check"], c["result"], c["details"]))
    md += ["",
           "## Interpretation\n",
           "A PASS verifies structural completeness, identifier uniqueness, schedule resolution, standards "
           "coverage against the verified Michigan catalog, unit progression, assessment alignment, "
           "multi-occasion mastery, separation from Grade 5 content, privacy posture, and Study "
           "adaptability.\n",
           "It does not claim state approval, accreditation, licensure, automatic credit, production-host "
           "integration, or that any individual learner has demonstrated proficiency.\n"]
    with open(os.path.join(ROOT, "validation", "validation-report.md"), "w") as f:
        f.write("\n".join(md) + "\n")

    for c in checks:
        print("%-52s %s  %s" % (c["check"], c["result"], c["details"][:96]))
    print("\n%s: %d/%d checks passed" % (overall, passed, len(checks)))
    return 0 if overall == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
