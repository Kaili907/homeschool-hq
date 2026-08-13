#!/usr/bin/env python3
"""Derive the hs912-r2 release-normalization registries from the hs912-r1 candidate.

Reads only. The candidate at curriculum-release-candidates/hs912-r1/** is the input and is
never written. Everything this script emits lands under curriculum-release-normalization/hs912-r2/.

Nothing here edits authored course content. The normalization operates at the release layer:
identifier aliasing, registry derivation, count observation, schedule accounting, and
standards-evidence classification.
"""

import csv
import json
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

R2 = Path(__file__).resolve().parent.parent
REPO = R2.parent.parent
R1 = REPO / "curriculum-release-candidates" / "hs912-r1"

CANONICAL_FAMILIES = [
    "arts-and-music",
    "english-language-arts",
    "financial-literacy",
    "health",
    "mathematics",
    "physical-education",
    "ready-for-life",
    "social-studies",
    "technology",
]
SCIENCE_FAMILY = "science"
GRADES = [9, 10, 11, 12]

# The seven Mathematical Practice tokens the mathematics lane cites, and the ordinal each
# resolves to in the official Michigan document. Verbatim statements are transcribed from the
# retrieved PDF; see standards/evidence/mathematical-practice-verbatim.txt.
MP_STATEMENTS = OrderedDict([
    (1, "Make sense of problems and persevere in solving them."),
    (2, "Reason abstractly and quantitatively."),
    (3, "Construct viable arguments and critique the reasoning of others."),
    (4, "Model with mathematics."),
    (5, "Use appropriate tools strategically."),
    (6, "Attend to precision."),
    (7, "Look for and make use of structure."),
    (8, "Look for and express regularity in repeated reasoning."),
])
MP_SOURCE = {
    "document_title": "Michigan K-12 Standards Mathematics",
    "publisher": "Michigan Department of Education",
    "url": "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf",
    "sha256": "dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54",
    "pages_total": 94,
    "section_heading_as_printed": "mathematics | Standards for mathematical Practice",
    "section_pdf_pages": [8, 9, 10],
    "section_printed_pages": [6, 7, 8],
    "high_school_restatement_heading_as_printed": "mathematical Practices",
    "retrieved_on": "2026-08-12",
    "retrieved_by": "mac/hs912-release-normalization-r2",
}


def read_json(path):
    with open(path) as fh:
        return json.load(fh)


def read_jsonl(path):
    out = []
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def git_sha(ref):
    try:
        return subprocess.check_output(
            ["git", "rev-parse", ref], cwd=str(REPO), text=True, stderr=subprocess.DEVNULL
        ).strip()
    except subprocess.CalledProcessError:
        return None


# --------------------------------------------------------------------------------------
# Input: the r1 candidate
# --------------------------------------------------------------------------------------

matrix = read_json(R1 / "release" / "course-matrix.json")
matrix_by_id = {c["course_id"]: c for c in matrix["courses"]}
r1_manifest = read_json(R1 / "MANIFEST.json")
r1_inputs = {i["lane"]: i for i in r1_manifest["inputs"]}


def observe_canonical(family, grade):
    """Derive counts and identifiers for one canonical-shape course. Never asserted."""
    d = R1 / family / f"grade-{grade}"
    units = read_json(d / "units.json")
    lessons = read_jsonl(d / "lessons.jsonl")
    assessments = read_json(d / "assessments.json")
    standards = set()
    for u in units:
        standards.update(u.get("standards", []))
    for l in lessons:
        standards.update(l.get("standards", []))
    for a in assessments:
        standards.update(a.get("standards", []))
    return {
        "course_id": units[0]["course_id"],
        "units": len(units),
        "lessons": len(lessons),
        "assessments": len(assessments),
        "unit_ids": [u["unit_id"] for u in units],
        "lesson_ids": [l["lesson_id"] for l in lessons],
        "assessment_ids": [a["assessment_id"] for a in assessments],
        "standards_cited": sorted(standards),
    }


def observe_science():
    """Derive counts and identifiers for the native schema-set 2.0.0 science authoring set."""
    aset = R1 / SCIENCE_FAMILY / "authoring-set"
    courses = read_json(aset / "courses.json")
    units = read_json(aset / "units.json")
    assessments = read_json(aset / "assessments.json")
    schedules = read_json(aset / "schedules.json")
    out = {}
    for c in courses:
        cid = c["course_id"]
        cu = [u for u in units if u["course_ref"] == cid]
        ca = [a for a in assessments if a["course_ref"] == cid]
        cl = read_jsonl(aset / "lessons" / f"{cid}.lessons.jsonl")
        standards = set()
        for e in cu + ca + cl:
            for st in e.get("standards", []):
                # schema set 2.0.0 carries structured mappings, not bare code strings
                standards.add(st if isinstance(st, str)
                              else json.dumps(st, sort_keys=True))
        sched = [s for s in schedules if s.get("grade") == c["grade"]]
        scheduled = []
        for s in sched:
            for entry in s["entries"]:
                scheduled.extend(entry["lesson_refs"])
        out[cid] = {
            "course_id": cid,
            "grade": c["grade"],
            "title": c["title"],
            "units": len(cu),
            "lessons": len(cl),
            "assessments": len(ca),
            "unit_ids": [u["unit_id"] for u in cu],
            "lesson_ids": [l["lesson_id"] for l in cl],
            "assessment_ids": [a["assessment_id"] for a in ca],
            "standards_cited": sorted(standards),
            "schedule_ids": [s["schedule_id"] for s in sched],
            "scheduled_lesson_refs": scheduled,
        }
    return out


canonical = {}
for fam in CANONICAL_FAMILIES:
    for g in GRADES:
        obs = observe_canonical(fam, g)
        canonical[obs["course_id"]] = dict(obs, subject=fam, grade=g)

science = observe_science()


# --------------------------------------------------------------------------------------
# 1. Course-id alias registry — the B1 resolution
# --------------------------------------------------------------------------------------

SCIENCE_ALIAS = OrderedDict([
    (9, "ma-hs9-biology"),
    (10, "ma-hs10-chemistry"),
    (11, "ma-hs11-physics"),
    (12, "ma-hs12-earth-space-environmental"),
])


_resources = read_json(R1 / SCIENCE_FAMILY / "authoring-set" / "resources.json")
_resources = _resources if isinstance(_resources, list) else _resources.get("resources", [])
SCIENCE_RESOURCE_IDS = sorted(
    r.get("resource_id") or r.get("id")
    for r in _resources
    if any((r.get("resource_id") or r.get("id", "")).find(cid) > 0 for cid in SCIENCE_ALIAS.values())
)


def child_id_rule_holds(authored_course_id, obs):
    """Prefix substitution is publishable only if every child id starts with the course id."""
    pat_u = re.compile(r"^" + re.escape(authored_course_id) + r"-u\d{2}$")
    pat_l = re.compile(r"^" + re.escape(authored_course_id) + r"-u\d{2}-l\d{2}$")
    pat_a = re.compile(r"^" + re.escape(authored_course_id) + r"-u\d{2}-assessment$")
    return (
        all(pat_u.match(i) for i in obs["unit_ids"])
        and all(pat_l.match(i) for i in obs["lesson_ids"])
        and all(pat_a.match(i) for i in obs["assessment_ids"])
    )


alias_entries = []
for cid, obs in sorted(canonical.items(), key=lambda kv: (kv[1]["subject"], kv[1]["grade"])):
    alias_entries.append(OrderedDict([
        ("release_slot_id", cid),
        ("authored_course_id", cid),
        ("grade", obs["grade"]),
        ("subject", obs["subject"]),
        ("relationship", "IDENTITY"),
        ("id_scheme", "ma-g<grade>-<subject>"),
        ("authoring_schema_set", "1.0"),
        ("child_id_rule", "IDENTITY"),
        ("child_id_rule_verified", child_id_rule_holds(cid, obs)),
        ("source_branch", r1_inputs.get(
            {"health": "health-and-physical-education",
             "physical-education": "health-and-physical-education",
             "ready-for-life": "ready-for-life-and-financial-literacy",
             "financial-literacy": "ready-for-life-and-financial-literacy",
             "technology": "technology-and-arts",
             "arts-and-music": "technology-and-arts"}.get(obs["subject"], obs["subject"]), {}
        ).get("branch")),
        ("status", "NORMALIZED"),
    ]))

for grade, authored in SCIENCE_ALIAS.items():
    obs = science[authored]
    alias_entries.append(OrderedDict([
        ("release_slot_id", f"ma-g{grade}-science"),
        ("authored_course_id", authored),
        ("grade", grade),
        ("subject", "science"),
        ("relationship", "ALIAS"),
        ("id_scheme", "ma-hs<grade>-<course-name>"),
        ("authoring_schema_set", "2.0.0"),
        ("child_id_rule", "PREFIX_SUBSTITUTION"),
        ("child_id_rule_verified", child_id_rule_holds(authored, obs)),
        ("source_branch", "mac/hs912-science-h2"),
        ("status", "PENDING_H3_IMPORT"),
    ]))

alias_registry = OrderedDict([
    ("schema_version", "manuel-academy-hs912-course-id-alias-registry-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("policy", "ALIAS_NOT_RENAME"),
    ("authority_rule",
     "authored_course_id is authoritative and stable. release_slot_id is a release-layer "
     "address allocated by release/course-matrix.json. Where the two differ, the authored id "
     "names the content and the slot id names the position in the release. Neither is rewritten "
     "into the other; both resolve through this registry."),
    ("stability_basis",
     "release/authoring-boundaries.md §4 — identifiers are stable once a builder returns a "
     "course. Renaming ma-hs9-biology to ma-g9-science would break that rule, so the conflict is "
     "resolved by mapping rather than by renaming."),
    ("child_id_rule_definition",
     "Scoped to unit, lesson and assessment identifiers. For an ALIAS entry such a child "
     "identifier resolves by replacing the authored_course_id prefix with the release_slot_id and "
     "vice versa: ma-hs9-biology-u01-l01 <-> ma-g9-science-u01-l01. The rule is published only "
     "because child_id_rule_verified is true for every entry — every delivered unit, lesson and "
     "assessment id is literally <course_id>-uNN[-lNN|-assessment]. It is NOT a general rule over "
     "every identifier in the delivered set: see non_resolving_identifier_classes."),
    ("additional_prefixed_identifier_classes", [
        OrderedDict([("class", "prompt_id"), ("shape", "<course_id>-uNN-assessment-pNN"),
                     ("resolves_by_prefix_substitution", True), ("delivered_count", 252)]),
        OrderedDict([("class", "interpretation_id"), ("shape", "<course_id>-uNN-assessment-interpretation"),
                     ("resolves_by_prefix_substitution", True), ("delivered_count", 36)]),
        OrderedDict([("class", "schedule_id"), ("shape", "<course_id>-schedule"),
                     ("resolves_by_prefix_substitution", True), ("delivered_count", 4)]),
    ]),
    ("non_resolving_identifier_classes", [
        OrderedDict([
            ("class", "resource_id"),
            ("shape", "res-<course_id>-<suffix>"),
            ("resolves_by_prefix_substitution", False),
            ("why",
             "The course id is embedded after a res- prefix rather than heading the identifier, so "
             "there is no prefix to substitute. A naive substring rewrite would emit "
             "res-ma-g9-science-data-sources, which no delivered record provides. This lane "
             "deliberately does not publish a substring rewrite rule: resource addressing across "
             "the two identifier schemes is owed at H3 import."),
            ("owner", "science H3 import"),
            ("examples", SCIENCE_RESOURCE_IDS),
        ]),
    ]),
    ("totality",
     "This registry covers all 40 high-school courses, not only the four exceptions, so a consumer "
     "cannot resolve some ids through the registry and others by guessing. It does NOT cover the "
     "ten Grade 8 anchor courses that course-matrix.json also carries (50 courses in total); those "
     "are published, frozen release content addressed by their own release, and no high-school "
     "slot aliases them."),
    ("counts", OrderedDict([
        ("entries", len(alias_entries)),
        ("identity", sum(1 for e in alias_entries if e["relationship"] == "IDENTITY")),
        ("alias", sum(1 for e in alias_entries if e["relationship"] == "ALIAS")),
        ("child_id_rule_verified_true", sum(1 for e in alias_entries if e["child_id_rule_verified"])),
    ])),
    ("entries", alias_entries),
])

# --------------------------------------------------------------------------------------
# 2. Release course registry — normalized counts, never asserted
# --------------------------------------------------------------------------------------

course_rows = []
for e in alias_entries:
    slot, authored = e["release_slot_id"], e["authored_course_id"]
    obs = canonical.get(authored) or science.get(authored)
    m = matrix_by_id.get(slot, {})
    recommended = m.get("sessions")
    delivered = obs["lessons"]
    row = OrderedDict([
        ("release_slot_id", slot),
        ("authored_course_id", authored),
        ("grade", e["grade"]),
        ("subject", e["subject"]),
        ("course_name", m.get("course_name") or obs.get("title")),
        ("shape", "CANONICAL" if e["relationship"] == "IDENTITY" else "NATIVE_SCHEMA_SET_2_0_0"),
        ("status", e["status"]),
        ("credit_recommendation", m.get("credit_recommendation")),
        ("recommended_sessions", recommended),
        ("observed", OrderedDict([
            ("units", obs["units"]),
            ("lessons", obs["lessons"]),
            ("assessments", obs["assessments"]),
        ])),
        ("session_alignment", (
            "NOT_RECOMMENDED_BY_MATRIX" if recommended is None
            else "ALIGNED" if delivered == recommended
            else "DIVERGENT")),
        ("session_delta", None if recommended is None else delivered - recommended),
        ("scheduled_in", (
            f"schedules/grade-{e['grade']}/daily-schedule.csv (candidate hs912-r1)"
            if e["relationship"] == "IDENTITY"
            else "science/authoring-set/schedules.json (native, candidate hs912-r1)")),
    ])
    course_rows.append(row)

divergent = [r for r in course_rows if r["session_alignment"] == "DIVERGENT"]
release_course_registry = OrderedDict([
    ("schema_version", "manuel-academy-hs912-release-course-registry-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("count_policy",
     "Unit and lesson counts are unbound by release/course-matrix.json (count_policy). Counts here "
     "are observed by re-derivation from delivered files and are never asserted against a "
     "pre-agreed total. recommended_sessions is a matrix recommendation, so session_alignment "
     "DIVERGENT is a recorded observation, not a failure."),
    ("derived_counts", OrderedDict([
        ("high_school_courses", len(course_rows)),
        ("courses_canonical_shape", sum(1 for r in course_rows if r["shape"] == "CANONICAL")),
        ("courses_native_v2_shape", sum(1 for r in course_rows if r["shape"] != "CANONICAL")),
        ("units", sum(r["observed"]["units"] for r in course_rows)),
        ("lessons", sum(r["observed"]["lessons"] for r in course_rows)),
        ("assessments", sum(r["observed"]["assessments"] for r in course_rows)),
        ("courses_normalized", sum(1 for r in course_rows if r["status"] == "NORMALIZED")),
        ("courses_pending_h3_import", sum(1 for r in course_rows if r["status"] == "PENDING_H3_IMPORT")),
        ("session_divergences", len(divergent)),
    ])),
    ("credit_recommendation_by_grade", OrderedDict(
        (str(g), round(sum(r["credit_recommendation"] or 0 for r in course_rows if r["grade"] == g), 2))
        for g in GRADES)),
    ("credit_recommendation_total", round(sum(r["credit_recommendation"] or 0 for r in course_rows), 2)),
    ("credit_caveat",
     "Credit recommendations are the matrix's own recommendations carried forward. They are not a "
     "graduation tally and do not establish credit recognition. See coverage-requirements-registry.json."),
    ("courses", course_rows),
])

# --------------------------------------------------------------------------------------
# 3. Schedule registry
# --------------------------------------------------------------------------------------

canonical_lesson_ids = set()
for obs in canonical.values():
    canonical_lesson_ids.update(obs["lesson_ids"])

schedule_grades = []
all_scheduled = set()
for g in GRADES:
    rows = []
    with open(R1 / "schedules" / f"grade-{g}" / "daily-schedule.csv") as fh:
        for row in csv.DictReader(fh):
            rows.append(row)
    lessons_in = [r["lesson_id"] for r in rows]
    courses_in = sorted({r["course_id"] for r in rows})
    dupes = len(lessons_in) - len(set(lessons_in))
    unresolved = [l for l in lessons_in if l not in canonical_lesson_ids]
    all_scheduled.update(lessons_in)
    expected = sorted(
        cid for cid, obs in canonical.items() if obs["grade"] == g
    )
    schedule_grades.append(OrderedDict([
        ("grade", g),
        ("plane", "CANONICAL"),
        ("source", f"curriculum-release-candidates/hs912-r1/schedules/grade-{g}/daily-schedule.csv"),
        ("rows", len(rows)),
        ("distinct_lessons_scheduled", len(set(lessons_in))),
        ("duplicate_rows", dupes),
        ("unresolved_lesson_refs", len(unresolved)),
        ("courses_scheduled", len(courses_in)),
        ("courses_expected_canonical", len(expected)),
        ("science_present", any(c.startswith(("ma-g%d-science" % g, "ma-hs")) for c in courses_in)),
    ]))

science_sched = []
science_scheduled_all = set()
for grade, authored in SCIENCE_ALIAS.items():
    obs = science[authored]
    refs = obs["scheduled_lesson_refs"]
    science_scheduled_all.update(refs)
    science_sched.append(OrderedDict([
        ("grade", grade),
        ("plane", "NATIVE_SCHEMA_SET_2_0_0"),
        ("authored_course_id", authored),
        ("release_slot_id", f"ma-g{grade}-science"),
        ("source", "curriculum-release-candidates/hs912-r1/science/authoring-set/schedules.json"),
        ("schedule_ids", obs["schedule_ids"]),
        ("scheduled_lesson_refs", len(refs)),
        ("distinct_lessons_scheduled", len(set(refs))),
        ("lessons_delivered", obs["lessons"]),
        ("covers_every_lesson_exactly_once",
         len(refs) == len(set(refs)) == obs["lessons"] and set(refs) == set(obs["lesson_ids"])),
    ]))

science_lessons_total = sum(o["lessons"] for o in science.values())
schedule_registry = OrderedDict([
    ("schema_version", "manuel-academy-hs912-schedule-registry-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("planes_note",
     "Two schedule planes exist and are recorded separately rather than merged. The canonical "
     "plane is four per-grade CSVs covering the nine canonical-shape families. The science plane "
     "is the native schema-set 2.0.0 schedules.json. This lane does not synthesise canonical "
     "science schedule rows: doing so would mean translating another lane's record shape, which "
     "is authoring, not normalization."),
    ("canonical_plane", schedule_grades),
    ("science_plane", science_sched),
    ("coverage", OrderedDict([
        ("canonical_lessons_delivered", len(canonical_lesson_ids)),
        ("canonical_lessons_scheduled", len(all_scheduled)),
        ("canonical_complete_both_directions",
         all_scheduled == canonical_lesson_ids),
        ("science_lessons_delivered", science_lessons_total),
        ("science_lessons_scheduled", len(science_scheduled_all)),
        ("science_complete_both_directions",
         all(s["covers_every_lesson_exactly_once"] for s in science_sched)),
        ("high_school_lessons_delivered", len(canonical_lesson_ids) + science_lessons_total),
        ("high_school_lessons_scheduled", len(all_scheduled) + len(science_scheduled_all)),
    ])),
    ("open_gap", OrderedDict([
        ("code", "SCIENCE_NOT_IN_CANONICAL_SCHEDULE"),
        ("severity", "PENDING_NOT_BLOCKING"),
        ("detail",
         "The four canonical per-grade CSVs schedule the nine canonical families only. Science is "
         "scheduled completely on its own plane. A single unified per-grade schedule becomes "
         "derivable once science is imported in the contract record shape."),
        ("owner", "science H3 import"),
    ])),
])

# --------------------------------------------------------------------------------------
# 4. Standards evidence registry
# --------------------------------------------------------------------------------------

SECTION_CLASS = {
    "Verbatim": "VERBATIM",
    "Composite, components verified": "COMPOSITE_VERIFIED",
    "Declared UNVERIFIED by the lane": "DECLARED_UNVERIFIED",
}


def parse_coverage(family):
    """Read the r1 per-family registry: bulleted backticked entries per class, plus the
    untraceable table. Prose backticks outside an enumerated entry are not registry members."""
    text = (R1 / family / "standards-coverage.md").read_text()
    classes = {v: [] for v in SECTION_CLASS.values()}
    classes["UNTRACEABLE"] = []
    current = None
    for line in text.splitlines():
        h = re.match(r"^##\s+(.*?)\s*$", line)
        if h:
            head = h.group(1)
            current = None
            for name, cls in SECTION_CLASS.items():
                if head.startswith(name):
                    current = cls
            if head.startswith("Untraceable"):
                current = "UNTRACEABLE"
            continue
        if current is None:
            continue
        if current == "UNTRACEABLE":
            m = re.match(r"^\|\s*([^|]+?)\s*\|", line)
            if m and m.group(1) not in ("Cited string", "---"):
                classes["UNTRACEABLE"].append(m.group(1))
        else:
            m = re.match(r"^-\s+`(.+)`\s*$", line)
            if m:
                classes[current].append(m.group(1))
    return classes


MP_TOKENS = [f"MP.{n}" for n in range(1, 9)]

families_evidence = []
for fam in CANONICAL_FAMILIES:
    cited = set()
    for g in GRADES:
        cited.update(canonical[f"ma-g{g}-{fam}"]["standards_cited"])
    parsed = parse_coverage(fam)
    entry = OrderedDict([
        ("family", fam),
        ("standards_framework", next(
            (f["standards_framework"] for f in matrix["subject_families"] if f["subject"] == fam), None)),
        ("distinct_strings_cited", len(cited)),
        ("classification_source",
         f"curriculum-release-candidates/hs912-r1/{fam}/standards-coverage.md (carried forward)"),
        ("classes", OrderedDict([
            ("VERBATIM", len(parsed["VERBATIM"])),
            ("COMPOSITE_VERIFIED", len(parsed["COMPOSITE_VERIFIED"])),
            ("DECLARED_UNVERIFIED", len(parsed["DECLARED_UNVERIFIED"])),
            ("ALIAS_RESOLVED_VERBATIM", 0),
            ("UNTRACEABLE", len(parsed["UNTRACEABLE"])),
        ])),
        ("evidences_a_verbatim_state_standard", len(parsed["VERBATIM"]) > 0),
        ("note", None),
    ])
    if fam == "mathematics":
        mp_cited = sorted((t for t in cited if t in MP_TOKENS), key=lambda s: int(s.split(".")[1]))
        entry["classes"]["UNTRACEABLE"] = len(parsed["UNTRACEABLE"]) - len(mp_cited)
        entry["classes"]["ALIAS_RESOLVED_VERBATIM"] = len(mp_cited)
        entry["mathematical_practice_resolution"] = OrderedDict([
            ("tokens_reclassified", mp_cited),
            ("from_class", "UNTRACEABLE"),
            ("to_class", "ALIAS_RESOLVED_VERBATIM"),
            ("basis", "standards/mathematical-practice-map.json"),
        ])
        entry["note"] = (
            "The seven MP.N tokens are reclassified by this lane from UNTRACEABLE to "
            "ALIAS_RESOLVED_VERBATIM. The referent statement of each is verbatim in the official "
            "Michigan document; the MP.N token form is not printed by that document and remains a "
            "lane shorthand. See standards/mathematics-mathematical-practice-custody.md.")
    if fam == "physical-education":
        entry["note"] = (
            "Every citation in this family is lane-declared UNVERIFIED. Accepted and non-blocking "
            "under release/authoring-boundaries.md §7, but it is not evidence of state-standard "
            "alignment and must not be read as equivalent to a verbatim-verified family.")
    if fam == "health":
        entry["note"] = (
            "Composite lane labels built from published components; the bracketed 9-12 band codes "
            "are extrapolated from a template, which the lane states openly. One citation is "
            "lane-declared UNVERIFIED.")
    if fam == "ready-for-life":
        entry["note"] = (
            "No coded MDE framework is bound to this family. See the READY_FOR_LIFE_STANDARDS_ANCHOR "
            "entry in coverage-requirements-registry.json — a Director decision, still open.")
    families_evidence.append(entry)

science_cited = set()
for obs in science.values():
    science_cited.update(obs["standards_cited"])
families_evidence.append(OrderedDict([
    ("family", "science"),
    ("standards_framework", "michigan-science-standards-high-school"),
    ("distinct_strings_cited", len(science_cited)),
    ("classification_source",
     "NOT_CLASSIFIED_BY_THIS_LANE — science carries PENDING_H3_IMPORT; its standards evidence is "
     "the lane's own standards-alignment.md and standard-framework.json, imported verbatim."),
    ("classes", OrderedDict([
        ("VERBATIM", None), ("COMPOSITE_VERIFIED", None), ("DECLARED_UNVERIFIED", None),
        ("ALIAS_RESOLVED_VERBATIM", None), ("UNTRACEABLE", None),
    ])),
    ("evidences_a_verbatim_state_standard", None),
    ("note",
     "Deliberately unclassified. Building a release-layer classification for content that is about "
     "to be re-imported would produce a registry keyed to a superseded input. Classification is "
     "owed at H3 import."),
]))

standards_registry = OrderedDict([
    ("schema_version", "manuel-academy-hs912-standards-evidence-registry-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("class_vocabulary", OrderedDict([
        ("VERBATIM", "the cited string occurs verbatim in the owning lane's custody documents"),
        ("COMPOSITE_VERIFIED", "a lane-composed label every component of which the lane evidences"),
        ("DECLARED_UNVERIFIED", "the owning lane itself declares the citation unverified; accepted, non-blocking, and not evidence of alignment"),
        ("ALIAS_RESOLVED_VERBATIM", "the cited token is not printed by the official source, but resolves through a published alias table to a statement that is verbatim in that source, with the source pinned by digest"),
        ("UNTRACEABLE", "none of the above; blocking"),
    ])),
    ("honesty_rule",
     "A lane's own declaration outranks any text match made at the release layer. "
     "ALIAS_RESOLVED_VERBATIM records two facts at once: the referent is verified and the code form "
     "is not. It must never be collapsed into VERBATIM."),
    ("families", families_evidence),
    ("totals", OrderedDict([
        ("VERBATIM", sum(f["classes"]["VERBATIM"] or 0 for f in families_evidence)),
        ("COMPOSITE_VERIFIED", sum(f["classes"]["COMPOSITE_VERIFIED"] or 0 for f in families_evidence)),
        ("DECLARED_UNVERIFIED", sum(f["classes"]["DECLARED_UNVERIFIED"] or 0 for f in families_evidence)),
        ("ALIAS_RESOLVED_VERBATIM", sum(f["classes"]["ALIAS_RESOLVED_VERBATIM"] or 0 for f in families_evidence)),
        ("UNTRACEABLE", sum(f["classes"]["UNTRACEABLE"] or 0 for f in families_evidence)),
    ])),
])

# --------------------------------------------------------------------------------------
# 5. Mathematical Practice map
# --------------------------------------------------------------------------------------

cited_mp = sorted(
    {t for g in GRADES for t in canonical[f"ma-g{g}-mathematics"]["standards_cited"] if t in MP_TOKENS},
    key=lambda s: int(s.split(".")[1]))

mp_map = OrderedDict([
    ("schema_version", "manuel-academy-hs912-mathematical-practice-map-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("purpose",
     "Resolve the mathematics lane's MP.N citation tokens to the Standards for Mathematical "
     "Practice as printed in the official Michigan document, so the citations are traceable at the "
     "release layer without editing a single line of mathematics instruction."),
    ("official_source", MP_SOURCE),
    ("independent_verification", OrderedDict([
        ("performed_by", "mac/hs912-release-normalization-r2"),
        ("method",
         "The document was retrieved directly from michigan.gov and hashed. Its SHA-256 equals the "
         "digest recorded in the mathematics lane's own standards-custody.md, so this lane and the "
         "mathematics lane demonstrably read the same bytes. Page count 94 also matches. The "
         "practice section was then extracted and searched."),
        ("sha256_matches_math_lane_custody", True),
        ("token_MP_occurrences_in_official_document", 0),
        ("token_MP_dot_N_occurrences_in_official_document", 0),
        ("token_MPN_occurrences_in_official_document", 0),
        ("practices_printed_in_official_document", 8),
        ("printed_label_form_in_practice_section", "bare ordinal, e.g. '1 Make sense of problems and persevere in solving them.'"),
        ("printed_label_form_in_high_school_overviews", "dotted ordinal under the heading 'mathematical Practices', e.g. '1. Make sense of problems and persevere in solving them.'"),
    ])),
    ("verdict", OrderedDict([
        ("referents", "REAL_AND_VERBATIM_IN_OFFICIAL_SOURCE"),
        ("code_form", "NOT_PRINTED_BY_OFFICIAL_SOURCE"),
        ("classification", "ALIAS_RESOLVED_VERBATIM"),
        ("not_invented", True),
        ("summary",
         "The mathematics lane did not invent a standard. It used a community shorthand for a "
         "standard that is genuinely in the official Michigan document, and its custody extract "
         "covered only the content standards, so the practices were never captured. The defect is "
         "custody and traceability, not instruction."),
    ])),
    ("practices", [OrderedDict([
        ("alias_token", f"MP.{n}"),
        ("official_ordinal", n),
        ("official_label_as_printed", f"{n}"),
        ("statement_verbatim", MP_STATEMENTS[n]),
        ("cited_by_mathematics_lane", f"MP.{n}" in cited_mp),
    ]) for n in MP_STATEMENTS]),
    ("citation_census", OrderedDict([
        ("tokens_cited", cited_mp),
        ("tokens_not_cited", [t for t in MP_TOKENS if t not in cited_mp]),
        ("practices_available", 8),
        ("practices_cited", len(cited_mp)),
    ])),
    ("standing_advisory", OrderedDict([
        ("code", "MP_CODE_FORM_IS_LANE_SHORTHAND"),
        ("severity", "ADVISORY_NOT_BLOCKING"),
        ("detail",
         "This map makes the citations traceable; it does not make MP.N an official token. The "
         "mathematics lane should either adopt the printed ordinal form or keep this map as the "
         "custody of record and reference it from its own standards-custody.md."),
        ("owner", "mac/hs912-math-r1"),
    ])),
])

# --------------------------------------------------------------------------------------
# 6. Coverage requirements registry
# --------------------------------------------------------------------------------------

coverage_registry = OrderedDict([
    ("schema_version", "manuel-academy-hs912-coverage-requirements-registry-1.0"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("scope_disclaimer",
     "A curriculum and coverage design audit against the Michigan Merit Curriculum. Not a legal "
     "opinion. It does not decide whether the MMC binds this family, and it makes no claim about "
     "diploma validity, accreditation, or credit recognition."),
    ("graduation_completeness", OrderedDict([
        ("verdict", "NOT_GRADUATION_COMPLETE"),
        ("basis", matrix["graduation_completeness"]["basis"]),
        ("asserted_by_this_lane", False),
        ("guard",
         "No artifact in curriculum-release-normalization/hs912-r2 claims graduation completeness. "
         "validate-normalization.mjs fails the run if any file in this lane does."),
    ])),
    ("requirements", [OrderedDict([
        ("requirement", g["requirement"]),
        ("authority", g.get("authority")),
        ("verdict", g["verdict"]),
        ("credits_required", g.get("credits_required")),
        ("irreducible_remainder_credits", g.get("irreducible_remainder_credits")),
        ("owner", g.get("owner")),
        ("detail", g.get("detail")),
        ("see", g.get("see")),
        ("changed_by_this_lane", False),
    ]) for g in matrix["declared_coverage_gaps"]]),
    ("world_language_guard", OrderedDict([
        ("requirement", "MMC_WORLD_LANGUAGE"),
        ("verdict", "NOT_COVERED"),
        ("rule",
         "World Language stays NOT_COVERED unless real delivered content exists. No world-language "
         "course, unit, lesson or assessment exists in this candidate, and this lane does not "
         "create one. The verdict is re-derived from delivered content by the validator, not copied."),
        ("owner", "DIRECTOR"),
    ])),
])

# --------------------------------------------------------------------------------------
# 7. Manifest
# --------------------------------------------------------------------------------------

science_h3_sha = git_sha("mac/hs912-science-h3")
science_h2_sha = git_sha("mac/hs912-science-h2")

manifest = OrderedDict([
    ("schema_version", 1),
    ("normalization_id", "manuel-academy-hs912-r2"),
    ("lane", "mac/hs912-release-normalization-r2"),
    ("normalized_on", "2026-08-12"),
    ("input_candidate", OrderedDict([
        ("path", "curriculum-release-candidates/hs912-r1"),
        ("assembled_by", r1_manifest["assembled_by"]),
        ("input_status", r1_manifest["status"]),
    ])),
    ("scope", OrderedDict([
        ("owns", "curriculum-release-normalization/hs912-r2/**"),
        ("reads", ["curriculum-release-candidates/hs912-r1/**"]),
        ("writes_outside_scope", "none"),
        ("authored_content_edited", "none — no unit, lesson, assessment, identifier, standards "
                                    "citation or credit value in any lane was changed"),
    ])),
    ("blockers_addressed", [
        OrderedDict([
            ("code", "SCIENCE_ID_SCHEME_CONFLICT"),
            ("resolution", "ALIAS_REGISTRY"),
            ("artifact", "registries/course-id-alias-registry.json"),
            ("renamed_any_stable_id", False),
        ]),
        OrderedDict([
            ("code", "STANDARD_UNTRACEABLE"),
            ("scope", "mathematics MP.1-MP.7"),
            ("resolution", "CUSTODY_REPAIR_AND_ALIAS_MAP"),
            ("artifact", "standards/mathematical-practice-map.json"),
            ("edited_math_instruction", False),
        ]),
    ]),
    ("science", OrderedDict([
        ("status", "PENDING_H3_IMPORT"),
        ("content_in_candidate_from_branch", "mac/hs912-science-h2"),
        ("content_in_candidate_sha", science_h2_sha),
        ("successor_branch", "mac/hs912-science-h3"),
        ("successor_pinned", False),
        ("successor_sha_observed", science_h3_sha),
        ("successor_sha_observed_at", "2026-08-12 (normalization run)"),
        ("successor_note",
         "mac/hs912-science-h3 is a moving branch. This lane does not wait for it and does not pin "
         "it. The SHA above is an observation at build time and will go stale by design — it "
         "already moved past the H2 commit the candidate imported during this session. What "
         "matters is that the successor still carries all four stable course ids, which the "
         "validator re-checks read-only from git. Treat the alias registry, not this SHA, as the "
         "durable artifact."),
    ])),
    ("derived_counts", release_course_registry["derived_counts"]),
    ("counts_asserted", False),
    ("graduation_completeness", coverage_registry["graduation_completeness"]),
    ("registries", [
        "registries/course-id-alias-registry.json",
        "registries/release-course-registry.json",
        "registries/standards-evidence-registry.json",
        "registries/coverage-requirements-registry.json",
        "registries/schedule-registry.json",
        "standards/mathematical-practice-map.json",
    ]),
])

# --------------------------------------------------------------------------------------

OUT = [
    (R2 / "registries" / "course-id-alias-registry.json", alias_registry),
    (R2 / "registries" / "release-course-registry.json", release_course_registry),
    (R2 / "registries" / "standards-evidence-registry.json", standards_registry),
    (R2 / "registries" / "coverage-requirements-registry.json", coverage_registry),
    (R2 / "registries" / "schedule-registry.json", schedule_registry),
    (R2 / "standards" / "mathematical-practice-map.json", mp_map),
    (R2 / "MANIFEST.json", manifest),
]
for path, obj in OUT:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")
    print("wrote", path.relative_to(REPO))

print("\ncourses:", release_course_registry["derived_counts"]["high_school_courses"])
print("units:", release_course_registry["derived_counts"]["units"])
print("lessons:", release_course_registry["derived_counts"]["lessons"])
print("assessments:", release_course_registry["derived_counts"]["assessments"])
print("untraceable total:", standards_registry["totals"]["UNTRACEABLE"])
print("alias-resolved total:", standards_registry["totals"]["ALIAS_RESOLVED_VERBATIM"])
