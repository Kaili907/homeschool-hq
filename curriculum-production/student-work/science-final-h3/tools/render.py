"""Markdown rendering for the Science student-work packages.

Two audiences, two files. `student_sheet` is what the learner reads and writes
on; it carries the safety brief, the blank data sheet, both alternative paths,
the analysis questions, and the rubric. `scoring_sheet` is the adult's copy: the
scoring authority, the expected reasoning per question, the reteach routes, and
the guardian safety record.

Shared blocks are resolved and printed in full here — a learner reading a safety
brief must see the prohibitions, not a pointer to them. The student sheet never
contains an expected answer or a filled-in value.
"""

from __future__ import annotations

from safety_brief import resolve

BLANK_CELL = " "


def _bullets(items) -> str:
    return "\n".join(f"- {item}" for item in items if item)


def _numbered(items) -> str:
    return "\n".join(f"{index}. {item}" for index, item in enumerate(items, start=1) if item)


def _write_here(label: str) -> str:
    return f"**{label}**\n\n> \n"


def _blank_table(columns: list[str], rows: int) -> str:
    head = "| " + " | ".join(columns) + " |"
    rule = "| " + " | ".join("---" for _ in columns) + " |"
    body = "\n".join("| " + " | ".join(BLANK_CELL for _ in columns) + " |" for _ in range(rows))
    return "\n".join([head, rule, body])


def _rubric_table(shared: dict) -> str:
    columns = ["Criterion", *shared["lists"]["rubric-scale"]]
    head = "| " + " | ".join(columns) + " |"
    rule = "| " + " | ".join("---" for _ in columns) + " |"
    rows = [
        "| "
        + " | ".join(
            [
                criterion["criterion"],
                criterion["not_yet"],
                criterion["approaching"],
                criterion["meets"],
                criterion["exceeds"],
            ]
        )
        + " |"
        for criterion in shared["rubric_criteria"]
    ]
    return "\n".join([head, rule, *rows])


# ---------------------------------------------------------------------------
# Student sheet
# ---------------------------------------------------------------------------


def _safety_section(brief: dict) -> str:
    lines = [
        "## Safety — read this before you touch anything",
        "",
        brief["headline"],
        "",
        f"**Who has to be with you.** {brief['supervision_plain_words']}",
        "",
        f"**Protective equipment.** {brief['required_ppe']}",
        "",
    ]

    if brief.get("hazards"):
        lines += ["### What could go wrong, and what stops it", ""]
        for hazard in brief["hazards"]:
            lines.append(f"- **{hazard['kind'].title()} hazard.** {hazard['description']}")
            lines.append(f"  - What stops it: {hazard['mitigation']}")
        lines.append("")
    elif brief.get("hazard_note"):
        lines += ["### Hazards", "", brief["hazard_note"], ""]

    if brief.get("safe_order"):
        lines += [
            "### Do these steps in this order — do not reorder them",
            "",
            _numbered(brief["safe_order"]),
            "",
        ]
    elif brief.get("safe_order_note"):
        lines += ["### Order of work", "", brief["safe_order_note"], ""]

    if brief.get("lesson_safety_clauses_verbatim"):
        lines += [
            "### This lesson's safety rules",
            "",
            _bullets(brief["lesson_safety_clauses_verbatim"]),
            "",
        ]
    if brief.get("imported_floor_clauses"):
        lines += [
            "### Rules that apply to every Science lesson",
            "",
            _bullets(brief["imported_floor_clauses"]),
            "",
        ]

    lines += [
        "### Stop at once if any of these happens",
        "",
        _bullets(brief["stop_conditions"]),
        "",
        "### Never, in any lesson",
        "",
        _bullets(brief["prohibitions"]),
        "",
        f"**Clearing up.** {brief['disposal']}",
        "",
        f"**Stopping is allowed.** {brief['pause_rule']} {brief['equal_credit_rule']}",
        "",
    ]

    if brief.get("sensitivity"):
        lines += [_bullets(brief["sensitivity"]), ""]
    if brief.get("privacy"):
        lines += ["### What is recorded about you", "", _bullets(brief["privacy"]), ""]
    if brief.get("guardian_acknowledgement"):
        lines += ["### For the adult, before the session", "", brief["guardian_acknowledgement"], ""]
    return "\n".join(lines)


def _data_sheet_section(package: dict, shared: dict) -> str:
    sheet = package["data_sheet"]
    text = shared["text"]
    lines = [
        "## Your data sheet",
        "",
        f"_{text[sheet['no_supplied_values_rule_ref']]}_",
        "",
        "**The task.** " + sheet["lesson_task_verbatim"],
        "",
        _write_here(text[sheet["prediction_prompt_ref"]]),
    ]

    if sheet["plan"]:
        lines += ["### Your plan — the adult approves this before anything is touched", ""]
        for field in sheet["plan"]:
            lines.append(f"**{field['field']}.** {field['instruction']}")
            lines.append("")
            lines.append("> ")
            lines.append("")

    record = sheet["record_table"]
    provenance = sheet["provenance_table"]
    lines += [
        "### Record as you go",
        "",
        f"_{text[record['rule_ref']]}_",
        "",
        _blank_table(record["columns"], record["blank_rows"]),
        "",
        "### Where each value came from",
        "",
        f"_{text[provenance['rule_ref']]}_",
        "",
        _blank_table(provenance["columns"], provenance["blank_rows"]),
        "",
        _write_here(text[sheet["limitations_prompt_ref"]]),
        "",
        _write_here(sheet["check_and_revise_prompt"]),
    ]
    return "\n".join(lines)


def _alternatives_section(package: dict, shared: dict) -> str:
    supplied = package["supplied_data_alternative"]
    equal_credit = package["equal_credit_safe_alternative"]
    text = shared["text"]
    lists = shared["lists"]

    lines = [
        "## If you are not doing the hands-on activity",
        "",
        "### Path A — this lesson needs no special equipment"
        if equal_credit.get("is_no_equipment_note")
        else "### Path A — the alternative activity (same credit)",
        "",
        equal_credit["text"],
        "",
    ]
    if equal_credit.get("clarification_ref"):
        lines += [f"_{text[equal_credit['clarification_ref']]}_", ""]
    if equal_credit.get("derived_task"):
        lines += [
            "**Do this instead — the whole lesson on paper:** " + equal_credit["derived_task"],
            "",
            f"_{text[equal_credit['derived_task_note_ref']]}_",
            "",
        ]
    if equal_credit.get("unit_path_text"):
        lines += [
            "**The hands-on day in this unit, and its equal-credit alternative:** "
            + equal_credit["unit_path_text"],
            "",
        ]
    lines += [
        _bullets(lists[equal_credit["guarantees_ref"]]),
        "",
        text[equal_credit["how_to_choose_ref"]],
        "",
        "### Path B — work from supplied data (same credit)",
        "",
        text[supplied["headline_ref"]],
        "",
        text[supplied["how_ref"]],
        "",
        f"_{text[supplied['supplies_no_numbers_ref']]}_",
        "",
        "For every supplied value, record all of this:",
        "",
        _bullets(lists[supplied["provenance_required_ref"]]),
        "",
    ]
    if supplied["source_declared_provenance"]:
        lines += [
            "**What this lesson's data is, according to the curriculum:** "
            + supplied["source_declared_provenance"],
            "",
        ]
    if supplied["course_data_source_reference"]:
        lines += [
            "**Where to find the published data:** see `"
            + supplied["course_data_source_reference"]
            + "` in the course resource list. The family retrieves it; no third-party content is "
            "copied into this package.",
            "",
        ]
    lines += [text[supplied["scoring_ref"]], "", text[equal_credit["equal_credit_rule_ref"]], ""]
    return "\n".join(lines)


def _questions_section(package: dict) -> str:
    lines = [
        "## Analysis questions",
        "",
        "Answer every question. Write in the space under each one.",
        "",
    ]
    for question in package["analysis_questions"]:
        lines.append(f"**{question['id'].upper()}.** {question['prompt']}")
        lines.append("")
        lines.append("> ")
        lines.append("")
    return "\n".join(lines)


def _rubric_section(package: dict, shared: dict) -> str:
    rubric = package["rubric"]
    text = shared["text"]
    return "\n".join(
        [
            "## How this is scored",
            "",
            _rubric_table(shared),
            "",
            text[rubric["threshold_ref"]],
            "",
            text[rubric["equal_credit_rule_ref"]],
            "",
            "**You have met the target when:**",
            "",
            _bullets(rubric["success_criteria_verbatim"]),
            "",
        ]
    )


def student_sheet(package: dict, shared: dict, floor: dict) -> str:
    brief = resolve(package["safety_brief"], floor, package["band"])
    text = shared["text"]
    lines = [
        f"# {package['title']}",
        "",
        f"**{package['course_title']}** · Unit {package['unit_number']}: {package['unit_title']} · "
        f"Day {package['day_in_unit']} of the unit (course day {package['course_day']}) · "
        f"about {package['estimated_minutes']} minutes",
        "",
        f"**Today's focus:** {package['focus']}",
        "",
        f"**Unit question:** {package['essential_question']}",
        "",
    ]
    if package.get("unit_phenomenon"):
        lines += [f"**{package['unit_phenomenon']}**", ""]
    lines += [
        "**What you are aiming at:**",
        "",
        _bullets(package["learning_objectives"]),
        "",
        "**Materials:**",
        "",
        _bullets(package["materials"]),
        "",
        _safety_section(brief),
        _data_sheet_section(package, shared),
        "",
        _alternatives_section(package, shared),
        _questions_section(package),
        _rubric_section(package, shared),
        "## If you get stuck",
        "",
        _bullets(shared["lists"][package["remediation"]["student_visible_if_stuck_ref"]]),
        "",
        "## Going further (optional)",
        "",
        _bullets(package["extension"]["options"]),
        "",
        f"_{text[package['extension']['never_ref']]}_",
        "",
        "---",
        "",
        f"_Package `{package['package_id']}` · lesson `{package['lesson_id']}` · built from "
        f"`{package['source']['lineage']}` at `{package['source']['commit'][:7]}`. No observation, "
        "measurement, or expected result is supplied anywhere in this sheet._",
        "",
    ]
    return "\n".join(lines)


def _correctness_section(package: dict, shared: dict) -> str:
    """The adult-facing content key. Never rendered on a student sheet."""
    authority = package["scientific_correctness_authority"]
    text = shared["text"]
    lines = [
        "## Scientific correctness authority for this topic",
        "",
        text[authority["headline_ref"]],
        "",
        f"_Topic `{authority['topic_key']}` · forms in force: "
        f"{', '.join(f'`{form}`' for form in authority['authority_forms'])} · authored in "
        f"`{authority['authored']['file']}`._",
        "",
    ]
    if authority["fixed_facts"]:
        lines += [
            "**Fixed for this topic.** These are settled, and work that contradicts one is `Not yet` "
            "on Scientific correctness:",
            "",
            _bullets(authority["fixed_facts"]),
            "",
        ]
    lines += [
        "**Accepted relationships and models.** What this lesson's learning target asserts:",
        "",
        _bullets(authority["relationships"]),
        "",
    ]
    if authority["accepted_alternative_framings"]:
        lines += [
            "**Also correct.** Accept any of these framings — do not require the wording above:",
            "",
            _bullets(authority["accepted_alternative_framings"]),
            "",
        ]
    lines += [
        "**Disqualifying errors.** Each of these is `Not yet` on Scientific correctness however well "
        "the reasoning is documented and however complete the evidence is:",
        "",
        _bullets(authority["disqualifying_errors"]),
        "",
        "**Grade boundary.** " + authority["out_of_scope"],
        "",
    ]
    supplied = authority.get("supplied_data_answer_authority")
    if supplied:
        lines += [
            "**Data the learner did not generate.**",
            "",
            text[supplied["rule_ref"]],
            "",
            f"- Answer authority: {supplied['authority_is']}.",
            f"- Named data-source resource: `{supplied['data_source_resource']}` "
            f"(scope: {supplied['resource_scope']}).",
            "",
            "Provenance the curriculum source declares for this lesson, verbatim:",
            "",
            f"> {supplied['source_declared_provenance']}",
            "",
        ]
    if authority.get("investigation_rule_ref"):
        lines += [
            "**Investigation day — the key bounds the conclusion, never the observations.**",
            "",
            text[authority["investigation_rule_ref"]],
            "",
        ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Scoring sheet
# ---------------------------------------------------------------------------


def scoring_sheet(package: dict, shared: dict, floor: dict) -> str:
    expected = package["expected_reasoning"]
    remediation = package["remediation"]
    guardian = package["guardian_record"]
    text = shared["text"]
    reasoning = shared["expected_reasoning_by_question_kind"]

    lines = [
        f"# Scoring authority — {package['title']}",
        "",
        f"**{package['course_title']}** · Unit {package['unit_number']}: {package['unit_title']} · "
        f"Day {package['day_in_unit']} · lesson `{package['lesson_id']}`",
        "",
        "> Adult copy. Do not give this to the learner before the work is submitted.",
        "",
        "## There is no answer key, and that is deliberate",
        "",
        text[expected["no_fixed_answer_key_ref"]],
        "",
        "**Scoring guidance carried verbatim from the curriculum source:**",
        "",
        f"> {expected['source_scoring_guidance_verbatim']}",
        "",
        _correctness_section(package, shared),
        "",
        "## What a complete response contains, question by question",
        "",
    ]
    for item in expected["per_question"]:
        lines += [
            f"**{item['id'].upper()} — {item['kind'].replace('_', ' ').lower()}.** "
            f"_Serves objective {item['objective_index'] + 1}:_ "
            f"{package['learning_objectives'][item['objective_index']]}",
            "",
            reasoning[item["complete_response_contains_ref"]],
            "",
        ]

    lines += [
        "## Non-negotiables",
        "",
        _bullets(shared["lists"][expected["non_negotiables_ref"]]),
        "",
        "## Rubric",
        "",
        "The full four-level rubric is in `policy/scoring-and-safety-policy.md` and is printed in "
        "full on the learner's own sheet. It is scored against this lesson's success criteria:",
        "",
        _bullets(package["rubric"]["success_criteria_verbatim"]),
        "",
        text[package["rubric"]["threshold_ref"]],
        "",
        "## Reteach routes",
        "",
        _bullets(
            f"**{route['signal']}** — {route['adult_action']}"
            for route in remediation["adult_routes"]
        ),
        "",
        f"_{text[remediation['reteach_never_ref']]}_",
        "",
        "**Mastery rule:** " + (remediation["mastery_rule_verbatim"] or "See course policy."),
        "",
        "## Guardian safety record",
        "",
        f"- Supervision level: `{guardian.get('supervision', 'none')}`",
        f"- Guardian visibility: `{guardian.get('guardian_visibility', 'summary')}`",
        f"- Safety completeness check: `{package['assurances']['safety_completeness']}`",
        "",
    ]
    if guardian.get("hazards"):
        lines += [
            "**Declared hazards — each one also appears in the learner's safety brief:**",
            "",
            _bullets(
                f"{hazard['kind']}: {hazard['description']} — mitigation: {hazard['mitigation']}"
                for hazard in guardian["hazards"]
            ),
            "",
        ]
    if guardian.get("lesson_safety_and_privacy_verbatim"):
        lines += [
            "**Lesson safety and privacy block, verbatim from source:**",
            "",
            _bullets(guardian["lesson_safety_and_privacy_verbatim"]),
            "",
        ]
    if guardian.get("guardian_visibility_note"):
        lines += ["**Guardian visibility note:** " + guardian["guardian_visibility_note"], ""]
    if (
        guardian.get("guardian_acknowledgement")
        and guardian["guardian_acknowledgement"] != guardian.get("guardian_visibility_note")
    ):
        lines += [
            "**Guardian acknowledgement:** " + guardian["guardian_acknowledgement"],
            "",
        ]

    # The three things an adult has to know before the session starts, and which
    # the source's guardian note has no field for.
    if guardian.get("safe_order"):
        lines += [
            "**Safe order the learner is given — read it before the session starts:**",
            "",
            _bullets(guardian["safe_order"]),
            "",
        ]
    if guardian.get("required_ppe"):
        lines += ["**Protective equipment:** " + guardian["required_ppe"], ""]
    if guardian.get("disposal_instruction"):
        lines += ["**Disposal and clearing up:** " + guardian["disposal_instruction"], ""]

    lines += [
        "**Stop conditions on record, adult wording:**",
        "",
        _bullets(guardian.get("stop_conditions", [])),
        "",
    ]
    if package["band"] == "elementary":
        lines += [
            "**Non-disableable prohibitions, adult wording:**",
            "",
            _bullets(item["text"] for item in floor["non_disableable_prohibitions"]),
            "",
            "_Grades 3-5 wording._ The learner's sheet carries a restatement of each prohibition "
            "and stop condition at their reading age. Every restatement is stricter than the adult "
            "clause it replaces — the fire instruction, for example, is unconditional evacuation "
            "with no smothering option. The adult clauses above are the ones in force; read them "
            "yourself before the session.",
            "",
        ]

    lines += [
        "## Path choice",
        "",
        "Both paths are scored with the same rubric. Recording which path ran is a completion "
        "detail, never a scoring input.",
        "",
        "---",
        "",
        f"_Package `{package['package_id']}` · built from `{package['source']['lineage']}` at "
        f"`{package['source']['commit'][:7]}`._",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Course, policy, and coverage documents
# ---------------------------------------------------------------------------


def course_readme(course: dict, packages: list[dict]) -> str:
    units: dict[int, list[dict]] = {}
    for package in packages:
        units.setdefault(package["unit_number"], []).append(package)

    lines = [
        f"# {course['title']} — student work packages",
        "",
        f"`{course['course_id']}` · {len(packages)} lessons · source lineage "
        f"`{course['lineage']}` at `{course['commit'][:7]}`",
        "",
        "One package per lesson. `student-sheets/` is what the learner works on, `scoring/` is the "
        "adult copy, and `work-packages.jsonl` is the machine record — one JSON object per lesson.",
        "",
        "| Unit | Title | Lessons | Investigation data sheets |",
        "| --- | --- | --- | --- |",
    ]
    for number in sorted(units):
        group = units[number]
        investigations = sum(
            1 for package in group if package["work_type"] == "INVESTIGATION_DATA_SHEET"
        )
        lines.append(f"| {number} | {group[0]['unit_title']} | {len(group)} | {investigations} |")
    lines += [
        "",
        "Every package in this course carries a student-visible safety brief, an equal-credit safe "
        "alternative, and a supplied-data path. None of them supplies an observation, a "
        "measurement, or an expected result.",
        "",
    ]
    return "\n".join(lines)


def policy_doc(shared: dict, floor: dict) -> str:
    return "\n".join(
        [
            "# Science student-work scoring and safety policy",
            "",
            "Applies to every Science student-work package, in every grade.",
            "",
            "## Scoring",
            "",
            shared["text"]["no-fixed-answer-key"],
            "",
            "### The rubric",
            "",
            _rubric_table(shared),
            "",
            shared["text"]["rubric-threshold"],
            "",
            shared["text"]["equal-credit-rule"],
            "",
            "### Non-negotiables",
            "",
            _bullets(shared["lists"]["scoring-non-negotiables"]),
            "",
            "### What a complete response contains, by question kind",
            "",
            _bullets(
                f"**{kind.replace('_', ' ').lower()}** — {body}"
                for kind, body in sorted(shared["expected_reasoning_by_question_kind"].items())
            ),
            "",
            "## Safety floor",
            "",
            f"Floor version `{floor['floor_version']}`. Every clause below is carried verbatim from "
            "a committed, reviewed source; nothing here is newly authored.",
            "",
            "### Non-disableable prohibitions",
            "",
            f"_Source: `{floor['attribution']['hs-h3']['branch']}` @ "
            f"`{floor['attribution']['hs-h3']['commit'][:7]}`._",
            "",
            _bullets(item["text"] for item in floor["non_disableable_prohibitions"]),
            "",
            "### Global stop conditions",
            "",
            _bullets(item["text"] for item in floor["global_stop_conditions"]),
            "",
            "### Elementary investigation clauses imported into Grades 5, 7, and 8",
            "",
            f"_Source: `{floor['attribution']['g34']['branch']}` @ "
            f"`{floor['attribution']['g34']['commit'][:7]}`. The canonical Grade 5/7/8 source "
            "carries no equal-credit investigation alternative and no guardian acknowledgement of "
            "its own, so the reviewed Grade 3/4 clauses are imported. The floor is additive only — "
            "it never relaxes a clause a lesson already states._",
            "",
            _bullets(item["text"] for item in floor["elementary_investigation_clauses"]),
            "",
            "### Equal-credit alternative clause",
            "",
            _bullets(item["text"] for item in floor["equal_credit_alternative_clauses"]),
            "",
            "### Guardian acknowledgement",
            "",
            _bullets(item["text"] for item in floor["guardian_acknowledgement_clauses"]),
            "",
            "### Privacy declarations required of every lesson",
            "",
            _bullets(item["text"] for item in floor["required_privacy_declarations"]),
            "",
        ]
    )


def coverage_report(manifest: dict) -> str:
    lines = [
        "# Science student-work coverage",
        "",
        f"{manifest['total_lessons']} lessons across {len(manifest['courses'])} courses.",
        "",
        "| Course | Grade | Lessons | Units | Investigation sheets | Work sheets | Hazard-bearing | "
        "Safety VERIFIED | Correctness topics | Correctness authority | Source |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for course in manifest["courses"]:
        lines.append(
            f"| {course['title']} | {course['grade']} | {course['lessons']} | {course['units']} | "
            f"{course['investigation_data_sheets']} | {course['student_work_sheets']} | "
            f"{course['hazard_bearing']} | {course['safety_verified']}/{course['lessons']} | "
            f"{course['correctness_topics']} | "
            f"{course['correctness_authority_lessons']}/{course['lessons']} | "
            f"`{course['lineage']}` @ `{course['commit'][:7]}` |"
        )
    lines += [
        "",
        "## High School safety lineage",
        "",
        f"- Used: `{manifest['high_school_safety_lineage']['branch']}` @ "
        f"`{manifest['high_school_safety_lineage']['used'][:7]}`",
        f"- Superseded safety fix, not read: "
        f"`{manifest['high_school_safety_lineage']['supersedes'][:7]}` (H2)",
        f"- Rejected base candidate: "
        f"`{manifest['high_school_safety_lineage']['rejected_base_candidate'][:7]}`",
        f"- {manifest['high_school_safety_lineage']['note']}",
        "",
        "## Invariants",
        "",
        _bullets(manifest["invariants"]),
        "",
    ]
    return "\n".join(lines)
