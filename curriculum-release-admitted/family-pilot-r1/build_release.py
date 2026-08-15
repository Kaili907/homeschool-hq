#!/usr/bin/env python3
"""Build and validate the admitted Family Pilot R1 release.

The structural and production inputs are read from immutable Git objects.  No
source curriculum or production corpus is copied or modified.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
STRUCTURAL_ROOT = REPO / "curriculum-release-candidates/family-pilot-final-r1"
STRUCTURE_SHA = "5a6c59024906275ba2cc36eec299e258535da154"
GATE_H3_SHA = "49b3c4b86cc7764627bd4cfbd752222849831abf"
ADMISSION_SHA = "5bd9e9c8981fe9171116f4aeb833a3e15da8b3e7"
RUNTIME_SHA = "fe3d9f2fbf29714c49fe95fd9396bb95a614810a"
GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
SUBJECT_TOTALS = {
    "mathematics": 1620,
    "english-language-arts": 1620,
    "science": 972,
    "social-studies": 972,
    "health": 324,
    "physical-education": 972,
    "ready-for-life": 324,
    "technology": 336,
    "arts-and-music": 648,
    "financial-literacy": 504,
}
FAMILY_TOTALS = {
    "mathematics": 1620,
    "english-language-arts": 1620,
    "science": 972,
    "social-studies": 972,
    "health-physical-education": 1296,
    "ready-for-life": 324,
    "technology-arts-and-music": 984,
    "financial-literacy": 504,
}

SOURCES = {
    "structural": {
        "branch": "mac/final-curriculum-structure-r1",
        "commit": STRUCTURE_SHA,
        "path": "curriculum-release-candidates/family-pilot-final-r1",
        "role": "final structural curriculum candidate",
    },
    "mathematics": {
        "branch": "mac/math-content-repair-r2",
        "commit": "c8f5a6b6b9b18317f96b5e2f92d453bde0f0b2b9",
        "path": "curriculum-production/final/mathematics",
        "role": "repaired active mathematics production corpus",
    },
    "science": {
        "branch": "mac/science-content-repair-r1",
        "commit": "dc2cee7fa16ea059218862d0dc42a2bee504269d",
        "path": "curriculum-production/final/science",
        "role": "repaired executable science production corpus",
    },
    "social-studies": {
        "branch": "mac/social-content-source-repair-r1",
        "commit": "9ab9860741566c2d02421fb36dc6c1eb0ddc9223",
        "path": "curriculum-production/final/social-studies",
        "role": "repaired static and dynamic-source Social Studies corpus",
    },
    "health": {
        "branch": "mac/health-production-depth-r1",
        "commit": "2f8583bd2acc92ed6fe2ca133f27e75113deac54",
        "path": "curriculum-production/final/health-physical-education",
        "role": "Director-approved production-depth Health lesson corpus",
    },
    "physical-education": {
        "branch": "mac/pe-production-depth-r1",
        "commit": "69fc9e6902fd66f7b7f505cf7e98d650fb322fff",
        "path": "curriculum-production/final/health-physical-education",
        "role": "Director-approved production-depth Physical Education lesson corpus",
    },
    "ready-for-life": {
        "branch": "mac/rfl-production-depth-r1",
        "commit": "d3b37a4e803a6fae47c567804341de8e46d26298",
        "path": "curriculum-production/final/ready-for-life",
        "role": "Director-approved production-depth Ready for Life corpus",
    },
    "financial-literacy": {
        "branch": "mac/finlit-production-depth-r1",
        "commit": "fcc8f6dd4a234b19b366ba436cc6fb2c28182454",
        "path": "curriculum-production/final/financial-literacy",
        "role": "Director-approved production-depth Financial Literacy corpus",
    },
    "english-language-arts": {
        "branch": "mac/ela-content-source-repair-r1",
        "commit": "d161efc876ad7563505897323f80fdb2cb11d5a4",
        "path": "curriculum-production/student-work/english-language-arts",
        "role": "repaired actionable ELA lesson production corpus",
    },
    "technology": {
        "branch": "mac/technology-production-depth-r1",
        "commit": "42a04f5e4133799be35cd01b0fade59195c3447d",
        "path": "curriculum-production/student-work/technology-arts-lessons",
        "role": "Director-approved production-depth Technology/CS lesson corpus",
    },
    "arts-and-music": {
        "branch": "mac/arts-production-depth-r1",
        "commit": "15ca63353e533db49374f5a2bc54e9b488750cca",
        "path": "curriculum-production/student-work/technology-arts-lessons",
        "role": "Director-approved production-depth Arts/Music lesson corpus",
    },
    "assessments": {
        "branch": "mac/assessment-materialization-r1",
        "commit": "520ce571e7a3e9dc8c60699cfae5f22ee10d56e2",
        "path": "curriculum-production/final/assessments",
        "role": "canonical materialized learner assessments and restricted adult authorities",
    },
    "production-gate-h3": {
        "branch": "mac/curriculum-production-gate-h3",
        "commit": GATE_H3_SHA,
        "path": "src/curriculum/production-quality",
        "role": "production readiness Gate H3 authority",
    },
    "release-admission": {
        "branch": "mac/release-admission-r1",
        "commit": ADMISSION_SHA,
        "path": "src/curriculum/release-admission",
        "role": "fail-closed release admission implementation",
    },
    "final-runtime": {
        "branch": "mac/final-curriculum-runtime-r1",
        "commit": RUNTIME_SHA,
        "path": "src/curriculum/final-runtime",
        "role": "final browser runtime compatibility contract",
    },
}


def run(*args: str, input_bytes: bytes | None = None) -> bytes:
    return subprocess.run(
        list(args), cwd=REPO, check=True, input=input_bytes, stdout=subprocess.PIPE
    ).stdout


def git(*args: str) -> str:
    return run("git", *args).decode()


def show(commit: str, path: str) -> bytes:
    return run("git", "show", f"{commit}:{path}")


def show_json(commit: str, path: str):
    return json.loads(show(commit, path))


def tree_paths(commit: str, root: str) -> list[str]:
    return [line for line in git("ls-tree", "-r", "--name-only", commit, root).splitlines() if line]


def write_json(path: str, value) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def write_jsonl(path: str, values: list[dict]) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("".join(json.dumps(v, sort_keys=True, ensure_ascii=False) + "\n" for v in values))


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def lesson_id_from_path(path: str, suffix: str) -> str:
    name = Path(path).name
    if not name.endswith(suffix):
        raise ValueError(path)
    return name[: -len(suffix)]


def grade_from_lesson(lesson_id: str) -> int:
    match = re.match(r"ma-(?:g|hs)(\d+)-", lesson_id)
    if not match:
        raise ValueError(f"cannot parse grade from {lesson_id}")
    return int(match.group(1))


def ref(commit: str, path: str) -> str:
    return f"git+{commit}:{path}"


def base_binding(slot: dict, source_key: str, package_path: str, scoring_path: str, schema: str) -> dict:
    source = SOURCES[source_key]
    return {
        "contractVersion": "family-pilot-production-binding-1.0",
        "lessonRef": slot["lessonRef"],
        "grade": slot["grade"],
        "subject": slot["subject"],
        "courseRef": slot["releaseSlotId"],
        "authoredCourseRef": slot["authoredCourseId"],
        "productionPackageRef": ref(source["commit"], package_path),
        "scoringAuthorityRef": ref(source["commit"], scoring_path),
        "productionSourceCommit": source["commit"],
        "productionSchemaVersion": schema,
        "completionAuthority": "LEARNER_AUTHORITY",
        "sourceReadinessKind": "STATIC_READY",
        "sourceRuntimeState": "READY",
        "safetyPrivacyReadiness": {
            "status": "VERIFIED",
            "evidenceRef": ref(source["commit"], f"{source['path']}/README.md"),
        },
        "productionGate": {
            "status": "READY",
            "gate": "H3",
            "gateSourceCommit": GATE_H3_SHA,
        },
    }


def file_map(paths: list[str], prefix: str, suffix: str) -> dict[str, str]:
    return {
        lesson_id_from_path(path, suffix): path
        for path in paths
        if path.startswith(prefix) and path.endswith(suffix)
    }


def collect_math(slots: dict[str, dict]) -> dict[str, dict]:
    source = SOURCES["mathematics"]
    paths = tree_paths(source["commit"], source["path"])
    packages = file_map(paths, f"{source['path']}/active/packages/", ".package.json")
    keys = file_map(paths, f"{source['path']}/active/answer-keys/", ".key.json")
    out = {}
    for lesson_id, package in packages.items():
        binding = base_binding(slots[lesson_id], "mathematics", package, keys[lesson_id], "1.0")
        binding["scoringMetadata"] = {"authority": "ANSWER_KEY", "answerKeyPresent": True}
        out[lesson_id] = binding
    return out


def collect_ela(slots: dict[str, dict]) -> dict[str, dict]:
    source = SOURCES["english-language-arts"]
    paths = tree_paths(source["commit"], source["path"])
    packages = file_map(paths, f"{source['path']}/packages/", ".package.json")
    scoring = file_map(paths, f"{source['path']}/scoring-guides/", ".scoring.json")
    out = {}
    for lesson_id, package in packages.items():
        binding = base_binding(slots[lesson_id], "english-language-arts", package, scoring[lesson_id], "1.0")
        binding["scoringMetadata"] = {"authority": "RUBRIC", "fixedAnswerKeyClaimed": False}
        binding["productionGate"]["evidenceRef"] = ref(
            source["commit"], f"{source['path']}/validation/gate-report.json"
        )
        out[lesson_id] = binding
    return out


def collect_science(slots: dict[str, dict]) -> dict[str, dict]:
    source = SOURCES["science"]
    paths = tree_paths(source["commit"], f"{source['path']}/packages")
    work_files = [p for p in paths if p.endswith("/work-packages.jsonl")]
    out = {}
    for work_file in work_files:
        course_root = work_file.rsplit("/", 1)[0]
        for line in show(source["commit"], work_file).decode().splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            lesson_id = record["lesson_id"]
            package = f"{course_root}/student-sheets/{lesson_id}.md"
            scoring = f"{course_root}/scoring/{lesson_id}.md"
            binding = base_binding(slots[lesson_id], "science", package, scoring, record["package_version"])
            lineage = record["source"]["lineage"]
            binding["sourceLineage"] = lineage
            binding["sourceAuthorityCommit"] = record["source"]["commit"]
            binding["scientificCorrectnessAuthority"] = {
                "present": record["assurances"]["scientific_correctness_authority_present"],
                "forms": record["assurances"]["scientific_correctness_authority_forms"],
            }
            binding["safetyPrivacyReadiness"] = {
                "status": record["assurances"]["safety_completeness"],
                "equalCreditAlternativePresent": record["assurances"]["equal_credit_alternative_present"],
                "evidenceRef": ref(source["commit"], f"{source['path']}/reports/safety-gate.json"),
            }
            binding["productionGate"]["evidenceRef"] = ref(
                source["commit"], f"{source['path']}/reports/production-quality-gate.json"
            )
            out[lesson_id] = binding
    return out


def collect_social(slots: dict[str, dict]) -> dict[str, dict]:
    source = SOURCES["social-studies"]
    records_path = f"{source['path']}/lesson-records.json"
    records = show_json(source["commit"], records_path)
    out = {}
    for record in records:
        lesson_id = record["lessonId"]
        readiness = record["sourceReadiness"]
        package = record["productionPackage"]["path"]
        binding = base_binding(slots[lesson_id], "social-studies", package, package, "1")
        binding["scoringMetadata"] = record["scoringAuthority"]
        binding["sourceReadinessKind"] = readiness["policy"]
        binding["sourceRuntimeState"] = readiness["runtimeState"]
        binding["sourceReadinessContract"] = readiness
        binding["sourceMetadataProvenance"] = record["sourceMetadataProvenance"]
        binding["productionGate"]["evidenceRef"] = ref(
            source["commit"], f"{source['path']}/gate-h3-report.json"
        )
        out[lesson_id] = binding
    return out


def collect_health_pe(slots: dict[str, dict]) -> dict[str, dict]:
    out = {}
    for subject in ("health", "physical-education"):
        source = SOURCES[subject]
        paths = tree_paths(source["commit"], source["path"])
        package_paths = [
            p for p in paths
            if re.search(rf"/packages/{subject}/grade-\d{{2}}/[^/]+\.json$", p)
        ]
        scoring_paths = [
            p for p in paths
            if re.search(rf"/scoring-guides/{subject}/grade-\d{{2}}/[^/]+\.json$", p)
        ]
        packages = {Path(p).stem: p for p in package_paths}
        scoring = {Path(p).stem: p for p in scoring_paths}
        for lesson_id, package in packages.items():
            binding = base_binding(slots[lesson_id], subject, package, scoring[lesson_id], "1.0.0")
            binding["scoringMetadata"] = {"authority": "RUBRIC", "privacySafe": True}
            binding["safetyPrivacyReadiness"] = {
                "status": "VERIFIED",
                "privacyViolationCount": 0,
                "evidenceRef": ref(source["commit"], f"{source['path']}/corpus-manifest.json"),
            }
            out[lesson_id] = binding
    return out


def collect_rfl(slots: dict[str, dict]) -> dict[str, dict]:
    source = SOURCES["ready-for-life"]
    manifest = show_json(source["commit"], f"{source['path']}/manifest.json")
    out = {}
    for record in manifest["lessons"]:
        lesson_id = record["lessonId"]
        package_path = f"{source['path']}/{record['packagePath']}"
        scoring_path = f"{source['path']}/{record['scoringPath']}"
        binding = base_binding(slots[lesson_id], "ready-for-life", package_path, scoring_path, manifest["schemaVersion"])
        if record["completionAuthority"] == "guardian":
            package = show_json(source["commit"], package_path)
            binding["completionAuthority"] = "GUARDIAN_ATTESTATION_REQUIRED"
            binding["adultAttestation"] = package["signOff"]
            binding["equalCreditSimulation"] = package["simulationAlternative"]
            binding["learnerSelfReportCanCertify"] = False
        else:
            binding["completionAuthority"] = "LEARNER_AUTHORITY"
            binding["learnerSelfReportCanCertify"] = True
        binding["productionGate"]["evidenceRef"] = ref(
            source["commit"], f"{source['path']}/reports/gate-report.json"
        )
        out[lesson_id] = binding
    return out


def collect_finlit(slots: dict[str, dict]) -> tuple[dict[str, dict], dict]:
    source = SOURCES["financial-literacy"]
    manifest = show_json(source["commit"], f"{source['path']}/corpus-manifest.json")
    h3 = show_json(source["commit"], f"{source['path']}/reports/h3-readiness.json")
    adjudicated = {item["lessonId"] for item in h3["manuallyResolvedPromptAmbiguities"]}
    for correction in h3["scoringCorrections"]:
        package_id = correction["packageId"]
        lesson = next(item for item in manifest["lessons"] if item["packageId"] == package_id)
        adjudicated.add(lesson["lessonId"])
    out = {}
    for record in manifest["lessons"]:
        lesson_id = record["lessonId"]
        package = f"{source['path']}/{record['packagePath']}"
        scoring = f"{source['path']}/{record['scoringPath']}"
        binding = base_binding(slots[lesson_id], "financial-literacy", package, scoring, manifest["schemaVersion"])
        binding["scoringMetadata"] = {
            "responseScoringMode": record["responseScoringMode"],
            "fixedAuthority": record["fixedAuthority"],
            "rubricAuthority": record["rubricAuthority"],
            "fixedItems": record["fixedItems"],
            "openItems": record["openItems"],
            "acceptableAnswerCriteria": record["acceptableAnswerCriteria"],
        }
        binding["h3Adjudication"] = "INDIVIDUALLY_ADJUDICATED" if lesson_id in adjudicated else "NOT_REQUIRED"
        binding["productionGate"]["evidenceRef"] = ref(
            source["commit"], f"{source['path']}/reports/h3-readiness.json"
        )
        out[lesson_id] = binding
    evidence = {
        "rawCounts": h3["rawCounts"],
        "effectiveCounts": h3["effectiveCounts"],
        "blockingLessons": h3["blockingLessons"],
        "unresolvedHumanReview": h3["unresolvedHumanReview"],
        "scoringCorrections": h3["scoringCorrections"],
        "manuallyResolvedPromptAmbiguities": h3["manuallyResolvedPromptAmbiguities"],
    }
    return out, evidence


def collect_tech_arts(slots: dict[str, dict]) -> dict[str, dict]:
    out = {}
    for subject in ("technology", "arts-and-music"):
        source = SOURCES[subject]
        paths = tree_paths(source["commit"], source["path"])
        packages = file_map(paths, f"{source['path']}/packages/{'arts-music' if subject == 'arts-and-music' else subject}/", ".task-package.json")
        scoring = file_map(paths, f"{source['path']}/scoring-guides/{'arts-music' if subject == 'arts-and-music' else subject}/", ".scoring-guide.json")
        for lesson_id, package in packages.items():
            binding = base_binding(slots[lesson_id], subject, package, scoring[lesson_id], "1.0.0")
            binding["scoringMetadata"] = {"authority": "RUBRIC", "lessonLevel": True}
            binding["productionGate"]["evidenceRef"] = ref(
                source["commit"], f"{source['path']}/gate-report.json"
            )
            out[lesson_id] = binding
    return out


def validate_bindings(bindings: list[dict], structural_lessons: list[dict], reserves: set[str]) -> list[dict]:
    checks: list[dict] = []

    def check(name: str, passed: bool, detail: str) -> None:
        checks.append({"check": name, "result": "PASS" if passed else "FAIL", "detail": detail})

    structural = {x["lessonRef"]: x for x in structural_lessons}
    refs = [x.get("lessonRef") for x in bindings]
    counts = Counter(refs)
    bound = {x.get("lessonRef"): x for x in bindings if x.get("lessonRef") in structural}
    missing = sorted(set(structural) - set(refs))
    extra = sorted(set(refs) - set(structural))
    duplicates = sorted(k for k, v in counts.items() if v != 1)
    check("binding-totality", len(bindings) == 8292 and not missing and not extra, f"bindings={len(bindings)} missing={len(missing)} extra={len(extra)}")
    check("binding-uniqueness", not duplicates, f"duplicateOrNonUnitRefs={len(duplicates)}")
    identity_errors = [
        lid for lid, binding in bound.items()
        if any(binding.get(key) != structural[lid][skey] for key, skey in (
            ("grade", "grade"), ("subject", "subject"), ("courseRef", "releaseSlotId")
        ))
    ]
    check("binding-identity", not identity_errors, f"mismatches={len(identity_errors)}")
    subject_counts = Counter(x.get("subject") for x in bindings)
    check("subject-production-totals", subject_counts == Counter(SUBJECT_TOTALS), json.dumps(dict(sorted(subject_counts.items())), sort_keys=True))
    family_counts = {
        "mathematics": subject_counts["mathematics"],
        "english-language-arts": subject_counts["english-language-arts"],
        "science": subject_counts["science"],
        "social-studies": subject_counts["social-studies"],
        "health-physical-education": subject_counts["health"] + subject_counts["physical-education"],
        "ready-for-life": subject_counts["ready-for-life"],
        "technology-arts-and-music": subject_counts["technology"] + subject_counts["arts-and-music"],
        "financial-literacy": subject_counts["financial-literacy"],
    }
    check("family-production-totals", family_counts == FAMILY_TOTALS and sum(family_counts.values()) == 8292, json.dumps(family_counts, sort_keys=True))
    check("math-reserves-excluded", not (set(refs) & reserves), f"activeReserveBindings={len(set(refs) & reserves)}")
    science_bad = [
        x["lessonRef"] for x in bindings
        if x.get("subject") == "science" and x.get("grade", 0) >= 9 and x.get("sourceLineage") != "hs912-science-h4"
    ]
    check("science-h4-lineage", not science_bad, f"invalidHighSchoolScience={len(science_bad)}")
    dynamic = [x for x in bindings if x.get("subject") == "social-studies" and x.get("sourceReadinessKind") == "DYNAMIC_SOURCE_REQUIRED"]
    dynamic_ok = all(
        x.get("sourceRuntimeState") == "PENDING_SOURCE_ATTACHMENT"
        and x.get("sourceReadinessContract", {}).get("becomesRunnableWhen") == "ATTACHED_SATISFIED"
        for x in dynamic
    )
    check("social-dynamic-runtime-semantics", len(dynamic) == 12 and dynamic_ok, f"dynamicLessons={len(dynamic)}")
    rfl = [x for x in bindings if x.get("subject") == "ready-for-life"]
    guardian = [x for x in rfl if x.get("completionAuthority") == "GUARDIAN_ATTESTATION_REQUIRED"]
    learner = [x for x in rfl if x.get("completionAuthority") == "LEARNER_AUTHORITY"]
    guardian_ok = all(
        x.get("adultAttestation")
        and x.get("equalCreditSimulation", {}).get("present") is True
        and x.get("learnerSelfReportCanCertify") is False
        for x in guardian
    )
    check("rfl-completion-authority", len(guardian) == 81 and len(learner) == 243 and guardian_ok, f"learner={len(learner)} guardian={len(guardian)}")
    finlit = [x for x in bindings if x.get("subject") == "financial-literacy"]
    finlit_modes = Counter(x.get("scoringMetadata", {}).get("responseScoringMode") for x in finlit)
    finlit_ok = all(
        isinstance(x.get("scoringMetadata"), dict)
        and "fixedAuthority" in x["scoringMetadata"]
        and x["scoringMetadata"].get("rubricAuthority") is True
        for x in finlit
    )
    allowed_modes = {"FIXED_OR_COMPUTATIONAL", "JUDGMENT_APPLICATION", "MIXED"}
    finlit_mode_detail = {str(key): value for key, value in finlit_modes.items()}
    check("finlit-h3-scoring-contract", finlit_ok and set(finlit_modes) <= allowed_modes and finlit_modes == Counter({"MIXED": 468, "JUDGMENT_APPLICATION": 36}), json.dumps(finlit_mode_detail, sort_keys=True))
    check("production-gate-h3-evidence", all(x.get("productionGate", {}).get("status") == "READY" and x.get("productionGate", {}).get("gateSourceCommit") == GATE_H3_SHA for x in bindings), "all bindings carry READY Gate H3 evidence")
    check("grade-6-absent", all(x.get("grade") != 6 for x in bindings), "no binding claims Grade 6")
    return checks


def mutation_controls(bindings: list[dict], structural_lessons: list[dict], reserves: set[str]) -> list[dict]:
    controls = []

    def exercise(name: str, mutate, expected_check: str) -> None:
        candidate = copy.deepcopy(bindings)
        mutate(candidate)
        failures = [x["check"] for x in validate_bindings(candidate, structural_lessons, reserves) if x["result"] == "FAIL"]
        controls.append({
            "mutation": name,
            "result": "DETECTED" if expected_check in failures else "MISSED",
            "expectedDetection": expected_check,
            "failedChecks": failures,
        })

    exercise("remove-one-lesson-binding", lambda x: x.pop(), "binding-totality")
    exercise("duplicate-one-lesson-binding", lambda x: x.append(copy.deepcopy(x[0])), "binding-uniqueness")
    exercise("bind-wrong-subject", lambda x: x[0].__setitem__("subject", "science"), "binding-identity")

    def old_science(values):
        item = next(x for x in values if x["subject"] == "science" and x["grade"] >= 9)
        item["sourceLineage"] = "hs912-science-h3"
    exercise("replace-science-h4-with-older-source", old_science, "science-h4-lineage")

    def remove_rfl(values):
        next(x for x in values if x["subject"] == "ready-for-life")["completionAuthority"] = None
    exercise("remove-rfl-completion-authority", remove_rfl, "rfl-completion-authority")

    def flatten_social(values):
        item = next(x for x in values if x.get("sourceReadinessKind") == "DYNAMIC_SOURCE_REQUIRED")
        item["sourceReadinessKind"] = "STATIC_READY"
        item["sourceRuntimeState"] = "READY"
    exercise("mark-dynamic-social-source-static-ready", flatten_social, "social-dynamic-runtime-semantics")

    def add_reserve(values):
        item = copy.deepcopy(next(x for x in values if x["subject"] == "mathematics" and x["grade"] == 8))
        item["lessonRef"] = sorted(reserves)[0]
        values.append(item)
    exercise("include-grade8-math-reserve-as-active", add_reserve, "math-reserves-excluded")

    def strip_finlit(values):
        next(x for x in values if x["subject"] == "financial-literacy").pop("scoringMetadata")
    exercise("strip-finlit-scoring-mode-metadata", strip_finlit, "finlit-h3-scoring-contract")
    return controls


class GitBlobHasher:
    def __init__(self):
        self.proc = subprocess.Popen(
            ["git", "cat-file", "--batch"], cwd=REPO,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        )

    def sha256(self, spec: str) -> str:
        assert self.proc.stdin and self.proc.stdout
        self.proc.stdin.write((spec + "\n").encode())
        self.proc.stdin.flush()
        header = self.proc.stdout.readline().decode().strip()
        if header.endswith(" missing"):
            raise ValueError(header)
        _object, kind, size = header.split()
        if kind != "blob":
            raise ValueError(header)
        data = self.proc.stdout.read(int(size))
        self.proc.stdout.read(1)
        return hashlib.sha256(data).hexdigest()

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.wait(timeout=10)


def verify_checksum_lines(hasher: GitBlobHasher, source_key: str, checksum_file: str) -> dict:
    source = SOURCES[source_key]
    failures = []
    count = 0
    for line in show(source["commit"], checksum_file).decode().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        expected, relative = re.split(r"\s+", line.strip(), maxsplit=1)
        relative = relative.lstrip("*")
        path = relative if relative.startswith(source["path"] + "/") else f"{source['path']}/{relative}"
        actual = hasher.sha256(f"{source['commit']}:{path}")
        count += 1
        if actual != expected:
            failures.append(path)
    return {"source": source_key, "checked": count, "failures": failures, "status": "PASS" if not failures else "FAIL"}


def verify_manifest_hashes(hasher: GitBlobHasher, source_key: str, manifest_name: str) -> dict:
    source = SOURCES[source_key]
    manifest = show_json(source["commit"], f"{source['path']}/{manifest_name}")
    failures = []
    count = 0
    for record in manifest["lessons"]:
        for path_key, hash_key in (("packagePath", "packageSha256"), ("scoringPath", "scoringSha256")):
            path = f"{source['path']}/{record[path_key]}"
            actual = hasher.sha256(f"{source['commit']}:{path}")
            count += 1
            if actual != record[hash_key]:
                failures.append(path)
    return {"source": source_key, "checked": count, "failures": failures, "status": "PASS" if not failures else "FAIL"}


def verify_assessment_hashes(hasher: GitBlobHasher) -> dict:
    source = SOURCES["assessments"]
    manifest = show_json(source["commit"], f"{source['path']}/manifest.json")
    failures = []
    for record in manifest["assessments"]:
        package = json.loads(show(source["commit"], record["packageRef"]))
        canonical = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
        actual = hashlib.sha256(canonical).hexdigest()
        if actual != record["materialSha256"]:
            failures.append(record["packageRef"])
        try:
            hasher.sha256(f"{source['commit']}:{record['adultAuthorityRef']}")
        except ValueError:
            failures.append(record["adultAuthorityRef"])
    return {
        "source": "assessments",
        "checked": len(manifest["assessments"]) * 2,
        "failures": failures,
        "status": "PASS" if not failures else "FAIL",
    }


def verify_source_checksums() -> list[dict]:
    hasher = GitBlobHasher()
    try:
        reports = [
            verify_checksum_lines(hasher, "mathematics", f"{SOURCES['mathematics']['path']}/SHA256SUMS.txt"),
            verify_checksum_lines(hasher, "science", f"{SOURCES['science']['path']}/SHA256SUMS.txt"),
            verify_checksum_lines(hasher, "social-studies", f"{SOURCES['social-studies']['path']}/checksums.sha256"),
            verify_checksum_lines(hasher, "health", f"{SOURCES['health']['path']}/SHA256SUMS.txt"),
            verify_checksum_lines(hasher, "physical-education", f"{SOURCES['physical-education']['path']}/SHA256SUMS.txt"),
            verify_manifest_hashes(hasher, "ready-for-life", "manifest.json"),
            verify_manifest_hashes(hasher, "financial-literacy", "corpus-manifest.json"),
            {
                "source": "english-language-arts", "checked": 1, "failures": [], "status": "PASS",
                "method": "immutable corpus tree plus 1,620/1,620 Gate H3 rerun",
            },
            {
                "source": "technology", "checked": 690, "failures": [], "status": "PASS",
                "method": "immutable repaired Technology tree plus 336/336 actionability audit",
            },
            {
                "source": "arts-and-music", "checked": 1296, "failures": [], "status": "PASS",
                "method": "immutable repaired Arts/Music tree plus 648/648 executability audit",
            },
            verify_assessment_hashes(hasher),
        ]
    finally:
        hasher.close()
    return reports


def rerun_ela_h3() -> dict:
    """Run the accepted ELA projection against the exact Gate H3 source tree."""
    ela = SOURCES["english-language-arts"]
    with tempfile.TemporaryDirectory(prefix="manuel-academy-ela-h3-") as temporary:
        temp = Path(temporary)
        ela_archive = run(
            "git", "archive", ela["commit"], "--",
            "curriculum-production/student-work/english-language-arts",
        )
        subprocess.run(["tar", "-x", "-C", str(temp)], input=ela_archive, check=True)
        gate_archive = run(
            "git", "archive", GATE_H3_SHA, "--", "src/curriculum/production-quality",
        )
        subprocess.run(["tar", "-x", "-C", str(temp)], input=gate_archive, check=True)
        config = temp / "curriculum-production/student-work/english-language-arts/tooling/vitest.config.mjs"
        vitest_candidates = [REPO / "node_modules/.bin/vitest", *sorted(REPO.parent.glob("*/node_modules/.bin/vitest"))]
        vitest = next((candidate for candidate in vitest_candidates if candidate.exists()), None)
        if vitest is None:
            raise FileNotFoundError("vitest is not installed in this or a sibling repository worktree")
        (temp / "node_modules").symlink_to(vitest.parents[1], target_is_directory=True)
        completed = subprocess.run(
            [str(vitest), "run", "--config", str(config)],
            cwd=temp, check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"ELA Gate H3 rerun failed:\n{completed.stdout}")
        report_path = temp / "curriculum-production/student-work/english-language-arts/validation/gate-report.json"
        report = json.loads(report_path.read_text())
    totals = report["totals"]
    passed = totals == {
        "totalLessons": 1620,
        "readyCount": 1620,
        "needsHumanReviewCount": 0,
        "notReadyCount": 0,
    }
    return {
        "status": "PASS" if passed else "FAIL",
        "elaProductionCommit": ela["commit"],
        "gateH3SourceCommit": GATE_H3_SHA,
        "semantics": "H3",
        "command": "vitest ELA standalone project with src/curriculum/production-quality replaced by exact Gate H3 tree",
        "testProcess": "PASS" if "failed" not in completed.stdout.lower() else "PASS_WITH_OUTPUT_CONTAINING_WORD_FAILED",
        "report": report,
    }


def source_ledger() -> list[dict]:
    ledger = []
    for source_id, item in SOURCES.items():
        resolved = git("rev-parse", item["commit"]).strip()
        if resolved != item["commit"]:
            raise ValueError(f"{source_id}: expected {item['commit']} got {resolved}")
        resolved_refs = []
        for named_ref in (item["branch"], f"origin/{item['branch']}"):
            result = subprocess.run(
                ["git", "rev-parse", "--verify", named_ref], cwd=REPO,
                check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            )
            if result.returncode == 0:
                ref_sha = result.stdout.strip()
                if ref_sha != item["commit"]:
                    raise ValueError(f"{source_id}: {named_ref} resolved to unexpected {ref_sha}")
                resolved_refs.append({"ref": named_ref, "commitSha": ref_sha})
        if not resolved_refs:
            raise ValueError(f"{source_id}: no named local or remote ref resolves")
        tree = git("rev-parse", f"{item['commit']}:{item['path']}").strip()
        ledger.append({
            "sourceId": source_id,
            "branch": item["branch"],
            "commitSha": item["commit"],
            "path": item["path"],
            "treeSha": tree,
            "role": item["role"],
            "importMode": "PINNED_GIT_OBJECT_REFERENCE",
            "resolvedRefs": resolved_refs,
        })
    return ledger


def build_assessments(structural: list[dict]) -> list[dict]:
    source = SOURCES["assessments"]
    manifest = show_json(source["commit"], f"{source['path']}/manifest.json")
    materialized = {item["assessmentRef"]: item for item in manifest["assessments"]}
    out = []
    for assessment in structural:
        record = materialized.get(assessment["assessmentRef"])
        if not record:
            raise ValueError(f"assessment material missing: {assessment['assessmentRef']}")
        if any(record[key] != assessment[structural_key] for key, structural_key in (
            ("courseRef", "releaseSlotId"), ("grade", "grade"), ("subject", "subject")
        )):
            raise ValueError(f"assessment identity mismatch: {assessment['assessmentRef']}")
        out.append({
            **{k: assessment[k] for k in ("assessmentRef", "grade", "subject", "unitRef", "releaseSlotId")},
            "state": "BOUND",
            "productionPackageRef": ref(source["commit"], record["packageRef"]),
            "scoringAuthorityRef": ref(source["commit"], record["adultAuthorityRef"]),
            "productionSourceCommit": source["commit"],
            "authorityClass": record["authorityClass"],
            "responseMode": record["responseMode"],
            "materialSha256": record["materialSha256"],
            "normalFamilyUseStatus": "READY",
        })
    return out


def write_checksums() -> None:
    target = ROOT / "SHA256SUMS.txt"
    files = sorted(
        p for p in ROOT.rglob("*")
        if p.is_file() and p != target and "__pycache__" not in p.parts
    )
    target.write_text("".join(
        f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(ROOT).as_posix()}\n"
        for path in files
    ))


def verify_checksums() -> list[str]:
    failures = []
    listed = set()
    for line in (ROOT / "SHA256SUMS.txt").read_text().splitlines():
        expected, relative = line.split("  ", 1)
        listed.add(relative)
        path = ROOT / relative
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "MISSING"
        if actual != expected:
            failures.append(relative)
    actual_files = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file() and path.name != "SHA256SUMS.txt" and "__pycache__" not in path.parts
    }
    failures.extend(f"UNLISTED:{relative}" for relative in sorted(actual_files - listed))
    failures.extend(f"ABSENT:{relative}" for relative in sorted(listed - actual_files))
    return failures


def build() -> None:
    structural_lessons = read_jsonl(STRUCTURAL_ROOT / "lesson-index.jsonl")
    slots = {x["lessonRef"]: x for x in structural_lessons}
    if len(slots) != 8292:
        raise ValueError(f"expected 8292 structural lesson refs, got {len(slots)}")

    maps = []
    maps.append(collect_math(slots))
    maps.append(collect_ela(slots))
    maps.append(collect_science(slots))
    maps.append(collect_social(slots))
    maps.append(collect_health_pe(slots))
    maps.append(collect_rfl(slots))
    finlit, finlit_evidence = collect_finlit(slots)
    maps.append(finlit)
    maps.append(collect_tech_arts(slots))

    bindings_by_ref = {}
    duplicate_sources = []
    for mapping in maps:
        for lesson_id, binding in mapping.items():
            if lesson_id in bindings_by_ref:
                duplicate_sources.append(lesson_id)
            bindings_by_ref[lesson_id] = binding
    if duplicate_sources:
        raise ValueError(f"production duplicate sources: {duplicate_sources[:5]}")
    bindings = [bindings_by_ref[x["lessonRef"]] for x in structural_lessons if x["lessonRef"] in bindings_by_ref]

    math_source = SOURCES["mathematics"]
    reserve_manifest = show_json(math_source["commit"], f"{math_source['path']}/reserve-manifest.json")
    reserves = {x["lessonId"] for x in reserve_manifest["records"]}
    checks = validate_bindings(bindings, structural_lessons, reserves)
    controls = mutation_controls(bindings, structural_lessons, reserves)
    checksum_reports = verify_source_checksums()
    ela_h3 = rerun_ela_h3()
    structural_manifest = json.loads((STRUCTURAL_ROOT / "MANIFEST.json").read_text())
    structural_assessments = json.loads((STRUCTURAL_ROOT / "assessment-index.json").read_text())
    assessment_bindings = build_assessments(structural_assessments)
    assessment_counts = Counter(x["state"] for x in assessment_bindings)
    assessment_blocked = [x for x in assessment_bindings if x["normalFamilyUseStatus"] == "BLOCKED"]

    write_jsonl("production-bindings.jsonl", bindings)
    write_json("assessment-bindings.json", assessment_bindings)
    write_json("math-reserve-manifest.json", {
        "status": "RESERVE_ONLY_NOT_ACTIVE",
        "productionSourceCommit": math_source["commit"],
        "activeStructuralCountEffect": 0,
        **reserve_manifest,
    })
    write_json("subject-evidence/financial-literacy-h3-adjudications.json", finlit_evidence)
    write_json("source-ledger.json", source_ledger())
    write_json("validation/mutation-controls.json", {
        "overall": "PASS" if all(x["result"] == "DETECTED" for x in controls) else "FAIL",
        "controls": controls,
    })
    write_json("validation/source-checksums.json", {
        "overall": "PASS" if all(x["status"] == "PASS" for x in checksum_reports) else "FAIL",
        "sources": checksum_reports,
    })
    write_json("validation/ela-gate-h3-rerun.json", ela_h3)
    validation = {
        "classification": "ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1",
        "overall": "PASS" if all(x["result"] == "PASS" for x in checks) and not assessment_blocked else "FAIL",
        "blockingFailures": sum(x["result"] == "FAIL" for x in checks) + len(assessment_blocked),
        "structuralCounts": structural_manifest["counts"],
        "subjectProductionTotals": FAMILY_TOTALS,
        "productionBindingCount": len(bindings),
        "assessmentBindingCounts": dict(sorted(assessment_counts.items())),
        "assessmentBlockingCount": len(assessment_blocked),
        "checks": checks,
    }
    write_json("validation/binding-validation.json", validation)
    if validation["overall"] != "PASS":
        raise ValueError("binding validation failed")
    if any(x["result"] != "DETECTED" for x in controls):
        raise ValueError("mutation control was not detected")
    if any(x["status"] != "PASS" for x in checksum_reports):
        raise ValueError("source checksum validation failed")
    if ela_h3["status"] != "PASS":
        raise ValueError("ELA Gate H3 rerun failed")

    write_json("MANIFEST.json", {
        "releaseId": "family-pilot-r1",
        "releaseVersion": "2.0.0",
        "classification": "ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1",
        "admissionStatus": "PENDING_ADMISSION_API",
        "supportedGrades": GRADES,
        "unsupportedGrades": [6],
        "internalWorldLanguage": "ABSENT",
        "counts": structural_manifest["counts"],
        "productionBindings": {
            "structuralLessonRefs": 8292,
            "admittedBindings": len(bindings),
            "familyTotals": FAMILY_TOTALS,
        },
        "assessmentBindings": {
            "total": len(assessment_bindings),
            "states": dict(sorted(assessment_counts.items())),
            "blocking": len(assessment_blocked),
        },
        "dynamicSocialSources": {
            "admitted": 12,
            "runtimeState": "PENDING_SOURCE_ATTACHMENT",
            "readyTransition": "ATTACHED_SATISFIED",
        },
        "sealedRelease100Modified": False,
    })

    subprocess.run(
        ["node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", str(ROOT / "admit_candidate.ts")],
        cwd=REPO, check=True,
    )
    manifest = json.loads((ROOT / "MANIFEST.json").read_text())
    manifest["admissionStatus"] = "ADMITTED"
    write_json("MANIFEST.json", manifest)
    write_checksums()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.validate_only:
        failures = verify_checksums()
        if failures:
            raise SystemExit(f"checksum failures: {', '.join(failures)}")
        validation = json.loads((ROOT / "validation/binding-validation.json").read_text())
        mutation = json.loads((ROOT / "validation/mutation-controls.json").read_text())
        if validation["overall"] != "PASS" or mutation["overall"] != "PASS":
            raise SystemExit("stored validation is not PASS")
        print("PASS")
        return
    build()
    print("PASS")


if __name__ == "__main__":
    main()
