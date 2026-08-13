#!/usr/bin/env python3
"""Build the release-admission projection for Social Studies source integrity.

One row per lesson in the shipped gate input, classified so that release
admission can tell the three cases apart without reading prose:

  STATIC_VERIFIED_SOURCE  -- a named source set was verified against the
                             repository that holds it.
  DYNAMIC_SOURCE_REQUIRED -- the evidence is chosen at teaching time; the
                             lesson is admissible only once an attachment
                             satisfying DYNAMIC_SOURCE_REQUIREMENT is recorded.
  UNRESOLVED              -- neither. Held back.

Grades 9-12 are reported separately: their gate input already asserts
sourceIntegrityStatus VERIFIED and no registry in this lane checked them, so
this projection makes no claim about them either way.

Everything is read read-only except the two files this lane writes.
"""
import datetime
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
GATE_INPUT = os.path.join(REPO, "curriculum-production", "student-work",
                          "social-studies", "_gate", "production-input.json")
UPSTREAM = os.path.join(REPO, "curriculum-production", "source-resolution",
                        "social-studies", "source-registry.json")
RESOLUTIONS = os.path.join(HERE, "unit-resolutions.json")
SOURCES = os.path.join(HERE, "era1-verified-sources.json")
CONTRACT = os.path.join(HERE, "dynamic-source-contract.json")
LEDGER = os.path.join(HERE, "attachments.json")
OUT = os.path.join(HERE, "source-projection.json")

MIN_USABLE_ANCHORS = 2
MIN_TYPOLOGICAL_ANCHORS = 2
AS_OF = os.environ.get("PROJECTION_AS_OF") or datetime.date.today().isoformat()


def load(path):
    return json.load(open(path, encoding="utf-8"))


def link_problem(src, key, label):
    """A link that was never checked is not a link that passed."""
    link = src.get("linkCheck")
    if not link:
        return "%s %s has no link check; run tools/check-arks.py" % (label, key)
    if link.get("status") != "RESOLVED":
        return "%s %s link check %s" % (label, key, link.get("status"))
    return None


def check_static_unit(unit, sources):
    """A static resolution stands only if its own anchors still hold."""
    problems = []
    usable, typological = [], []
    for key in unit["anchorSourceKeys"]:
        src = sources["sources"].get(key)
        if src is None:
            problems.append("anchor %s is not in era1-verified-sources.json" % key)
            continue
        if src["verification"]["status"] != "VERIFIED":
            problems.append("anchor %s is %s" % (key, src["verification"]["status"]))
            continue
        bad_link = link_problem(src, key, "anchor")
        if bad_link:
            problems.append(bad_link)
            continue
        if not src["periodClaim"]["usableAsEra1Evidence"]:
            problems.append("anchor %s is not usable as in-period evidence" % key)
            continue
        usable.append(key)
        if src["periodClaim"]["basis"] == "TYPOLOGICAL":
            typological.append(key)
    if len(usable) < MIN_USABLE_ANCHORS:
        problems.append("%d usable anchors, need %d" % (len(usable), MIN_USABLE_ANCHORS))
    if len(typological) < MIN_TYPOLOGICAL_ANCHORS:
        problems.append("%d typologically assigned anchors, need %d"
                        % (len(typological), MIN_TYPOLOGICAL_ANCHORS))
    # A supporting source is teaching material, not an anchor: a broken one is
    # reported but does not unresolve the unit.
    supporting = []
    for key in unit.get("supportingSourceKeys", []):
        src = sources["sources"].get(key)
        if src is None:
            supporting.append("supporting %s is not in era1-verified-sources.json" % key)
            continue
        bad_link = link_problem(src, key, "supporting")
        if bad_link:
            supporting.append(bad_link)
    return usable, typological, problems, supporting


def stale(date_str, max_age_days):
    """True when a recorded date is missing, unparseable, in the future, or old."""
    try:
        d = datetime.date.fromisoformat(str(date_str)[:10])
    except ValueError:
        return "unparseable date %r" % date_str
    today = datetime.date.fromisoformat(AS_OF)
    if d > today:
        return "date %s is in the future" % d
    if (today - d).days > max_age_days:
        return "date %s is %d days old; the contract allows %d" % (
            d, (today - d).days, max_age_days)
    return None


def attachment_state(lesson_ref, unit_ref, contract, ledger):
    """Where a contract-governed lesson stands, from the attachment ledger.

    This checks the shape of an attestation, not the truth of it: that every
    required field is present, that the declared kind and tier are ones the
    contract defines and agree with each other, that the adult recorded reading
    and previewing the source, that the recorded dates are real and inside the
    revalidation window, and that the unit's authority rules hold. Whether the
    source says what the adult says it says is the adult's attestation, and no
    validator can settle it.
    """
    required = [f["field"] for f in contract["evidenceMetadata"]["required"]]
    kinds = {k["kind"] for k in contract["acceptableSource"]["qualifyingKinds"]}
    covers = {t["tier"]: set(t["covers"]) for t in contract["sourceAuthority"]["tiers"]}
    max_age = contract["revalidation"]["attachmentAgeDays"]
    strong = {"TIER_1_OFFICIAL_RECORD", "TIER_3_INDEPENDENT_REPORTING"}

    unit_atts = [a for a in ledger["attachments"] if a.get("unitRef") == unit_ref]
    mine = [a for a in unit_atts if a.get("lessonRef") == lesson_ref]
    if not mine:
        return "PENDING_SOURCE_ATTACHMENT", False, ["no attachment recorded for this lesson"]

    problems = []
    for att in mine:
        who = att.get("attachmentId", "<no id>")
        missing = [f for f in required if not att.get(f)]
        if missing:
            problems.append("attachment %s missing: %s" % (who, ", ".join(missing)))
        tier, kind = att.get("authorityTier"), att.get("sourceKind")
        if tier not in covers:
            problems.append("attachment %s has no recognised authorityTier" % who)
        if kind not in kinds:
            problems.append("attachment %s has no recognised sourceKind" % who)
        elif tier in covers and kind not in covers[tier]:
            problems.append("attachment %s declares tier %s for a %s source; that tier "
                            "covers %s" % (who, tier, kind, ", ".join(sorted(covers[tier]))))
        if not att.get("readInFull") or not att.get("previewedForSafetyAndLevel"):
            problems.append("attachment %s was not read in full and previewed" % who)
        for field in ("retrievedOn", "selectedOn"):
            bad = stale(att.get(field), max_age)
            if bad:
                problems.append("attachment %s %s: %s" % (who, field, bad))
    if len(unit_atts) < 2:
        problems.append("unit has %d attachments, contract requires 2" % len(unit_atts))
    if not any(a.get("authorityTier") in strong for a in unit_atts):
        problems.append("unit has no TIER_1 or TIER_3 source")
    if len({a.get("responsibleParty") for a in unit_atts}) < 2:
        problems.append("unit's attachments do not have two different responsible parties")

    if problems:
        return "ATTACHED_INCOMPLETE", False, problems
    return "ATTACHED_SATISFIED", True, []


def main():
    gate = load(GATE_INPUT)
    upstream = load(UPSTREAM)
    resolutions = load(RESOLUTIONS)
    sources = load(SOURCES)
    contract = load(CONTRACT)
    ledger = load(LEDGER)

    up_by_lesson = {l["lessonRef"]: l for l in upstream["lessons"]}
    units = {u["unitRef"]: u for u in resolutions["units"]}

    unit_findings = {}
    for ref, unit in units.items():
        if unit["sourceClass"] != "STATIC_VERIFIED_SOURCE":
            continue
        usable, typological, problems, supporting = check_static_unit(unit, sources)
        unit_findings[ref] = {"usableAnchors": usable,
                              "typologicalAnchors": typological,
                              "problems": problems,
                              "supportingSourceProblems": supporting}

    rows = []
    for course in gate["courses"]:
        for lesson in course["lessons"]:
            ref = lesson["lessonId"]
            unit_ref = lesson["unitId"]
            row = {"lessonRef": ref, "courseId": course["courseId"],
                   "unitRef": unit_ref,
                   "gateInputSourceIntegrityStatus": lesson.get("sourceIntegrityStatus")}
            unit = units.get(unit_ref)
            if unit and unit["sourceClass"] == "STATIC_VERIFIED_SOURCE":
                found = unit_findings[unit_ref]
                if found["problems"]:
                    row.update(sourceClass="UNRESOLVED", resolvedBy="social-studies-dynamic",
                               sourceIntegrityStatus="UNKNOWN", admissible=False,
                               admissionBlockedBy=found["problems"], anchorSourceKeys=[])
                else:
                    row.update(sourceClass="STATIC_VERIFIED_SOURCE",
                               resolvedBy="social-studies-dynamic",
                               sourceIntegrityStatus="VERIFIED", admissible=True,
                               admissionBlockedBy=[],
                               anchorSourceKeys=found["usableAnchors"],
                               typologicalAnchorKeys=found["typologicalAnchors"])
            elif unit and unit["sourceClass"] == "DYNAMIC_SOURCE_REQUIRED":
                state, admissible, problems = attachment_state(ref, unit_ref, contract, ledger)
                row.update(sourceClass="DYNAMIC_SOURCE_REQUIRED",
                           resolvedBy="social-studies-dynamic",
                           contractId=unit["contractId"], dynamicState=state,
                           sourceIntegrityStatus=("VERIFIED_AT_ATTACHMENT" if admissible
                                                  else "UNKNOWN"),
                           admissible=admissible, admissionBlockedBy=problems,
                           anchorSourceKeys=[])
            elif ref in up_by_lesson:
                up = up_by_lesson[ref]
                resolved = up["sourceIntegrityStatus"] == "VERIFIED"
                row.update(sourceClass=("STATIC_VERIFIED_SOURCE" if resolved else "UNRESOLVED"),
                           resolvedBy="social-studies",
                           sourceIntegrityStatus=up["sourceIntegrityStatus"],
                           admissible=resolved,
                           admissionBlockedBy=([] if resolved
                                               else [up.get("unresolvedReason") or "unresolved upstream"]),
                           anchorSourceKeys=up["anchorSourceKeys"])
            else:
                row.update(sourceClass="NOT_ASSESSED_BY_SOURCE_REGISTRY", resolvedBy=None,
                           sourceIntegrityStatus=lesson.get("sourceIntegrityStatus"),
                           admissible=None,
                           admissionBlockedBy=["no source registry covers this lesson; the "
                                               "gate input's assertion is carried through "
                                               "unchecked by this lane"],
                           anchorSourceKeys=[])
            rows.append(row)

    totals = {}
    for row in rows:
        totals[row["sourceClass"]] = totals.get(row["sourceClass"], 0) + 1
    payload = {
        "projectionVersion": 1,
        "generatedBy": "tools/build-projection.py",
        "purpose": "release admission for Social Studies source integrity",
        "gateInput": "curriculum-production/student-work/social-studies/_gate/production-input.json",
        "registries": {
            "static": "curriculum-production/source-resolution/social-studies/source-registry.json",
            "dynamicLane": "curriculum-production/source-resolution/social-studies-dynamic",
        },
        "classes": {
            "STATIC_VERIFIED_SOURCE": "A named source set was verified against the repository that holds it. Admissible.",
            "DYNAMIC_SOURCE_REQUIRED": "Evidence is selected at teaching time under DYNAMIC_SOURCE_REQUIREMENT. Admissible only when dynamicState is ATTACHED_SATISFIED.",
            "UNRESOLVED": "No verified static source set and no dynamic contract. Held back.",
            "NOT_ASSESSED_BY_SOURCE_REGISTRY": "Outside both registries. This lane makes no claim; admissible is null, not true.",
        },
        "totals": totals,
        "admissibleCount": sum(1 for r in rows if r["admissible"] is True),
        "blockedCount": sum(1 for r in rows if r["admissible"] is False),
        "unclaimedCount": sum(1 for r in rows if r["admissible"] is None),
        "asOf": AS_OF,
        "whatTheDynamicValidatorChecks": (
            "The shape of an attestation: required fields, declared kind and tier "
            "against the contract's own vocabularies and against each other, the "
            "adult's read-in-full and preview record, recorded dates inside the "
            "revalidation window, and the unit's authority rules. Not whether the "
            "source says what the adult says it says -- that is the adult's "
            "attestation, and no validator settles it."),
        "unitFindings": unit_findings,
        "lessons": rows,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("lessons=%d %s" % (len(rows), totals))
    print("admissible=%d blocked=%d unclaimed=%d"
          % (payload["admissibleCount"], payload["blockedCount"], payload["unclaimedCount"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
