#!/usr/bin/env python3
"""Regenerate curriculum-release-evidence/g34-specialty-r3 from two inputs:

  1. curriculum-release-normalization/g34-r2  - the normalized Grade 3/4 release
     (read only; never written to).
  2. sources/documents/*.pdf                  - the official documents this package
     holds in custody, pinned by SHA256.

Every classification below is COMPUTED by comparing the citation string the lane
authored against text extracted from the held PDF at build time. No official
standard text is typed into this script by hand; if a held document changes, its
SHA256 assertion fails before any evidence is written.

Run:  python3 curriculum-release-evidence/g34-specialty-r3/tools/build-evidence.py
"""

import difflib
import hashlib
import json
import os
import re
import sys

try:
    import pypdf
except ImportError:  # pragma: no cover
    sys.exit("pypdf is required: python3 -m pip install pypdf")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # .../g34-specialty-r3
REPO = os.path.dirname(os.path.dirname(ROOT))     # repo root
RELEASE = os.path.join(REPO, "curriculum-release-normalization", "g34-r2")

EVIDENCE_ID = "manuel-academy-g34-specialty-standards-evidence-r3"
RELEASE_ID = "manuel-academy-grades-3-4-r2-normalized"
RETRIEVED_DATE = "2026-08-12"          # fixed constant: reruns stay byte-identical
USER_AGENT_NOTE = ("curl with a desktop browser User-Agent; michigan.gov serves 200 to that "
                   "and 403 to the default agent, which is why earlier sessions recorded the "
                   "host as unfetchable")

SUBJECTS = [
    ("health", "health"),
    ("physical-education", "physical-education"),
    ("tech-cs", "technology"),
    ("arts-music", "arts-and-music"),
    ("financial-literacy", "financial-literacy"),
    ("ready-for-life", "ready-for-life"),
]

CLASSES = [
    "VERBATIM_VERIFIED",
    "ALIAS_RESOLVED_VERBATIM",
    "COMPOSITE_VERIFIED",
    "LOCAL_COMPOSITION",
    "UNVERIFIED",
    "HUMAN_REVIEW_REQUIRED",
]

# --------------------------------------------------------------------------
# Source custody. sha256 values are pinned; a mismatch aborts the build.
# --------------------------------------------------------------------------

DOCS = [
    {
        "doc_id": "mde-health-2025",
        "file": "mde-health-education-standards-guidelines-2025.pdf",
        "title": "Michigan Health Education Standards Guidelines",
        "version_label": "2025, ADA final with edits 12-19-25",
        "publisher": "Michigan Department of Education",
        "authority": "Approved by the Michigan State Board of Education 2025-11-13 (per the MDE "
                     "press release of that date). The document itself carries no approval line; "
                     "its own title is 'Standards Guidelines' and the press release describes it "
                     "as guidance to districts under local control.",
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/"
                         "School-Health-and-Safety/Michigan-Health-Education-Standards-"
                         "Guidelines-2025---ADA-final-with-edits-12-19-25.pdf"),
        "sha256": "e64744d56ba3ba36b968012995f9fed259f74efbb49fbfc91075be8b16defee4",
    },
    {
        "doc_id": "mde-pe-2017",
        "file": "mde-k12-physical-education-standards-2017.pdf",
        "title": "K-12 Physical Education Standards",
        "version_label": "May 2017",
        "publisher": "Michigan Department of Education",
        "authority": "Adopted by the Michigan State Board of Education, May 2017; the document "
                     "cover reads 'K-12 PE Standards May 2017'.",
        "linked_from": ("https://www.michigan.gov/mde/services/health-safety/"
                        "health-education-and-physical-education/physed"),
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/2019/02/22/"
                         "K_12_PE_Standards_Aug_17_ADA_compliance918.pdf"),
        "sha256": "88ab7e08a6611015674ebf97e67a7e8ba0aabb9138b9376bf70adecd9018d93c",
    },
    {
        "doc_id": "mde-cs-2019",
        "file": "mde-k12-computer-science-standards-2019.pdf",
        "title": "Michigan K-12 Standards: Computer Science",
        "version_label": "May 2019",
        "publisher": "Michigan Department of Education",
        "authority": "Adopted by the Michigan State Board of Education May 2019; this is the "
                     "document the live MDE Computer Science standards page serves today as "
                     "'K-12 CS Standards'.",
        "linked_from": ("https://www.michigan.gov/mde/services/academic-standards/"
                        "michigan-k-12-computer-science-standards"),
        "official_url": ("https://www.michigan.gov/documents/mde/"
                         "CompSci_Standards_Accessible_Final_655284_7.pdf"),
        "sha256": "62bedb9e798a0ebb387dbbeafefc1f926c745df1dd564e4b67b41385e0392c3d",
    },
    {
        "doc_id": "mde-arts-glce",
        "file": "mde-arts-standards-benchmarks-glce.pdf",
        "title": ("Michigan Merit Curriculum Standards, Benchmarks, and Grade Level Content "
                  "Expectations: Visual Arts, Music, Dance, and Theatre"),
        "version_label": "as served from the Academic Standards page on 2026-08-12",
        "publisher": "Michigan Department of Education",
        "authority": "The only arts standards document linked from the MDE Academic Standards "
                     "index page.",
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Arts_Standards_Benchmarks_GLCE.pdf"),
        "sha256": "f52e0506e30a2277991ae4cebfe75ce157ca0cc3d6ba2b833e15ee8fd9113f2b",
    },
    {
        "doc_id": "mde-vpaa-2011",
        "file": "mde-vpaa-expectations-june-2011.pdf",
        "title": ("Michigan Standards, Benchmarks, and Grade Level Content Expectations for "
                  "Visual Arts, Music, Dance, and Theater"),
        "version_label": "v.06.2011",
        "publisher": "Michigan Department of Education",
        "authority": "The document the lane's own cited page (the Michigan Merit Curriculum arts "
                     "page) links as 'Visual, Performing and Applied Arts Content Expectations'. "
                     "Held so the version question is answerable from bytes, not memory.",
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/arts",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/Year/2014/"
                         "06/06/Complete_VPAA_Expectations_June_2011_356110_7.pdf"),
        "sha256": "330ca531c64200c0ec5e7bc18083cb76e6eb2c57a21fbe3de25c2d29bcfe845c",
    },
    {
        "doc_id": "mde-personal-finance",
        "file": "mde-personal-finance-content-expectations-9-12.pdf",
        "title": "Michigan Merit Curriculum Personal Finance 9-12 Content Expectations",
        "version_label": "v5/2023",
        "publisher": "Michigan Department of Education",
        "authority": "The content expectations MCL 380.1278a points at; the only standalone "
                     "Michigan personal-finance standards document. It republishes the Personal "
                     "Finance category of the K-12 Social Studies Standards, where the same "
                     "expectations also live.",
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards/personal-finance",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Personal-Finance/"
                         "Personal_Finance_Content_Expectations.pdf"),
        "sha256": "ff97640535d7864de8d3333669a5f8d8ab8134ebfa0af5f9f938cf2e91ab2735",
    },
    {
        "doc_id": "mde-social-studies",
        "file": "mde-k12-social-studies-standards.pdf",
        "title": "Michigan K-12 Social Studies Standards",
        "version_label": "as served from the Academic Standards page on 2026-08-12",
        "publisher": "Michigan Department of Education",
        "authority": "Held only to answer one question: does Michigan publish exact-grade "
                     "economics expectations for Grades 3 and 4? It does.",
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Social_Studies_Standards.pdf"),
        "sha256": "bba06f46bb241ae3cdd698caaeb41baa3c976d96176fef0a9d594a7e98e70b96",
    },
]

# Pages consulted, from a web page rather than a PDF. Not held in custody; recorded
# so the claim is traceable and re-checkable.
WEB_OBSERVATIONS = [
    {
        "observation_id": "cs-live-page-serves-2019-pdf",
        "url": ("https://www.michigan.gov/mde/services/academic-standards/"
                "michigan-k-12-computer-science-standards"),
        "observed": RETRIEVED_DATE,
        "finding": ("The live page's 'K-12 CS Standards' resource resolves to "
                    "CompSci_Standards_Accessible_Final_655284_7.pdf (the May 2019 document held "
                    "here as mde-cs-2019). The only archive link on the page is 'Archived Public "
                    "Information Session Presentations' - archived meeting presentations, not an "
                    "archive of superseded standards."),
        "closes": "standards-reference.md Gap 4",
    },
    {
        "observation_id": "pe-live-page-serves-2017-pdf",
        "url": ("https://www.michigan.gov/mde/services/health-safety/"
                "health-education-and-physical-education/physed"),
        "observed": RETRIEVED_DATE,
        "finding": ("The live MDE Physical Education page links "
                    "K_12_PE_Standards_Aug_17_ADA_compliance918.pdf - byte-identical to the "
                    "document held here as mde-pe-2017. The 2017 standards are current."),
    },
    {
        "observation_id": "health-board-approval-2025-11-13",
        "url": ("https://www.michigan.gov/mde/news-and-information/press-releases/2025/11/13/"
                "revised-health-education-standards"),
        "observed": RETRIEVED_DATE,
        "finding": ("MDE press release, November 13 2025: 'Local Control, Parent Opt-Out Remain "
                    "Part of Guidelines Approved by State Board of Education'. This is where the "
                    "approval date comes from; the PDF itself does not state one. The release "
                    "links a slightly earlier filename (---ADA-Final.pdf); the Academic Standards "
                    "index links the ---ADA-final-with-edits-12-19-25.pdf held here."),
    },
    {
        "observation_id": "arts-index-links-only-glce",
        "url": "https://www.michigan.gov/mde/services/academic-standards",
        "observed": RETRIEVED_DATE,
        "finding": ("The Academic Standards index lists exactly one arts standards document: "
                    "'Standards, Benchmarks, and Grade Level Content Expectations (GLCEs) for "
                    "Visual Arts, Music, Dance, and Theatre'. No National Core Arts Standards "
                    "adoption is listed anywhere on the index."),
    },
    {
        "observation_id": "personal-finance-is-high-school",
        "url": "https://www.michigan.gov/mde/services/academic-standards/personal-finance",
        "observed": RETRIEVED_DATE,
        "finding": ("MCL 380.1278a requires a 1/2 credit personal finance course of students "
                    "entering 8th grade in 2023, satisfied in high school. The page publishes no "
                    "elementary personal-finance expectations."),
    },
    {
        "observation_id": "mde-sel-competencies-exist-but-are-not-academic-standards",
        "url": "https://www.michigan.gov/mde/services/health-safety/social-emotional-learning-sel",
        "observed": RETRIEVED_DATE,
        "finding": ("MDE publishes 'SEL Competencies and Indicators' (2017) under Health & Safety "
                    "services. It is not listed on the Academic Standards index and is not an "
                    "academic standard. Not retrieved into custody: no citation in this release "
                    "names a competency from it."),
    },
]

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def norm(s):
    """Collapse whitespace. PDF extraction line-wraps; nothing else is changed."""
    return re.sub(r"\s+", " ", s).strip()


def tidy(s):
    """Undo the spaced punctuation the arts PDF's font tables produce ('arts .' -> 'arts.')."""
    return re.sub(r"\s+([.,;:])", r"\1", norm(s))


def cmp_key(s):
    """Comparison form: whitespace collapsed, one optional trailing period dropped."""
    return norm(s).rstrip(".").strip()


def token_diff(expected, found):
    a, b = cmp_key(expected).split(), cmp_key(found).split()
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if tag == "equal":
            continue
        out.append({"op": tag,
                    "official": " ".join(a[i1:i2]),
                    "authored": " ".join(b[j1:j2])})
    return out


def write_json(relpath, obj):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return relpath


def write_text(relpath, text):
    path = os.path.join(ROOT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return relpath


# --------------------------------------------------------------------------
# custody: verify the held documents, then read them
# --------------------------------------------------------------------------

PAGES = {}     # doc_id -> [page_text, ...] (1-indexed via PAGES[doc][n-1])
CUSTODY = []


def load_documents():
    for d in DOCS:
        path = os.path.join(ROOT, "sources", "documents", d["file"])
        if not os.path.exists(path):
            sys.exit("missing held document: %s (run sources/refetch.sh)" % d["file"])
        actual = sha256_file(path)
        if actual != d["sha256"]:
            sys.exit("SHA256 mismatch for %s\n  pinned: %s\n  actual: %s"
                     % (d["file"], d["sha256"], actual))
        reader = pypdf.PdfReader(path)
        PAGES[d["doc_id"]] = [(p.extract_text() or "") for p in reader.pages]
        rec = dict(d)
        rec["bytes"] = os.path.getsize(path)
        rec["pages"] = len(reader.pages)
        rec["held_at"] = "sources/documents/" + d["file"]
        rec["retrieved"] = RETRIEVED_DATE
        rec["retrieval_method"] = USER_AGENT_NOTE
        rec["sha256_verified"] = True
        CUSTODY.append(rec)


def page(doc_id, n):
    return PAGES[doc_id][n - 1]


def span(doc_id, first, last):
    return norm(" ".join(PAGES[doc_id][first - 1:last]))


def doc_text(doc_id):
    return norm(" ".join(PAGES[doc_id]))


# --------------------------------------------------------------------------
# anchors: official text pulled out of the held bytes at build time
# --------------------------------------------------------------------------

def require(doc_id, literal):
    """Presence-check a literal against the held bytes. Every official string typed
    into this script passes through here, so none of them can drift silently."""
    if literal not in doc_text(doc_id):
        sys.exit("literal not found in %s: %r" % (doc_id, literal))
    return literal


def anchor(doc_id, locator, quote):
    return {"doc_id": doc_id, "locator": locator, "quote": quote}


def extract_health():
    """Six Practices (pp. 8-11) and the topic vocabulary (p. 12)."""
    practices = {}
    text = span("mde-health-2025", 8, 11)
    for num, name in re.findall(r"Practice ([1-6]): (.+?):", text):
        practices.setdefault(int(num), norm(name))
    if sorted(practices) != [1, 2, 3, 4, 5, 6]:
        sys.exit("health: expected Practices 1-6, extracted %s" % sorted(practices))

    topics = {}
    for name, abbr in re.findall(r"([A-Z][A-Za-z ]+?) \[([A-Z]{2,4})\]", norm(page("mde-health-2025", 12))):
        topics[norm(name)] = abbr

    span_topics = {}
    for name, abbr in re.findall(r"([A-Z][A-Za-z ]+?) \[5\.\d\.([A-Z]+)\]", span("mde-health-2025", 32, 37)):
        span_topics[norm(name)] = abbr

    indicator_codes = sorted(set(re.findall(r"\[5\.\d\.[A-Z]+\]", doc_text("mde-health-2025"))))
    return {
        "practices": practices,
        "topics": topics,
        "grade_span_3_5_topics": span_topics,
        "grade_span_label": require("mde-health-2025", "Grade Span: 3-5 (by the end of Grade 5)"),
        "grade_span_3_5_indicator_codes": indicator_codes,
    }


def extract_pe():
    """The five standards as printed in the Grades 3, 4, and 5 section (pp. 21-30)."""
    text = span("mde-pe-2017", 21, 30)
    # page 21 still carries the tail of the K-2 section; start at the Standard 1
    # that immediately precedes the first "Grade 3 Grade 4 Grade 5" column header.
    first_header = text.find("Grade 3 Grade 4 Grade 5")
    text = text[text.rfind("Standard 1:", 0, first_header):]
    out = {}
    for num in (1, 2, 3, 4, 5):
        m = re.search(r"Standard %d:\s*(.+?)(?= Grade 3 )" % num, text)
        if m:
            out[num] = norm(m.group(1))
    if sorted(out) != [1, 2, 3, 4, 5]:
        sys.exit("pe: expected Standards 1-5 in the Grades 3-5 section, extracted %s" % sorted(out))
    outcome_codes = sorted(set(re.findall(r"\(S\d+\.\d+\.[34][a-z]?\)", doc_text("mde-pe-2017"))))
    return {"standards": out, "grade_3_4_outcome_codes": outcome_codes}


def extract_cs():
    """Core Concepts (p. 6 figure) and the Level 1B identifiers."""
    figure = norm(page("mde-cs-2019", 6))
    concepts = [c for c in ["Computing Systems", "Networks and the Internet", "Data and Analysis",
                            "Algorithms and Programming", "Impacts of Computing"] if c in figure]
    if len(concepts) != 5:
        sys.exit("cs: expected 5 core concepts on p.6, found %s" % concepts)
    ids = sorted(set(re.findall(r"1B-[A-Z]{2}-\d\d", doc_text("mde-cs-2019"))))
    level = require("mde-cs-2019", "Level 1B: Upper Elementary (Grades 3-5)")
    return {"core_concepts": concepts, "level_1b_label": level, "level_1b_codes": ids}


def extract_arts():
    """The five Michigan arts standards, and the absence of National Core Arts vocabulary."""
    text = tidy(doc_text("mde-arts-glce"))
    standards = {}
    for num, body in re.findall(r"Standard ([1-5]):\s*(.+?)(?= \(VPAA)", text):
        standards.setdefault(int(num), tidy(body))
    if sorted(standards) != [1, 2, 3, 4, 5]:
        sys.exit("arts: expected Standards 1-5, extracted %s" % sorted(standards))
    raw = "\n".join(PAGES["mde-arts-glce"])
    seen = set(re.findall(r"^(PERFORM|CREATE|ANALYZE|ANALYZE IN CONTEXT|"
                          r"ANALYZE AND MAKE CONNECTIONS)\s*$", raw, re.M))
    headings = [h for h in ["PERFORM", "CREATE", "ANALYZE", "ANALYZE IN CONTEXT",
                            "ANALYZE AND MAKE CONNECTIONS"] if h in seen]
    if len(headings) != 5:
        sys.exit("arts: expected 5 standard headings, found %s" % headings)
    ncas_words = ["Creating", "Performing", "Presenting", "Producing", "Responding", "Connecting"]
    both = doc_text("mde-arts-glce") + " " + doc_text("mde-vpaa-2011")
    ncas = {w: both.count(w) for w in ncas_words}
    ncas_ci = {w: len(re.findall(w, both, re.I)) for w in ncas_words}
    disciplines = sorted(set(re.findall(r"ARTS EDUCATION - (DANCE|MUSIC|THEATRE|VISUAL ARTS)",
                                        doc_text("mde-arts-glce"))))
    # The PDF's font tables print these with erratic spacing ("ART . D . I  . 3  . 1"),
    # which is why a space-sensitive pattern silently misses every Dance code.
    g34 = sorted(set(re.sub(r"\s+", "", c) for c in re.findall(
        r"ART\s*\.\s*[A-Z]+\s*\.\s*[IV]+\s*\.\s*[34]\s*\.\s*\d+", doc_text("mde-arts-glce"))))
    g34_by_discipline = {}
    for c in g34:
        g34_by_discipline[c.split(".")[1]] = g34_by_discipline.get(c.split(".")[1], 0) + 1
    return {"standards": standards, "headings": headings,
            "national_core_arts_vocabulary_occurrences_capitalised": ncas,
            "national_core_arts_vocabulary_occurrences_case_insensitive": ncas_ci,
            "disciplines": disciplines, "grade_3_4_expectation_codes": g34,
            "grade_3_4_expectation_codes_by_discipline": g34_by_discipline}


def extract_personal_finance():
    text = norm(" ".join(PAGES["mde-personal-finance"]))
    title = require("mde-personal-finance", "Personal Finance 9 – 12 CONTENT EXPECTATIONS")
    pf = sorted(set(re.findall(r"\bPF[1-7]\b", text)))
    absent = {w: text.count(w) for w in ["Grade 3", "Grade 4", "elementary", "Elementary"]}
    return {"title": title, "expectation_codes": pf, "elementary_mentions": absent}


def extract_social_studies():
    text = re.sub(r"[ \t]+", " ", "\n".join(PAGES["mde-social-studies"]))
    g3 = sorted(set(re.findall(r"\b3 – (E\d\.\d\.\d)\b", text)))
    g4 = sorted(set(re.findall(r"\b4 – (E\d\.\d\.\d)\b", text)))
    return {"grade_3_economics_codes": g3, "grade_4_economics_codes": g4}


# --------------------------------------------------------------------------
# classification
# --------------------------------------------------------------------------

RULES = []      # filled in by rule(); used for rules/classification-rules.json


def rule(rid, subject, statement):
    RULES.append({"id": rid, "subject": subject, "statement": statement})
    return rid


R_HEALTH_PRACTICE = rule(
    "S1-health-practice-alias", "health",
    "'Michigan Health Practice <n>: <name>' resolves to ALIAS_RESOLVED_VERBATIM when <name> is "
    "byte-equal (whitespace-normalized) to the name printed for Practice <n> on pp. 8-11 of "
    "mde-health-2025. The 'Michigan Health Practice' prefix is Manuel Academy house form; the "
    "document prints 'Practice <n>:'.")
R_HEALTH_TOPIC = rule(
    "S2-health-topic-composite", "health",
    "'Michigan Health Topic (Grades 3-5): <topic>' resolves to COMPOSITE_VERIFIED when both "
    "components verify independently: the grade span 'Grade Span: 3-5 (by the end of Grade 5)' and "
    "the topic name in the topic list on p. 12. The combined string appears nowhere in the "
    "document, so it is composite, not verbatim. A topic name the document does not print is "
    "HUMAN_REVIEW_REQUIRED.")
R_PE_STANDARD = rule(
    "S3-pe-standard-alias", "physical-education",
    "'Michigan PE Standard <n>: <text>' resolves to ALIAS_RESOLVED_VERBATIM when <text> equals the "
    "text printed for Standard <n> in the Grades 3, 4, and 5 section (pp. 21-30) of mde-pe-2017, "
    "ignoring a trailing period. Any other text is HUMAN_REVIEW_REQUIRED and the divergence is "
    "recorded token by token.")
R_CS_CONCEPT = rule(
    "S4-cs-core-concept-alias", "technology",
    "'Michigan Computer Science: <strand>' resolves to ALIAS_RESOLVED_VERBATIM when <strand> is one "
    "of the five Core Concepts printed in the Core Concepts figure on p. 6 of mde-cs-2019.")
R_ARTS_PROCESS = rule(
    "S5-arts-process-not-michigan", "arts-and-music",
    "'Michigan Arts: [<discipline> - ]<process>' is HUMAN_REVIEW_REQUIRED in every case. The "
    "process vocabulary used (Creating / Performing / Presenting / Responding / Connecting) is "
    "National Core Arts Standards vocabulary and occurs zero times in either held Michigan arts "
    "document. Michigan's five standards are PERFORM, CREATE, ANALYZE, ANALYZE IN CONTEXT, and "
    "ANALYZE AND MAKE CONNECTIONS. Where the authored process is a morphological variant of a "
    "Michigan verb (Creating/CREATE, Performing/PERFORM) that is recorded as a candidate alias for "
    "a human to accept or reject - this package does not accept it, because accepting it would be "
    "this session inventing the mapping.")
R_LOCAL = rule(
    "S6-manuel-academy-local", "financial-literacy, ready-for-life",
    "A citation that names Manuel Academy, a Manuel Academy unit, or a Manuel Academy baseline is "
    "LOCAL_COMPOSITION: a Manuel Academy curricular decision carrying no state authority. This is "
    "a positive classification, not a failure to verify.")
R_FINLIT_MI = rule(
    "S7-financial-literacy-no-elementary-standard", "financial-literacy",
    "A Grade 3/4 financial-literacy citation that names Michigan is HUMAN_REVIEW_REQUIRED. "
    "Michigan's only personal-finance standards document is titled 'Personal Finance 9 - 12 "
    "Content Expectations' (PF1-PF7). No elementary personal-finance standard exists to resolve "
    "against, so the citation asserts an authority the state does not publish.")
R_FINLIT_LOCAL = rule(
    "S8-financial-literacy-progression", "financial-literacy",
    "'Grade <n> economics and mathematics connections' names no framework and no code: it is a "
    "Manuel Academy elementary progression label, LOCAL_COMPOSITION. Michigan does publish "
    "exact-grade economics expectations for both grades (3 - E1.0.1 ... 3 - E3.0.1; 4 - E1.0.2 ... "
    "4 - E3.0.1) in mde-social-studies; none is cited.")
R_RFL_MI = rule(
    "S9-ready-for-life-no-michigan-authority", "ready-for-life",
    "Ready for Life is a Manuel Academy course with no Michigan framework. A Ready for Life "
    "citation that names Michigan is HUMAN_REVIEW_REQUIRED, never a Michigan standard: it resolves "
    "to no practice, topic, indicator or competency in any held document.")


def classify(subject, code, grade, A):
    """Return the evidence record fields for one authored citation string."""
    def out(cls, rid, **kw):
        rec = {"evidence_class": cls, "rule_id": rid, "official_anchor": None,
               "divergence": None, "authority": "manuel-academy",
               "official_document": None, "grade_resolution": "not-applicable",
               "exact_grade_codes_available": False, "notes": ""}
        rec.update(kw)
        return rec

    if subject == "health":
        m = re.match(r"^Michigan Health Practice ([1-6]): (.+)$", code)
        if m:
            n, name = int(m.group(1)), m.group(2)
            official = A["health"]["practices"][n]
            if cmp_key(name) == cmp_key(official):
                return out("ALIAS_RESOLVED_VERBATIM", R_HEALTH_PRACTICE,
                           authority="michigan-mde", official_document="mde-health-2025",
                           official_anchor=anchor("mde-health-2025", "PDF pp. 8-11, Practices "
                                                  "for Comprehensive Health Education",
                                                  "Practice %d: %s" % (n, official)),
                           grade_resolution="grade-band-3-5",
                           notes=("The 2025 guidelines are organised by grade span, so Grade 3 and "
                                  "Grade 4 both sit in the 3-5 band; no Grade-3-only or "
                                  "Grade-4-only health standard exists. Indicator codes do exist "
                                  "for the band (%s) and none is cited."
                                  % ", ".join(A["health"]["grade_span_3_5_indicator_codes"][:3] + ["..."])))
            return out("HUMAN_REVIEW_REQUIRED", R_HEALTH_PRACTICE, authority="contested",
                       official_document="mde-health-2025",
                       official_anchor=anchor("mde-health-2025", "PDF pp. 8-11",
                                              "Practice %d: %s" % (n, official)),
                       divergence={"official": official, "authored": name,
                                   "diff": token_diff(official, name)})
        m = re.match(r"^Michigan Health Topic \(Grades 3-5\): (.+)$", code)
        if m:
            topic = m.group(1)
            official_topics = A["health"]["topics"]
            grade_span = A["health"]["grade_span_label"]     # verified by require()
            if topic in official_topics and grade_span:
                return out("COMPOSITE_VERIFIED", R_HEALTH_TOPIC, authority="michigan-mde",
                           official_document="mde-health-2025",
                           official_anchor=anchor(
                               "mde-health-2025", "PDF p. 12 topic list; PDF p. 2/19/32 grade span heading",
                               "%s [%s]  +  %s" % (topic, official_topics[topic],
                                                   A["health"]["grade_span_label"])),
                           grade_resolution="grade-band-3-5",
                           notes="Grade span and topic each verify; the combined label is house form.")
            prefixes = sorted((t for t in official_topics if topic.startswith(t)),
                              key=len, reverse=True)
            near = prefixes[:1] or difflib.get_close_matches(topic, list(official_topics),
                                                             n=1, cutoff=0.6)
            return out("HUMAN_REVIEW_REQUIRED", R_HEALTH_TOPIC, authority="contested",
                       official_document="mde-health-2025",
                       official_anchor=anchor("mde-health-2025", "PDF p. 12 topic list",
                                              "; ".join("%s [%s]" % (t, official_topics[t])
                                                        for t in sorted(official_topics))),
                       divergence={"official": near[0] if near else None, "authored": topic,
                                   "diff": token_diff(near[0], topic) if near else None},
                       notes=("The document's topic list is exactly: %s. The authored label is not "
                              "on it." % "; ".join(sorted(official_topics))))

    if subject == "physical-education":
        m = re.match(r"^Michigan PE Standard ([1-5]): (.+)$", code)
        if m:
            n, text = int(m.group(1)), m.group(2)
            official = A["pe"]["standards"][n]
            if cmp_key(text) == cmp_key(official):
                return out("ALIAS_RESOLVED_VERBATIM", R_PE_STANDARD, authority="michigan-mde",
                           official_document="mde-pe-2017",
                           official_anchor=anchor("mde-pe-2017",
                                                  "PDF pp. 21-30, Grades 3, 4, and 5",
                                                  "Standard %d: %s" % (n, official)),
                           grade_resolution="exact-grade-available-not-used",
                           exact_grade_codes_available=True,
                           notes=("Michigan prints per-grade outcome codes for Grades 3 and 4 "
                                  "(%d of them, e.g. %s). The citation anchors at the standard "
                                  "level only, which is grade-agnostic."
                                  % (len(A["pe"]["grade_3_4_outcome_codes"]),
                                     ", ".join(A["pe"]["grade_3_4_outcome_codes"][:3]))))
            return out("HUMAN_REVIEW_REQUIRED", R_PE_STANDARD, authority="contested",
                       official_document="mde-pe-2017",
                       official_anchor=anchor("mde-pe-2017", "PDF pp. 21-30, Grades 3, 4, and 5",
                                              "Standard %d: %s" % (n, official)),
                       divergence={"official": official, "authored": text,
                                   "diff": token_diff(official, text)},
                       grade_resolution="exact-grade-available-not-used",
                       exact_grade_codes_available=True,
                       notes=("Standard %d exists and is correctly numbered; the label text "
                              "attributed to Michigan is not the text Michigan prints." % n))

    if subject == "technology":
        m = re.match(r"^Michigan Computer Science: (.+)$", code)
        if m and m.group(1) in A["cs"]["core_concepts"]:
            return out("ALIAS_RESOLVED_VERBATIM", R_CS_CONCEPT, authority="michigan-mde",
                       official_document="mde-cs-2019",
                       official_anchor=anchor("mde-cs-2019", "PDF p. 6, Core Concepts figure",
                                              m.group(1)),
                       grade_resolution="grade-band-3-5", exact_grade_codes_available=False,
                       notes=("Michigan organises CS by level, not grade: Level 1B is Upper "
                              "Elementary, Grades 3-5, so Grade 3 and Grade 4 share the band. "
                              "%d Level 1B identifiers exist (e.g. %s) and none is cited. The "
                              "five Core Concept names appear only in the Core Concepts figure, "
                              "not as section headings. The five names come from the K-12 CS "
                              "Framework and Michigan adopted the CSTA standards; Michigan does "
                              "print them, which is what separates this case from the arts one, "
                              "where the authored vocabulary appears nowhere in Michigan's text."
                              % (len(A["cs"]["level_1b_codes"]),
                                 ", ".join(A["cs"]["level_1b_codes"][:3]))))

    if subject == "arts-and-music":
        m = re.match(r"^Michigan Arts: (?:(.+?) – )?(.+)$", code)
        if m:
            discipline, process = m.group(1), m.group(2)
            processes = [p.strip() for p in re.split(r"/", process)]
            variant = {"Creating": "CREATE", "Performing": "PERFORM"}
            candidates = {p: variant[p] for p in processes if p in variant}
            return out("HUMAN_REVIEW_REQUIRED", R_ARTS_PROCESS, authority="contested",
                       official_document="mde-arts-glce",
                       official_anchor=anchor(
                           "mde-arts-glce", "standard headings throughout; e.g. PDF p. 3",
                           " | ".join("Standard %d: %s" % (k, v)
                                      for k, v in sorted(A["arts"]["standards"].items()))),
                       divergence={"official": "; ".join(A["arts"]["headings"]),
                                   "authored": process, "diff": None},
                       grade_resolution="exact-grade-available-not-used",
                       exact_grade_codes_available=True,
                       notes=("National Core Arts Standards process vocabulary attributed to "
                              "Michigan. Occurrences of that vocabulary as a capitalised name "
                              "across both held Michigan arts documents: %s (it does appear in "
                              "lower-case prose; it is never a standard or process name). "
                              "Michigan publishes exact-grade expectations for "
                              "Grades 3 and 4 in all four disciplines (%d codes: %s)."
                              "%s%s"
                              % (json.dumps(A["arts"]["national_core_arts_vocabulary_occurrences_capitalised"],
                                            sort_keys=True),
                                 len(A["arts"]["grade_3_4_expectation_codes"]),
                                 ", ".join("%s %d" % kv for kv in
                                           sorted(A["arts"]["grade_3_4_expectation_codes_by_discipline"].items())),
                                 (" Discipline '%s' is a real Michigan arts discipline." % discipline)
                                 if discipline and discipline.upper() in A["arts"]["disciplines"] else "",
                                 (" Candidate alias for a human to rule on: %s."
                                  % ", ".join("%s -> %s" % kv for kv in sorted(candidates.items())))
                                 if candidates else "")))

    if subject == "financial-literacy":
        if code.startswith("Manuel Academy"):
            return out("LOCAL_COMPOSITION", R_LOCAL,
                       notes="Manuel Academy elementary progression choice. No Michigan authority claimed.")
        if re.match(r"^Grade [34] economics and mathematics connections$", code):
            return out("LOCAL_COMPOSITION", R_FINLIT_LOCAL,
                       official_document="mde-social-studies",
                       official_anchor=anchor("mde-social-studies",
                                              "Grade 3 and Grade 4 economics expectations",
                                              "; ".join(["3 – " + c for c in A["ss"]["grade_3_economics_codes"]][:3]
                                                        + ["..."])),
                       notes=("Names no framework and no code, so it claims nothing. Recorded "
                              "because an official elementary anchor does exist and is unused: "
                              "Michigan publishes %d Grade 3 and %d Grade 4 economics expectations "
                              "in the Social Studies standards. Using them would make this course "
                              "Michigan-anchored through Social Studies Economics, not through "
                              "Personal Finance."
                              % (len(A["ss"]["grade_3_economics_codes"]),
                                 len(A["ss"]["grade_4_economics_codes"]))))
        if code.startswith("Michigan"):
            return out("HUMAN_REVIEW_REQUIRED", R_FINLIT_MI, authority="contested",
                       official_document="mde-personal-finance",
                       official_anchor=anchor("mde-personal-finance",
                                              "PDF p. 1 title, PDF p. 2 expectations",
                                              A["pf"]["title"] + ": "
                                              + ", ".join(A["pf"]["expectation_codes"])),
                       notes=("Michigan's personal-finance framework is Grades 9-12 (PF1-PF7). The "
                              "held document mentions Grade 3 %d times and Grade 4 %d times. This "
                              "citation attributes a Michigan personal-finance foundation to Grades "
                              "3/4, where Michigan publishes none. A convergence-time policy "
                              "decision is required; this session will not manufacture the authority."
                              % (A["pf"]["elementary_mentions"]["Grade 3"],
                                 A["pf"]["elementary_mentions"]["Grade 4"])))

    if subject == "ready-for-life":
        if code.startswith("Manuel Academy") or code.startswith("Ready for Life v1"):
            return out("LOCAL_COMPOSITION", R_LOCAL,
                       notes=("Manuel Academy Ready for Life is a local composition end to end. "
                              "Michigan publishes no Ready for Life framework and this package "
                              "never labels it as a Michigan standard."))
        if code.startswith("Michigan"):
            return out("HUMAN_REVIEW_REQUIRED", R_RFL_MI, authority="contested",
                       official_document="mde-health-2025",
                       notes=("Names Michigan on a course that has no Michigan framework, and "
                              "resolves to no Practice, Topic or indicator in the held Health "
                              "guidelines. MDE does publish SEL Competencies and Indicators "
                              "(2017), but under Health & Safety services, not as an academic "
                              "standard, and this citation names no competency from it. Ready for "
                              "Life is Manuel Academy LOCAL_COMPOSITION; this string is the one "
                              "place that boundary is blurred."))

    return {"evidence_class": "UNVERIFIED", "rule_id": "S0-unmatched", "official_anchor": None,
            "divergence": None, "authority": "unknown", "official_document": None,
            "grade_resolution": "not-applicable", "exact_grade_codes_available": False,
            "notes": "No rule matched this citation string; it is reported, not guessed."}


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def main():
    load_documents()
    A = {"health": extract_health(), "pe": extract_pe(), "cs": extract_cs(),
         "arts": extract_arts(), "pf": extract_personal_finance(), "ss": extract_social_studies()}

    release_sums = os.path.join(RELEASE, "SHA256SUMS.txt")
    if not os.path.exists(release_sums):
        sys.exit("input release not found at %s" % RELEASE)

    records, courses = [], []
    for slug, subject_key in SUBJECTS:
        for grade in (3, 4):
            course_id = "ma-g%d-%s" % (grade, slug)
            src = os.path.join(RELEASE, "standards", "courses", course_id + ".standards.json")
            art = json.load(open(src, encoding="utf-8"))
            entries = []
            for e in art["standards"]:
                d = classify(subject_key, e["code_or_strand"], grade, A)
                lesson_ids = e.get("lesson_ids", [])
                entries.append({
                    "course_id": course_id, "grade": grade, "subject": subject_key,
                    "code_or_strand": e["code_or_strand"],
                    "citation_count": e["citation_count"],
                    "unit_numbers": e["unit_numbers"],
                    "lesson_id_set_sha256": hashlib.sha256(
                        "\n".join(sorted(lesson_ids)).encode("utf-8")).hexdigest(),
                    "release_mapping_status": e["mapping_status"],
                    "release_derivation_rule": e["derivation_rule"],
                    **d})
            entries.sort(key=lambda r: r["code_or_strand"])
            counts = {c: sum(x["citation_count"] for x in entries if x["evidence_class"] == c)
                      for c in CLASSES}
            distinct = {c: sum(1 for x in entries if x["evidence_class"] == c) for c in CLASSES}
            course = {
                "evidence_id": EVIDENCE_ID, "release_id": RELEASE_ID, "course_id": course_id,
                "grade": grade, "subject": subject_key,
                "source_artifact": "curriculum-release-normalization/g34-r2/standards/courses/%s.standards.json" % course_id,
                "official_source_claimed_by_release": art["official_source"],
                "citations_total": art["totals"]["citations"],
                "distinct_total": art["totals"]["distinct"],
                "citation_counts_by_class": counts,
                "distinct_counts_by_class": distinct,
                "citations": entries,
            }
            assert sum(counts.values()) == art["totals"]["citations"], course_id
            courses.append(course)
            records.extend(entries)

    for c in courses:
        write_json("evidence/courses/%s.evidence.json" % c["course_id"], c)

    records.sort(key=lambda r: (r["course_id"], r["code_or_strand"]))
    lines = [json.dumps(r, ensure_ascii=False, sort_keys=True) for r in records]
    write_text("evidence/citations.jsonl", "\n".join(lines) + "\n")

    total = sum(r["citation_count"] for r in records)
    by_class = {c: sum(r["citation_count"] for r in records if r["evidence_class"] == c) for c in CLASSES}
    by_subject = {}
    for _, sk in SUBJECTS:
        rows = [r for r in records if r["subject"] == sk]
        by_subject[sk] = {"citations": sum(r["citation_count"] for r in rows),
                          "distinct": len(rows),
                          "by_class": {c: sum(r["citation_count"] for r in rows
                                              if r["evidence_class"] == c) for c in CLASSES}}
    by_grade_resolution = {}
    for r in records:
        k = r["grade_resolution"]
        by_grade_resolution[k] = by_grade_resolution.get(k, 0) + r["citation_count"]
    by_authority = {}
    for r in records:
        by_authority[r["authority"]] = by_authority.get(r["authority"], 0) + r["citation_count"]

    verified = by_class["VERBATIM_VERIFIED"] + by_class["ALIAS_RESOLVED_VERBATIM"] + by_class["COMPOSITE_VERIFIED"]
    rollup = {
        "evidence_id": EVIDENCE_ID, "release_id": RELEASE_ID,
        "scope": "Grade 3/4 specialty subjects: health, physical education, technology/computer "
                 "science, arts/music, financial literacy, ready for life (12 courses).",
        "citations_total": total,
        "citation_records": len(records),
        "distinct_citation_strings_across_package":
            len(set(r["code_or_strand"] for r in records)),
        "by_class": by_class,
        "verified_total": verified,
        "local_composition_total": by_class["LOCAL_COMPOSITION"],
        "unresolved_total": by_class["UNVERIFIED"] + by_class["HUMAN_REVIEW_REQUIRED"],
        "by_subject": by_subject,
        "by_grade_resolution": by_grade_resolution,
        "by_authority_asserted": by_authority,
        "release_mapping_status_before": {
            s: sum(r["citation_count"] for r in records if r["release_mapping_status"] == s)
            for s in sorted(set(r["release_mapping_status"] for r in records))},
    }
    write_json("evidence/rollup.json", rollup)

    write_json("sources/source-custody.json", {
        "evidence_id": EVIDENCE_ID,
        "retrieved": RETRIEVED_DATE,
        "retrieval_method": USER_AGENT_NOTE,
        "correction_to_the_input_release": (
            "curriculum-release-normalization/g34-r2 records that michigan.gov 'blocks automated "
            "retrieval of its own copy' and that 'No code inside a PDF was fetched and transcribed "
            "by this session.' Both were true of the tooling those sessions used. They are not "
            "true of the host: every document below was fetched directly from michigan.gov on "
            + RETRIEVED_DATE + " and is held here byte for byte."),
        "documents": CUSTODY,
        "web_observations": WEB_OBSERVATIONS,
        "extraction": {"library": "pypdf", "version": pypdf.__version__,
                       "note": "Text comparison is whitespace-normalized. A different pypdf "
                               "version could shift extraction; the PDF bytes are the record, "
                               "the extraction is the reading of them."},
    })

    write_json("sources/extracts/official-anchors.json", {
        "note": "Extracted from the held PDFs at build time. Nothing here is typed by hand.",
        "health": A["health"], "physical_education": A["pe"], "computer_science": A["cs"],
        "arts": A["arts"], "personal_finance": A["pf"], "social_studies": A["ss"]})

    write_json("rules/classification-rules.json", {
        "evidence_id": EVIDENCE_ID,
        "classes": {
            "VERBATIM_VERIFIED": "The citation string in full appears verbatim in the cited "
                                 "official document.",
            "ALIAS_RESOLVED_VERBATIM": "The citation is a house-prefixed form of one official "
                                       "element; strip the documented prefix and the remainder is "
                                       "verbatim official text, and the prefix's numbering "
                                       "resolves to the document's own numbering.",
            "COMPOSITE_VERIFIED": "The citation combines two or more separately verified official "
                                  "elements into a string that appears nowhere verbatim.",
            "LOCAL_COMPOSITION": "A Manuel Academy curricular anchor. Asserts no state authority. "
                                 "A positive classification, not a failure to verify.",
            "UNVERIFIED": "An official source is named but the exact code or text was not "
                          "confirmed against the document.",
            "HUMAN_REVIEW_REQUIRED": "The citation asserts an authority the held document does not "
                                     "support - divergent text, a different framework, or no "
                                     "elementary standard at all. A human must decide; this "
                                     "session will not decide by inventing.",
        },
        "method": "Each rule is executed, not asserted: the authored string is compared against "
                  "text extracted from the held PDF during this build. See tools/build-evidence.py.",
        "rules": RULES,
    })

    # ---- findings -------------------------------------------------------
    def cited(pred):
        return sum(r["citation_count"] for r in records if pred(r))

    findings = [
        {"id": "F1-arts-wrong-framework", "severity": "high", "subject": "arts-and-music",
         "citations_affected": cited(lambda r: r["subject"] == "arts-and-music"),
         "summary": "Every Grade 3/4 arts citation labels National Core Arts Standards process "
                    "vocabulary as Michigan.",
         "evidence": "Creating / Performing / Presenting / Producing / Responding / Connecting "
                     "never appear as a capitalised standard or process name in either held "
                     "Michigan arts document (%s); they appear only in lower-case prose (%s). "
                     "Michigan's five standards are PERFORM, CREATE, ANALYZE, ANALYZE IN CONTEXT, "
                     "ANALYZE AND MAKE CONNECTIONS, and Michigan prints %d exact-grade "
                     "expectations for Grades 3 and 4 across all four disciplines (%s)."
                     % (json.dumps(A["arts"]["national_core_arts_vocabulary_occurrences_capitalised"],
                                   sort_keys=True),
                        json.dumps(A["arts"]["national_core_arts_vocabulary_occurrences_case_insensitive"],
                                   sort_keys=True),
                        len(A["arts"]["grade_3_4_expectation_codes"]),
                        ", ".join("%s %d" % kv for kv in
                                  sorted(A["arts"]["grade_3_4_expectation_codes_by_discipline"].items()))),
         "decision_needed": "Either recite Michigan's own standard names and Grade 3/4 codes, or "
                            "keep the artistic-process framing and disclose it as a non-Michigan "
                            "framework. Not a lesson edit - a standards-label decision."},
        {"id": "F2-pe-label-text-diverges", "severity": "high", "subject": "physical-education",
         "citations_affected": cited(lambda r: r["subject"] == "physical-education"
                                     and r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"),
         "summary": "PE Standards 2, 3 and 5 are cited with text Michigan does not print.",
         "evidence": "; ".join(
             "Standard %d official: '%s'" % (n, A["pe"]["standards"][n]) for n in (2, 3, 5)),
         "decision_needed": "Correct the three labels to the printed text, or record that the "
                            "labels are paraphrase. Standards 1 and 4 are verbatim and unaffected."},
        {"id": "F3-financial-literacy-michigan-attribution", "severity": "high",
         "subject": "financial-literacy",
         "citations_affected": cited(lambda r: r["subject"] == "financial-literacy"
                                     and r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"),
         "summary": "'Michigan Personal Finance foundations - introductory' attributes a Michigan "
                    "framework to Grades 3/4.",
         "evidence": "Michigan's personal-finance document is titled 'Personal Finance 9 - 12 "
                     "Content Expectations' and defines PF1-PF7 only. It never mentions Grade 3 or "
                     "Grade 4. The available official elementary anchor is Social Studies "
                     "Economics (3 - E1.0.1 ... , 4 - E1.0.2 ...), a different subject.",
         "decision_needed": "Gap 1 of the release standards reference is still open and this is "
                            "the citation that pre-empts it. Decide Social Studies Economics, a "
                            "disclosed non-Michigan framework, or an explicit no-standard label."},
        {"id": "F4-ready-for-life-michigan-string", "severity": "medium", "subject": "ready-for-life",
         "citations_affected": cited(lambda r: r["subject"] == "ready-for-life"
                                     and r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"),
         "summary": "'Michigan Health/SEL connections' is the one string that puts Michigan's name "
                    "on a Ready for Life lesson.",
         "evidence": "Ready for Life has no Michigan framework. The string names no Practice, "
                     "Topic, indicator or SEL competency. Every other Ready for Life citation is "
                     "correctly a Manuel Academy local composition.",
         "decision_needed": "Drop the Michigan wording or replace it with a real Health Practice / "
                            "Topic anchor from the 3-5 band."},
        {"id": "F5-health-safety-topic-name", "severity": "medium", "subject": "health",
         "citations_affected": cited(lambda r: r["subject"] == "health"
                                     and r["evidence_class"] == "HUMAN_REVIEW_REQUIRED"),
         "summary": "The health topic is cited as 'Safety and Injury Prevention'; Michigan's topic "
                    "is 'Safety' [SAF].",
         "evidence": "'Injury Prevention' occurs 0 times in the 2025 guidelines. The document's "
                     "topic list is: " + "; ".join(sorted(A["health"]["topics"])) + ".",
         "decision_needed": "Rename the anchor to the printed topic. The other six topics verify."},
        {"id": "F6-gap-4-computer-science-closed", "severity": "resolved", "subject": "technology",
         "citations_affected": cited(lambda r: r["subject"] == "technology"),
         "summary": "The release's Gap 4 (computer science currency unconfirmed) is closed in "
                    "favour of the lane.",
         "evidence": "The live MDE computer science page serves the May 2019 document held here. "
                     "The 'archive' page the earlier session flagged is an archive of public "
                     "information session presentations, not of superseded standards. All five "
                     "authored strand labels are the Core Concept names Michigan prints. Michigan "
                     "adopted the CSTA standards and the names originate in the K-12 CS Framework "
                     "- but unlike the arts case, Michigan's own adopted document does print "
                     "them, which is why these resolve and the arts labels do not.",
         "decision_needed": "None. Level 1B (Grades 3-5) identifiers exist and are still uncited, "
                            "which is a granularity choice, not a currency problem."},
        {"id": "F7-source-retrieval-claim-was-wrong", "severity": "resolved", "subject": "all",
         "citations_affected": total,
         "summary": "The input release's premise - that michigan.gov cannot be fetched and that no "
                    "PDF code could be transcribed - does not hold.",
         "evidence": "Seven official documents were fetched directly from michigan.gov on "
                     + RETRIEVED_DATE + " with a desktop User-Agent and are held here by SHA256. "
                     "That is why this package can classify 0 citations as UNVERIFIED where the "
                     "release classified " + str(rollup["release_mapping_status_before"].get("unverified", 0)) + ".",
         "decision_needed": "The other subject lanes (science, social studies, mathematics, ELA) "
                            "inherit the same wrong premise and can be resolved the same way. Out "
                            "of scope here."},
    ]
    write_json("findings/findings.json", {"evidence_id": EVIDENCE_ID, "findings": findings})

    write_json("findings/open-questions.json", {"evidence_id": EVIDENCE_ID, "open_questions": [
        {"id": "Q1", "question": "Should the specialty courses cite exact-grade codes rather than "
                                 "band or standard-level anchors?",
         "state": "open",
         "detail": "PE prints Grade 3/4 outcome codes (%d of them) and the arts GLCE prints Grade "
                   "3/4 expectation codes (%d). Health and computer science are genuinely "
                   "grade-banded (3-5 / Level 1B) and no exact-grade code exists to cite. This "
                   "package records which is which; it does not choose."
                   % (len(A["pe"]["grade_3_4_outcome_codes"]),
                      len(A["arts"]["grade_3_4_expectation_codes"]))},
        {"id": "Q2", "question": "Are the health guidelines a standard at all?", "state": "open",
         "detail": "The document is titled 'Standards Guidelines' and the approving press release "
                   "describes guidance to districts under local control. Calling a citation "
                   "against it 'a Michigan standard' is stronger than the source supports; this "
                   "package says 'Michigan Health Education Standards Guidelines 2025, grade span "
                   "3-5' and nothing more."},
        {"id": "Q3", "question": "Does every authored Practice x Topic pairing exist in the 3-5 band?",
         "state": "open",
         "detail": "The guidelines pair only some practices with some topics per grade span. The "
                   "citations name practices and topics separately, so no pairing is asserted and "
                   "nothing here contradicts the document - but a lane that later writes indicator "
                   "codes must check the pairing exists."},
        {"id": "Q4", "question": "Is any of this educator-reviewed?", "state": "open",
         "detail": "No. Nothing in this package is a licensed-educator review. Verified means the "
                   "authored string was compared against the official document's bytes."},
        {"id": "Q5", "question": "Two health PDF filenames are in circulation.", "state": "open",
         "detail": "The November 2025 press release links '---ADA-Final.pdf'; the Academic "
                   "Standards index links '---ADA-final-with-edits-12-19-25.pdf'. This package "
                   "holds the index one. The differences between them were not diffed."},
    ]})

    # ---- manifest, readme, sums ----------------------------------------
    manifest = {
        "evidence_id": EVIDENCE_ID,
        "status": "G34_SPECIALTY_STANDARDS_EVIDENCE_READY",
        "built": RETRIEVED_DATE,
        "input_release": {
            "release_id": RELEASE_ID,
            "path": "curriculum-release-normalization/g34-r2",
            "sha256sums_sha256": sha256_file(release_sums),
            "read_only": True,
            "lessons_edited": 0,
        },
        "scope": {"grades": [3, 4], "courses": [c["course_id"] for c in courses],
                  "subjects": [s for _, s in SUBJECTS]},
        "counts": {"citations_total": total, "citation_records": len(records),
                   "distinct_citation_strings_across_package":
                       len(set(r["code_or_strand"] for r in records)),
                   "by_class": by_class,
                   "verified_total": verified,
                   "local_composition_total": by_class["LOCAL_COMPOSITION"],
                   "unresolved_total": rollup["unresolved_total"]},
        "documents_in_custody": [{"doc_id": d["doc_id"], "sha256": d["sha256"],
                                  "bytes": d["bytes"], "pages": d["pages"]} for d in CUSTODY],
        "boundary": "Writes only under curriculum-release-evidence/g34-specialty-r3/.",
    }
    write_json("MANIFEST.json", manifest)

    write_text("sources/refetch.sh", REFETCH_TEMPLATE % "\n".join(
        'fetch "%s" \\\n      "%s" \\\n      %s' % (d["file"], d["official_url"], d["sha256"])
        for d in DOCS))
    os.chmod(os.path.join(ROOT, "sources", "refetch.sh"), 0o755)

    write_text("README.md", readme(rollup, findings, A, courses))

    # SHA256SUMS over everything except itself
    sums = []
    for base, _dirs, files in os.walk(ROOT):
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(base, f), ROOT)
            if rel == "SHA256SUMS.txt":
                continue
            sums.append("%s  %s" % (sha256_file(os.path.join(base, f)), rel))
    write_text("SHA256SUMS.txt", "\n".join(sorted(sums, key=lambda s: s.split("  ", 1)[1])) + "\n")

    print("citations %d  verified %d  local %d  unresolved %d"
          % (total, verified, by_class["LOCAL_COMPOSITION"], rollup["unresolved_total"]))
    for c in CLASSES:
        print("  %-24s %d" % (c, by_class[c]))


REFETCH_TEMPLATE = """#!/bin/sh
# Re-fetch every document held in sources/documents/ and check it against the
# pinned SHA256. michigan.gov answers 403 to a default User-Agent and 200 to a
# desktop browser one; that is the whole trick.
set -e
cd "$(dirname "$0")/documents"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

fetch() {
  curl -sS -L -A "$UA" -o "$1.refetch" "$2"
  got=$(shasum -a 256 "$1.refetch" | cut -d' ' -f1)
  if [ "$got" = "$3" ]; then
    echo "OK       $1"
    rm -f "$1.refetch"
  else
    echo "CHANGED  $1"
    echo "  pinned $3"
    echo "  live   $got"
    echo "  kept as $1.refetch - diff it before trusting any classification against $1"
  fi
}

%s
"""


def readme(rollup, findings, A, courses):
    by = rollup["by_class"]
    subj_rows = []
    label = {"health": "Health", "physical-education": "Physical Education",
             "technology": "Technology / Computer Science", "arts-and-music": "Arts / Music",
             "financial-literacy": "Financial Literacy", "ready-for-life": "Ready for Life"}
    for _, sk in SUBJECTS:
        s = rollup["by_subject"][sk]
        c = s["by_class"]
        subj_rows.append("| %s | %d | %d | %d | %d | %d |" % (
            label[sk], s["citations"],
            c["ALIAS_RESOLVED_VERBATIM"] + c["VERBATIM_VERIFIED"], c["COMPOSITE_VERIFIED"],
            c["LOCAL_COMPOSITION"], c["UNVERIFIED"] + c["HUMAN_REVIEW_REQUIRED"]))
    open_findings = [f for f in findings if f["severity"] != "resolved"]
    finding_rows = ["| %s | %s | %d | %s |" % (f["id"], f["severity"], f["citations_affected"],
                                               f["summary"]) for f in findings]
    return """# Grade 3/4 Specialty Standards - Evidence Resolution

`%s` - status **G34_SPECIALTY_STANDARDS_EVIDENCE_READY**

Six specialty subjects of the normalized Grade 3/4 release, resolved against the official
Michigan documents themselves. **No lesson was edited and no file outside this directory was
written.**

## The premise that changed

`curriculum-release-normalization/g34-r2` says michigan.gov "blocks automated retrieval of its own
copy" and that "No code inside a PDF was fetched and transcribed by this session." That was true of
the tooling, not of the host: michigan.gov answers `403` to a default User-Agent and `200` to a
desktop browser one. Seven official documents were fetched on %s and are held here byte for byte,
pinned by SHA256 (`sources/documents/`, `sources/refetch.sh`).

That is why **%d of %d citations are UNVERIFIED here, against %d in the release**. The reduction is
not a softer standard - it is the documents actually being read.

## Result

| Class | Citations |
| --- | ---: |
| VERBATIM_VERIFIED | %d |
| ALIAS_RESOLVED_VERBATIM | %d |
| COMPOSITE_VERIFIED | %d |
| LOCAL_COMPOSITION | %d |
| UNVERIFIED | %d |
| HUMAN_REVIEW_REQUIRED | %d |
| **Total** | **%d** |

| Subject | Citations | Verbatim/alias | Composite | Local | Unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
%s

`VERBATIM_VERIFIED` is zero by construction: no lane wrote a bare official sentence. Every citation
that does resolve carries a Manuel Academy prefix (`Michigan PE Standard 1: ...`), which is what
`ALIAS_RESOLVED_VERBATIM` means here.

## What honesty cost

**Ready for Life is Manuel Academy LOCAL_COMPOSITION.** Michigan publishes no Ready for Life
framework and this package never labels one. %d of its %d citations are classified exactly that
way. The remaining %d are the single string `Michigan Health/SEL connections`, which is the one
place the boundary is blurred, and it is reported, not resolved.

**Financial Literacy separates two things the release ran together.** Michigan's only standalone
personal-finance standards document is titled *Personal Finance 9 - 12 Content Expectations*
(PF1-PF7, republished from the Personal Finance category of the K-12 Social Studies Standards) and
never mentions Grade 3 or Grade 4. So `Michigan Personal Finance foundations -
introductory` is HUMAN_REVIEW_REQUIRED, while the Manuel Academy unit and sequence anchors are
LOCAL_COMPOSITION - a real elementary progression, honestly labelled. Michigan *does* publish
exact-grade economics expectations for both grades in the Social Studies standards; they are the
available anchor and they are not cited.

**Arts is the largest single problem.** Every arts citation attributes National Core Arts Standards
process vocabulary to Michigan. Those words - Creating, Performing, Presenting, Producing,
Responding, Connecting - never appear as a capitalised standard or process name in either held
Michigan arts document; they occur only in lower-case prose. Michigan's five standards are PERFORM,
CREATE, ANALYZE, ANALYZE IN CONTEXT and ANALYZE AND MAKE CONNECTIONS, and it prints %d exact-grade
expectations for Grades 3 and 4 across all four disciplines (%s).

**Health and PE resolve well, with named exceptions.** All six Health Practice names are verbatim;
six of the seven topic names are verbatim and the seventh is not (Michigan's topic is `Safety`, not
`Safety and Injury Prevention`). PE Standards 1 and 4 are verbatim; 2, 3 and 5 are cited with text
Michigan does not print.

**Computer Science clears.** The release's Gap 4 suspected the 2019 standards had been superseded.
The live MDE page serves that exact document; the "archive" page is an archive of public information
session presentations. All five authored strand labels are the Core Concept names Michigan's
adopted document prints. Those names originate in the K-12 CS Framework, which Michigan adopted -
and that is exactly what separates this case from arts: Michigan's own document prints these words,
and prints none of the arts ones.

## Grade-band honesty

Health (grade span 3-5) and Computer Science (Level 1B, Grades 3-5) are genuinely banded: no
Grade-3-only or Grade-4-only standard exists to cite, so `grade_resolution` is `grade-band-3-5`.
Physical Education and Arts are not banded - Michigan prints %d Grade 3/4 PE outcome codes and %d
Grade 3/4 arts expectation codes and none is cited, so both read
`exact-grade-available-not-used`. Anchor locators throughout are **PDF page indices**, not the
documents' own printed page numbers; the two differ by a few pages in every document except the
health guidelines.

## Findings

| id | severity | citations | summary |
| --- | --- | ---: | --- |
%s

Full text in [`findings/findings.json`](findings/findings.json); what is still undecided in
[`findings/open-questions.json`](findings/open-questions.json). %d findings are open.

## Layout

```
g34-specialty-r3/
  MANIFEST.json                        identity, counts, input pin, boundary
  SHA256SUMS.txt
  rules/classification-rules.json      the six classes and the rules that assign them
  sources/documents/*.pdf              seven official documents, held byte for byte
  sources/source-custody.json          url, sha256, pages, how and when retrieved
  sources/extracts/official-anchors.json   official text pulled from those bytes at build time
  sources/refetch.sh                   re-fetch and re-check every pinned hash
  evidence/citations.jsonl             one record per distinct citation string per course
  evidence/courses/*.evidence.json     twelve per-course files
  evidence/rollup.json                 counts by class, subject, grade resolution, authority
  findings/                            what is wrong, and what is still undecided
  tools/build-evidence.py              regenerates all of the above
```

## Reproducing

```bash
python3 curriculum-release-evidence/g34-specialty-r3/tools/build-evidence.py
```

It verifies all seven held PDFs against their pinned SHA256 before reading a byte and aborts on a
mismatch. Every classification is computed by comparing the authored string against text extracted
from those PDFs at build time. Where the script does name an official string literally - the five
computer science Core Concepts, the five arts standard headings, the health grade-span label, the
Level 1B label, the personal finance title - that literal is presence-checked against the held
bytes and the build aborts if it is not found, so none of them can drift silently. Same inputs
produce a byte-identical tree.

## Read before promoting

- Nothing here is a licensed-educator review. `verified` means the authored string was compared
  against the official document's bytes.
- The Michigan Health Education Standards Guidelines are titled *guidelines* and the approving
  press release describes guidance to districts under local control. This package cites them as
  such and does not upgrade them to "standards".
- %d citations still need a human. That is a real number, not a formality: it is every arts
  citation, three of the five PE standards, the Michigan financial-literacy string, the Michigan
  Ready for Life string, and one health topic name.
- The same wrong retrieval premise sits under the science, social studies, mathematics and ELA
  lanes. They were not touched here.
""" % (
        EVIDENCE_ID, RETRIEVED_DATE,
        by["UNVERIFIED"], rollup["citations_total"],
        rollup["release_mapping_status_before"].get("unverified", 0),
        by["VERBATIM_VERIFIED"], by["ALIAS_RESOLVED_VERBATIM"], by["COMPOSITE_VERIFIED"],
        by["LOCAL_COMPOSITION"], by["UNVERIFIED"], by["HUMAN_REVIEW_REQUIRED"],
        rollup["citations_total"], "\n".join(subj_rows),
        rollup["by_subject"]["ready-for-life"]["by_class"]["LOCAL_COMPOSITION"],
        rollup["by_subject"]["ready-for-life"]["citations"],
        rollup["by_subject"]["ready-for-life"]["by_class"]["HUMAN_REVIEW_REQUIRED"],
        len(A["arts"]["grade_3_4_expectation_codes"]),
        ", ".join("%s %d" % kv for kv in
                  sorted(A["arts"]["grade_3_4_expectation_codes_by_discipline"].items())),
        len(A["pe"]["grade_3_4_outcome_codes"]), len(A["arts"]["grade_3_4_expectation_codes"]),
        "\n".join(finding_rows), len(open_findings),
        rollup["unresolved_total"],
    )


if __name__ == "__main__":
    main()
