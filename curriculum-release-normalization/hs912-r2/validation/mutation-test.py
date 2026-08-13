#!/usr/bin/env python3
"""One deliberate defect per check. A survivor means the check is decoration.

Copies this lane — and, where the check reads delivered content, the candidate too — into a
temporary directory, damages the copy, and requires validate-normalization.mjs to emit the named
finding code. The real lane and the real candidate are never touched.

Every mutation here corresponds to a way the registries could be wrong. The set includes the
fourteen corruptions an independent reviewer designed against an earlier cut of the validator,
all of which survived it. They do not survive now.

    python3 curriculum-release-normalization/hs912-r2/validation/mutation-test.py
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

R2 = Path(__file__).resolve().parent.parent
R1 = R2.parent.parent / "curriculum-release-candidates" / "hs912-r1"
VALIDATOR = R2 / "validation" / "validate-normalization.mjs"

# Assembled from fragments so this file contains no text the validator's own claim patterns match.
# That is what lets the completeness scan run over every file in the lane with no exemptions.
CLAIM = "graduation" + "-" + "complete"
READY = "diploma" + "-" + "ready"


def edit_json(root, rel, fn):
    p = root / rel
    obj = json.loads(p.read_text())
    fn(obj)
    p.write_text(json.dumps(obj, indent=2) + "\n")


def family(o, name):
    return next(f for f in o["families"] if f["family"] == name)


# ---------------------------------------------------------------- alias registry

def rename_science_id(root):
    def f(o):
        for e in o["entries"]:
            if e["release_slot_id"] == "ma-g9-science":
                e["authored_course_id"] = "ma-g9-science"
    edit_json(root, "registries/course-id-alias-registry.json", f)


def drop_alias_entry(root):
    edit_json(root, "registries/course-id-alias-registry.json",
              lambda o: o.__setitem__("entries", [e for e in o["entries"] if e["release_slot_id"] != "ma-g11-science"]))


def break_child_rule_claim(root):
    edit_json(root, "registries/course-id-alias-registry.json",
              lambda o: o["entries"][0].__setitem__("child_id_rule_verified", False))


def falsify_alias_counts(root):
    def f(o):
        o["counts"] = {"entries": 7, "identity": 0, "alias": 40, "child_id_rule_verified_true": 0}
    edit_json(root, "registries/course-id-alias-registry.json", f)


def alias_child_rule_says_identity(root):
    def f(o):
        for e in o["entries"]:
            if e["relationship"] == "ALIAS":
                e["child_id_rule"] = "IDENTITY"
    edit_json(root, "registries/course-id-alias-registry.json", f)


def relabel_identity_as_alias(root):
    def f(o):
        for e in o["entries"]:
            e["relationship"] = "ALIAS"
    edit_json(root, "registries/course-id-alias-registry.json", f)


def undeclare_non_resolving_ids(root):
    edit_json(root, "registries/course-id-alias-registry.json",
              lambda o: o.__setitem__("non_resolving_identifier_classes", []))


# ---------------------------------------------------------------- course registry

def inflate_course_count(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o["courses"][0]["observed"].__setitem__("lessons", o["courses"][0]["observed"]["lessons"] + 12))


def delete_course_rows(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o.__setitem__("courses", o["courses"][:-5]))


def hide_divergence(root):
    def f(o):
        for c in o["courses"]:
            if c["session_alignment"] == "DIVERGENT":
                c["session_alignment"] = "ALIGNED"
                break
    edit_json(root, "registries/release-course-registry.json", f)


def falsify_recommended_sessions(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o["courses"][0].__setitem__("recommended_sessions", 999))


def falsify_course_grade(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o["courses"][0].__setitem__("grade", 12))


def inflate_credit(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o["courses"][0].__setitem__("credit_recommendation", 9.0))


def falsify_credit_total(root):
    edit_json(root, "registries/release-course-registry.json",
              lambda o: o.__setitem__("credit_recommendation_total", 40.0))


def assert_counts(root):
    edit_json(root, "MANIFEST.json", lambda o: o.__setitem__("counts_asserted", True))


# ---------------------------------------------------------------- schedules

def fake_schedule_rows(root):
    edit_json(root, "registries/schedule-registry.json",
              lambda o: o["canonical_plane"][0].__setitem__("rows", 1))


def falsify_schedule_detail(root):
    def f(o):
        p = o["canonical_plane"][0]
        p["distinct_lessons_scheduled"] = 1
        p["duplicate_rows"] = 0
        p["unresolved_lesson_refs"] = 0
        p["courses_scheduled"] = 99
    edit_json(root, "registries/schedule-registry.json", f)


def falsify_schedule_coverage(root):
    def f(o):
        o["coverage"]["canonical_lessons_scheduled"] = 1
        o["coverage"]["high_school_lessons_scheduled"] = 1
        o["coverage"]["science_complete_both_directions"] = False
    edit_json(root, "registries/schedule-registry.json", f)


def falsify_science_schedule_ids(root):
    edit_json(root, "registries/schedule-registry.json",
              lambda o: o["science_plane"][0].__setitem__("schedule_ids", ["invented-schedule"]))


def merge_schedule_planes(root):
    edit_json(root, "registries/schedule-registry.json",
              lambda o: o["canonical_plane"][0].__setitem__("science_present", True))


def drop_schedule_gap(root):
    edit_json(root, "registries/schedule-registry.json",
              lambda o: o["open_gap"].__setitem__("code", "NONE"))


# ---------------------------------------------------------------- standards evidence

def launder_mp_to_verbatim(root):
    def f(o):
        m = family(o, "mathematics")
        m["classes"]["VERBATIM"] += m["classes"]["ALIAS_RESOLVED_VERBATIM"]
        m["classes"]["ALIAS_RESOLVED_VERBATIM"] = 0
    edit_json(root, "registries/standards-evidence-registry.json", f)


def reintroduce_untraceable(root):
    def f(o):
        m = family(o, "mathematics")
        m["classes"]["ALIAS_RESOLVED_VERBATIM"] -= 3
        m["classes"]["UNTRACEABLE"] = 3
    edit_json(root, "registries/standards-evidence-registry.json", f)


def launder_health_composite_as_verbatim(root):
    def f(o):
        h = family(o, "health")
        h["classes"]["VERBATIM"] = h["classes"]["COMPOSITE_VERIFIED"]
        h["classes"]["COMPOSITE_VERIFIED"] = 0
        h["evidences_a_verbatim_state_standard"] = True
    edit_json(root, "registries/standards-evidence-registry.json", f)


def destroy_social_studies_evidence(root):
    def f(o):
        ss = family(o, "social-studies")
        ss["classes"]["DECLARED_UNVERIFIED"] = ss["classes"]["VERBATIM"]
        ss["classes"]["VERBATIM"] = 0
        ss["evidences_a_verbatim_state_standard"] = False
    edit_json(root, "registries/standards-evidence-registry.json", f)


def launder_pe_unverified(root):
    def f(o):
        pe = family(o, "physical-education")
        pe["classes"]["VERBATIM"] = pe["classes"]["DECLARED_UNVERIFIED"]
        pe["classes"]["DECLARED_UNVERIFIED"] = 0
        pe["evidences_a_verbatim_state_standard"] = True
    edit_json(root, "registries/standards-evidence-registry.json", f)


def preclassify_science_standards(root):
    edit_json(root, "registries/standards-evidence-registry.json",
              lambda o: family(o, "science")["classes"].__setitem__("VERBATIM", 71))


def invent_ready_for_life_framework(root):
    edit_json(root, "registries/standards-evidence-registry.json",
              lambda o: family(o, "ready-for-life").__setitem__(
                  "standards_framework", "michigan-ready-for-life-standards"))


# ---------------------------------------------------------------- mathematical practice

def fake_mp_statement_everywhere(root):
    """Corrupt the map AND the evidence file together — the reviewer's hardest mutation."""
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["practices"][3].__setitem__("statement_verbatim", "Model stuff with math, roughly."))
    p = root / "standards/evidence/mathematical-practice-verbatim.txt"
    p.write_text(p.read_text().replace("Model with mathematics.", "Model stuff with math, roughly."))


def reattribute_source(root):
    def f(o):
        o["official_source"]["document_title"] = "Common Core State Standards for Mathematics"
        o["official_source"]["publisher"] = "CCSSI"
        o["official_source"]["pages_total"] = 3
    edit_json(root, "standards/mathematical-practice-map.json", f)


def claim_mp_is_official(root):
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["verdict"].__setitem__("code_form", "PRINTED_BY_OFFICIAL_SOURCE"))


def claim_mp_printed_in_source(root):
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["independent_verification"].__setitem__("token_MP_occurrences_in_official_document", 999))


def overstate_mp_label(root):
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["practices"][0].__setitem__("official_label_as_printed", "MP.1"))


def drift_digest(root):
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["official_source"].__setitem__("sha256", "0" * 64))


def fake_mp_census(root):
    def f(o):
        for p in o["practices"]:
            if p["alias_token"] == "MP.8":
                p["cited_by_mathematics_lane"] = True
    edit_json(root, "standards/mathematical-practice-map.json", f)


def falsify_mp_census_list(root):
    edit_json(root, "standards/mathematical-practice-map.json",
              lambda o: o["citation_census"].__setitem__("tokens_cited", ["MP.1"]))


# ---------------------------------------------------------------- coverage and claims

def cover_world_language(root):
    def f(o):
        for r in o["requirements"]:
            if r["requirement"] == "MMC_WORLD_LANGUAGE":
                r["verdict"] = "COVERED"
    edit_json(root, "registries/coverage-requirements-registry.json", f)


def zero_world_language_remainder(root):
    def f(o):
        for r in o["requirements"]:
            if r["requirement"] == "MMC_WORLD_LANGUAGE":
                r["irreducible_remainder_credits"] = 0
    edit_json(root, "registries/coverage-requirements-registry.json", f)


def drop_coverage_gap(root):
    edit_json(root, "registries/coverage-requirements-registry.json",
              lambda o: o.__setitem__("requirements", [r for r in o["requirements"]
                                                       if r["requirement"] != "MMC_PERSONAL_FINANCE_DISPLACEMENT"]))


def claim_graduation_complete(root):
    (root / "README.md").write_text(f"# hs912-r2\n\nThis programme is {CLAIM} against the Michigan Merit Curriculum.\n")


def claim_completeness_with_stray_negation(root):
    # The negation sits before the claim but behind a clause break, so a loose polarity rule
    # would wave this through. It must be caught.
    (root / "README.md").write_text(f"# hs912-r2\n\nThere is no remaining doubt: this programme is {CLAIM} and {READY}.\n")


def flip_graduation_verdict(root):
    edit_json(root, "registries/coverage-requirements-registry.json",
              lambda o: o["graduation_completeness"].__setitem__("verdict", "GRADUATION_REQUIREMENTS_MET"))


# ---------------------------------------------------------------- scope and provenance

def normalize_science_early(root):
    def f(o):
        for c in o["courses"]:
            if c["subject"] == "science":
                c["status"] = "NORMALIZED"
    edit_json(root, "registries/release-course-registry.json", f)


def pin_h3(root):
    edit_json(root, "MANIFEST.json", lambda o: o["science"].__setitem__("successor_pinned", True))


def falsify_science_provenance(root):
    def f(o):
        o["science"]["content_in_candidate_from_branch"] = "mac/hs912-science-r1"
        o["science"]["content_in_candidate_sha"] = "f" * 40
    edit_json(root, "MANIFEST.json", f)


# ---------------------------------------------------------------- candidate mutations

def plant_world_language_content(candidate):
    """The check that says "no world-language content exists" must read the disk to say it."""
    for grade in (9, 10, 11, 12):
        d = candidate / "world-language" / f"grade-{grade}"
        d.mkdir(parents=True)
        cid = f"ma-g{grade}-world-language"
        (d / "units.json").write_text(json.dumps([{
            "unit_id": f"{cid}-u01", "course_id": cid, "grade": grade, "subject": "world-language",
            "title": "Novice High Spanish", "standards": ["WL.1"],
            "lesson_ids": [f"{cid}-u01-l01"], "assessment_id": f"{cid}-u01-assessment"}]))
        (d / "lessons.jsonl").write_text(json.dumps({
            "lesson_id": f"{cid}-u01-l01", "course_id": cid, "grade": grade,
            "subject": "world-language", "standards": ["WL.1"]}) + "\n")
        (d / "assessments.json").write_text(json.dumps([{
            "assessment_id": f"{cid}-u01-assessment", "unit_number": 1, "standards": ["WL.1"]}]))


MUTANTS = [
    ("rename a stable science course id", rename_science_id, "SCIENCE_ID_RENAMED"),
    ("drop a slot from the alias registry", drop_alias_entry, "ALIAS_REGISTRY_INCOMPLETE"),
    ("falsify a child-id-rule claim", break_child_rule_claim, "CHILD_ID_RULE_CLAIM_WRONG"),
    ("falsify the alias registry's own counts block", falsify_alias_counts, "ALIAS_COUNTS_WRONG"),
    ("tell consumers the aliased child ids resolve as identity", alias_child_rule_says_identity, "CHILD_ID_RULE_LABEL_WRONG"),
    ("relabel every identity course as an alias", relabel_identity_as_alias, "ALIAS_RELATIONSHIP_WRONG"),
    ("stop declaring the non-resolving identifier class", undeclare_non_resolving_ids, "CHILD_ID_RULE_SCOPE_UNDECLARED"),
    ("inflate a course lesson count", inflate_course_count, "COURSE_COUNT_MISMATCH"),
    ("delete five course rows", delete_course_rows, "COURSE_ROWS_MISSING"),
    ("hide a session divergence", hide_divergence, "SESSION_ALIGNMENT_WRONG"),
    ("falsify a recommended session count", falsify_recommended_sessions, "RECOMMENDED_SESSIONS_DRIFT"),
    ("falsify a course grade", falsify_course_grade, "COURSE_GRADE_WRONG"),
    ("drift a credit recommendation", inflate_credit, "CREDIT_DRIFT"),
    ("falsify the credit total", falsify_credit_total, "CREDIT_TOTAL_WRONG"),
    ("assert counts instead of observing", assert_counts, "COUNTS_ASSERTED"),
    ("falsify a schedule row count", fake_schedule_rows, "SCHEDULE_CLAIM_WRONG"),
    ("falsify the schedule detail numbers", falsify_schedule_detail, "SCHEDULE_CLAIM_WRONG"),
    ("falsify the schedule coverage numbers", falsify_schedule_coverage, "SCHEDULE_COVERAGE_CLAIM_WRONG"),
    ("invent a science schedule id", falsify_science_schedule_ids, "SCIENCE_SCHEDULE_CLAIM_WRONG"),
    ("merge the two schedule planes", merge_schedule_planes, "SCHEDULE_PLANE_CONFUSION"),
    ("stop declaring the schedule gap", drop_schedule_gap, "SCHEDULE_GAP_UNDECLARED"),
    ("launder MP citations into VERBATIM", launder_mp_to_verbatim, "STANDARDS_CLASS_DRIFT"),
    ("leave untraceable citations behind", reintroduce_untraceable, "STANDARDS_CLASS_DRIFT"),
    ("launder health composite labels into verbatim", launder_health_composite_as_verbatim, "STANDARDS_CLASS_DRIFT"),
    ("destroy social studies verbatim evidence", destroy_social_studies_evidence, "STANDARDS_CLASS_DRIFT"),
    ("launder PE declared-unverified into verbatim", launder_pe_unverified, "STANDARDS_CLASS_DRIFT"),
    ("pre-classify science standards", preclassify_science_standards, "SCIENCE_STANDARDS_PRECLASSIFIED"),
    ("bind ready-for-life to an invented framework", invent_ready_for_life_framework, "FRAMEWORK_DRIFT"),
    ("corrupt a practice statement in map and evidence together", fake_mp_statement_everywhere, "MP_STATEMENT_WRONG"),
    ("re-attribute the official source", reattribute_source, "MP_SOURCE_DRIFT"),
    ("claim MP.N is an official token", claim_mp_is_official, "MP_VERDICT_OVERSTATED"),
    ("claim MP tokens appear in the official document", claim_mp_printed_in_source, "MP_VERDICT_INCONSISTENT"),
    ("overstate the printed practice label", overstate_mp_label, "MP_LABEL_OVERSTATED"),
    ("drift the pinned source digest", drift_digest, "MP_SOURCE_DRIFT"),
    ("falsify the MP citation census flag", fake_mp_census, "MP_CENSUS_WRONG"),
    ("falsify the MP citation census list", falsify_mp_census_list, "MP_CENSUS_WRONG"),
    ("mark world language covered", cover_world_language, "WORLD_LANGUAGE_OVERSTATED"),
    ("zero the world language irreducible remainder", zero_world_language_remainder, "COVERAGE_FIELD_CHANGED"),
    ("drop a declared coverage gap", drop_coverage_gap, "COVERAGE_GAP_DROPPED"),
    ("claim completeness in prose", claim_graduation_complete, "GRADUATION_CLAIM"),
    ("claim completeness behind a stray negation", claim_completeness_with_stray_negation, "GRADUATION_CLAIM"),
    ("flip the graduation verdict", flip_graduation_verdict, "GRADUATION_CLAIM"),
    ("mark science normalized before import", normalize_science_early, "SCIENCE_STATUS_WRONG"),
    ("pin the moving H3 branch", pin_h3, "H3_PINNED"),
    ("falsify the science provenance", falsify_science_provenance, "SCIENCE_PROVENANCE_WRONG"),
]

CANDIDATE_MUTANTS = [
    ("plant world-language content in the candidate", plant_world_language_content, "WORLD_LANGUAGE_CONTENT_FOUND"),
]


def run(lane, candidate=None):
    argv = ["node", str(VALIDATOR), "--r2", str(lane), "--format", "json"]
    if candidate:
        argv += ["--candidate", str(candidate)]
    proc = subprocess.run(argv, capture_output=True, text=True)
    if not proc.stdout.strip():
        return {"overall": "CRASHED", "blocking": -1, "findings": [
            {"severity": "BLOCKING", "code": "VALIDATOR_CRASHED", "message": proc.stderr.strip()[:300]}], "notes": []}
    return json.loads(proc.stdout)


def main():
    if run(R2)["blocking"]:
        print("baseline is not clean; fix the lane before mutation testing")
        return 1

    killed, survived = 0, []

    for label, mutate, code in MUTANTS:
        with tempfile.TemporaryDirectory() as tmp:
            lane = Path(tmp) / "hs912-r2"
            shutil.copytree(R2, lane)
            mutate(lane)
            report = run(lane)
            if any(f["code"] == code and f["severity"] == "BLOCKING" for f in report["findings"]):
                killed += 1
                print(f"  killed   {label}  ->  {code}")
            else:
                survived.append((label, code))
                print(f"  SURVIVED {label}  ->  expected {code}, got "
                      f"{sorted({f['code'] for f in report['findings'] if f['severity'] == 'BLOCKING'})}")

    for label, mutate, code in CANDIDATE_MUTANTS:
        with tempfile.TemporaryDirectory() as tmp:
            candidate = Path(tmp) / "hs912-r1"
            shutil.copytree(R1, candidate)
            mutate(candidate)
            report = run(R2, candidate)
            if any(f["code"] == code and f["severity"] == "BLOCKING" for f in report["findings"]):
                killed += 1
                print(f"  killed   {label}  ->  {code}")
            else:
                survived.append((label, code))
                print(f"  SURVIVED {label}  ->  expected {code}, got "
                      f"{sorted({f['code'] for f in report['findings'] if f['severity'] == 'BLOCKING'})}")

    total = len(MUTANTS) + len(CANDIDATE_MUTANTS)
    print(f"\n{killed}/{total} mutants killed")

    # A rule that fires on the honest sentence is as broken as one that misses the dishonest one.
    with tempfile.TemporaryDirectory() as tmp:
        lane = Path(tmp) / "hs912-r2"
        shutil.copytree(R2, lane)
        (lane / "README.md").write_text(
            f"# hs912-r2\n\nThis programme is not {CLAIM} against the Michigan Merit Curriculum.\n")
        if any(f["code"] == "GRADUATION_CLAIM" for f in run(lane)["findings"]):
            print("  FALSE POSITIVE: the honest negated statement was reported as a claim")
            survived.append(("honest negated statement", "must not report"))
        else:
            print("  clean     the honest negated statement is read and allowed")

    return 0 if not survived else 1


if __name__ == "__main__":
    sys.exit(main())
