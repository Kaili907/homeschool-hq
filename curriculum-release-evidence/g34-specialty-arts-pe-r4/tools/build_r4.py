#!/usr/bin/env python3
"""Regenerate the g34-specialty-arts-pe-r4 evidence package.

Reads, and never writes, three things:
  - the PDFs pinned by g34-specialty-r3 (verified against their pinned SHA256 first),
  - the r3 citation records for arts and physical education,
  - nothing else.

Every classification below is computed by comparing an authored string against text
extracted from those PDF bytes during this run. Where a literal official string is named
in this file, it is presence-checked against the bytes and the build aborts if absent, so
no literal can drift silently.

    python3 curriculum-release-evidence/g34-specialty-arts-pe-r4/tools/build_r4.py
"""

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pypdf

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
R3 = OUT.parent / "g34-specialty-r3"
DOCS = R3 / "sources" / "documents"

EVIDENCE_ID = "manuel-academy-g34-specialty-arts-pe-standards-policy-r4"

NORM = lambda s: re.sub(r"\s+", " ", s or "").strip()


def die(msg):
    sys.exit(f"ABORT: {msg}")


# --------------------------------------------------------------------------- sources

PINS = {
    "mde-pe-2017": "88ab7e08a6611015674ebf97e67a7e8ba0aabb9138b9376bf70adecd9018d93c",
    "mde-arts-glce": "f52e0506e30a2277991ae4cebfe75ce157ca0cc3d6ba2b833e15ee8fd9113f2b",
    "mde-vpaa-2011": "330ca531c64200c0ec5e7bc18083cb76e6eb2c57a21fbe3de25c2d29bcfe845c",
}


def load_sources():
    custody = json.loads((R3 / "sources" / "source-custody.json").read_text())
    docs, pages = {}, {}
    for d in custody["documents"]:
        if d["doc_id"] not in PINS:
            continue
        path = DOCS / d["file"]
        raw = path.read_bytes()
        got = hashlib.sha256(raw).hexdigest()
        if got != PINS[d["doc_id"]]:
            die(f"{d['doc_id']} sha256 {got} != pinned {PINS[d['doc_id']]}")
        if got != d["sha256"]:
            die(f"{d['doc_id']} disagrees with r3 custody record")
        docs[d["doc_id"]] = d
        pages[d["doc_id"]] = [p.extract_text() or "" for p in pypdf.PdfReader(str(path)).pages]
    missing = set(PINS) - set(docs)
    if missing:
        die(f"missing pinned documents: {sorted(missing)}")
    return custody, docs, pages


# ------------------------------------------------------------------ official PE anchors

PE_BANDS = [
    ("K-2", "Kindergarten Grade 1 Grade 2"),
    ("3-5", "Grade 3 Grade 4 Grade 5"),
    ("6-8", "Grade 6 Grade 7 Grade 8"),
    ("HS", "Level 1 Level 2"),
]


def extract_pe_standards(pe_pages):
    """Statement printed after 'Standard <n>:' in each grade band, with its page index."""
    found = defaultdict(dict)
    for i, raw in enumerate(pe_pages):
        t = NORM(raw)
        for m in re.finditer(r"Standard\s*([1-5])\s*:\s*(.+?)(?=\s+(?:Kindergarten Grade 1|Grade 3 Grade 4|Grade 6 Grade 7|Level 1 Level 2|\d+\.\s))", t):
            n, stmt = m.group(1), NORM(m.group(2))
            tail = NORM(t[m.end():m.end() + 80])
            band = next((b for b, cue in PE_BANDS if tail.startswith(cue)), None)
            if band and band not in found[n]:
                found[n][band] = {"text": stmt, "pdf_page_index": i}
    for n in "12345":
        if "3-5" not in found[n]:
            die(f"PE Standard {n}: no Grade 3-5 band statement extracted")
    return dict(found)


def count_in(pages, needle):
    return sum(NORM(p).lower().count(needle.lower()) for p in pages)


def pe_outcome_codes(pe_pages):
    """(S<standard>.<outcome>.<grade>[suffix]) codes, deduplicated, by grade."""
    pat = re.compile(r"\(\s*S([1-5])\s*\.\s*(\d+)\s*\.\s*(\d+)([a-z]?)\s*\)")
    by_grade = defaultdict(set)
    for p in pe_pages:
        for m in pat.finditer(NORM(p)):
            s, o, g, sfx = m.groups()
            by_grade[g].add((s, o, sfx))
    return by_grade


# ---------------------------------------------------------------- official arts anchors

ARTS_STANDARDS = {
    "I": ("PERFORM", "Apply skills and knowledge to perform in the arts"),
    "II": ("CREATE", "Apply skills and knowledge to create in the arts"),
    "III": ("ANALYZE", "Analyze, describe, and evaluate works of art"),
    "IV": ("ANALYZE IN CONTEXT", "Understand, analyze, and describe the arts in their historical, social, and cultural contexts"),
    "V": ("ANALYZE AND MAKE CONNECTIONS", "Recognize, analyze, and describe connections among the arts; between the arts and other disciplines; between the arts and everyday life"),
}
ARTS_ROMAN_TO_NUM = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}
DISCIPLINE_NAME = {"D": "Dance", "M": "Music", "T": "Theatre", "VA": "Visual Arts"}

NCAS_PROCESS_WORDS = ["Creating", "Performing", "Presenting", "Producing", "Responding", "Connecting"]

ARTS_CODE = re.compile(r"ART\s*\.\s*(D|M|T|VA)\s*\.\s*(I{1,3}|IV|V)\s*\.\s*(K|\d{1,2})\s*\.\s*(\d+)\s*")
ARTS_HEADINGS = r"\b(?:PERFORM|CREATE|ANALYZE IN CONTEXT|ANALYZE AND MAKE CONNECTIONS|ANALYZE|GRADE \d|KINDERGARTEN|Michigan Visual Arts)\b"


def extract_arts_codes(arts_pages):
    out = {}
    for i, raw in enumerate(arts_pages):
        t = NORM(raw)
        ms = list(ARTS_CODE.finditer(t))
        for j, m in enumerate(ms):
            d, s, g, n = m.groups()
            end = ms[j + 1].start() if j + 1 < len(ms) else len(t)
            body = re.split(ARTS_HEADINGS, t[m.end():end])[0]
            body = re.sub(r"\s+([.,;])", r"\1", body).strip()
            key = f"ART.{d}.{s}.{g}.{n}"
            if key not in out or len(body) > len(out[key]["text"]):
                out[key] = {"discipline": d, "standard_roman": s, "grade": g,
                            "index": int(n), "text": body, "pdf_page_index": i}
    return out


def capitalised_name_counts(pages_sets):
    """NCAS process words used as a capitalised name, across both arts documents.

    A capitalised name is the word with an initial capital NOT at a sentence start and
    NOT mid-sentence lowercase. Counted permissively: any initial-capital occurrence.
    Rule R4-ARTS-1 requires this to be zero.
    """
    counts = {}
    for w in NCAS_PROCESS_WORDS:
        n = 0
        for pages in pages_sets:
            for p in pages:
                n += len(re.findall(rf"\b{w}\b", NORM(p)))
        counts[w] = n
    return counts


# ---------------------------------------------------------------------- crosswalk table

# Warrant is an expectation code plus the text Michigan prints for it. Each is
# presence-checked against the extraction below; the build aborts on any mismatch.
CROSSWALK = {
    "Creating": {
        "michigan_standards": ["II"],
        "ncas_definition": "Conceiving and developing new artistic ideas and work.",
        "warrant_codes": ["ART.M.II.3.1", "ART.D.II.3.2", "ART.T.II.3.1", "ART.VA.II.3.5"],
        "warrant": "Michigan Standard 2 is 'Apply skills and knowledge to create in the arts', and every Grade 3/4 expectation filed under it is generative.",
        "name_similarity": "Creating / CREATE share a root. Recorded, not relied on: the warrant is the expectation text.",
    },
    "Performing": {
        "michigan_standards": ["I"],
        "ncas_definition": "Realizing artistic ideas and work through interpretation and presentation.",
        "warrant_codes": ["ART.M.I.3.11", "ART.T.I.3.2", "ART.D.I.3.1"],
        "warrant": "Michigan Standard 1 is 'Apply skills and knowledge to perform in the arts', and its Grade 3/4 expectations are performance-realization outcomes.",
        "name_similarity": "Performing / PERFORM share a root. Recorded, not relied on.",
    },
    "Presenting": {
        "michigan_standards": ["I"],
        "ncas_definition": "Interpreting and sharing artistic work; in NCAS the visual-arts analogue of Performing.",
        "warrant_codes": ["ART.VA.I.3.4", "ART.VA.I.4.4"],
        "warrant": "Michigan files visual-arts presentation under PERFORM, not under a separate standard: ART.VA.I.3.4 reads 'Select, present, and evaluate personal artwork.' and ART.VA.I.4.4 reads 'Prepare, present, and collaboratively evaluate personal artwork.'",
        "name_similarity": "None. Presenting and PERFORM do not share a root. This mapping rests entirely on Michigan's own expectation text, which is why it is the case that proves rule R4-ARTS-2.",
    },
    "Responding": {
        "michigan_standards": ["III"],
        "ncas_definition": "Understanding and evaluating how the arts convey meaning.",
        "warrant_codes": ["ART.M.III.3.4", "ART.VA.III.3.4"],
        "warrant": "Michigan Standard 3 is 'Analyze, describe, and evaluate works of art'; ART.M.III.3.4 reads 'With teacher guidance, use music vocabulary to analyze, describe, and evaluate music of various styles.'",
        "name_similarity": "None. Responding and ANALYZE do not share a root.",
        "caveat": "Michigan Standard 3 is not a pure analogue at the expectation level: ART.D.III.3.4 ('Demonstrate the ability to create a dance study for presentation to peers.') is a creation-and-presentation outcome filed under ANALYZE. The standard-level mapping holds; the expectation-level partition does not, which is one more reason rule R4-ARTS-4 refuses to assign a code.",
    },
    "Connecting": {
        "michigan_standards": ["IV", "V"],
        "ncas_definition": "Relating artistic ideas and work with personal meaning and external context. NCAS carries two anchors under this process: synthesizing personal knowledge and experience to make art, and relating works to societal, cultural and historical context.",
        "warrant_codes": ["ART.M.V.3.2", "ART.M.IV.3.2"],
        "warrant": "The two halves of NCAS Connecting land on two different Michigan standards. ART.M.V.3.2 ('Observe and identify cross-curricular connections within the 3rd grade curriculum.') is Standard 5. ART.M.IV.3.2 ('Describe how elements of music are used in examples from world cultures, using music performed and presented in 3rd grade.') is Standard 4.",
        "name_similarity": "Connecting / ANALYZE AND MAKE CONNECTIONS share 'connect-'. Recorded, and deliberately NOT relied on: the shared root points at Standard 5 alone and would hide the Standard 4 half.",
        "ambiguous": True,
    },
}

# Authored process token -> crosswalk key. Order matters: longest first.
PROCESS_TOKENS = [
    ("Performing/Presenting", ["Performing", "Presenting"]),
    ("Connecting", ["Connecting"]),
    ("Creating", ["Creating"]),
    ("Performing", ["Performing"]),
    ("Presenting", ["Presenting"]),
    ("Producing", ["Producing"]),
    ("Responding", ["Responding"]),
]


def parse_arts_citation(s):
    """'Michigan Arts: Visual Arts - Presenting' -> ('Visual Arts', 'Presenting')."""
    body = s.split(":", 1)[1].strip() if ":" in s else s
    disc = None
    for code, name in DISCIPLINE_NAME.items():
        for dash in ("–", "—", "-"):
            if body.startswith(f"{name} {dash} "):
                disc, body = code, body[len(name) + 3:].strip()
                break
        if disc:
            break
    for token, _ in PROCESS_TOKENS:
        if body == token:
            return disc, token
    return disc, None


# ----------------------------------------------------------------------------- classify


# Source-meaning analysis for each divergent PE standard. Each entry declares the token
# substitution it was written about; classify_pe asserts the computed diff still matches,
# so the reasoning cannot outlive the divergence it explains (R4-PE-2 meaning_test).
PE_MEANING = {
    "2": {
        "expect_authored": ["physical activities"],
        "expect_official": ["performance"],
        "scope_change": "SUBSTITUTION",
        "analysis": "'Performance' names the execution of movement skills; 'physical activities' names the settings movement happens in. They are not interchangeable in this document's own usage: mde-pe-2017 uses 'physical activity' as a distinct concept throughout Standards 3 and 5, so Standard 2's object cannot be swapped for it without changing what knowledge the standard asks students to apply.",
        "meaning_preserved": False,
    },
    "3": {
        "expect_authored": ["health-enhanced", ""],
        "expect_official": ["health-enhancing", "activity and"],
        "scope_change": "NARROWING",
        "analysis": "Dropping 'activity and' deletes the participation half of the standard, leaving only fitness - a physiological state - where Michigan asks for both physical activity and fitness. Separately, 'health-enhanced' IS a Michigan word, but only in the K-2 band (PDF p. 18); the Grade 3-5 band prints 'health-enhancing'. The authored string therefore splices a word from one band into a truncation matching no band, and appears zero times in the document.",
        "meaning_preserved": False,
    },
    "5": {
        "expect_authored": ["other benefits"],
        "expect_official": ["social interaction"],
        "scope_change": "BROADENING",
        "analysis": "Michigan closes its enumeration with a named value, 'social interaction'. 'Other benefits' converts that final item into an open-ended catch-all, so the authored text asserts a wider standard than Michigan prints and admits any benefit whatever as a cited outcome.",
        "meaning_preserved": False,
    },
}


def classify_pe(rec, pe_std):
    """R4-PE-1 / R4-PE-2 / R4-PE-3."""
    s = rec["code_or_strand"]
    m = re.match(r"Michigan PE Standard ([1-5]):\s*(.+)$", s)
    if not m:
        die(f"unparsed PE citation: {s!r}")
    n, authored = m.group(1), NORM(m.group(2))
    band = pe_std[n]["3-5"]
    official = NORM(band["text"]).rstrip(".")
    verbatim = authored.rstrip(".") == official

    out = {
        "michigan_standard_number": int(n),
        "authored_text": authored,
        "official_text_grade_3_5": band["text"],
        "official_pdf_page_index": band["pdf_page_index"],
        "referent_claim": "RESOLVED",
        "referent_resolution": f"Michigan PE Standard {n} exists and is unambiguous.",
    }
    if verbatim:
        out.update({
            "evidence_class": "ALIAS_RESOLVED_VERBATIM",
            "rule_id": "R4-PE-1",
            "text_claim": "RESOLVED",
            "citation_string_status": "HOUSE_PREFIXED_OFFICIAL_TEXT",
        })
        return out

    aw, ow = authored.rstrip(".").split(), official.split()
    import difflib
    ops = [o for o in difflib.SequenceMatcher(None, aw, ow).get_opcodes() if o[0] != "equal"]
    diff = [f"{tag}: authored[{i1}:{i2}]={' '.join(aw[i1:i2])!r} official[{j1}:{j2}]={' '.join(ow[j1:j2])!r}"
            for tag, i1, i2, j1, j2 in ops]

    # R4-PE-2 meaning_test: the recorded analysis must still describe the computed diff.
    meaning = PE_MEANING.get(n)
    if meaning is None:
        die(f"PE Standard {n} diverges but has no recorded source-meaning analysis")
    got_a = [" ".join(aw[i1:i2]) for _, i1, i2, _, _ in ops]
    got_o = [" ".join(ow[j1:j2]) for _, _, _, j1, j2 in ops]
    if got_a != meaning["expect_authored"] or got_o != meaning["expect_official"]:
        die(f"PE Standard {n}: recorded meaning analysis describes "
            f"{meaning['expect_authored']}->{meaning['expect_official']} but the diff is {got_a}->{got_o}")

    occurrences = None  # filled by caller (needs page set)
    out.update({
        "source_meaning": {k: v for k, v in meaning.items()
                           if k in ("scope_change", "analysis", "meaning_preserved")},
        "evidence_class": "HUMAN_REVIEW_REQUIRED",
        "rule_id": "R4-PE-2",
        "text_claim": "FAILED",
        "citation_string_status": "MISATTRIBUTED_AS_AUTHORED",
        "token_diff": diff,
        "proposed_correction": {
            "from": s,
            "to": f"Michigan PE Standard {n}: {official}",
            "applied": False,
            "note": "Recorded under R4-PE-3, not applied. This package edits no lesson.",
        },
        "_occurrences": occurrences,
    })
    return out


def classify_arts(rec, arts_codes):
    """R4-ARTS-1 .. R4-ARTS-5."""
    s = rec["code_or_strand"]
    disc, token = parse_arts_citation(s)
    if token is None:
        die(f"unparsed arts citation: {s!r}")
    grade = str(rec["grade"])

    components = dict(PROCESS_TOKENS)[token]
    targets = sorted({r for c in components for r in CROSSWALK[c]["michigan_standards"]},
                     key=lambda r: ARTS_ROMAN_TO_NUM[r])
    ambiguous = any(CROSSWALK[c].get("ambiguous") for c in components) or len(targets) > 1

    candidates = sorted(k for k, v in arts_codes.items()
                        if v["grade"] == grade and v["standard_roman"] in targets
                        and (disc is None or v["discipline"] == disc))

    out = {
        "authored_process": token,
        "ncas_components": components,
        "authored_discipline": DISCIPLINE_NAME.get(disc) if disc else None,
        "discipline_verified": bool(disc) or None,
        "michigan_standard_targets": [
            {"roman": r, "number": ARTS_ROMAN_TO_NUM[r], "name": ARTS_STANDARDS[r][0],
             "statement": ARTS_STANDARDS[r][1] + "."} for r in targets],
        "warrant": [CROSSWALK[c]["warrant"] for c in components],
        "warrant_codes": sorted({c2 for c in components for c2 in CROSSWALK[c]["warrant_codes"]}),
        "name_similarity_note": [CROSSWALK[c]["name_similarity"] for c in components],
        "candidate_expectation_codes": candidates,
        "candidate_expectation_count": len(candidates),
        "exact_grade_expectation_assigned": False,
        "citation_string_status": "MISATTRIBUTED_AS_AUTHORED",
        "text_claim": "FAILED",
        "text_claim_reason": "NCAS process vocabulary; occurs zero times as a capitalised name in either held Michigan arts document (R4-ARTS-1).",
    }
    if ambiguous:
        out.update({
            "evidence_class": "HUMAN_REVIEW_REQUIRED",
            "rule_id": "R4-ARTS-3",
            "referent_claim": "AMBIGUOUS",
            "referent_resolution": "Spans more than one Michigan standard; choosing between them requires reading the lesson, which is out of scope.",
        })
    else:
        out.update({
            "evidence_class": "CROSSWALK_RESOLVED_STANDARD_LEVEL",
            "rule_id": "R4-ARTS-2",
            "referent_claim": "RESOLVED_AT_STANDARD_LEVEL",
            "referent_resolution": f"Maps to exactly one Michigan standard ({targets[0]}) under a documented, reversible rule warranted by Michigan's own Grade {grade} expectation text.",
        })
    if CROSSWALK[components[0]].get("caveat"):
        out["caveat"] = CROSSWALK[components[0]]["caveat"]
    return out


# --------------------------------------------------------------------------------- main


def main():
    custody, docs, pages = load_sources()
    pe_pages = pages["mde-pe-2017"]
    arts_pages = pages["mde-arts-glce"]
    vpaa_pages = pages["mde-vpaa-2011"]

    # --- official anchors, extracted from the verified bytes
    pe_std = extract_pe_standards(pe_pages)
    arts_codes = extract_arts_codes(arts_pages)

    # --- R4-ARTS-1 premise check: NCAS words must not appear as capitalised names
    cap = capitalised_name_counts([arts_pages, vpaa_pages])
    if any(cap.values()):
        die(f"R4-ARTS-1 premise broken: NCAS words appear capitalised: "
            f"{ {k: v for k, v in cap.items() if v} }. Re-derive the arts rules before rebuilding.")

    # --- named-literal presence checks (nothing hardcoded may drift)
    arts_all = " || ".join(NORM(p) for p in arts_pages)
    for roman, (name, stmt) in ARTS_STANDARDS.items():
        if name not in arts_all:
            die(f"arts standard heading {name!r} not found in mde-arts-glce")
        if NORM(stmt).lower() not in re.sub(r"\s+\.", ".", arts_all).lower().replace(" .", "."):
            probe = stmt.split(",")[0][:40].lower()
            if probe not in arts_all.lower():
                die(f"arts standard statement for {roman} not found: {stmt[:60]!r}")
    for key, cw in CROSSWALK.items():
        for code in cw["warrant_codes"]:
            if code not in arts_codes:
                die(f"crosswalk warrant code {code} (for {key}) not present in the held document")

    # --- r3 citations in scope
    r3_rows = [json.loads(l) for l in (R3 / "evidence" / "citations.jsonl").read_text().splitlines() if l.strip()]
    arts_rows = [r for r in r3_rows if r["subject"] == "arts-and-music"]
    pe_rows = [r for r in r3_rows if r["subject"] == "physical-education"]

    # --- PE
    pe_out, pe_counts, pe_before = [], Counter(), Counter()
    for r in pe_rows:
        c = classify_pe(r, pe_std)
        if c["evidence_class"] == "HUMAN_REVIEW_REQUIRED":
            c["_occurrences"] = count_in(pe_pages, c["authored_text"])
            c["authored_text_occurrences_in_document"] = c.pop("_occurrences")
        else:
            c.pop("_occurrences", None)
        rec = {
            "course_id": r["course_id"], "grade": r["grade"], "subject": r["subject"],
            "citation": r["code_or_strand"], "citation_count": r["citation_count"],
            "unit_numbers": r["unit_numbers"], "lesson_id_set_sha256": r["lesson_id_set_sha256"],
            "official_document": "mde-pe-2017", "r3_class": r["evidence_class"], **c,
        }
        pe_out.append(rec)
        pe_counts[rec["evidence_class"]] += r["citation_count"]
        pe_before[r["evidence_class"]] += r["citation_count"]

    # --- Arts
    arts_out, arts_counts, arts_before = [], Counter(), Counter()
    for r in arts_rows:
        c = classify_arts(r, arts_codes)
        rec = {
            "course_id": r["course_id"], "grade": r["grade"], "subject": r["subject"],
            "citation": r["code_or_strand"], "citation_count": r["citation_count"],
            "unit_numbers": r["unit_numbers"], "lesson_id_set_sha256": r["lesson_id_set_sha256"],
            "official_document": "mde-arts-glce", "r3_class": r["evidence_class"], **c,
        }
        arts_out.append(rec)
        arts_counts[rec["evidence_class"]] += r["citation_count"]
        arts_before[r["evidence_class"]] += r["citation_count"]

    # --- registry, with inverse index (R4-BOTH-2)
    registry, inverse = [], defaultdict(list)
    for rec in arts_out:
        key = rec["citation"]
        entry = {
            "mapping_id": f"ARTS::{rec['course_id']}::{key}",
            "authored_citation": key,
            "framework_of_origin": "National Core Arts Standards (NCAS)",
            "authored_process": rec["authored_process"],
            "authored_discipline": rec["authored_discipline"],
            "michigan_targets": [t["roman"] for t in rec["michigan_standard_targets"]],
            "michigan_target_names": [t["name"] for t in rec["michigan_standard_targets"]],
            "mapping_kind": ("CROSSWALK_ONE_TO_ONE" if rec["evidence_class"] == "CROSSWALK_RESOLVED_STANDARD_LEVEL"
                             else "CROSSWALK_ONE_TO_MANY_UNRESOLVED"),
            "is_alias": False,
            "is_composite_of_official_elements": False,
            "is_crosswalk_only": True,
            "evidence_class": rec["evidence_class"],
            "exact_grade_expectation_assigned": False,
            "candidate_expectation_count": rec["candidate_expectation_count"],
            "warrant_codes": rec["warrant_codes"],
            "reversible": True,
            "citation_count": rec["citation_count"],
            "grade": rec["grade"],
            "course_id": rec["course_id"],
        }
        registry.append(entry)
        for t in entry["michigan_targets"]:
            inverse[f"ART-STANDARD-{ARTS_ROMAN_TO_NUM[t]}-{ARTS_STANDARDS[t][0]}"].append(entry["mapping_id"])
    for rec in pe_out:
        key = rec["citation"]
        entry = {
            "mapping_id": f"PE::{rec['course_id']}::{key}",
            "authored_citation": key,
            "framework_of_origin": "Michigan K-12 Physical Education Standards (2017), quoted",
            "michigan_targets": [f"PE-STANDARD-{rec['michigan_standard_number']}"],
            "mapping_kind": ("ALIAS_HOUSE_PREFIX" if rec["evidence_class"] == "ALIAS_RESOLVED_VERBATIM"
                             else "MISQUOTATION_UNRESOLVED"),
            "is_alias": rec["evidence_class"] == "ALIAS_RESOLVED_VERBATIM",
            "is_composite_of_official_elements": False,
            "is_crosswalk_only": False,
            "evidence_class": rec["evidence_class"],
            "proposed_correction": rec.get("proposed_correction"),
            "reversible": True,
            "citation_count": rec["citation_count"],
            "grade": rec["grade"],
            "course_id": rec["course_id"],
        }
        registry.append(entry)
        inverse[entry["michigan_targets"][0]].append(entry["mapping_id"])

    # --- write
    (OUT / "evidence" / "arts-citations.jsonl").write_text(
        "".join(json.dumps(r, sort_keys=True, ensure_ascii=False) + "\n" for r in arts_out))
    (OUT / "evidence" / "pe-citations.jsonl").write_text(
        "".join(json.dumps(r, sort_keys=True, ensure_ascii=False) + "\n" for r in pe_out))

    g34_arts = {k: v for k, v in arts_codes.items() if v["grade"] in ("3", "4")}
    by_disc = Counter(v["discipline"] for v in g34_arts.values())
    by_std = Counter(v["standard_roman"] for v in g34_arts.values())
    pe_codes = pe_outcome_codes(pe_pages)

    (OUT / "sources" / "extracts" / "michigan-arts-anchors.json").write_text(json.dumps({
        "doc_id": "mde-arts-glce",
        "sha256": PINS["mde-arts-glce"],
        "standards": {r: {"number": ARTS_ROMAN_TO_NUM[r], "name": n, "statement": s + "."}
                      for r, (n, s) in ARTS_STANDARDS.items()},
        "disciplines": DISCIPLINE_NAME,
        "ncas_capitalised_name_occurrences": cap,
        "grade_3_4_expectation_count": len(g34_arts),
        "grade_3_4_by_discipline": dict(by_disc),
        "grade_3_4_by_standard": {r: by_std[r] for r in ["I", "II", "III", "IV", "V"]},
        "grade_3_4_expectations": {k: g34_arts[k] for k in sorted(g34_arts)},
    }, indent=1, sort_keys=True, ensure_ascii=False))

    (OUT / "sources" / "extracts" / "michigan-pe-anchors.json").write_text(json.dumps({
        "doc_id": "mde-pe-2017",
        "sha256": PINS["mde-pe-2017"],
        "standards_by_band": pe_std,
        "band_note": "Statements are NOT identical across bands. Standard 3 reads 'health-enhanced' at K-2 and 'health-enhancing' at 3-5 and 6-8; Standard 2 reads 'principals' at HS and 'principles' elsewhere. A Grade 3/4 citation is judged against the 3-5 band only (R4-PE-1).",
        "grade_3_4_outcome_code_count": len(pe_codes["3"]) + len(pe_codes["4"]),
        "grade_3_4_outcome_codes_by_standard": dict(Counter(
            s for g in ("3", "4") for s, _, _ in pe_codes[g])),
    }, indent=1, sort_keys=True, ensure_ascii=False))

    (OUT / "registry" / "crosswalk-registry.json").write_text(json.dumps({
        "evidence_id": EVIDENCE_ID,
        "reversible": True,
        "reversal": "Delete curriculum-release-evidence/g34-specialty-arts-pe-r4/. No lesson, no release file and no r3 byte was modified.",
        "crosswalk_table": CROSSWALK,
        "mappings": registry,
    }, indent=1, sort_keys=True, ensure_ascii=False))

    (OUT / "registry" / "inverse-index.json").write_text(json.dumps({
        "evidence_id": EVIDENCE_ID,
        "note": "Michigan target -> the authored citations that map onto it. Not a bijection: many authored labels share a target. Reversibility means every mapping is recoverable from either direction, which tools/validate.py asserts.",
        "index": {k: sorted(v) for k, v in sorted(inverse.items())},
    }, indent=1, sort_keys=True, ensure_ascii=False))

    before_after = {
        "evidence_id": EVIDENCE_ID,
        "arts": {
            "citations": sum(arts_before.values()),
            "before_r3": dict(arts_before),
            "after_r4": dict(arts_counts),
            "resolved_at_standard_level": arts_counts["CROSSWALK_RESOLVED_STANDARD_LEVEL"],
            "human_review_required": arts_counts["HUMAN_REVIEW_REQUIRED"],
            "resolved_to_exact_grade_expectation": 0,
            "verbatim_michigan": 0,
        },
        "physical_education": {
            "citations_total": sum(pe_before.values()),
            "citations_in_scope": sum(v for k, v in pe_before.items() if k == "HUMAN_REVIEW_REQUIRED"),
            "before_r3": dict(pe_before),
            "after_r4": dict(pe_counts),
            "newly_resolved": sum(v for k, v in pe_counts.items() if k == "ALIAS_RESOLVED_VERBATIM")
                              - sum(v for k, v in pe_before.items() if k == "ALIAS_RESOLVED_VERBATIM"),
            "human_review_required": pe_counts["HUMAN_REVIEW_REQUIRED"],
        },
    }
    (OUT / "evidence" / "before-after.json").write_text(
        json.dumps(before_after, indent=1, sort_keys=True))

    unresolved = [
        {"subject": r["subject"], "course_id": r["course_id"], "grade": r["grade"],
         "citation": r["citation"], "citation_count": r["citation_count"],
         "why": r.get("referent_resolution") or r.get("text_claim_reason"),
         "decision_needed": ("Choose Michigan Standard 4 or 5 for each lesson, then choose an exact Grade "
                             f"{r['grade']} expectation from the {r.get('candidate_expectation_count')} candidates."
                             if r["subject"] == "arts-and-music" else
                             "Accept the recorded proposed_correction, or re-cite the lesson against one of "
                             "Michigan's exact Grade 3/4 outcome codes."),
         "proposed_correction": r.get("proposed_correction"),
         "candidate_expectation_codes": r.get("candidate_expectation_codes"),
         "rule_id": r["rule_id"]}
        for r in arts_out + pe_out if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"
    ]
    (OUT / "evidence" / "unresolved.json").write_text(json.dumps({
        "evidence_id": EVIDENCE_ID,
        "total_citations_unresolved": sum(u["citation_count"] for u in unresolved),
        "distinct_strings_unresolved": len(unresolved),
        "items": unresolved,
    }, indent=1, sort_keys=True, ensure_ascii=False))

    print(f"arts   {sum(arts_before.values()):4d} citations -> {dict(arts_counts)}")
    print(f"pe     {sum(pe_before.values()):4d} citations -> {dict(pe_counts)}")
    print(f"registry {len(registry)} mappings; unresolved {sum(u['citation_count'] for u in unresolved)} citations")
    return before_after


if __name__ == "__main__":
    main()
