"""The safety floor applied to every Science student-work package.

Nothing here is authored. Every clause is lifted verbatim from a committed,
reviewed source and carries the commit it came from, so the validator can
re-derive the floor and fail if a clause ever drifts from its source:

Grades 3-5 read a restated variant of each prohibition and stop condition, held
in `blocks.ELEMENTARY_SAFETY_VARIANTS` and attached here as `elementary_text`.
Every variant is strictly more restrictive than the adult clause it replaces,
and the adult clause still reaches the guardian on the scoring sheet. The build
fails if a clause has no variant.

  hs-h2   mac/hs912-science-h2 @ 265ea3a — the ten non-disableable
          prohibitions, the required privacy declarations, and the global stop
          conditions carried by every lesson in the H2 package.
  g34     mac/g34-science-social-r1 @ 4c6ca4e — the elementary investigation
          clauses (adult approval, the no mains/flame/chemical prohibition, the
          text-only equal-credit path, the no-camera rule) added by the G3/4
          safety review.

Why the floor exists. The canonical Grade 5/7/8 Science source carries four
generic safety bullets, no equal-credit investigation alternative, and no
guardian acknowledgement — the two protections both sibling packages carry.
Rather than author new safety policy for those grades, the floor imports the
reviewed clauses from the packages that already have them. The floor is only
ever additive: it never relaxes a clause a lesson already states.
"""

from __future__ import annotations

from collections import Counter

from blocks import ELEMENTARY_SAFETY_VARIANTS
from sources import (
    CANONICAL_COMMIT,
    G34_COMMIT,
    HS_H2_COMMIT,
    HS_POLICY_SET_PATH,
    SourceReader,
)

FLOOR_VERSION = "1.0.0"

# Phases whose work is hands-on or data-bearing. Everything else is desk work.
DATA_BEARING_PHASES = frozenset(
    {"Investigation", "Investigation or close reading", "Performance task build"}
)

SUPERVISION_PLAIN_WORDS = {
    "none": "You may work on this on your own. An adult should know you are doing it.",
    "nearby-adult": "An adult must be within earshot and able to reach you. Do not start until they are.",
    "direct-adult": "An adult must be beside you, watching, for the whole activity. Do not start without them.",
    "adult-approved-and-nearby": (
        "An adult reviews and approves this activity before you begin, and stays within earshot "
        "while you do it. Do not start until they have."
    ),
}


def _dedupe(items):
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _common_stop_conditions(hs_lessons_by_course: dict[str, list[dict]]) -> list[str]:
    """Stop conditions carried by every High School lesson, in package order.

    Taken as the intersection over all H2 lessons so a condition that only some
    investigations declare never gets promoted into the universal floor.
    """
    lesson_sets = []
    order_votes: Counter[tuple[str, int]] = Counter()
    for course_id in sorted(hs_lessons_by_course):
        for lesson in hs_lessons_by_course[course_id]:
            conditions = list(lesson.get("safety_privacy", {}).get("stop_conditions", []))
            lesson_sets.append(set(conditions))
            for index, condition in enumerate(conditions):
                order_votes[(condition, index)] += 1
    if not lesson_sets:
        return []
    universal = set.intersection(*lesson_sets)

    def position(condition: str) -> int:
        candidates = [
            (count, index)
            for (text, index), count in order_votes.items()
            if text == condition
        ]
        return max(candidates)[1]

    return sorted(universal, key=position)


def _elementary_clauses(
    g34_lessons: list[dict], canonical_lessons: list[dict]
) -> list[str]:
    """G3/4 safety clauses the canonical Grade 5/7/8 source does not carry."""
    g34_clauses = set()
    for lesson in g34_lessons:
        g34_clauses.update(lesson.get("safety_and_privacy", []))
    canonical_clauses = set()
    for lesson in canonical_lessons:
        canonical_clauses.update(lesson.get("safety_and_privacy", []))
    extra = g34_clauses - canonical_clauses

    ordered: list[str] = []
    for lesson in g34_lessons:
        for clause in lesson.get("safety_and_privacy", []):
            if clause in extra and clause not in ordered:
                ordered.append(clause)
    return ordered


def build_safety_floor(reader: SourceReader, lessons_by_course: dict[str, list[dict]]) -> dict:
    policy_set = reader.read_json("hs912-science-h2", HS_H2_COMMIT, HS_POLICY_SET_PATH)
    policy_safety = policy_set["safety_privacy"]

    hs_courses = {
        course_id: lessons
        for course_id, lessons in lessons_by_course.items()
        if course_id.startswith("ma-hs")
    }
    g34_lessons = [
        lesson
        for course_id in ("ma-g3-science", "ma-g4-science")
        for lesson in lessons_by_course.get(course_id, [])
    ]
    canonical_lessons = [
        lesson
        for course_id in ("ma-g5-science", "ma-g7-science", "ma-g8-science")
        for lesson in lessons_by_course.get(course_id, [])
    ]

    g34_alternatives = _dedupe(
        lesson["investigation_alternative"]
        for lesson in g34_lessons
        if lesson.get("investigation_alternative")
    )
    g34_guardian_acks = _dedupe(
        lesson["guardian_safety_ack"]
        for lesson in g34_lessons
        if lesson.get("guardian_safety_ack")
    )

    prohibitions = policy_safety["non_disableable_prohibitions"]
    stop_conditions = _common_stop_conditions(hs_courses)
    missing = [
        text
        for text in [*prohibitions, *stop_conditions]
        if text not in ELEMENTARY_SAFETY_VARIANTS
    ]
    if missing:
        raise SystemExit(
            "safety floor clause has no grades 3-5 variant, so the build would ship adult "
            "wording to an elementary learner:\n  - " + "\n  - ".join(missing)
        )

    return {
        "floor_version": FLOOR_VERSION,
        "attribution": {
            "hs-h2": {
                "branch": "mac/hs912-science-h2",
                "commit": HS_H2_COMMIT,
                "note": "H2 safety fix. The failed base candidate f58f7f1 is not read by this build.",
            },
            "g34": {
                "branch": "mac/g34-science-social-r1",
                "commit": G34_COMMIT,
                "note": "Grade 3/4 safety review fix.",
            },
            "canonical": {
                "branch": "curriculum release 1.0.0",
                "commit": CANONICAL_COMMIT,
                "note": "Grade 5/7/8 immutable import; carries no investigation alternative of its own.",
            },
        },
        "non_disableable_prohibitions": [
            {
                "text": text,
                "source": "hs-h2",
                "elementary_text": ELEMENTARY_SAFETY_VARIANTS[text],
            }
            for text in prohibitions
        ],
        "required_privacy_declarations": [
            {"text": text, "source": "hs-h2"}
            for text in policy_safety["required_privacy_declarations"]
        ],
        "global_stop_conditions": [
            {
                "text": text,
                "source": "hs-h2",
                "elementary_text": ELEMENTARY_SAFETY_VARIANTS[text],
            }
            for text in stop_conditions
        ],
        "elementary_investigation_clauses": [
            {"text": text, "source": "g34"}
            for text in _elementary_clauses(g34_lessons, canonical_lessons)
        ],
        "equal_credit_alternative_clauses": [
            {"text": text, "source": "g34"} for text in g34_alternatives
        ],
        "guardian_acknowledgement_clauses": [
            {"text": text, "source": "g34"} for text in g34_guardian_acks
        ],
        "imported_into": {
            "ma-g5-science": ["elementary_investigation_clauses", "equal_credit_alternative_clauses",
                              "guardian_acknowledgement_clauses", "global_stop_conditions"],
            "ma-g7-science": ["elementary_investigation_clauses", "equal_credit_alternative_clauses",
                              "guardian_acknowledgement_clauses", "global_stop_conditions"],
            "ma-g8-science": ["elementary_investigation_clauses", "equal_credit_alternative_clauses",
                              "guardian_acknowledgement_clauses", "global_stop_conditions"],
            "ma-g3-science": ["global_stop_conditions"],
            "ma-g4-science": ["global_stop_conditions"],
        },
        "applies_to_every_course": [
            "non_disableable_prohibitions",
            "required_privacy_declarations",
        ],
    }
