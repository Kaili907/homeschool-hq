"""Pinned read-only access to the three committed Science curriculum sources.

Nothing in this module writes. Every source is read at a pinned commit so the
build is reproducible regardless of where the source branches move next.

  grade 3 / 4          mac/g34-science-social-r1 @ 4c6ca4e (the reviewed fix)
  grade 5 / 7 / 8      canonical release 1.0.0 @ 4056e31 (immutable import)
  high school 9-12     mac/hs912-science-h2 @ 265ea3a (H2 safety fix)

The failed base High School candidate (f58f7f1) is recorded here only so the
validator can prove the build did not read it.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]

G34_COMMIT = "4c6ca4ef904c0b79dc81f85e3cfed946c20c98d6"
CANONICAL_COMMIT = "4056e31d8beb36622be5ac27ea7f20145266343b"
HS_H2_COMMIT = "265ea3a75740ccbeea0dfa02c723514779def052"
HS_FAILED_BASE_COMMIT = "f58f7f1eec0a0f93801df4978c00511ec98cc95e"

CONTENT_ROOT = "curriculum-content/manuel-academy/1.0.0/grades"
HS_ROOT = "curriculum-authoring/full-family-highschool-9-12/subjects/science"


@dataclass(frozen=True)
class SourceRef:
    """One pinned blob the build read, recorded in MANIFEST.json."""

    lineage: str
    commit: str
    path: str
    sha256: str
    bytes: int


def _git_show(commit: str, path: str) -> bytes:
    return subprocess.run(
        ["git", "show", f"{commit}:{path}"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    ).stdout


class SourceReader:
    """Reads pinned blobs and records every read for the manifest."""

    def __init__(self) -> None:
        self._refs: dict[str, SourceRef] = {}

    def read(self, lineage: str, commit: str, path: str) -> bytes:
        raw = _git_show(commit, path)
        self._refs[f"{commit}:{path}"] = SourceRef(
            lineage=lineage,
            commit=commit,
            path=path,
            sha256=hashlib.sha256(raw).hexdigest(),
            bytes=len(raw),
        )
        return raw

    def read_json(self, lineage: str, commit: str, path: str):
        return json.loads(self.read(lineage, commit, path))

    def read_jsonl(self, lineage: str, commit: str, path: str) -> list[dict]:
        raw = self.read(lineage, commit, path).decode("utf-8")
        return [json.loads(line) for line in raw.splitlines() if line.strip()]

    def refs(self) -> list[SourceRef]:
        return [self._refs[key] for key in sorted(self._refs)]


# Course catalogue, in build order. `family` selects the source adapter.
COURSES: tuple[dict, ...] = (
    {
        "course_id": "ma-g3-science",
        "title": "Grade 3 Science",
        "grade": 3,
        "band": "elementary",
        "family": "k8",
        "lineage": "g34-committed",
        "commit": G34_COMMIT,
        "lessons_path": f"{CONTENT_ROOT}/grade-3/courses/science/lessons.jsonl",
        "units_path": f"{CONTENT_ROOT}/grade-3/courses/science/units.json",
    },
    {
        "course_id": "ma-g4-science",
        "title": "Grade 4 Science",
        "grade": 4,
        "band": "elementary",
        "family": "k8",
        "lineage": "g34-committed",
        "commit": G34_COMMIT,
        "lessons_path": f"{CONTENT_ROOT}/grade-4/courses/science/lessons.jsonl",
        "units_path": f"{CONTENT_ROOT}/grade-4/courses/science/units.json",
    },
    {
        "course_id": "ma-g5-science",
        "title": "Grade 5 Science",
        "grade": 5,
        "band": "elementary",
        "family": "k8",
        "lineage": "canonical-1.0.0",
        "commit": CANONICAL_COMMIT,
        "lessons_path": f"{CONTENT_ROOT}/grade-5/courses/science/lessons.jsonl",
        "units_path": f"{CONTENT_ROOT}/grade-5/courses/science/units.json",
    },
    {
        "course_id": "ma-g7-science",
        "title": "Grade 7 Science",
        "grade": 7,
        "band": "middle",
        "family": "k8",
        "lineage": "canonical-1.0.0",
        "commit": CANONICAL_COMMIT,
        "lessons_path": f"{CONTENT_ROOT}/grade-7/courses/science/lessons.jsonl",
        "units_path": f"{CONTENT_ROOT}/grade-7/courses/science/units.json",
    },
    {
        "course_id": "ma-g8-science",
        "title": "Grade 8 Science",
        "grade": 8,
        "band": "middle",
        "family": "k8",
        "lineage": "canonical-1.0.0",
        "commit": CANONICAL_COMMIT,
        "lessons_path": f"{CONTENT_ROOT}/grade-8/courses/science/lessons.jsonl",
        "units_path": f"{CONTENT_ROOT}/grade-8/courses/science/units.json",
    },
    {
        "course_id": "ma-hs9-biology",
        "title": "High School Biology (Grade 9)",
        "grade": 9,
        "band": "high",
        "family": "hs",
        "lineage": "hs912-science-h2",
        "commit": HS_H2_COMMIT,
        "lessons_path": f"{HS_ROOT}/authoring-set/lessons/ma-hs9-biology.lessons.jsonl",
        "units_path": f"{HS_ROOT}/authoring-set/units.json",
    },
    {
        "course_id": "ma-hs10-chemistry",
        "title": "High School Chemistry (Grade 10)",
        "grade": 10,
        "band": "high",
        "family": "hs",
        "lineage": "hs912-science-h2",
        "commit": HS_H2_COMMIT,
        "lessons_path": f"{HS_ROOT}/authoring-set/lessons/ma-hs10-chemistry.lessons.jsonl",
        "units_path": f"{HS_ROOT}/authoring-set/units.json",
    },
    {
        "course_id": "ma-hs11-physics",
        "title": "High School Physics (Grade 11)",
        "grade": 11,
        "band": "high",
        "family": "hs",
        "lineage": "hs912-science-h2",
        "commit": HS_H2_COMMIT,
        "lessons_path": f"{HS_ROOT}/authoring-set/lessons/ma-hs11-physics.lessons.jsonl",
        "units_path": f"{HS_ROOT}/authoring-set/units.json",
    },
    {
        "course_id": "ma-hs12-earth-space-environmental",
        "title": "High School Earth, Space, and Environmental Science (Grade 12)",
        "grade": 12,
        "band": "high",
        "family": "hs",
        "lineage": "hs912-science-h2",
        "commit": HS_H2_COMMIT,
        "lessons_path": f"{HS_ROOT}/authoring-set/lessons/ma-hs12-earth-space-environmental.lessons.jsonl",
        "units_path": f"{HS_ROOT}/authoring-set/units.json",
    },
)

HS_POLICY_SET_PATH = f"{HS_ROOT}/authoring-set/policy-set.json"
HS_RESOURCES_PATH = f"{HS_ROOT}/authoring-set/resources.json"
HS_SAFETY_FRAMEWORK_PATH = f"{HS_ROOT}/lab-safety-framework.md"
