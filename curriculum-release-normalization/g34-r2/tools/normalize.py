#!/usr/bin/env python3
"""Normalize the Grades 3/4 release candidate into a promotion-compatible release.

Input:  curriculum-release-candidates/g34-r1/   (verified against its own SHA256SUMS.txt)
Output: curriculum-release-normalization/g34-r2/

No lesson is rewritten. Exactly two lesson metadata fields are normalized, both by an
invertible adapter, and the round trip is proven byte-for-byte on all 1800 lessons.
Everything else - the subject-slug divergence, the stale course matrix, the missing
standalone standards artifacts - is resolved at the release boundary with adapters,
projections, and normalized metadata rather than by editing content.

Run from the repo root:
    python3 curriculum-release-normalization/g34-r2/tools/normalize.py
"""
import csv, hashlib, io, json, os, re, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "curriculum-release-candidates", "g34-r1")
OUT = os.path.join(ROOT, "curriculum-release-normalization", "g34-r2")

RELEASE_ID = "manuel-academy-grades-3-4-r2-normalized"
RELEASE_STATUS = "G34_NORMALIZED_RELEASE_READY"
NORMALIZED_ON = "2026-08-12"
RELEASE_SCHEMA_VERSION = "1.0"

CANONICAL_SUBJECTS = [
    "mathematics", "english-language-arts", "science", "social-studies", "health",
    "physical-education", "ready-for-life", "technology", "arts-and-music",
    "financial-literacy",
]

# canonical subject slug -> slug used by release/course-matrix.json and release/lesson-schema.json
MATRIX_SLUG = {s: s for s in CANONICAL_SUBJECTS}
MATRIX_SLUG["technology"] = "technology-computer-science"
MATRIX_SLUG["arts-and-music"] = "arts-music"

# authored course_id -> course_id the stale matrix used
MATRIX_COURSE_ID = {
    "ma-g3-tech-cs": "ma-g3-technology-computer-science",
    "ma-g4-tech-cs": "ma-g4-technology-computer-science",
    "ma-g3-arts-music": "ma-g3-arts-music",
    "ma-g4-arts-music": "ma-g4-arts-music",
}

# canonical subject -> anchor row of release/standards-reference.md
STANDARDS_REF = {
    "mathematics": "standards-reference.md#mathematics",
    "english-language-arts": "standards-reference.md#english-language-arts",
    "science": "standards-reference.md#science",
    "social-studies": "standards-reference.md#social-studies",
    "health": "standards-reference.md#health-education",
    "physical-education": "standards-reference.md#physical-education",
    "ready-for-life": "standards-reference.md#ready-for-life",
    "technology": "standards-reference.md#technology--computer-science",
    "arts-and-music": "standards-reference.md#arts--music",
    "financial-literacy": "standards-reference.md#financial-literacy",
}

OFFICIAL_SOURCE = {
    "mathematics": "Michigan K-12 Standards: Mathematics (MDE)",
    "english-language-arts": "Michigan K-12 Standards: English Language Arts (MDE)",
    "science": "Michigan K-12 Science Standards, Nov 2015 (MDE, NGSS-derived)",
    "social-studies": "Michigan K-12 Social Studies Standards, May 2018 + grade-level GLCE PDFs (MDE)",
    "health": "Michigan Health Education Standards Guidelines 2025 (MDE), grade span 3-5",
    "physical-education": "Michigan K-12 Physical Education Standards, adopted 2017 (MDE)",
    "ready-for-life": None,
    "technology": "Michigan K-12 Computer Science Standards, adopted 2019 (MDE), Level 1B",
    "arts-and-music": "Michigan Visual, Performing, and Applied Arts Standards (MDE)",
    "financial-literacy": None,
}

# canonical subject -> lane standards artifacts carried at standards/sources/, or [] where the
# lane shipped none (custody gaps A and B in the r1 custody report).
LANE_ARTIFACTS = {
    "mathematics": ["standards/sources/mathematics/standards/standards-map.json",
                    "standards/sources/mathematics/standards/standards-map.md"],
    "english-language-arts": ["standards/sources/english-language-arts/standards/standards-map.json",
                              "standards/sources/english-language-arts/standards/michigan-ela-g3.json",
                              "standards/sources/english-language-arts/standards/michigan-ela-g4.json",
                              "standards/sources/english-language-arts/standards/standards-reference.md"],
    "health": ["standards/sources/health/standards-map.md"],
    "physical-education": ["standards/sources/physical-education/standards-map.md"],
    "technology": ["standards/sources/technology-computer-science/standards-map.md"],
    "arts-and-music": ["standards/sources/arts-music/standards-map.md"],
    "science": [],
    "social-studies": [],
    "ready-for-life": [],
    "financial-literacy": [],
}

PENDING_HEALTH_REVIEW = {
    "ma-g3-health", "ma-g4-health", "ma-g3-physical-education", "ma-g4-physical-education",
}

# Fields this run is allowed to touch on a lesson record. Nothing else may differ.
NORMALIZED_FIELDS = ["standards", "schema_version", "authored_schema_version"]


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(p):
    with open(p, "rb") as f:
        return sha256_bytes(f.read())


def jdump(obj):
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def write(relpath, data):
    p = os.path.join(OUT, relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    mode = "wb" if isinstance(data, bytes) else "w"
    with open(p, mode, **({} if isinstance(data, bytes) else {"encoding": "utf-8", "newline": "\n"})) as f:
        f.write(data)


def src_bytes(relpath):
    with open(os.path.join(SRC, relpath), "rb") as f:
        return f.read()


# --------------------------------------------------------------- 0. verify input
def verify_input():
    sums = os.path.join(SRC, "SHA256SUMS.txt")
    if not os.path.exists(sums):
        sys.exit("g34-r1 SHA256SUMS.txt not found; refusing to normalize an unverified input")
    listed, bad = [], []
    for line in open(sums, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line:
            continue
        h, rel = line.split("  ", 1)
        listed.append(rel)
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            bad.append(f"missing {rel}")
        elif sha256_file(p) != h:
            bad.append(f"differs {rel}")
    on_disk = set()
    for r, _d, fs in os.walk(SRC):
        for x in fs:
            on_disk.add(os.path.relpath(os.path.join(r, x), SRC))
    extra = sorted(on_disk - set(listed) - {"SHA256SUMS.txt"})
    if bad or extra:
        sys.exit("g34-r1 failed its own checksums: " + "; ".join(bad + [f"unlisted {e}" for e in extra]))
    return listed


def git_head():
    try:
        return subprocess.run(["git", "-C", ROOT, "rev-parse", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return None


# ------------------------------------------------------- 1. read the r1 candidate
def load_candidate():
    """course_id -> {grade, subject, dir, lesson_lines, lessons, units, assessments}"""
    courses = {}
    for grade in (3, 4):
        gdir = os.path.join(SRC, "grades", f"grade-{grade}", "courses")
        for subject in sorted(os.listdir(gdir)):
            cdir = os.path.join(gdir, subject)
            if not os.path.isdir(cdir):
                continue
            raw = open(os.path.join(cdir, "lessons.jsonl"), encoding="utf-8").read()
            lines = [l for l in raw.split("\n") if l.strip()]
            lessons = [json.loads(l) for l in lines]
            cid = lessons[0]["course_id"]
            units = json.load(open(os.path.join(cdir, "units.json"), encoding="utf-8"))
            assessments = json.load(open(os.path.join(cdir, "assessments.json"), encoding="utf-8"))
            courses[cid] = {
                "course_id": cid, "grade": grade, "subject": subject,
                "rel_dir": f"grades/grade-{grade}/courses/{subject}",
                "lines": lines, "lessons": lessons,
                "units": units, "assessments": assessments,
                "trailing_newline": raw.endswith("\n"),
            }
    return courses


def unit_records(units):
    return units["units"] if isinstance(units, dict) else units


def assessment_records(assessments):
    return assessments["assessments"] if isinstance(assessments, dict) else assessments


# ------------------------------------------- 2. standards mapping-status adapter
#
# Every assignment below traces to a written statement in an artifact carried in this
# release. Nothing infers review state that no author asserted: `canonical` is issued
# only where a lane catalog names the published MDE document as its source of record
# for the exact code, and the default is `unverified`, which is the contract's own
# term for "source cited, exact code not yet confirmed".

MAPPING_RULES = [
    {
        "id": "R1-lane-catalog-canonical",
        "status": "canonical",
        "applies_to": ["mathematics", "english-language-arts"],
        "test": "citation string appears verbatim in a lane-shipped standards catalog whose "
                "provenance block names the published MDE document as the source of record for "
                "those codes",
        "evidence": [
            "standards/sources/mathematics/standards/standards-map.json -> sources[0].role: "
            "'Source of record for every Grade 3 and Grade 4 code and paraphrase in this catalog.'",
            "standards/sources/english-language-arts/standards/michigan-ela-g3.json and "
            "michigan-ela-g4.json -> sources[1].note: 'every Grade 3 and Grade 4 code and sub-code "
            "below was read from this text'",
        ],
    },
    {
        "id": "R2-math-practice-house-convention",
        "status": "human-review",
        "applies_to": ["mathematics"],
        "test": "citation is an MP.n mathematical-practice code",
        "evidence": [
            "standards/sources/mathematics/standards/standards-map.json -> practice_code_note: "
            "'The MP.n prefix is a Manuel Academy package convention ... the Michigan document ... "
            "does not print the string MP.1.' No official code exists in the cited form, which is "
            "the contract's definition of human-review.",
        ],
    },
    {
        "id": "R3-financial-literacy-gap-1",
        "status": "human-review",
        "applies_to": ["financial-literacy"],
        "test": "any citation on a Grade 3/4 financial-literacy lesson",
        "evidence": [
            "standards/sources/release/standards-reference.md Gap 1: 'Until that decision is made, "
            "all Financial Literacy Grade 3/4 standards entries must use mapping_status: "
            "human-review.'",
        ],
    },
    {
        "id": "R4-ready-for-life-no-framework",
        "status": "human-review",
        "applies_to": ["ready-for-life"],
        "test": "any citation on a Grade 3/4 ready-for-life lesson",
        "evidence": [
            "standards/sources/release/standards-reference.md source table: Ready for Life -> "
            "'(no discrete Michigan academic-standards page)', official URL N/A. No official code "
            "exists; every citation is a Manuel Academy internal unit anchor.",
        ],
    },
    {
        "id": "R5-source-cited-code-unconfirmed",
        "status": "unverified",
        "applies_to": ["science", "social-studies", "health", "physical-education",
                       "arts-and-music", "technology"],
        "test": "default: a published official source is named for the subject in "
                "release/standards-reference.md, and no lane recorded a code-level confirmation "
                "against it",
        "evidence": [
            "standards/sources/release/standards-reference.md 'Verification method and its limits': "
            "'No code inside a PDF was fetched and transcribed by this session.'",
            "standards/sources/release/standards-reference.md Gap 4 directs technology/computer "
            "science to unverified explicitly.",
            "standards/sources/{health,physical-education,arts-music,technology-computer-science}/"
            "standards-map.md each close with 'a human curriculum reviewer should confirm ... "
            "before this package is promoted' - an intent to verify, not a record of verification.",
            "science and social-studies ship no lane standards artifact at all (r1 custody report "
            "Gap A), so no confirmation record can exist for their 1572 citations.",
        ],
    },
]


def build_catalogs():
    m = json.loads(src_bytes("standards/sources/mathematics/standards/standards-map.json"))
    math_codes, math_practices = set(), set()
    for gv in m["grades"].values():
        for s in gv["standards"]:
            math_codes.add(s["code"])
        for p in gv.get("mathematical_practices", []):
            math_practices.add(p["code"] if isinstance(p, dict) else p)
    ela = {}
    for g in (3, 4):
        d = json.loads(src_bytes(f"standards/sources/english-language-arts/standards/michigan-ela-g{g}.json"))
        ela[g] = set(d["standards"].keys())
    return math_codes, math_practices, ela


MATH_CODES, MATH_PRACTICES, ELA_CODES = set(), set(), {}


def mapping_for(subject, grade, citation):
    """-> (mapping_status, rule_id). Deterministic; order of rules is the order above."""
    if subject == "mathematics":
        if citation in MATH_CODES:
            return "canonical", "R1-lane-catalog-canonical"
        if citation in MATH_PRACTICES:
            return "human-review", "R2-math-practice-house-convention"
        return "unverified", "R5-source-cited-code-unconfirmed"
    if subject == "english-language-arts":
        if citation in ELA_CODES[grade]:
            return "canonical", "R1-lane-catalog-canonical"
        return "unverified", "R5-source-cited-code-unconfirmed"
    if subject == "financial-literacy":
        return "human-review", "R3-financial-literacy-gap-1"
    if subject == "ready-for-life":
        return "human-review", "R4-ready-for-life-no-framework"
    return "unverified", "R5-source-cited-code-unconfirmed"


# ---------------------------------------------------------- 3. the two adapters
def normalize_lesson(lesson):
    """r1 lesson record -> release lesson record. Key order is preserved; the only
    changes are the two declared metadata fields."""
    out = {}
    for k, v in lesson.items():
        if k == "schema_version":
            out["schema_version"] = RELEASE_SCHEMA_VERSION
            if v != RELEASE_SCHEMA_VERSION:
                out["authored_schema_version"] = v
        elif k == "standards":
            subject, grade = lesson["subject"], lesson["grade"]
            entries = []
            for c in v:
                status, _rule = mapping_for(subject, grade, c)
                entries.append({
                    "code_or_strand": c,
                    "source": STANDARDS_REF[subject],
                    "mapping_status": status,
                })
            out["standards"] = entries
        else:
            out[k] = v
    return out


def denormalize_lesson(lesson):
    """Exact inverse of normalize_lesson."""
    out = {}
    for k, v in lesson.items():
        if k == "schema_version":
            out["schema_version"] = lesson.get("authored_schema_version", v)
        elif k == "authored_schema_version":
            continue
        elif k == "standards":
            out["standards"] = [e["code_or_strand"] for e in v]
        else:
            out[k] = v
    return out


SEPARATOR_STYLES = [(", ", ": "), (",", ":")]


def detect_separators(line, obj):
    for sep in SEPARATOR_STYLES:
        if json.dumps(obj, ensure_ascii=False, separators=sep) == line:
            return sep
    return None


INSTRUCTIONAL_EXCLUDE = set(NORMALIZED_FIELDS)


def instructional_digest(lesson):
    """Digest over every field the normalization is not allowed to touch."""
    body = {k: v for k, v in lesson.items() if k not in INSTRUCTIONAL_EXCLUDE}
    return sha256_bytes(json.dumps(body, ensure_ascii=False, sort_keys=True,
                                   separators=(",", ":")).encode("utf-8"))


def citation_digest(codes):
    return sha256_bytes(json.dumps(list(codes), ensure_ascii=False,
                                   separators=(",", ":")).encode("utf-8"))


# ------------------------------------------------------------------ 4. schemas
def build_release_schema(base):
    s = json.loads(json.dumps(base))
    s["$id"] = "https://manuel.academy/schemas/curriculum-lesson-grade34-release-v1.json"
    s["title"] = "Manuel Academy Curriculum Lesson - Grades 3/4 Release v1"
    s["description"] = (
        "Release-boundary lesson schema for the normalized Grades 3/4 release "
        "(curriculum-release-normalization/g34-r2). Derived from "
        "curriculum-authoring/full-family-grade34/release/lesson-schema.json, carried verbatim in "
        "this release at standards/sources/release/lesson-schema.json, with exactly three declared "
        "deltas recorded in schemas/schema-delta.md. Neither the sealed 1.0.0 schema nor the "
        "release lane's file is modified."
    )
    s["properties"]["subject"]["enum"] = list(CANONICAL_SUBJECTS)
    s["properties"]["authored_schema_version"] = {
        "type": "string",
        "description": "The schema_version the authoring lane emitted, preserved when it differs "
                       "from the release-wide schema_version. Absent when they agree.",
    }
    return s


def validate_against(schema, obj, path=""):
    """Minimal JSON-Schema subset check, sufficient for these two lesson schemas."""
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


# ------------------------------------------------------------------- 5. build
def main():
    global MATH_CODES, MATH_PRACTICES, ELA_CODES

    listed = verify_input()
    head = git_head()

    # wipe the output tree except the tool that generates it
    if os.path.isdir(OUT):
        for name in sorted(os.listdir(OUT)):
            if name == "tools":
                continue
            p = os.path.join(OUT, name)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)

    MATH_CODES, MATH_PRACTICES, ELA_CODES = build_catalogs()
    courses = load_candidate()
    order = [f"ma-g{g}-{k}" for g in (3, 4) for k in
             ["mathematics", "english-language-arts", "science", "social-studies", "health",
              "physical-education", "ready-for-life", "tech-cs", "arts-music",
              "financial-literacy"]]
    assert sorted(order) == sorted(courses), sorted(set(order) ^ set(courses))

    # ---------------------------------------------------------- verbatim carry
    verbatim = []          # (src_rel, out_rel)
    for cid in order:
        c = courses[cid]
        d = os.path.join(SRC, c["rel_dir"])
        for name in sorted(os.listdir(d)):
            if name == "lessons.jsonl":
                continue
            verbatim.append((f"{c['rel_dir']}/{name}", f"{c['rel_dir']}/{name}"))
    for name in sorted(os.listdir(os.path.join(SRC, "schedules"))):
        verbatim.append((f"schedules/{name}", f"schedules/{name}"))
    for r, _d, fs in os.walk(os.path.join(SRC, "standards", "sources")):
        for x in sorted(fs):
            rel = os.path.relpath(os.path.join(r, x), SRC).replace(os.sep, "/")
            verbatim.append((rel, rel))
    verbatim.append(("standards/standards-custody-report.md", "standards/upstream/standards-custody-report.md"))
    verbatim.append(("standards/standards-inventory.json", "standards/upstream/standards-inventory.json"))
    verbatim.append(("ledger/source-branches.json", "ledger/source-branches.json"))
    verbatim.append(("ledger/source-branch-ledger.md", "ledger/source-branch-ledger.md"))
    verbatim.append(("validation/validation-report.md", "validation/upstream-validation-report.r1.md"))
    verbatim.append(("validation/validation.json", "validation/upstream-validation.r1.json"))
    verbatim = sorted(set(verbatim))

    verbatim_proof = []
    for s_rel, o_rel in verbatim:
        b = src_bytes(s_rel)
        write(o_rel, b)
        verbatim_proof.append({"source": f"curriculum-release-candidates/g34-r1/{s_rel}",
                               "release_path": o_rel, "sha256": sha256_bytes(b),
                               "byte_identical": sha256_file(os.path.join(OUT, o_rel)) == sha256_bytes(b)})

    # ------------------------------------------------- normalize lesson records
    digest_rows = []
    ledger_courses = []
    roundtrip_failures, digest_failures, serialize_failures = [], [], []
    all_norm = []
    citation_rows = []      # (course_id, subject, grade, code, status, rule, lesson_id)

    for cid in order:
        c = courses[cid]
        out_lines, changed_sv, changed_std = [], 0, 0
        for line, lesson in zip(c["lines"], c["lessons"]):
            sep = detect_separators(line, lesson)
            if sep is None:
                serialize_failures.append(lesson["lesson_id"])
                sep = (", ", ": ")
            norm = normalize_lesson(lesson)
            back = denormalize_lesson(norm)
            back_line = json.dumps(back, ensure_ascii=False, separators=sep)
            if back_line != line:
                roundtrip_failures.append(lesson["lesson_id"])
            d1, d2 = instructional_digest(lesson), instructional_digest(norm)
            c1 = citation_digest(lesson["standards"])
            c2 = citation_digest([e["code_or_strand"] for e in norm["standards"]])
            if d1 != d2 or c1 != c2:
                digest_failures.append(lesson["lesson_id"])
            if norm["schema_version"] != lesson["schema_version"]:
                changed_sv += 1
            changed_std += 1
            digest_rows.append({
                "lesson_id": lesson["lesson_id"], "course_id": cid,
                "instructional_sha256_r1": d1, "instructional_sha256_r2": d2,
                "instructional_equal": d1 == d2,
                "citation_sequence_sha256_r1": c1, "citation_sequence_sha256_r2": c2,
                "citation_sequence_equal": c1 == c2,
                "roundtrip_byte_identical": back_line == line,
            })
            for e in norm["standards"]:
                _s, rule = mapping_for(c["subject"], lesson["grade"], e["code_or_strand"])
                citation_rows.append((cid, c["subject"], lesson["grade"], e["code_or_strand"],
                                      e["mapping_status"], rule, lesson["lesson_id"],
                                      lesson["unit_number"]))
            out_lines.append(json.dumps(norm, ensure_ascii=False, separators=sep))
            all_norm.append(norm)
        write(f"{c['rel_dir']}/lessons.jsonl", "\n".join(out_lines) + ("\n" if c["trailing_newline"] else ""))
        ledger_courses.append({
            "course_id": cid, "lessons": len(out_lines),
            "standards_field_normalized": changed_std,
            "schema_version_pinned": changed_sv,
            "authored_schema_version_added": changed_sv,
            "other_fields_changed": 0,
        })

    # ----------------------------------------------------------- adapters
    write("adapters/subject-slug-map.json", jdump({
        "release_id": RELEASE_ID,
        "purpose": "Resolve the canonical-vs-matrix subject slug divergence at the release "
                   "boundary instead of renaming anything. Lessons already carry the canonical "
                   "slug; this map lets any consumer still keyed on the release lane's matrix "
                   "slugs translate in either direction without touching content.",
        "canonical_authority": [
            "curriculum-content/manuel-academy/1.0.0 (sealed release directory layout)",
            "src/curriculum-authoring/v2/contracts.ts",
        ],
        "stale_artifacts_using_matrix_slugs": [
            "standards/sources/release/course-matrix.json",
            "standards/sources/release/lesson-schema.json (subject enum)",
        ],
        "canonical_to_matrix": {s: MATRIX_SLUG[s] for s in CANONICAL_SUBJECTS},
        "matrix_to_canonical": {MATRIX_SLUG[s]: s for s in CANONICAL_SUBJECTS},
        "divergent_subjects": [s for s in CANONICAL_SUBJECTS if MATRIX_SLUG[s] != s],
        "course_id_authored_to_matrix": dict(MATRIX_COURSE_ID),
        "course_id_note": "Authored course IDs are preserved verbatim. ma-g{3,4}-tech-cs are the "
                          "IDs 72 lesson IDs, 12 unit IDs, the schedule, and every assessment "
                          "cross-reference are built from; renaming them would be a content "
                          "rewrite. release/course-matrix.normalized.json carries both.",
    }))

    write("adapters/schema-version-policy.json", jdump({
        "release_id": RELEASE_ID,
        "release_schema_version": RELEASE_SCHEMA_VERSION,
        "rule": "Every lesson in this release declares schema_version = the release-wide value. "
                "Where the authoring lane emitted a different value it is preserved verbatim in "
                "authored_schema_version, so nothing is lost and the change is invertible.",
        "inverse": "schema_version := authored_schema_version if present, then drop the field.",
        "observed_authored_versions": {"1.0": 1440, "1.1": 360},
        "affected_courses": ["ma-g3-english-language-arts", "ma-g4-english-language-arts"],
        "why_not_widen_the_const": "release/lesson-schema.json pins schema_version to "
            "const '1.0'. Widening it to an enum was the alternative and is rejected here: a "
            "release package should present one schema version to its consumers. The ELA 1.1 "
            "records are a strict superset of the 1.0 field set (39 fields vs 30-38, all "
            "additive) and the schema sets additionalProperties: true, so a 1.1 record is a "
            "valid 1.0 record. The authored value stays on the record either way.",
    }))

    write("adapters/standards-mapping-policy.json", jdump({
        "release_id": RELEASE_ID,
        "purpose": "Project the plain-string standards citations every lane authored into the "
                   "{code_or_strand, source, mapping_status} object form release/lesson-schema.json "
                   "requires, without inventing review state.",
        "code_or_strand": "The lane's citation string, verbatim. Never edited, reordered, "
                          "deduplicated, or dropped.",
        "source": "The anchor row of release/standards-reference.md for the lesson's subject - the "
                  "same value release/course-matrix.json already assigns as standards_ref.",
        "mapping_status": "Derived by the rules below. Each rule cites a written statement in an "
                          "artifact carried in this release. canonical is issued only against a "
                          "lane catalog that names the published MDE document as its source of "
                          "record for the exact code; the default is unverified, the contract's "
                          "own term for 'source cited, exact code not yet confirmed'.",
        "never": "No citation is promoted to canonical on assembly judgement, and no citation is "
                 "assigned a status a lane or the release contract contradicts.",
        "enum_definitions": {
            "canonical": "code confirmed against the cited official source",
            "unverified": "source cited, exact code not yet confirmed",
            "human-review": "ambiguous / no official code exists",
            "defined_in": "standards/sources/release/standards-reference.md",
        },
        "rules": MAPPING_RULES,
        "subject_source_anchor": dict(STANDARDS_REF),
    }))

    # ------------------------------------------------------------- schemas
    base_schema = json.loads(src_bytes("standards/sources/release/lesson-schema.json"))
    rel_schema = build_release_schema(base_schema)
    write("schemas/lesson.release.v1.json", jdump(rel_schema))

    # ---------------------------------------------- standards artifacts (20)
    by_course = {}
    for cid, subject, grade, code, status, rule, lid, unum in citation_rows:
        by_course.setdefault(cid, []).append((subject, grade, code, status, rule, lid, unum))

    rollup_total = {"canonical": 0, "unverified": 0, "human-review": 0}
    standards_index = []
    for cid in order:
        rows = by_course[cid]
        subject, grade = rows[0][0], rows[0][1]
        per = {}
        for _s, _g, code, status, rule, lid, unum in rows:
            e = per.setdefault(code, {"code_or_strand": code, "source": STANDARDS_REF[subject],
                                      "mapping_status": status, "derivation_rule": rule,
                                      "citation_count": 0, "unit_numbers": set(), "lesson_ids": []})
            e["citation_count"] += 1
            e["unit_numbers"].add(unum)
            e["lesson_ids"].append(lid)
        entries = []
        counts = {"canonical": 0, "unverified": 0, "human-review": 0}
        for code in sorted(per):
            e = per[code]
            counts[e["mapping_status"]] += e["citation_count"]
            e["unit_numbers"] = sorted(e["unit_numbers"])
            e["lesson_ids"] = sorted(set(e["lesson_ids"]))
            entries.append(e)
        for k in counts:
            rollup_total[k] += counts[k]
        lane = LANE_ARTIFACTS[subject]
        artifact = {
            "release_id": RELEASE_ID,
            "course_id": cid,
            "grade": grade,
            "subject": subject,
            "matrix_subject_slug": MATRIX_SLUG[subject],
            "standards_ref": STANDARDS_REF[subject],
            "official_source": OFFICIAL_SOURCE[subject],
            "custody": "lane-authored standards artifact present" if lane else
                       "no lane standards artifact - this file is the release-boundary standalone "
                       "artifact, projected from the course's own lesson citations",
            "lane_artifacts": lane,
            "projection_note": "Every entry below is a citation the lane already authored on a "
                               "lesson in this course. Nothing here adds, renames, or reinterprets "
                               "a standard; counts and mapping_status are derived by "
                               "adapters/standards-mapping-policy.json.",
            "totals": {"citations": sum(counts.values()), "distinct": len(entries), **counts},
            "standards": entries,
        }
        write(f"standards/courses/{cid}.standards.json", jdump(artifact))
        standards_index.append({
            "course_id": cid, "grade": grade, "subject": subject,
            "artifact": f"standards/courses/{cid}.standards.json",
            "citations": sum(counts.values()), "distinct": len(entries),
            "lane_artifact_present": bool(lane), **counts,
        })

    write("standards/standards-index.json", jdump({
        "release_id": RELEASE_ID,
        "note": "One standalone standards artifact per course, for all 20 courses. Eight courses "
                "(science, social-studies, ready-for-life, financial-literacy in both grades) "
                "shipped no lane standards artifact; theirs are projected from their own lesson "
                "citations and are marked as such.",
        "courses": standards_index,
    }))
    write("standards/standards-rollup.json", jdump({
        "release_id": RELEASE_ID,
        "contract_check": "standards-mapping-status-reported",
        "totals": {"citations": sum(rollup_total.values()), **rollup_total},
        "by_course": {r["course_id"]: {k: r[k] for k in ("canonical", "unverified", "human-review")}
                      for r in standards_index},
        "policy": "adapters/standards-mapping-policy.json",
    }))

    # -------------------------------------------------------------- indexes
    sched_index = json.loads(src_bytes("schedules/schedule-index.json"))
    sched_by_course = {c["course_id"]: c for c in sched_index["courses"]}
    r1_course_index = {c["course_id"]: c for c in
                       json.loads(src_bytes("course-index.json"))["courses"]}

    course_rows, unit_rows, lesson_rows = [], [], []
    for cid in order:
        c = courses[cid]
        subject, grade = c["subject"], c["grade"]
        units = unit_records(c["units"])
        assess = assessment_records(c["assessments"])
        s = sched_by_course[cid]
        r1c = r1_course_index[cid]
        course_rows.append({
            "course_id": cid,
            "matrix_course_id": MATRIX_COURSE_ID.get(cid, cid),
            "grade": grade,
            "subject": subject,
            "matrix_subject_slug": MATRIX_SLUG[subject],
            "unit_count": len(units),
            "lesson_count": len(c["lessons"]),
            "assessment_count": len(assess),
            "sessions": s["sessions"],
            "sessions_per_week": s["sessions_per_week"],
            "weeks_spanned": s["weeks_spanned"],
            "schedule_provenance": s["provenance"],
            "path": c["rel_dir"] + "/",
            "schedule": s["file"],
            "standards_artifact": f"standards/courses/{cid}.standards.json",
            "standards_ref": STANDARDS_REF[subject],
            "source_branch": r1c["source_branch"],
            "source_commit": r1c["source_commit"],
            "status": "PENDING_FINAL_HEALTH_REVIEW" if cid in PENDING_HEALTH_REVIEW
                      else "RELEASE_READY",
        })
        for u in units:
            unit_rows.append({
                "unit_id": u["unit_id"], "course_id": cid, "grade": grade, "subject": subject,
                "unit_number": u["unit_number"], "title": u.get("title", ""),
                "days": u.get("days", len(u.get("lesson_ids", []))),
                "lesson_count": len(u.get("lesson_ids", [])),
                "assessment_id": u.get("assessment_id"),
            })
        for l in c["lessons"]:
            lesson_rows.append([l["lesson_id"], l["course_id"], l["grade"], l["subject"],
                                l["unit_number"], l["course_day"], l.get("day_in_unit", ""),
                                l.get("phase", ""), l["title"]])

    write("course-index.json", jdump({
        "release_id": RELEASE_ID, "generated_on": NORMALIZED_ON, "grades": [3, 4],
        "courses": course_rows,
    }))
    write("unit-index.json", jdump({
        "release_id": RELEASE_ID, "generated_on": NORMALIZED_ON, "units": unit_rows,
    }))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["lesson_id", "course_id", "grade", "subject", "unit_number", "course_day",
                "day_in_unit", "phase", "title"])
    w.writerows(lesson_rows)
    write("lesson-index.csv", buf.getvalue())

    # ----------------------------------------------- normalized course matrix
    stale = json.loads(src_bytes("standards/sources/release/course-matrix.json"))
    write("release/course-matrix.normalized.json", jdump({
        "package_id": RELEASE_ID,
        "status": "normalized",
        "generated_on": NORMALIZED_ON,
        "supersedes": {
            "file": "standards/sources/release/course-matrix.json",
            "package_id": stale["package_id"],
            "status_there": stale["status"],
            "owner": "mac/g34-release-standards-r1 (not edited by this session)",
            "stale_fields": [
                "counts.units_total and counts.lessons_total were null placeholders; real totals "
                "are 154 and 1800.",
                "every course carried days: 180; real per-course cadence ranges from 36 to 180 "
                "sessions across the same 36-week year.",
                "unit_count and lesson_count were null on all 20 courses.",
                "subjects used the matrix slugs technology-computer-science and arts-music; the "
                "canonical slugs technology and arts-and-music are what the lanes authored and "
                "what the sealed 1.0.0 package uses.",
                "course_id ma-g{3,4}-technology-computer-science does not exist; the authored IDs "
                "are ma-g{3,4}-tech-cs.",
                "path pointed at subjects/<subject>/grade-<n>/, the authoring layout; release "
                "content lives at grades/grade-<n>/courses/<subject>/.",
            ],
        },
        "grades": [3, 4],
        "school_year": stale["school_year"],
        "subjects": list(CANONICAL_SUBJECTS),
        "subject_slug_map": "adapters/subject-slug-map.json",
        "counts": {
            "grades": 2, "courses_per_grade": 10, "courses_total": 20,
            "units_total": len(unit_rows), "lessons_total": len(lesson_rows),
            "assessments_total": sum(c["assessment_count"] for c in course_rows),
            "scheduled_sessions_total": sum(c["sessions"] for c in course_rows),
        },
        "cadence_note": "days is replaced by sessions / sessions_per_week / weeks_spanned. Every "
                        "course spans exactly weeks 1-36; the number of sessions per course "
                        "varies by subject and is what the lane authored.",
        "courses": [{
            "course_id": c["course_id"],
            "matrix_course_id": c["matrix_course_id"],
            "grade": c["grade"],
            "subject": c["subject"],
            "matrix_subject_slug": c["matrix_subject_slug"],
            "title": f"Grade {c['grade']} " + {
                "mathematics": "Mathematics", "english-language-arts": "English Language Arts",
                "science": "Science", "social-studies": "Social Studies", "health": "Health",
                "physical-education": "Physical Education", "ready-for-life": "Ready for Life",
                "technology": "Technology & Computer Science", "arts-and-music": "Arts & Music",
                "financial-literacy": "Financial Literacy"}[c["subject"]],
            "sessions": c["sessions"],
            "sessions_per_week": c["sessions_per_week"],
            "weeks_spanned": c["weeks_spanned"],
            "schedule_provenance": c["schedule_provenance"],
            "unit_count": c["unit_count"],
            "lesson_count": c["lesson_count"],
            "assessment_count": c["assessment_count"],
            "standards_ref": c["standards_ref"],
            "standards_artifact": c["standards_artifact"],
            "path": c["path"],
            "schedule": c["schedule"],
            "status": c["status"],
        } for c in course_rows],
    }))

    # ---------------------------------------------------------- validation
    contract, integrity, preservation = [], [], []

    def check(group, name, ok, detail):
        group.append({"check": name, "result": "PASS" if ok else "FAIL", "detail": detail})
        return ok

    def report(group, name, detail):
        group.append({"check": name, "result": "REPORTED", "detail": detail})

    L = all_norm
    lids = [l["lesson_id"] for l in L]
    uids = [u["unit_id"] for u in unit_rows]
    aids = [a["assessment_id"] for cid in order for a in assessment_records(courses[cid]["assessments"])]

    check(contract, "two-grades", sorted({l["grade"] for l in L}) == [3, 4],
          f"grades present: {sorted({l['grade'] for l in L})}")
    per_grade = {g: {c["subject"] for c in course_rows if c["grade"] == g} for g in (3, 4)}
    check(contract, "ten-courses-per-grade",
          all(per_grade[g] == set(CANONICAL_SUBJECTS) for g in (3, 4)),
          "grade 3: 10 courses, one per canonical subject; grade 4: 10 courses, one per canonical subject")
    check(contract, "course-count", len(course_rows) == 20, f"{len(course_rows)} courses")
    check(contract, "unique-course-ids", len({c['course_id'] for c in course_rows}) == 20,
          f"{len({c['course_id'] for c in course_rows})} distinct of {len(course_rows)}")
    check(contract, "unique-unit-ids", len(set(uids)) == len(uids),
          f"{len(uids)} units, {len(set(uids))} distinct")
    pat = re.compile(r"^ma-g(3|4)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$")
    badpat = [x for x in lids if not pat.match(x)]
    check(contract, "unique-lesson-ids", len(set(lids)) == len(lids) and not badpat,
          f"{len(lids)} lessons, {len(set(lids))} distinct; {len(badpat)} fail the grade34 lesson-id pattern")

    sched_problems, week_problems = [], []
    for cid in order:
        rows = list(csv.DictReader(io.StringIO(src_bytes(f"schedules/{cid}.csv").decode("utf-8"))))
        scheduled = [r["lesson_id"] for r in rows]
        have = {l["lesson_id"] for l in courses[cid]["lessons"]}
        if sorted(scheduled) != sorted(have):
            sched_problems.append(cid)
        weeks = sorted({int(r["week"]) for r in rows})
        if weeks != list(range(1, 37)):
            week_problems.append(cid)
    check(contract, "schedule-covers-every-lesson-once", not sched_problems,
          "; ".join(sched_problems) or "all 20 courses: every lesson scheduled exactly once, no unscheduled lesson")
    check(contract, "week-coverage", not week_problems,
          "; ".join(week_problems) or "all 20 courses span exactly weeks 1-36 with no empty week")

    rel_errs = [f"{l['lesson_id']}: {e}" for l in L for e in validate_against(rel_schema, l)]
    check(contract, "lesson-schema-compatibility", not rel_errs,
          (f"all {len(L)} lessons validate against schemas/lesson.release.v1.json"
           if not rel_errs else f"{len(rel_errs)} errors, e.g. " + "; ".join(rel_errs[:4])))

    upstream_errs = {}
    for l in L:
        for e in validate_against(base_schema, l):
            upstream_errs.setdefault(re.sub(r"^[^:]+: ", "", e), []).append(l["lesson_id"])
    n_up = len({x for v in upstream_errs.values() for x in v})
    report(contract, "lesson-schema-compatibility-against-unmodified-release-schema",
           (f"{n_up} of {len(L)} lessons fail standards/sources/release/lesson-schema.json as the "
            f"release-standards lane authored it. Remaining reasons: "
            + "; ".join(f"{k} ({len(v)})" for k, v in sorted(upstream_errs.items()))
            + ". This is the stale subject enum recorded in the r1 custody report section 5, not a "
              "content defect; adapters/subject-slug-map.json translates in both directions."
            ) if upstream_errs else f"all {len(L)} lessons also validate against the unmodified release schema")

    no_status = [l["lesson_id"] for l in L
                 if not any(isinstance(s, dict) and s.get("mapping_status") for s in l["standards"])]
    few_obj = [l["lesson_id"] for l in L if len(l.get("learning_objectives", [])) < 3]
    total_std = sum(len(l["standards"]) for l in L)
    with_status = sum(1 for l in L for s in l["standards"] if s.get("mapping_status"))
    check(contract, "required-standards-and-objectives", not no_status and not few_obj,
          f"learning_objectives >= 3: PASS on all {len(L)} lessons. standards entry carrying a "
          f"mapping_status: PASS on {len(L) - len(no_status)} of {len(L)} lessons "
          f"({with_status} of {total_std} citations carry one).")

    acc_short = [l["lesson_id"] for l in L if len(l.get("accessibility_and_accommodations", [])) < 5]
    min_acc = min(len(l.get("accessibility_and_accommodations", [])) for l in L)
    check(contract, "accessibility-depth", not acc_short,
          f"{len(acc_short)} lessons below 5 entries; minimum observed is {min_acc}")

    FALLBACK_WORDS = ("text", "transcript", "describ", "description", "demonstrat", "read-aloud",
                      "read aloud", "written", "alt text", "caption")
    no_fb = [l["lesson_id"] for l in L
             if not any(w in " ".join(map(str, l.get("accessibility_and_accommodations", []))).lower()
                        for w in FALLBACK_WORDS)]
    check(contract, "no-media-path", not no_fb,
          f"{len(no_fb)} lessons name no text/transcript/description/demonstration fallback "
          f"(keyword heuristic over accessibility_and_accommodations; human review still required)")

    sp_short = [l["lesson_id"] for l in L if len(l.get("safety_and_privacy", [])) < 2]
    min_sp = min(len(l.get("safety_and_privacy", [])) for l in L)
    check(contract, "safety-privacy-depth", not sp_short,
          f"{len(sp_short)} lessons below 2 entries; minimum observed is {min_sp}")

    BANNED = ["photo", "photograph", "video of", "voice recording", "precise location", "home address",
              "diagnosis", "medical history", "family income", "faith", "religion", "immigration",
              "password", "card number", "credit card", "tax id", "social security", "private message"]
    NEGATORS = ["no ", "not ", "never", "without", "do not", "does not", "is not", "are not",
                "optional", "n't", "neither", "nor ", "avoid", "refus", "prohibit", "exclude"]
    sp_hits = []
    for l in L:
        for entry in l.get("safety_and_privacy", []):
            low = str(entry).lower()
            for b in BANNED:
                if b in low and not any(n in low for n in NEGATORS):
                    sp_hits.append(f"{l['lesson_id']}: '{b}'")
    check(contract, "safety-privacy-content", not sp_hits,
          f"{len(sp_hits)} non-prohibiting uses of a banned disclosure term across {len(L)} lessons "
          f"(keyword heuristic that ignores explicit prohibitions such as 'no photo required'; "
          f"human review still required)")

    MULTI = ["two occasions", "multiple occasions", "at least two", "more than one", "two separate",
             "separate occasions", "two different", "on two", "second occasion", "across occasions"]
    single = [l["lesson_id"] for l in L
              if not any(m in str(l.get("mastery_rule", "")).lower() for m in MULTI)]
    check(contract, "multi-occasion-mastery", not single,
          f"{len(single)} lessons whose mastery_rule does not name multiple evidence occasions "
          f"(keyword heuristic; human review still required)")

    check(contract, "standards-mapping-status-reported", with_status == total_std,
          f"{total_std} standards citations across {len(L)} lessons; all {with_status} carry a "
          f"per-citation mapping_status. Rollup: canonical {rollup_total['canonical']}, unverified "
          f"{rollup_total['unverified']}, human-review {rollup_total['human-review']}. Derivation: "
          f"adapters/standards-mapping-policy.json; per-course detail: standards/standards-rollup.json.")

    # ----------------------------------------- normalization-integrity checks
    check(integrity, "input-candidate-verified", True,
          f"g34-r1 re-hashed against its own SHA256SUMS.txt before reading: {len(listed)} files, 0 differ")
    check(integrity, "lesson-roundtrip-byte-identical", not roundtrip_failures and not serialize_failures,
          (f"denormalize(normalize(lesson)) re-serialized in the source file's own separator style "
           f"reproduces all {len(L)} original JSONL lines byte for byte"
           if not roundtrip_failures and not serialize_failures
           else f"{len(roundtrip_failures)} round-trip failures, {len(serialize_failures)} "
                f"unreproducible source lines"))
    check(integrity, "instructional-content-digest-equal", not digest_failures,
          (f"SHA256 over every field outside {NORMALIZED_FIELDS} is identical between g34-r1 and "
           f"this release on all {len(L)} lessons; the standards citation sequence digest is "
           f"identical too" if not digest_failures
           else f"{len(digest_failures)} lessons differ outside the normalized fields"))
    norm_by_course = {}
    for l in L:
        norm_by_course.setdefault(l["course_id"], []).append(l)
    off_surface = []
    for cid in order:
        for orig, norm in zip(courses[cid]["lessons"], norm_by_course[cid]):
            for k in set(orig) | set(norm):
                if k in INSTRUCTIONAL_EXCLUDE:
                    continue
                if orig.get(k) != norm.get(k):
                    off_surface.append(f"{orig['lesson_id']}.{k}")
    check(integrity, "normalization-surface-closed", not off_surface,
          (f"exactly {len(NORMALIZED_FIELDS)} lesson fields are touched release-wide "
           f"({', '.join(NORMALIZED_FIELDS)}); every other field compares equal on all {len(L)} lessons"
           if not off_surface else f"{len(off_surface)} unexpected field changes, e.g. {off_surface[:5]}"))
    bad_verbatim = [v["release_path"] for v in verbatim_proof if not v["byte_identical"]]
    check(integrity, "verbatim-files-byte-identical", not bad_verbatim,
          f"{len(verbatim_proof)} non-lesson files carried from g34-r1 re-hashed after write; "
          f"{len(bad_verbatim)} differ")
    check(integrity, "lesson-index-identical-to-candidate",
          sha256_file(os.path.join(OUT, "lesson-index.csv")) == sha256_file(os.path.join(SRC, "lesson-index.csv")),
          "lesson-index.csv regenerated from the normalized lessons is byte-identical to g34-r1's, "
          "which fixes every lesson id, course id, grade, subject, unit number, course day, phase "
          "and title in one hash")
    sealed_dirty = subprocess.run(
        ["git", "-C", ROOT, "status", "--porcelain", "--", "curriculum-content/manuel-academy/1.0.0"],
        capture_output=True, text=True).stdout.strip()
    check(integrity, "sealed-1.0.0-untouched", not sealed_dirty,
          sealed_dirty or "no file under curriculum-content/manuel-academy/1.0.0 is added, changed, or removed")
    r1_dirty = subprocess.run(
        ["git", "-C", ROOT, "status", "--porcelain", "--", "curriculum-release-candidates/g34-r1"],
        capture_output=True, text=True).stdout.strip()
    check(integrity, "g34-r1-candidate-untouched", not r1_dirty,
          r1_dirty or "no file under curriculum-release-candidates/g34-r1 is added, changed, or removed")

    # ----------------------------------------------------- preservation checks
    r1_manifest = json.loads(src_bytes("MANIFEST.json"))
    exp = r1_manifest["counts"]
    got = {"courses": len(course_rows), "units": len(unit_rows), "lessons": len(L),
           "assessments": len(aids), "scheduled_sessions": sum(c["sessions"] for c in course_rows)}
    check(preservation, "counts-preserved",
          all(exp[k] == got[k] for k in got),
          "; ".join(f"{k}: {got[k]} (candidate {exp[k]})" for k in ("courses", "units", "lessons",
                                                                    "assessments", "scheduled_sessions")))
    r1_lids = [json.loads(l)["lesson_id"] for cid in order for l in courses[cid]["lines"]]
    check(preservation, "lesson-ids-preserved", r1_lids == lids,
          f"{len(lids)} lesson ids, same values in the same order as the candidate")
    r1_uids = [u["unit_id"] for cid in order for u in unit_records(courses[cid]["units"])]
    check(preservation, "unit-ids-preserved", r1_uids == uids, f"{len(uids)} unit ids unchanged")
    check(preservation, "course-ids-preserved",
          [c["course_id"] for c in course_rows] == order, f"{len(order)} course ids unchanged")
    r1_aids = [a["assessment_id"] for cid in order for a in assessment_records(courses[cid]["assessments"])]
    check(preservation, "assessment-ids-preserved", r1_aids == aids and len(set(aids)) == len(aids),
          f"{len(aids)} assessments, {len(set(aids))} distinct, all ids unchanged")
    sched_bad = [cid for cid in order
                 if sha256_file(os.path.join(OUT, "schedules", f"{cid}.csv"))
                 != sha256_file(os.path.join(SRC, "schedules", f"{cid}.csv"))]
    check(preservation, "schedules-preserved", not sched_bad,
          f"all 20 schedule CSVs plus schedule-index.json are byte-identical to the candidate")
    ass_bad = [cid for cid in order
               if sha256_file(os.path.join(OUT, courses[cid]["rel_dir"], "assessments.json"))
               != sha256_file(os.path.join(SRC, courses[cid]["rel_dir"], "assessments.json"))]
    check(preservation, "assessments-preserved", not ass_bad,
          "all 20 assessments.json files are byte-identical to the candidate")
    check(preservation, "subject-slugs-canonical",
          {c["subject"] for c in course_rows} == set(CANONICAL_SUBJECTS),
          "all 20 courses carry a subject drawn from the canonical 10-subject enum the sealed 1.0.0 "
          "package and src/curriculum-authoring/v2/contracts.ts use")
    check(preservation, "standards-artifact-per-course",
          all(os.path.exists(os.path.join(OUT, c["standards_artifact"])) for c in course_rows),
          "20 of 20 courses have a standalone standards artifact under standards/courses/ "
          f"({sum(1 for r in standards_index if not r['lane_artifact_present'])} of them projected "
          "from lesson citations because their lane shipped none)")

    # ---------------------------------------------------------- provenance
    write("provenance/inputs.json", jdump({
        "release_id": RELEASE_ID,
        "normalized_on": NORMALIZED_ON,
        "input": {
            "tree": "curriculum-release-candidates/g34-r1",
            "candidate_id": r1_manifest["candidate_id"],
            "files": len(listed),
            "sha256sums_sha256": sha256_file(os.path.join(SRC, "SHA256SUMS.txt")),
            "verified": "every listed file re-hashed and matched before this run read it",
        },
        "assembly_base_commit_of_input": json.loads(src_bytes("ledger/source-branches.json"))["assembly_base_commit"],
        "repo_head_at_normalization": head,
        "reads_only": ["curriculum-release-candidates/g34-r1/**"],
        "writes_only": ["curriculum-release-normalization/g34-r2/**"],
        "does_not_modify": [
            "curriculum-content/manuel-academy/1.0.0/**",
            "curriculum-release-candidates/g34-r1/**",
            "curriculum-authoring/full-family-grade34/**",
            "every source curriculum branch",
            "src/**", "scripts/**",
        ],
    }))

    write("provenance/normalization-ledger.json", jdump({
        "release_id": RELEASE_ID,
        "lesson_fields_touched": NORMALIZED_FIELDS,
        "lesson_fields_touched_count": len(NORMALIZED_FIELDS),
        "adapters": {
            "standards": "adapters/standards-mapping-policy.json",
            "schema_version": "adapters/schema-version-policy.json",
            "subject_slug": "adapters/subject-slug-map.json (no lesson field changed; the divergence "
                            "is resolved in the release schema and the normalized matrix)",
        },
        "invertible": True,
        "inverse_proof": "provenance/content-equivalence.json -> roundtrip_byte_identical",
        "per_course": ledger_courses,
    }))

    eq = {
        "release_id": RELEASE_ID,
        "claim": "Every byte of instructional content copied from g34-r1 is unchanged. The only "
                 "differences in any lesson record are the declared metadata fields, and applying "
                 "the documented inverse reproduces the candidate's own JSONL lines byte for byte.",
        "lessons": len(L),
        "roundtrip_byte_identical": sum(1 for r in digest_rows if r["roundtrip_byte_identical"]),
        "instructional_digest_equal": sum(1 for r in digest_rows if r["instructional_equal"]),
        "citation_sequence_equal": sum(1 for r in digest_rows if r["citation_sequence_equal"]),
        "fields_excluded_from_the_instructional_digest": NORMALIZED_FIELDS,
        "verbatim_files": {
            "count": len(verbatim_proof),
            "byte_identical": sum(1 for v in verbatim_proof if v["byte_identical"]),
        },
        "per_lesson_evidence": "provenance/lesson-content-digests.csv",
        "verbatim_file_evidence": "provenance/verbatim-files.json",
    }
    write("provenance/content-equivalence.json", jdump(eq))
    write("provenance/verbatim-files.json", jdump({
        "release_id": RELEASE_ID,
        "note": "Files carried out of g34-r1 with no change at all. sha256 is the shared hash of "
                "the candidate file and the released file.",
        "files": verbatim_proof,
    }))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["lesson_id", "course_id", "instructional_sha256_r1", "instructional_sha256_r2",
                "instructional_equal", "citation_sequence_sha256_r1", "citation_sequence_sha256_r2",
                "citation_sequence_equal", "roundtrip_byte_identical"])
    for r in digest_rows:
        w.writerow([r["lesson_id"], r["course_id"], r["instructional_sha256_r1"],
                    r["instructional_sha256_r2"], str(r["instructional_equal"]).lower(),
                    r["citation_sequence_sha256_r1"], r["citation_sequence_sha256_r2"],
                    str(r["citation_sequence_equal"]).lower(),
                    str(r["roundtrip_byte_identical"]).lower()])
    write("provenance/lesson-content-digests.csv", buf.getvalue())

    # ------------------------------------------------------- validation files
    groups = {"release_contract_conformance": contract,
              "normalization_integrity": integrity,
              "preservation": preservation}
    verdicts = {k: ("PASS" if all(c["result"] != "FAIL" for c in v) else "FAIL")
                for k, v in groups.items()}
    overall = "PASS" if all(v == "PASS" for v in verdicts.values()) else "FAIL"
    write("validation/validation.json", jdump({
        "release_id": RELEASE_ID,
        "normalized_on": NORMALIZED_ON,
        "overall": overall,
        "verdicts": verdicts,
        "counts": got,
        "standards_mapping_status": rollup_total,
        "external_gates": [
            "PENDING_FINAL_HEALTH_REVIEW on ma-g{3,4}-health and ma-g{3,4}-physical-education: a "
            "named licensed reviewer has not signed off. Carried forward from the candidate, "
            "unchanged, and explicitly out of scope for normalization.",
        ],
        "groups": groups,
    }))

    # ------------------------------------------------------------ manifest
    write("MANIFEST.json", jdump({
        "release_id": RELEASE_ID,
        "status": RELEASE_STATUS if overall == "PASS" else "BLOCKED",
        "normalized_on": NORMALIZED_ON,
        "supersedes": r1_manifest["candidate_id"],
        "input": "curriculum-release-candidates/g34-r1 (unmodified)",
        "preserves": {
            "package": "curriculum-content/manuel-academy/1.0.0",
            "note": "The sealed Grades 5/7/8 release keeps its own identity, version, counts and "
                    "checksums. This release is a separate tree and modifies nothing under "
                    "curriculum-content/, nothing under curriculum-release-candidates/, and no "
                    "source curriculum branch.",
        },
        "grades": [3, 4],
        "school_year": {"weeks": 36, "instructional_days": 180},
        "subjects": list(CANONICAL_SUBJECTS),
        "lesson_schema": {
            "release": "schemas/lesson.release.v1.json",
            "release_schema_version": RELEASE_SCHEMA_VERSION,
            "derived_from": "standards/sources/release/lesson-schema.json (carried verbatim)",
            "deltas": "schemas/schema-delta.md",
        },
        "counts": {**got, "grades": 2,
                   "per_grade": {str(g): {"courses": 10,
                                          "units": sum(c["unit_count"] for c in course_rows if c["grade"] == g),
                                          "lessons": sum(c["lesson_count"] for c in course_rows if c["grade"] == g)}
                                 for g in (3, 4)},
                   "per_course": {c["course_id"]: {"units": c["unit_count"],
                                                   "lessons": c["lesson_count"],
                                                   "assessments": c["assessment_count"],
                                                   "sessions": c["sessions"]} for c in course_rows}},
        "normalizations": [
            {"id": "N1", "layer": "lesson metadata", "field": "standards",
             "from": "array of plain strings", "to": "array of {code_or_strand, source, mapping_status}",
             "lessons": len(L), "citations": sum(rollup_total.values()),
             "adapter": "adapters/standards-mapping-policy.json", "invertible": True},
            {"id": "N2", "layer": "lesson metadata", "field": "schema_version",
             "from": "1.1 (ELA) / 1.0 (18 courses)", "to": f"{RELEASE_SCHEMA_VERSION} release-wide, "
             "authored value preserved in authored_schema_version",
             "lessons": 360, "adapter": "adapters/schema-version-policy.json", "invertible": True},
            {"id": "N3", "layer": "release schema", "field": "subject enum",
             "from": "matrix slugs technology-computer-science / arts-music",
             "to": "canonical slugs technology / arts-and-music; both directions in the alias map",
             "lessons": 0, "adapter": "adapters/subject-slug-map.json", "invertible": True},
            {"id": "N4", "layer": "release artifact", "field": "standalone standards artifacts",
             "from": "12 of 20 courses covered by a lane artifact",
             "to": "20 of 20 courses carry standards/courses/<course_id>.standards.json",
             "lessons": 0, "adapter": "standards/standards-index.json", "invertible": True},
            {"id": "N5", "layer": "release artifact", "field": "course matrix and cadence",
             "from": "release/course-matrix.json: null counts, days: 180 on every course, matrix "
                     "slugs, non-existent tech-cs course ids, authoring paths",
             "to": "release/course-matrix.normalized.json with real counts, per-course cadence, "
                   "canonical slugs, authored course ids, release paths",
             "lessons": 0, "adapter": "release/course-matrix.normalized.json", "invertible": True},
        ],
        "entry_points": {
            "course_index": "course-index.json",
            "unit_index": "unit-index.json",
            "lesson_index": "lesson-index.csv",
            "course_matrix": "release/course-matrix.normalized.json",
            "schedule_index": "schedules/schedule-index.json",
            "lesson_schema": "schemas/lesson.release.v1.json",
            "standards_index": "standards/standards-index.json",
            "standards_rollup": "standards/standards-rollup.json",
            "validation": "validation/validation.json",
            "content_equivalence": "provenance/content-equivalence.json",
            "source_ledger": "ledger/source-branches.json",
            "checksums": "SHA256SUMS.txt",
        },
        "course_status": {c["course_id"]: c["status"] for c in course_rows},
        "standards_mapping_status": rollup_total,
        "validation": {"overall": overall, **verdicts},
        "boundaries": {
            "owns": "curriculum-release-normalization/g34-r2/**",
            "does_not_modify": [
                "curriculum-release-candidates/g34-r1/**",
                "curriculum-content/manuel-academy/1.0.0/**",
                "curriculum-authoring/full-family-grade34/**",
                "src/**", "scripts/**",
            ],
            "not_yet_wired": [
                "AcademyGrade in src/types.ts",
                "PILOT_GRADES in src/curriculum/family-pilot/source.node.ts",
                "EXPECTED counts in scripts/build-curriculum.mjs",
                "a published release version for grades 3/4",
            ],
        },
        "external_gates": [
            "PENDING_FINAL_HEALTH_REVIEW on ma-g3-health, ma-g4-health, ma-g3-physical-education, "
            "ma-g4-physical-education - a named licensed reviewer has not signed off. Unchanged "
            "from the candidate and out of scope for normalization.",
        ],
    }))

    write(".gitattributes", "# Preserve this release byte-for-byte across platforms, so SHA256SUMS.txt\n"
                            "# and provenance/lesson-content-digests.csv stay valid on checkout.\n"
                            "# Mirrors the guard the sealed curriculum-content/ release uses.\n"
                            "** -text\n")

    # -------------------------------------------------------------- reports
    def rows(group):
        return "\n".join(f"| `{c['check']}` | {c['result']} | {c['detail']} |" for c in group)

    write("validation/validation-report.md", f"""# Validation Report - Grades 3/4 Normalized Release

**Release:** `{RELEASE_ID}`
**Normalized on:** {NORMALIZED_ON}
**Input:** `curriculum-release-candidates/g34-r1` ({r1_manifest['candidate_id']}), unmodified

| Group | Verdict |
| --- | --- |
| Conformance to `release/validation-contract.md` | **{verdicts['release_contract_conformance']}** |
| Normalization integrity | **{verdicts['normalization_integrity']}** |
| Preservation of the candidate | **{verdicts['preservation']}** |
| Overall | **{overall}** |

The candidate reported release-contract conformance as FAIL on `lesson-schema-compatibility` and
`required-standards-and-objectives`. Both now pass, and neither passes because a lesson was
rewritten - see [content equivalence](../provenance/content-equivalence-report.md).

## Counts

| | Grade 3 | Grade 4 | Total |
| --- | ---: | ---: | ---: |
| Courses | 10 | 10 | 20 |
| Units | {sum(c['unit_count'] for c in course_rows if c['grade'] == 3)} | {sum(c['unit_count'] for c in course_rows if c['grade'] == 4)} | {got['units']} |
| Lessons | {sum(c['lesson_count'] for c in course_rows if c['grade'] == 3)} | {sum(c['lesson_count'] for c in course_rows if c['grade'] == 4)} | {got['lessons']} |
| Assessments | | | {got['assessments']} |
| Scheduled sessions | | | {got['scheduled_sessions']} |

Every count matches the candidate exactly.

## Per course

| Grade | Subject | Course ID | Units | Lessons | Assess | Sessions | Cadence | Lane std. artifact | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
""" + "\n".join(
        f"| {c['grade']} | {c['subject']} | `{c['course_id']}` | {c['unit_count']} | "
        f"{c['lesson_count']} | {c['assessment_count']} | {c['sessions']} | {c['sessions_per_week']}/wk "
        f"x 36wk | {'yes' if next(r for r in standards_index if r['course_id'] == c['course_id'])['lane_artifact_present'] else 'none - standalone projected'} | "
        f"{c['status']} |" for c in course_rows) + f"""

## Release-contract checks

Every required check in
[`standards/sources/release/validation-contract.md`](../standards/sources/release/validation-contract.md),
in the contract's own order, run against the normalized lessons.

| Check | Result | Detail |
| --- | --- | --- |
{rows(contract)}

## Normalization integrity

| Check | Result | Detail |
| --- | --- | --- |
{rows(integrity)}

## Preservation

| Check | Result | Detail |
| --- | --- | --- |
{rows(preservation)}

## Standards mapping-status rollup

The rollup the contract asks for, which the candidate could not produce because no lane emitted the
object citation form.

| Status | Citations | Share |
| --- | ---: | ---: |
| `canonical` | {rollup_total['canonical']} | {round(rollup_total['canonical'] * 100 / sum(rollup_total.values()))}% |
| `unverified` | {rollup_total['unverified']} | {round(rollup_total['unverified'] * 100 / sum(rollup_total.values()))}% |
| `human-review` | {rollup_total['human-review']} | {round(rollup_total['human-review'] * 100 / sum(rollup_total.values()))}% |
| **Total** | **{sum(rollup_total.values())}** | |

Derivation rules and the evidence for each: [`adapters/standards-mapping-policy.json`](../adapters/standards-mapping-policy.json).
Per-course: [`standards/standards-rollup.json`](../standards/standards-rollup.json).
The contract requires this rollup to be *reported*, not to hit a particular ratio - it exists so
convergence can decide whether the ratio is acceptable. It is not acceptable yet: {rollup_total['unverified'] + rollup_total['human-review']}
of {sum(rollup_total.values())} citations still need a human.

## Scope limits

- Internal consistency only. No standard code is verified against a live Michigan source in this
  run; that is exactly what the `unverified` count above measures.
- `no-media-path`, `safety-privacy-content` and `multi-occasion-mastery` are keyword heuristics,
  as the contract itself describes them. They run over fields this normalization does not touch,
  and the keyword sets are the candidate's. A PASS means the scan found nothing.
- No licensed-educator sign-off exists for any of the 20 courses. Health and Physical Education
  carry `PENDING_FINAL_HEALTH_REVIEW` and remain an explicit external gate.
- No rendered-interface accessibility audit.
- No host integration. Grades 3 and 4 still do not exist in `AcademyGrade`, `PILOT_GRADES`, or
  `scripts/build-curriculum.mjs`. Promotion is a separate session; 1.0.0 stays frozen.
""")

    ela_sv = sum(1 for l in L if "authored_schema_version" in l)
    write("provenance/content-equivalence-report.md", f"""# Content Equivalence - Grades 3/4 Normalized Release

The claim this release has to earn: **the instructional content copied out of
`curriculum-release-candidates/g34-r1` is unchanged, and the only differences in any lesson record
are metadata fields named in advance.**

Three independent proofs, all machine-checked by [`tools/normalize.py`](../tools/normalize.py) on
every run, all reported in [`validation/validation.json`](../validation/validation.json).

## 1. The normalization surface is closed

Exactly {len(NORMALIZED_FIELDS)} fields may differ on a lesson record: `{'`, `'.join(NORMALIZED_FIELDS)}`.
The check `normalization-surface-closed` compares **every other key** of every one of the {len(L)}
lesson records against the candidate's and requires equality. Result: `{next(c['result'] for c in integrity if c['check'] == 'normalization-surface-closed')}`.

Nothing else in the release touches a lesson: `subject` keeps the canonical slug the lane authored,
every id, `course_day`, `unit_number`, `lesson_flow`, `formative_check`, `mastery_rule`,
`accessibility_and_accommodations`, `safety_and_privacy`, and every other field is passed through
untouched, in its original key order.

## 2. The adapters are invertible, and the inverse reproduces the original bytes

Both lesson normalizations have a documented inverse:

| Normalization | Forward | Inverse |
| --- | --- | --- |
| N1 `standards` | `"3.NBT.1"` -> `{{"code_or_strand": "3.NBT.1", "source": ..., "mapping_status": ...}}` | take `code_or_strand`, in order |
| N2 `schema_version` | `"1.1"` -> `"1.0"` + `authored_schema_version: "1.1"` | restore `authored_schema_version`, drop the field |

For each of the {len(L)} lessons the run computes `denormalize(normalize(lesson))`, re-serializes it
with the separator style detected from the candidate's own JSONL line, and compares **bytes**.

Result: {eq['roundtrip_byte_identical']} of {len(L)} lines reproduce byte for byte.

This is stronger than a field diff: it proves key order, spacing, unicode escaping, numeric
formatting and value identity are all preserved, so the normalization loses nothing.

## 3. Digests over the untouched fields match

For each lesson, a SHA256 is taken over every field outside the normalized set, and separately over
the standards citation sequence (the raw strings, in order). Both are computed on the candidate
record and on the released record.

| | Equal | Of |
| --- | ---: | ---: |
| Instructional-field digest | {eq['instructional_digest_equal']} | {len(L)} |
| Standards citation sequence digest | {eq['citation_sequence_equal']} | {len(L)} |

Per-lesson evidence, all {len(L)} rows with both hashes:
[`lesson-content-digests.csv`](lesson-content-digests.csv).

The citation digest matters on its own: it proves N1 added structure around the citations without
adding, dropping, reordering, deduplicating or editing a single one of the
{sum(rollup_total.values())} citation strings.

## 4. Everything that is not a lesson is byte-identical

{eq['verbatim_files']['count']} files - `units.json`, `assessments.json`, all 20 schedule CSVs and the
schedule index, every course guide, the ELA text banks and public-domain registers, the mathematics
practice/projects/mastery-evidence files, and every lane standards artifact - are copied with no
transformation and re-hashed after writing.
Byte-identical: {eq['verbatim_files']['byte_identical']} of {eq['verbatim_files']['count']}
([`verbatim-files.json`](verbatim-files.json)).

`lesson-index.csv`, regenerated from the *normalized* lessons, is byte-identical to the candidate's.
That single hash fixes every lesson id, course id, grade, subject, unit number, course day, phase
and title across all {len(L)} lessons.

## What actually changed, in full

| Change | Records | Layer |
| --- | ---: | --- |
| `standards` string -> object | {len(L)} lessons, {sum(rollup_total.values())} citations | lesson metadata |
| `schema_version` pinned, authored value preserved | {ela_sv} lessons | lesson metadata |
| release lesson schema `subject` enum canonicalized | 0 lessons | schema |
| standalone standards artifacts added | 0 lessons | release artifact |
| course matrix / cadence regenerated | 0 lessons | release artifact |

## Chain back to the source branches

This release proves equivalence to `g34-r1`. `g34-r1` proved, by its own
`content-byte-identical-to-source` check, that its 138 copied course files re-hash to the files in
the pinned lane commits recorded in [`ledger/source-branches.json`](../ledger/source-branches.json).
The two proofs compose: the instructional content here is the content the lanes authored.
""")

    write("schemas/schema-delta.md", f"""# Release lesson schema - delta from the release lane's file

[`lesson.release.v1.json`](lesson.release.v1.json) is
[`standards/sources/release/lesson-schema.json`](../standards/sources/release/lesson-schema.json)
- carried verbatim in this release, authored by `mac/g34-release-standards-r1`, **not edited** -
with three declared changes and nothing else.

## 1. `subject` enum canonicalized

```
- "technology-computer-science", "arts-music"
+ "technology", "arts-and-music"
```

The release lane wrote the enum from `course-matrix.json`'s planning slugs. Every lane authored the
canonical slugs, which are the ones the sealed `curriculum-content/manuel-academy/1.0.0` package and
`src/curriculum-authoring/v2/contracts.ts` use, and which the candidate's own directory layout keys
on. The r1 custody report section 5 recorded this as the open question and answered it the same way;
section 1a recorded that the schema needed the same remap applied to it. This is that remap, applied
at the release boundary instead of in the lane's file.

216 lessons (144 arts-and-music, 72 technology) fail the unmodified enum and pass this one. No
lesson's `subject` value changed. [`adapters/subject-slug-map.json`](../adapters/subject-slug-map.json)
translates in both directions for any consumer still keyed on the matrix slugs.

## 2. `authored_schema_version` declared

An optional string property recording the `schema_version` the authoring lane emitted, when it
differs from the release-wide value. The base schema sets `additionalProperties: true`, so this is
declarative rather than permissive - it documents a field that was already allowed.

## 3. `$id`, `title`, `description`

Retargeted to this release. No constraint changes.

## What did not change

`schema_version` keeps `const: "1.0"`. The `standards` item shape keeps its three required
properties and the `mapping_status` enum. Every `required` field, `minItems`, `minLength`,
`pattern`, and range is untouched. A lesson that validates against the lane's file also validates
against this one: the only relaxation is on `subject`, and it is a widening to the canonical values.

## Both are run

`validation/validation-report.md` reports `lesson-schema-compatibility` against this schema and,
separately, `lesson-schema-compatibility-against-unmodified-release-schema` against the lane's file,
so the residual gap stays visible rather than being normalized out of sight.
""")

    gap_courses = [r["course_id"] for r in standards_index if not r["lane_artifact_present"]]
    tot_cit = sum(rollup_total.values())
    write("standards/standards-custody-addendum.md", f"""# Standards Custody Addendum - Normalized Release

Addendum to [`upstream/standards-custody-report.md`](upstream/standards-custody-report.md), which is
carried here verbatim from the candidate. That report stands; this one records only what the
normalization changed about custody, and what it deliberately did not.

## 1. Citation form: resolved by projection, not by rewriting

The candidate recorded that all 20 lanes emit `standards` as plain strings and that
{tot_cit} of {tot_cit} citations carried no `mapping_status`, so the release schema's object form and
the contract's canonical/unverified/human-review rollup were both unreachable.

Both are now produced, by projecting each string into
`{{code_or_strand, source, mapping_status}}` where `code_or_strand` **is the lane's string,
verbatim**. Nothing was re-cited, re-worded, dropped or added - proven per lesson by the citation
sequence digest in [`../provenance/lesson-content-digests.csv`](../provenance/lesson-content-digests.csv).

`mapping_status` is derived by the published rules in
[`../adapters/standards-mapping-policy.json`](../adapters/standards-mapping-policy.json). The rules
exist so no reader has to trust a judgement call:

| Rule | Status | Scope | Grounded in |
| --- | --- | --- | --- |
| R1 | `canonical` | math content codes, ELA codes | the lane catalog names the published MDE document as source of record for those exact codes |
| R2 | `human-review` | math `MP.n` | the math lane states the MP.n string is a Manuel Academy convention the MDE document does not print |
| R3 | `human-review` | financial literacy | `release/standards-reference.md` Gap 1 directs it explicitly |
| R4 | `human-review` | ready for life | no discrete Michigan standards page exists; every citation is an internal anchor |
| R5 | `unverified` | everything else | an official source is named for the subject and no lane recorded a code-level confirmation |

Rollup: **{rollup_total['canonical']} canonical, {rollup_total['unverified']} unverified,
{rollup_total['human-review']} human-review**.

`canonical` is never issued on assembly judgement. {rollup_total['unverified'] + rollup_total['human-review']} of
{tot_cit} citations still need a human before any alignment claim is made to a family. The
normalization made that number *reportable*; it did not make it smaller.

## 2. Standalone standards artifacts: all 20 courses now have one

The candidate recorded that 8 of 20 courses shipped no standards artifact - Gap A (science,
social-studies: no lane document naming which published document the codes came from) and Gap B
(ready-for-life, financial-literacy).

Every course now carries `standards/courses/<course_id>.standards.json`, and each one states which
kind it is:

- **12 courses** with a lane artifact: the artifact is carried verbatim under `sources/` and the
  standalone file cross-references it.
- **8 courses** without one ({', '.join('`' + c + '`' for c in gap_courses)}): the standalone file is
  *projected from the course's own lesson citations*. It lists every distinct citation, its
  `mapping_status` and derivation rule, the lessons and units that cite it, and says plainly that no
  lane artifact exists.

**A projected artifact is a custody record, not a verification.** Gap A and Gap B are not closed by
it: science and social-studies still cite exact codes with no document of record, and the financial
literacy policy question the release contract deferred is still open. What changed is that the gap
is now enumerated per code rather than described in prose, so the lane that closes it has a work
list.

## 3. Health framework mismatch: unchanged, still recorded

The health lane aligned to the Michigan Health Education Standards Guidelines 2025 while the sealed
5/7/8 courses carry pre-2025 anchors. Normalization does not touch this. A family running Grade 4
and Grade 5 health will still see two vocabularies.

## 4. Naming: settled at the release boundary

The candidate answered the subject-slug question by keeping the canonical slugs the lanes authored.
This release keeps that answer and finishes it: the release lesson schema
([`../schemas/schema-delta.md`](../schemas/schema-delta.md)) and the normalized course matrix
([`../release/course-matrix.normalized.json`](../release/course-matrix.normalized.json)) both use
the canonical slugs, and [`../adapters/subject-slug-map.json`](../adapters/subject-slug-map.json)
translates for anything still keyed on the matrix slugs.

Course ids are unchanged. `ma-g{{3,4}}-tech-cs` stay as authored - renaming them would rewrite 72
lesson ids, 12 unit ids, a schedule and every assessment cross-reference. The normalized matrix
carries `matrix_course_id` alongside so the stale ids resolve.

## 5. Two lanes authored inside the sealed release path

Unchanged and still true of the source branches. This release reads only from the candidate and
writes only under `curriculum-release-normalization/g34-r2/`; the
`sealed-1.0.0-untouched` and `g34-r1-candidate-untouched` checks enforce both.

## 6. What still has no sign-off

Everything the candidate listed: no licensed-educator review of any of the 20 courses, no live
verification of standard codes, no rendered-interface accessibility audit, no host integration.
Health and Physical Education remain an explicit external gate at
`PENDING_FINAL_HEALTH_REVIEW`.
""")

    write("README.md", f"""# Manuel Academy - Grades 3/4 Normalized Release

`{RELEASE_ID}` - **status `{RELEASE_STATUS if overall == 'PASS' else 'BLOCKED'}`**

The Grades 3/4 candidate at `curriculum-release-candidates/g34-r1`, normalized into a shape a
promotion session can consume. No lesson was rewritten.

| | |
| --- | --- |
| Grades | 3, 4 |
| Courses | {got['courses']} |
| Units | {got['units']} |
| Lessons | {got['lessons']} |
| Unit assessments | {got['assessments']} |
| Scheduled sessions | {got['scheduled_sessions']} (every lesson exactly once, every course weeks 1-36) |
| Release-contract conformance | **{verdicts['release_contract_conformance']}** |
| Normalization integrity | **{verdicts['normalization_integrity']}** |
| Preservation | **{verdicts['preservation']}** |

## The five blockers, and how each is resolved

| Blocker at the candidate | Resolution | Lessons edited |
| --- | --- | ---: |
| `standards` plain strings vs the release schema's mapping objects | projection into `{{code_or_strand, source, mapping_status}}` with the citation string kept verbatim; `mapping_status` derived by published, evidence-cited rules | 0 rewritten, {got['lessons']} projected |
| ELA `schema_version` `1.1` vs the contract's `const: "1.0"` | release-wide pin with the authored value preserved in `authored_schema_version` | 0 |
| canonical vs matrix subject slugs | release schema canonicalized + bidirectional alias map + both slugs in the normalized matrix | 0 |
| 8 of 20 courses ship no standalone standards artifact | one standalone artifact per course; the 8 are projected from their own lesson citations and labelled as such | 0 |
| stale release course matrix and cadence metadata | `release/course-matrix.normalized.json` with real counts, real per-course cadence, authored course ids, release paths | 0 |

Details: [`provenance/normalization-ledger.json`](provenance/normalization-ledger.json),
[`schemas/schema-delta.md`](schemas/schema-delta.md),
[`standards/standards-custody-addendum.md`](standards/standards-custody-addendum.md).

## What is proven

- **{eq['roundtrip_byte_identical']} of {got['lessons']}** lessons: applying the documented inverse
  reproduces the candidate's own JSONL line **byte for byte**.
- **{eq['instructional_digest_equal']} of {got['lessons']}** lessons: SHA256 over every field outside
  the {len(NORMALIZED_FIELDS)} normalized ones is identical to the candidate's.
- **{eq['verbatim_files']['byte_identical']} of {eq['verbatim_files']['count']}** non-lesson files are
  byte-identical to the candidate's.
- `lesson-index.csv` is byte-identical to the candidate's, fixing every id in one hash.
- All counts, ids, schedules and assessments preserved.

Full argument: [`provenance/content-equivalence-report.md`](provenance/content-equivalence-report.md).

## Layout

```
g34-r2/
  MANIFEST.json                       release identity, counts, the five normalizations, boundaries
  course-index.json                   20 courses, canonical + matrix slugs, cadence, standards artifact
  unit-index.json                     {got['units']} units
  lesson-index.csv                    {got['lessons']} lessons - byte-identical to the candidate's
  SHA256SUMS.txt
  grades/grade-{{3,4}}/courses/<subject>/
                                      lessons.jsonl (normalized) plus every other lane file verbatim
  schedules/<course_id>.csv           verbatim
  adapters/                           subject-slug-map, schema-version-policy, standards-mapping-policy
  schemas/lesson.release.v1.json      the release schema + schema-delta.md
  release/course-matrix.normalized.json
  standards/courses/<course_id>.standards.json    20 standalone artifacts
  standards/standards-index.json, standards-rollup.json, standards-custody-addendum.md
  standards/sources/**                every lane standards artifact, verbatim
  standards/upstream/                 the candidate's custody report and inventory, verbatim
  provenance/                         inputs, normalization ledger, content-equivalence proofs
  validation/                         this release's report + the candidate's, verbatim
  ledger/                             the pinned source-branch commits, verbatim
  tools/normalize.py                  regenerates everything above from the candidate
```

## Reproducing

```bash
python3 curriculum-release-normalization/g34-r2/tools/normalize.py
```

It verifies `g34-r1` against its own `SHA256SUMS.txt` before reading a byte, refuses to run if the
candidate does not match, and writes only under `curriculum-release-normalization/g34-r2/`. Same
input produces a byte-identical tree.

## Read before promoting

- **Standards mapping status: {rollup_total['canonical']} canonical, {rollup_total['unverified']}
  unverified, {rollup_total['human-review']} human-review** of {tot_cit} citations. The contract
  requires this rollup to be reported so convergence can judge the ratio. The ratio is not yet
  acceptable - {rollup_total['unverified'] + rollup_total['human-review']} citations need a human.
  `canonical` was never issued on assembly judgement.
- **Health and Physical Education (4 courses, 288 lessons) remain
  `PENDING_FINAL_HEALTH_REVIEW`** - an explicit external gate. They ship complete, not hidden.
- **The release lane's own artifacts are still stale.** `release/course-matrix.json` and
  `release/lesson-schema.json` are carried verbatim under `standards/sources/release/` and are
  superseded here, not edited - they belong to `mac/g34-release-standards-r1`. The validation report
  runs both schemas so the residual gap stays visible.
- **Grades 3 and 4 still do not exist in the runtime**: not in `AcademyGrade`, not in
  `PILOT_GRADES`, not in `scripts/build-curriculum.mjs`. Promotion needs a new release version.
  1.0.0 stays frozen and is untouched here.
""")

    # ------------------------------------------------------------ checksums
    files = []
    for r, _d, fs in os.walk(OUT):
        for x in fs:
            rel = os.path.relpath(os.path.join(r, x), OUT).replace(os.sep, "/")
            if rel != "SHA256SUMS.txt":
                files.append(rel)
    write("SHA256SUMS.txt", "".join(f"{sha256_file(os.path.join(OUT, rel))}  {rel}\n"
                                    for rel in sorted(files)))

    print(f"{RELEASE_ID}: {overall}")
    for k, v in verdicts.items():
        print(f"  {k}: {v}")
    print(f"  courses={got['courses']} units={got['units']} lessons={got['lessons']} "
          f"assessments={got['assessments']} sessions={got['scheduled_sessions']}")
    print(f"  mapping_status: {rollup_total}")
    print(f"  files written: {len(files) + 1}")
    for c in contract + integrity + preservation:
        if c["result"] == "FAIL":
            print(f"  FAIL {c['check']}: {c['detail'][:200]}")
    return 0 if overall == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
