#!/usr/bin/env python3
"""Validate the g34-specialty-arts-pe-r4 package, then try to break it.

Two halves:

  INVARIANTS  assertions the emitted tree must satisfy - counts reconcile against r3,
              the registry round-trips, no arts citation was promoted past a crosswalk,
              no exact-grade expectation was assigned, nothing outside this directory
              was written.

  MUTATIONS   deliberate corruptions of the INPUT. Each one must change the verdict or
              abort the build. A mutation that leaves the output identical proves the
              corresponding rule was decorative - asserted in prose rather than executed
              against the bytes - and is reported as a FAILURE.

    python3 curriculum-release-evidence/g34-specialty-arts-pe-r4/tools/validate.py
"""

import copy
import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
R3 = OUT.parent / "g34-specialty-r3"
sys.path.insert(0, str(HERE))

import build_r4 as B  # noqa: E402

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'ok  ' if cond else 'FAIL'}  {name}{'' if cond else '  <- ' + detail}")


# ------------------------------------------------------------------------- invariants


def invariants():
    print("INVARIANTS")
    arts = [json.loads(l) for l in (OUT / "evidence" / "arts-citations.jsonl").read_text().splitlines() if l.strip()]
    pe = [json.loads(l) for l in (OUT / "evidence" / "pe-citations.jsonl").read_text().splitlines() if l.strip()]
    reg = json.loads((OUT / "registry" / "crosswalk-registry.json").read_text())
    inv = json.loads((OUT / "registry" / "inverse-index.json").read_text())
    ba = json.loads((OUT / "evidence" / "before-after.json").read_text())
    unres = json.loads((OUT / "evidence" / "unresolved.json").read_text())

    r3_rows = [json.loads(l) for l in (R3 / "evidence" / "citations.jsonl").read_text().splitlines() if l.strip()]
    r3_arts = sum(r["citation_count"] for r in r3_rows if r["subject"] == "arts-and-music")
    r3_pe = sum(r["citation_count"] for r in r3_rows if r["subject"] == "physical-education")

    check("arts citation total matches r3 (372)",
          sum(r["citation_count"] for r in arts) == r3_arts == 372,
          f"got {sum(r['citation_count'] for r in arts)} vs r3 {r3_arts}")
    check("pe citation total matches r3 (540)",
          sum(r["citation_count"] for r in pe) == r3_pe == 540,
          f"got {sum(r['citation_count'] for r in pe)} vs r3 {r3_pe}")

    a_cross = sum(r["citation_count"] for r in arts if r["evidence_class"] == "CROSSWALK_RESOLVED_STANDARD_LEVEL")
    a_hr = sum(r["citation_count"] for r in arts if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED")
    check("arts partitions exactly (324 + 48 = 372)", a_cross == 324 and a_hr == 48 and a_cross + a_hr == 372,
          f"{a_cross} + {a_hr}")

    p_alias = sum(r["citation_count"] for r in pe if r["evidence_class"] == "ALIAS_RESOLVED_VERBATIM")
    p_hr = sum(r["citation_count"] for r in pe if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED")
    check("pe partitions exactly (252 + 288 = 540)", p_alias == 252 and p_hr == 288 and p_alias + p_hr == 540,
          f"{p_alias} + {p_hr}")

    # the headline honesty guarantees
    check("no arts citation is VERBATIM/ALIAS/COMPOSITE (R4-ARTS-1)",
          not any(r["evidence_class"] in ("VERBATIM_VERIFIED", "ALIAS_RESOLVED_VERBATIM", "COMPOSITE_VERIFIED") for r in arts))
    check("no arts citation assigned an exact grade expectation (R4-ARTS-4)",
          all(r["exact_grade_expectation_assigned"] is False for r in arts))
    check("every arts citation stays MISATTRIBUTED_AS_AUTHORED (R4-BOTH-1)",
          all(r["citation_string_status"] == "MISATTRIBUTED_AS_AUTHORED" for r in arts))
    check("every unresolved pe citation stays MISATTRIBUTED_AS_AUTHORED (R4-BOTH-1)",
          all(r["citation_string_status"] == "MISATTRIBUTED_AS_AUTHORED"
              for r in pe if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"))
    check("no pe proposed_correction was applied (R4-PE-3)",
          all(r["proposed_correction"]["applied"] is False for r in pe if "proposed_correction" in r))
    check("no pe citation was promoted to COMPOSITE_VERIFIED (R4-PE-2)",
          not any(r["evidence_class"] == "COMPOSITE_VERIFIED" for r in pe))
    check("every divergent pe citation carries a source-meaning verdict",
          all("source_meaning" in r and r["source_meaning"]["meaning_preserved"] is False
              for r in pe if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"))
    check("every divergent pe authored text occurs 0x in the document",
          all(r["authored_text_occurrences_in_document"] == 0
              for r in pe if r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"))

    # registry round-trip (R4-BOTH-2)
    ids = {m["mapping_id"] for m in reg["mappings"]}
    listed = {i for v in inv["index"].values() for i in v}
    check("registry ids and inverse index cover the same mappings", ids == listed,
          f"only-in-registry={sorted(ids - listed)[:3]} only-in-inverse={sorted(listed - ids)[:3]}")
    check("registry covers every citation record", len(reg["mappings"]) == len(arts) + len(pe),
          f"{len(reg['mappings'])} vs {len(arts) + len(pe)}")
    rebuilt = {}
    for target, mids in inv["index"].items():
        for mid in mids:
            key = target.replace("ART-STANDARD-", "").split("-")[0] if target.startswith("ART-") else target
            rebuilt.setdefault(mid, []).append(key)
    ok = True
    for m in reg["mappings"]:
        got = sorted(rebuilt.get(m["mapping_id"], []))
        want = sorted(str(B.ARTS_ROMAN_TO_NUM[t]) if t in B.ARTS_ROMAN_TO_NUM else t for t in m["michigan_targets"])
        if got != want:
            ok = False
            break
    check("inverse index reconstructs every forward mapping (reversibility)", ok)
    check("every crosswalk mapping is flagged crosswalk-only, not alias/composite",
          all(m["is_crosswalk_only"] and not m["is_alias"] and not m["is_composite_of_official_elements"]
              for m in reg["mappings"] if m["mapping_id"].startswith("ARTS::")))

    check("unresolved list totals 336 (48 arts + 288 pe)", unres["total_citations_unresolved"] == 336,
          str(unres["total_citations_unresolved"]))
    check("before/after reports 0 arts resolved to an exact expectation",
          ba["arts"]["resolved_to_exact_grade_expectation"] == 0)
    check("before/after reports 0 arts as verbatim Michigan", ba["arts"]["verbatim_michigan"] == 0)
    check("before/after reports 0 pe newly resolved", ba["physical_education"]["newly_resolved"] == 0,
          str(ba["physical_education"]["newly_resolved"]))

    # boundary: this package owns only its own directory
    import subprocess
    root = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=str(OUT),
                          capture_output=True, text=True).stdout.strip()
    changed = subprocess.run(["git", "status", "--porcelain"], cwd=root,
                             capture_output=True, text=True).stdout.split()
    stray = [p for p in changed if p.startswith("curriculum") and "g34-specialty-arts-pe-r4" not in p]
    check("no file outside g34-specialty-arts-pe-r4/ is modified", not stray, str(stray[:4]))
    return arts, pe


# -------------------------------------------------------------------------- mutations


def run_build(patch):
    """Run the build against a mutated module state; return (verdict, output)."""
    saved = {k: copy.deepcopy(getattr(B, k)) for k in
             ("PINS", "PE_MEANING", "CROSSWALK", "ARTS_STANDARDS", "NCAS_PROCESS_WORDS")}
    saved_files = {p: p.read_bytes() for p in
                   list((OUT / "evidence").glob("*")) + list((OUT / "registry").glob("*"))
                   + list((OUT / "sources" / "extracts").glob("*"))}
    try:
        patch()
        buf = io.StringIO()
        try:
            with redirect_stdout(buf):
                B.main()
            return "built", buf.getvalue()
        except SystemExit as e:
            return "aborted", str(e)
        except Exception as e:  # noqa: BLE001
            return "error", f"{type(e).__name__}: {e}"
    finally:
        for k, v in saved.items():
            setattr(B, k, v)
        for p, b in saved_files.items():
            p.write_bytes(b)


def mutations():
    print("\nMUTATIONS  (each must abort the build or change the verdict)")

    def m_hash():
        B.PINS = dict(B.PINS, **{"mde-pe-2017": "0" * 64})
    v, msg = run_build(m_hash)
    check("corrupting a pinned SHA256 aborts the build", v == "aborted" and "sha256" in msg, f"{v}: {msg[:90]}")

    def m_pe_official():
        # Pretend Michigan prints the authored Standard 2 text. The classifier must then
        # resolve it as an alias - proving it reads the source rather than a hardcoded verdict.
        orig = B.extract_pe_standards

        def patched(pages):
            std = orig(pages)
            std["2"]["3-5"]["text"] = ("Applies knowledge of concepts, principles, strategies and tactics "
                                       "related to movement and physical activities.")
            return std
        B.extract_pe_standards = patched
    saved_fn = B.extract_pe_standards
    v, msg = run_build(m_pe_official)
    B.extract_pe_standards = saved_fn
    flipped = v == "built" and "'ALIAS_RESOLVED_VERBATIM': 444" in msg
    check("PE Standard 2 flips to ALIAS when the source is made to match",
          flipped, f"{v}: {msg.strip()[:120]}")

    def m_meaning_stale():
        B.PE_MEANING = copy.deepcopy(B.PE_MEANING)
        B.PE_MEANING["5"]["expect_official"] = ["a different phrase"]
    v, msg = run_build(m_meaning_stale)
    check("a source-meaning analysis that no longer matches its diff aborts",
          v == "aborted" and "meaning analysis" in msg, f"{v}: {msg[:90]}")

    def m_meaning_missing():
        B.PE_MEANING = {k: v for k, v in B.PE_MEANING.items() if k != "3"}
    v, msg = run_build(m_meaning_missing)
    check("a divergent PE standard with no recorded analysis aborts",
          v == "aborted" and "no recorded source-meaning" in msg, f"{v}: {msg[:90]}")

    def m_ncas_present():
        # If a Michigan document ever printed the NCAS words as names, rule R4-ARTS-1's
        # premise would be false and the build must refuse rather than quietly re-map.
        B.NCAS_PROCESS_WORDS = list(B.NCAS_PROCESS_WORDS) + ["Standard"]
    v, msg = run_build(m_ncas_present)
    check("NCAS words appearing capitalised in a Michigan doc aborts (R4-ARTS-1 premise)",
          v == "aborted" and "premise broken" in msg, f"{v}: {msg[:90]}")

    def m_bad_warrant():
        B.CROSSWALK = copy.deepcopy(B.CROSSWALK)
        B.CROSSWALK["Presenting"]["warrant_codes"] = ["ART.VA.I.99.9"]
    v, msg = run_build(m_bad_warrant)
    check("a crosswalk warrant code absent from the source aborts (R4-ARTS-2)",
          v == "aborted" and "warrant code" in msg, f"{v}: {msg[:90]}")

    def m_connecting_single():
        # Collapsing Connecting to one standard must move 48 citations out of review -
        # proving the 48 are held there by the two-target rule, not by a constant.
        B.CROSSWALK = copy.deepcopy(B.CROSSWALK)
        B.CROSSWALK["Connecting"]["michigan_standards"] = ["V"]
        B.CROSSWALK["Connecting"]["ambiguous"] = False
    v, msg = run_build(m_connecting_single)
    check("collapsing Connecting to one standard resolves the 48 (R4-ARTS-3)",
          v == "built" and "'CROSSWALK_RESOLVED_STANDARD_LEVEL': 372" in msg, f"{v}: {msg.strip()[:120]}")

    def m_arts_heading():
        B.ARTS_STANDARDS = copy.deepcopy(B.ARTS_STANDARDS)
        B.ARTS_STANDARDS["I"] = ("PERFORMANCE", B.ARTS_STANDARDS["I"][1])
    v, msg = run_build(m_arts_heading)
    check("a Michigan standard heading that drifts aborts",
          v == "aborted" and "heading" in msg, f"{v}: {msg[:90]}")

    print("\n  (tree restored after mutations)")
    B.main()


if __name__ == "__main__":
    invariants()
    mutations()
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    sys.exit(1 if FAIL else 0)
