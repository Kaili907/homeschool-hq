#!/usr/bin/env python3
"""Regenerate curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4.

Resolves the three remaining systemic Grade 3/4 specialty standards
classifications left open by g34-specialty-r3:

    health              12 citations   'Safety and Injury Prevention'
    financial-literacy  72 citations   'Michigan Personal Finance foundations - introductory'
    ready-for-life      72 citations   'Michigan Health/SEL connections'

Inputs, all read-only:

  1. curriculum-release-evidence/g34-specialty-r3   - the prior evidence package
     (its citations.jsonl is the record of what the lane authored; pinned by SHA256).
  2. sources/documents/*.pdf                        - the two official documents this
     package newly holds, pinned by SHA256.
  3. g34-specialty-r3/sources/documents/*.pdf       - three official documents whose
     custody is INHERITED: not copied, verified against r3's pinned SHA256 before
     a byte is read.

Every classification below is COMPUTED. No official standard text is asserted from
memory: each quoted anchor is presence-checked against the held bytes at build time
and the build aborts if a quote or an absence assertion fails.

Run:  python3 curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/tools/build-r4.py
"""

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
ROOT = os.path.dirname(HERE)                          # .../g34-specialty-health-finlit-rfl-r4
EVIDENCE_DIR = os.path.dirname(ROOT)                  # .../curriculum-release-evidence
REPO = os.path.dirname(EVIDENCE_DIR)
R3 = os.path.join(EVIDENCE_DIR, "g34-specialty-r3")

EVIDENCE_ID = "manuel-academy-g34-health-finlit-rfl-standards-policy-r4"
INPUT_EVIDENCE_ID = "manuel-academy-g34-specialty-standards-evidence-r3"
RELEASE_ID = "manuel-academy-grades-3-4-r2-normalized"
BUILT = "2026-08-12"          # fixed constant: reruns stay byte-identical
RETRIEVED = "2026-08-12"
UA_NOTE = ("curl with a desktop browser User-Agent; michigan.gov serves 200 to that and 403 "
           "to the default agent")

IN_SCOPE_SUBJECTS = ["health", "financial-literacy", "ready-for-life"]

# --------------------------------------------------------------------------
# Input pins. A mismatch aborts before anything is written.
# --------------------------------------------------------------------------

R3_PINS = {
    "SHA256SUMS.txt": "55d1f9b25680da024a90424f7bc5d668c91b486e761c9e15e5500dabf7a21058",
    "evidence/citations.jsonl": "6939093eca6b95fe12e12af046826f70c8563be82016e708a93429e3b976841c",
    "evidence/rollup.json": "9bd84a26102752d719e2d647ba3e79a805bd40c156b1e72a8776d9e317f9c0e4",
}

# Documents held in THIS package.
DOCS_HELD = [
    {
        "doc_id": "mde-sel-2017",
        "file": "mde-sel-competencies-indicators-2017.pdf",
        "title": ("Michigan Department of Education Early Childhood to Grade 12 Social and "
                  "Emotional Learning (SEL) Competencies and Indicators"),
        "version_label": "2017",
        "publisher": "Michigan Department of Education",
        "authority": (
            "Published by MDE under Health & Safety services, NOT under Academic Standards. "
            "The document's own first page states that Michigan's Content State Standards focus "
            "on academics and that SEL competencies address other aspects of learning - so it "
            "describes itself as a companion to the standards, not as one. It is not listed on "
            "the MDE Academic Standards index (a web observation, not a byte fact). The K-12 "
            "competencies cited here carry no State Board adoption line; the document does say "
            "its separate EARLY CHILDHOOD competencies 'come from State Board of Education (SBE) "
            "approved standards', which is a different band and is not cited by this package."
        ),
        "is_academic_standard": False,
        "linked_from": "https://www.michigan.gov/mde/services/health-safety/social-emotional-learning-sel",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/Year/2018/"
                         "04/12/SEL_Competencies-_ADA_Compliant_FINAL.pdf"),
        "sha256": "17d23981b703594f56b518de425c7e2235bb1b356dca4cb68d81b3f0862a3d0d",
        "held_for": ("Answers, from bytes, whether the Ready for Life string 'Michigan "
                     "Health/SEL connections' has any official support at all. It does - and the "
                     "same bytes show that support is not a standard."),
    },
    {
        "doc_id": "mde-health-2025-alt",
        "file": "mde-health-education-standards-guidelines-2025-press-release-variant.pdf",
        "title": "Michigan Health Education Standards Guidelines (press-release filename variant)",
        "version_label": "2025, ADA Final",
        "publisher": "Michigan Department of Education",
        "authority": ("The same guidelines, at the filename the MDE press release of 2025-11-13 "
                      "links. r3 recorded that two filenames were in circulation and that the "
                      "difference had not been diffed. This package holds the second one so the "
                      "question is answerable from bytes."),
        "is_academic_standard": False,
        "linked_from": ("https://www.michigan.gov/mde/news-and-information/press-releases/2025/11/"
                        "13/revised-health-education-standards"),
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/"
                         "School-Health-and-Safety/Michigan-Health-Education-Standards-"
                         "Guidelines-2025---ADA-Final.pdf"),
        "sha256": "17dc768b41b517a82f861849ae314781c723e08e87691504c38ab71aae670e15",
        "held_for": ("Second witness for the health resolution, and the answer to r3 open question "
                     "Q5. The two files differ on exactly one PDF page, in the Grades 6-8 band, "
                     "outside this package's scope - see the doc_pair_diff in source-custody.json."),
    },
    {
        "doc_id": "mde-pf-course-credit",
        "file": "mde-personal-finance-course-credit-requirements.pdf",
        "title": "Personal Finance Course/Credit Requirements (Michigan Merit Curriculum)",
        "version_label": "as served from the Academic Standards page on 2026-08-12",
        "publisher": "Michigan Department of Education",
        "authority": ("The Michigan Merit Curriculum course/credit document for personal finance. "
                      "Reproduces MCL 380.1278a(3), which conditions a HIGH SCHOOL DIPLOMA on a "
                      "1/2 credit personal finance course."),
        "is_academic_standard": False,
        "linked_from": "https://www.michigan.gov/mde/services/academic-standards",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Personal-Finance/Personal_Finance_Course_Credit.pdf"),
        "sha256": "34dd182eac9e374105d3fc85b14a221ec5563212cd29e5a0a453654e88f698a8",
        "held_for": ("Second, independent proof that Michigan's personal finance requirement is a "
                     "high school diploma credit. r3 proved it from the content expectations; this "
                     "proves it from the credit rule and the statute it quotes."),
    },
]

# Documents whose custody is INHERITED from g34-specialty-r3. Not copied; hash-verified.
DOCS_INHERITED = [
    {
        "doc_id": "mde-health-2025",
        "path": "sources/documents/mde-health-education-standards-guidelines-2025.pdf",
        "title": "Michigan Health Education Standards Guidelines",
        "version_label": "2025, ADA final with edits 12-19-25",
        "sha256": "e64744d56ba3ba36b968012995f9fed259f74efbb49fbfc91075be8b16defee4",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/"
                         "School-Health-and-Safety/Michigan-Health-Education-Standards-"
                         "Guidelines-2025---ADA-final-with-edits-12-19-25.pdf"),
    },
    {
        "doc_id": "mde-social-studies",
        "path": "sources/documents/mde-k12-social-studies-standards.pdf",
        "title": "Michigan K-12 Social Studies Standards",
        "version_label": "v 6/19",
        "sha256": "bba06f46bb241ae3cdd698caaeb41baa3c976d96176fef0a9d594a7e98e70b96",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Social_Studies_Standards.pdf"),
    },
    {
        "doc_id": "mde-personal-finance",
        "path": "sources/documents/mde-personal-finance-content-expectations-9-12.pdf",
        "title": "Michigan Merit Curriculum Personal Finance 9-12 Content Expectations",
        "version_label": "v5/2023",
        "sha256": "ff97640535d7864de8d3333669a5f8d8ab8134ebfa0af5f9f938cf2e91ab2735",
        "official_url": ("https://www.michigan.gov/mde/-/media/Project/Websites/mde/"
                         "Academic-Standards/Personal-Finance/Personal_Finance_Content_"
                         "Expectations.pdf"),
    },
]

# --------------------------------------------------------------------------
# Reading the held bytes
# --------------------------------------------------------------------------


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def norm(s):
    """Whitespace-normalize and undo PDF line-break hyphenation.

    Applied identically to the held text and to every quote, so 'goods and ser - vices'
    and 'goods and services' compare equal, as do 'well-being' and 'wellbeing'.
    """
    s = s.replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[\u2022\u25aa\u25cf\u00b7\u2023]", " ", s)   # layout bullets, normalized on both sides
    s = s.replace("\u2013", "-").replace("\u2014", "-")          # en/em dash -> hyphen, both sides
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(?<=[A-Za-z])\s?-\s?(?=[A-Za-z])", "", s)
    return s.strip()


def read_pdf(path, expect_sha, label):
    got = sha256_file(path)
    if got != expect_sha:
        sys.exit(f"ABORT: {label} sha256 mismatch\n  pinned {expect_sha}\n  actual {got}")
    reader = pypdf.PdfReader(path)
    pages = [p.extract_text() or "" for p in reader.pages]
    return {
        "pages": pages,
        "n_pages": len(pages),
        "bytes": os.path.getsize(path),
        "sha256": got,
        "norm": norm("\n".join(pages)),
        "raw_join": "\n".join(pages),
    }


# --------------------------------------------------------------------------
# Anchors. Every quote here is presence-checked against the held bytes.
# --------------------------------------------------------------------------

ANCHORS = {
    # ---- health -------------------------------------------------------
    "H-topic-list": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 12, 'Within each practice ... topics'",
        "quote": ("Balanced Eating and Physical Activity [BEPA] Community and Environmental Health "
                  "[CEH] Healthy Relationships [HR] Mental and Emotional Health [MEH] Personal "
                  "Health and Wellness [PHW] Safety [SAF] Substance Use and Misuse [SU] Sex "
                  "Education [SE]"),
    },
    "H-grade-span-3-5": {
        "doc_id": "mde-health-2025", "locator": "PDF pp. 32-37 section head",
        "quote": "Grade Span: 3-5 (by the end of Grade 5)",
    },
    "H-SAF-5-5": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, Practice 5, Safety [5.5.SAF] 1",
        "quote": ("Safety [5.5.SAF] 1. Describe ways to promote personal safety and reduce the "
                  "risk of injuries in various situations"),
    },
    "H-SAF-5-5-examples": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, Safety [5.5.SAF] 1 examples",
        "quote": ("during physical activity, around motor vehicles, around firearms, around loud "
                  "noise or music, around water, fire prevention, during a fire, as a pedestrian"),
    },
    "H-SAF-5-5-3": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, Safety [5.5.SAF] 3",
        "quote": ("Identify and demonstrate how to contact appropriate resources when someone is "
                  "poisoned or injured and needs help"),
    },
    "H-SAF-5-5-4": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, Safety [5.5.SAF] 4",
        "quote": "Apply strategies to stay safe online",
    },
    "H-SAF-5-3": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 34, Practice 3, Safety [5.3.SAF] 2",
        "quote": ("Locate trusted adults (including parents or guardians) from whom to get help if "
                  "boundaries are being violated"),
    },
    "H-PHW-5-5": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 36, Personal Health and Wellness [5.5.PHW] 1",
        "quote": ("Personal Health and Wellness [5.5.PHW] 1. Describe personal behaviors and "
                  "strategies that promote health and/or avoid health risks"),
    },
    "H-PHW-5-5-examples": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 36, [5.5.PHW] 1 examples",
        "quote": ("pedestrian safety, sun safety, protecting oneself from infectious diseases, "
                  "adequate sleep, good nutrition, protective equipment, appropriate screen time, "
                  "hearing protection, being physically active"),
    },
    "H-BEPA-5-4-2": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 34, Balanced Eating and Physical Activity [5.4.BEPA] 2",
        "quote": ("Identify and describe hunger and fullness indicators and how these can inform "
                  "nutrition-related decision-making"),
    },
    "H-BEPA-5-4-8": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 34, [5.4.BEPA] 8",
        "quote": ("Recognize that individuals have different food-related needs, preferences, and "
                  "traditions"),
    },
    "H-MEH-5-5-10": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, Mental and Emotional Health [5.5.MEH] 10",
        "quote": "Identify a variety of strategies for planning, prioritizing, and managing time",
    },
    "H-MEH-5-5-9": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 35, [5.5.MEH] 9",
        "quote": ("Identify and demonstrate strategies and behaviors to overcome barriers and help "
                  "meet personal responsibilities"),
    },
    "H-practice-5": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 34, Practice 5 definition",
        "quote": ("Practice 5: Self-Management and Goal Setting Set goals, engage in "
                  "health-promoting behaviors, and avoid risky behaviors"),
    },
    "H-grade-span-rationale": {
        "doc_id": "mde-health-2025", "locator": "PDF p. 12",
        "quote": ("The change from individual grade levels to grade spans allows more flexibility "
                  "for districts"),
    },

    # ---- financial literacy ------------------------------------------
    "PF-title": {
        "doc_id": "mde-personal-finance", "locator": "PDF p. 1 title",
        "quote": "Personal Finance",
    },
    "PFCC-statute": {
        "doc_id": "mde-pf-course-credit", "locator": "PDF p. 8 (printed p. 6), Appendix B, MCL 380.1278a(3)",
        "quote": ("Beginning with pupils entering grade 8 in 2023, the board of a school district "
                  "or board of directors of a public school academy shall not award a high school "
                  "diploma to a pupil unless the pupil completes a ½ credit course in personal "
                  "finance"),
    },
    "SS-econ-head-g3": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 33, Grade 3 ECONOMICS",
        "quote": ("ECONOMICS Individually and collaboratively, students will engage in planned "
                  "inquiries to investigate the economy of Michigan. E1 Market Economy"),
    },
    "SS-3-E1.0.1": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 33",
        "quote": ("3 – E1.0.1 Using a Michigan example, explain how scarcity, choice, and "
                  "opportunity cost affect what is produced and consumed"),
    },
    "SS-3-E1.0.2": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 33",
        "quote": ("3 – E1.0.2 Identify incentives that influence economic decisions people make in "
                  "Michigan"),
    },
    "SS-3-E1.0.4": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 34",
        "quote": ("3 – E1.0.4 Describe how entrepreneurs combine natural, human, and capital "
                  "resources to produce goods and services in Michigan"),
    },
    "SS-3-E1.0.5": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 34",
        "quote": ("3 – E1.0.5 Explain the role of entrepreneurship and business development in "
                  "Michigan's economic future"),
    },
    "SS-3-E2.0.1": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 34",
        "quote": ("3 – E2.0.1 Using a Michigan example, explain how specialization leads to "
                  "increased interdependence"),
    },
    "SS-3-E3.0.1": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 34",
        "quote": ("3 – E3.0.1 Identify products produced in other countries and consumed by people "
                  "in Michigan"),
    },
    "SS-4-E1.01": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 40 (printed as 'E1.01' in the document)",
        "quote": ("4 – E1.01 Identify a good or service produced in the United States and apply the "
                  "three economic questions all economies must address"),
    },
    "SS-4-E1.0.2": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 40",
        "quote": "4 – E1.0.2 Describe characteristics of a market economy",
    },
    "SS-4-E1.0.3": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 40",
        "quote": ("4 – E1.0.3 Describe how positive and negative incentives influence behavior in a "
                  "market economy"),
    },
    "SS-4-E1.0.3-saving": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 40, positive-incentive examples",
        "quote": ("Examples of positive incentives may include but are not limited to: responding "
                  "to a sale, saving money, earning money"),
    },
    "SS-4-E1.0.4": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": "4 – E1.0.4 Explain how price affects decisions about purchasing goods and services",
    },
    "SS-4-E1.0.5": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": "4 – E1.0.5 Explain how specialization and division of labor increase productivity",
    },
    "SS-4-E1.0.6": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": ("4 – E1.0.6 Explain how competition among buyers results in higher prices, and "
                  "competition among sellers results in lower prices"),
    },
    "SS-4-E1.0.7": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": "4 – E1.0.7 Describe the role of money in the exchange of goods and services",
    },
    "SS-4-E1.0.8": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": ("4 – E1.0.8 List goods and services governments provide in a market economy and "
                  "explain how these goods and services are funded"),
    },
    "SS-4-E3.0.1": {
        "doc_id": "mde-social-studies", "locator": "PDF p. 41",
        "quote": "4 – E3.0.1 Identify advantages and disadvantages of global competition",
    },

    # ---- ready for life / SEL ----------------------------------------
    "SEL-not-a-standard": {
        "doc_id": "mde-sel-2017", "locator": "PDF p. 1, opening paragraph",
        "quote": ("Currently, Michigan has Content State Standards that focus on academics. "
                  "However, there is little that attend to the other aspects of learning for "
                  "children/students."),
    },
    "SEL-companion-to-health": {
        "doc_id": "mde-sel-2017", "locator": "PDF p. 1",
        "quote": ("In combination with the Michigan Health Education Standards, SEL competencies "
                  "help support a well-rounded education"),
    },
    "SEL-competency-table": {
        "doc_id": "mde-sel-2017", "locator": "PDF p. 3, competency/indicator table",
        "quote": ("Self-Awareness 1A. Demonstrate an awareness of their emotions"),
    },
    "SEL-1D": {
        "doc_id": "mde-sel-2017", "locator": "PDF pp. 19-20, indicator 1D, band 3-5",
        "quote": ("Define what it means to be responsible and can identify things for which they "
                  "are responsible"),
    },
    "SEL-2C": {
        "doc_id": "mde-sel-2017", "locator": "PDF pp. 30-31, indicator 2C, band 3-5",
        "quote": "Distinguish between long term and short term goals",
    },
    "SEL-3B": {
        "doc_id": "mde-sel-2017", "locator": "PDF pp. 36-37, indicator 3B, band 3-5",
        "quote": ("Identify roles they have that contribute to their school, home, and neighboring "
                  "community"),
    },
    "SEL-4A": {
        "doc_id": "mde-sel-2017", "locator": "PDF pp. 45-46, indicator 4A, band 3-5",
        "quote": "Use attentive listening skills to foster better communication",
    },
    "SEL-5B": {
        "doc_id": "mde-sel-2017", "locator": "PDF pp. 57-58, indicator 5B, band 3-5",
        "quote": ("Demonstrate academic behaviors and self-regulation skills such as organization, "
                  "completing assignments, planning"),
    },
    "SEL-5C": {
        "doc_id": "mde-sel-2017", "locator": "PDF p. 60, indicator 5C, band 3-5",
        "quote": "Identify and organize materials needed to be prepared for class",
    },
}

# Absence assertions: the build aborts if any of these IS found.
ABSENCES = [
    {"id": "A1", "doc_id": "mde-health-2025", "needle": "Injury Prevention",
     "why": "'Safety and Injury Prevention' is not a name the Michigan health document prints."},
    {"id": "A2", "doc_id": "mde-personal-finance", "needle": "Grade 3",
     "why": "Michigan's personal finance content expectations never mention Grade 3."},
    {"id": "A3", "doc_id": "mde-personal-finance", "needle": "Grade 4",
     "why": "Michigan's personal finance content expectations never mention Grade 4."},
    {"id": "A4", "doc_id": "mde-pf-course-credit", "needle": "Grade 3",
     "why": "The personal finance credit rule never mentions Grade 3."},
    {"id": "A5", "doc_id": "mde-pf-course-credit", "needle": "elementary",
     "why": "The personal finance credit rule never mentions elementary grades."},
    {"id": "A6", "doc_id": "mde-sel-2017", "needle": "Ready for Life",
     "why": "No Michigan document names a Ready for Life course, framework or sequence."},
    {"id": "A7", "doc_id": "mde-health-2025", "needle": "Ready for Life",
     "why": "No Michigan document names a Ready for Life course, framework or sequence."},
    {"id": "A8", "doc_id": "mde-health-2025", "needle": "Personal Finance",
     "why": "The health guidelines carry no personal finance content."},
]

# --------------------------------------------------------------------------
# The policy. Three resolutions, keyed by the authored citation string.
# --------------------------------------------------------------------------

RESOLUTIONS = {
    "Michigan Health Topic (Grades 3-5): Safety and Injury Prevention": {
        "resolution_id": "R4-HEALTH-SAFETY-ALIAS",
        "subject": "health",
        "question": ("Is 'Safety and Injury Prevention' a defensible alias or composite for a "
                     "Michigan health topic, or an unsupported label?"),
        "verdict": "ALIAS_DEFENSIBLE_LABEL_NOT_OFFICIAL",
        "authored_class": "ALIAS_LABEL_DIVERGENT",
        "policy_class": "COMPOSITE_VERIFIED",
        "release_action": "RELABEL_REQUIRED",
        "required_label": "Michigan Health Topic (Grades 3-5): Safety",
        "label_official_names": [
            {"asserted": "Safety", "byte_form": "Safety [SAF]", "doc_id": "mde-health-2025"}],
        "authority_after": "michigan-mde",
        "rule_id": "P1-health-topic-alias-unique-referent",
        "official_support": ["H-topic-list", "H-grade-span-3-5", "H-SAF-5-5",
                             "H-SAF-5-5-examples", "H-SAF-5-5-3"],
        "reasoning": [
            "Referent is unique. The Grades 3-5 band prints exactly two safety groupings, "
            "Safety [5.3.SAF] and Safety [5.5.SAF], and both carry the same topic name: Safety "
            "[SAF]. There is no second candidate topic the authored label could mean, so mapping "
            "it does not require a human to choose between alternatives.",
            "The added words are substantively supported by that same topic. Safety [5.5.SAF] 1 "
            "reads 'reduce the risk of injuries in various situations' and lists fire prevention "
            "and pedestrian, water, firearm and motor-vehicle contexts; [5.5.SAF] 3 covers "
            "contacting help when someone is poisoned or injured. Injury prevention is what "
            "Michigan's Safety topic teaches at this band.",
            "The words are still not Michigan's. 'Injury Prevention' occurs zero times in the "
            "document (absence assertion A1). No other topic absorbs it: Personal Health and "
            "Wellness [5.5.PHW] 1 mentions pedestrian and sun safety and protective equipment "
            "only as examples of health-promoting behaviour, and prints no injury topic.",
            "So the mapping is defensible and the label is not. The anchor resolves; the printed "
            "topic name must be used.",
            "Checked against both copies. r3 recorded that two health PDF filenames were in "
            "circulation and had not been diffed. Both are now held and diffed: they differ on one "
            "page, in the Grades 6-8 Sex Education wording. Every anchor this resolution rests on "
            "is byte-identical in both, and neither prints 'Injury Prevention'. The open question "
            "the finding depended on is closed, not deferred.",
        ],
        "human_review_required": False,
        "why_not_human_review": (
            "r3 held this for a human because the authored label was not on the topic list. The "
            "document answers the question it was held for: exactly one topic can be meant, and "
            "that topic's own 3-5 indicators cover the extra words. Choosing the printed name over "
            "an unprinted expansion is not a judgement call - it is the rule the package already "
            "applies to the other six topics."
        ),
    },
    "Michigan Personal Finance foundations — introductory": {
        "resolution_id": "R4-FINLIT-NO-MI-PF-AT-G34",
        "subject": "financial-literacy",
        "question": ("Does Michigan publish a Grade 3/4 personal finance standard this citation "
                     "could resolve against, and if not, what is the honest anchor?"),
        "verdict": "NO_MICHIGAN_ELEMENTARY_PF_STANDARD_EXISTS",
        "authored_class": "FALSE_AUTHORITY_CLAIM",
        "policy_class": "CROSSWALK_SUPPORTING",
        "release_action": "RELABEL_REQUIRED",
        "required_label": None,   # per-grade; filled from CROSSWALK below
        "authority_after": "manuel-academy",
        "rule_id": "P2-financial-literacy-crosswalk-not-pf-code",
        "official_support": ["PF-title", "PFCC-statute", "SS-econ-head-g3"],
        "reasoning": [
            "Michigan's only standalone personal finance standards document is Personal Finance "
            "9 - 12 Content Expectations (PF1-PF7). It mentions Grade 3 zero times and Grade 4 "
            "zero times (absence assertions A2, A3).",
            "The credit rule held here says the same thing from the other direction: MCL "
            "380.1278a(3) conditions a HIGH SCHOOL DIPLOMA on a 1/2 credit personal finance "
            "course for pupils entering grade 8 in 2023 or after. It mentions neither Grade 3, "
            "Grade 4 nor elementary grades at all (absence assertions A4, A5).",
            "No PF code may therefore be manufactured for Grades 3/4, and the phrase 'Michigan "
            "Personal Finance' may not stand on a Grade 3/4 lesson.",
            "Michigan does publish exact-grade economics expectations for both grades in the K-12 "
            "Social Studies Standards - 3 - E1.0.1 through 3 - E3.0.1 and 4 - E1.01 through "
            "4 - E3.0.1. Those are real, official, exact-grade and citable. They belong to a "
            "different subject, so they support the course; they do not govern it.",
            "The Manuel Academy progression itself stays what it already is: LOCAL_COMPOSITION. "
            "This resolution separates the two rather than merging them.",
        ],
        "human_review_required": False,
        "why_not_human_review": (
            "r3 held this open because it would not choose between Social Studies economics, a "
            "disclosed non-Michigan framework, and an explicit no-standard label. The brief for "
            "this package makes that choice: the official economics expectations are a supporting "
            "crosswalk, never a personal finance code. Nothing is invented - every anchor below is "
            "a code Michigan prints for that exact grade."
        ),
    },
    "Michigan Health/SEL connections": {
        "resolution_id": "R4-RFL-SUPPORTING-NOT-STANDARD",
        "subject": "ready-for-life",
        "question": ("Does 'Michigan Health/SEL connections' have exact source authority, and if "
                     "only partial support exists, what may the release claim?"),
        "verdict": "SUPPORT_EXISTS_BUT_IS_NOT_A_STANDARD",
        "authored_class": "UNANCHORED_MICHIGAN_REFERENCE",
        "policy_class": "CROSSWALK_SUPPORTING",
        "release_action": "RELABEL_REQUIRED",
        "required_label": ("Supporting connection: Michigan Health Education Standards Guidelines "
                           "(grade span 3-5) and MDE SEL Competencies and Indicators (2017), band "
                           "3-5 — not a Michigan standard"),
        "label_official_names": [
            {"asserted": "Michigan Health Education Standards Guidelines",
             "byte_form": "Michigan Health Education Standards Guidelines",
             "doc_id": "mde-health-2025"},
            {"asserted": "SEL Competencies and Indicators",
             "byte_form": "SEL Competencies and Indicators", "doc_id": "mde-sel-2017"}],
        "authority_after": "manuel-academy",
        "rule_id": "P3-ready-for-life-supporting-connection-only",
        "official_support": ["SEL-not-a-standard", "SEL-companion-to-health",
                             "SEL-competency-table", "H-grade-span-3-5"],
        "reasoning": [
            "Support exists, and it is now in custody. MDE publishes SEL Competencies and "
            "Indicators (2017) with five competencies, lettered indicators 1A-5C, and a 3-5 "
            "benchmark band for each - real text that genuinely corresponds to Ready for Life "
            "unit content. r3 recorded this document as existing but did not retrieve it; this "
            "package holds it byte for byte.",
            "The same bytes show it is not a standard. Its first page reads 'Currently, Michigan "
            "has Content State Standards that focus on academics. However, there is little that "
            "attend to the other aspects of learning for children/students.' - it positions "
            "itself beside the standards, not among them. It is published under Health & Safety "
            "services, is absent from the MDE Academic Standards index, and carries no State "
            "Board adoption line.",
            "The Health Education Standards Guidelines 3-5 band does supply real anchors for the "
            "Ready for Life units on food, rest, safety, time and help-seeking. r3's open "
            "question Q2 still stands over all of them: that document is titled guidelines and "
            "the approving press release describes guidance to districts under local control.",
            "So the string may become a supporting connection with named anchors, and may never "
            "become a state-standard claim. Ready for Life stays Manuel Academy authorship; "
            "Michigan has approved no part of the sequence (absence assertions A6, A7).",
        ],
        "human_review_required": False,
        "why_not_human_review": (
            "r3 asked a human to drop the Michigan wording or replace it with a real anchor. Both "
            "halves are now answerable from bytes: real anchors exist, and their own documents "
            "say what they are not. The policy names the anchors and forbids the standard claim."
        ),
    },
}

# --------------------------------------------------------------------------
# Crosswalk. Unit -> official anchors, with honest coverage.
# 'partial' and 'none' are load-bearing: an uncovered unit is named, not padded.
# --------------------------------------------------------------------------

CROSSWALK = {
    "ma-g3-financial-literacy": {
        "governing_authority": "manuel-academy",
        "supporting_document": "mde-social-studies",
        "supporting_scope": "Grade 3 Economics (E1 Market Economy, E2 National Economy, E3 International Economy)",
        "required_label": ("Michigan K-12 Social Studies Standards, Grade 3 Economics (E1-E3) "
                           "— supporting connection, not a personal finance standard"),
        "label_official_names": [
            {"asserted": "Michigan K-12 Social Studies Standards",
             "byte_form": "Michigan K-12 Social Studies Standards", "doc_id": "mde-social-studies"},
            {"asserted": "Economics", "byte_form": "ECONOMICS", "doc_id": "mde-social-studies"}],
        "units": [
            {"unit": 1, "title": "needs, wants, and choosing",
             "anchors": ["SS-3-E1.0.1"], "coverage": "partial",
             "uncovered": ["needs", "wants",
                           "3 – E1.0.1 covers choice and opportunity cost; 'needs' and 'wants' "
                           "occur zero times in Michigan's Grade 3 economics expectations"]},
            {"unit": 2, "title": "earning and work",
             "anchors": ["SS-3-E1.0.4", "SS-3-E1.0.5"], "coverage": "partial",
             "uncovered": ["personal earning", "wages", "household income"]},
            {"unit": 3, "title": "spending and comparing",
             "anchors": ["SS-3-E1.0.2"], "coverage": "partial",
             "uncovered": ["comparison shopping", "unit price"]},
            {"unit": 4, "title": "saving and goals",
             "anchors": [], "coverage": "none",
             "uncovered": ["saving", "savings goals",
                           "Michigan publishes no Grade 3 economics expectation about saving; the "
                           "nearest official text is Grade 4 (4 – E1.0.3 lists 'saving money' as a "
                           "positive-incentive example)"]},
            {"unit": 5, "title": "money tools, privacy, and advertising",
             "anchors": [], "coverage": "none",
             "uncovered": ["money tools", "money privacy", "advertising",
                           "no Grade 3 economics expectation addresses any of the three; the "
                           "incentives expectation 3 – E1.0.2 was considered and rejected as too "
                           "loose to anchor them"]},
            {"unit": 6, "title": "simulated market capstone",
             "anchors": ["SS-3-E2.0.1", "SS-3-E3.0.1"], "coverage": "partial",
             "uncovered": ["running a simulated market"]},
        ],
    },
    "ma-g4-financial-literacy": {
        "governing_authority": "manuel-academy",
        "supporting_document": "mde-social-studies",
        "supporting_scope": "Grade 4 Economics (E1 Market Economy, E2 National Economy, E3 International Economy)",
        "required_label": ("Michigan K-12 Social Studies Standards, Grade 4 Economics (E1-E3) "
                           "— supporting connection, not a personal finance standard"),
        "label_official_names": [
            {"asserted": "Michigan K-12 Social Studies Standards",
             "byte_form": "Michigan K-12 Social Studies Standards", "doc_id": "mde-social-studies"},
            {"asserted": "Economics", "byte_form": "ECONOMICS", "doc_id": "mde-social-studies"}],
        "units": [
            {"unit": 1, "title": "choices, scarcity, and tradeoffs",
             "anchors": ["SS-4-E1.01", "SS-4-E1.0.2"], "coverage": "partial",
             "uncovered": ["scarcity and opportunity cost are the Grade 3 expectation "
                           "(3 – E1.0.1), not a Grade 4 one"]},
            {"unit": 2, "title": "earning, work, and enterprise",
             "anchors": ["SS-4-E1.0.5", "SS-4-E1.0.7"], "coverage": "partial",
             "uncovered": ["enterprise and entrepreneurship are Grade 3 expectations "
                           "(3 – E1.0.4, 3 – E1.0.5); 'entrepreneur' occurs zero times in "
                           "Michigan's Grade 4 economics expectations"]},
            {"unit": 3, "title": "spending plans and comparison",
             "anchors": ["SS-4-E1.0.4", "SS-4-E1.0.6"], "coverage": "partial",
             "uncovered": ["budgeting", "spending plans"]},
            {"unit": 4, "title": "saving, goals, and money privacy",
             "anchors": ["SS-4-E1.0.3", "SS-4-E1.0.3-saving"], "coverage": "partial",
             "uncovered": ["money privacy",
                           "saving appears only as an example of a positive incentive, not as an "
                           "expectation in its own right"]},
            {"unit": 5, "title": "advertising, risk, borrowing, and giving",
             "anchors": ["SS-4-E1.0.3"], "coverage": "partial",
             "uncovered": ["advertising", "financial risk", "borrowing", "giving"]},
            {"unit": 6, "title": "simulated marketplace capstone",
             "anchors": ["SS-4-E1.0.2", "SS-4-E1.0.8", "SS-4-E3.0.1"], "coverage": "partial",
             "uncovered": ["running a simulated marketplace"]},
        ],
    },
    "ma-g3-ready-for-life": {
        "governing_authority": "manuel-academy",
        "supporting_document": "mde-health-2025 + mde-sel-2017",
        "supporting_scope": ("Health Education Standards Guidelines grade span 3-5; SEL "
                             "Competencies and Indicators (2017) band 3-5"),
        "required_label": None,   # taken from RESOLUTIONS
        "units": [
            {"unit": 1, "title": "personal and shared space care",
             "anchors": ["SEL-1D", "SEL-5C"], "coverage": "partial",
             "uncovered": ["home space care", "chores"]},
            {"unit": 2, "title": "clothing care and readiness routines",
             "anchors": ["SEL-5C", "H-PHW-5-5"], "coverage": "partial",
             "uncovered": ["clothing care", "laundry"]},
            {"unit": 3, "title": "kitchen helper safety and no-heat preparation",
             "anchors": ["H-SAF-5-5", "H-SAF-5-5-examples", "H-SAF-5-5-3"], "coverage": "partial",
             "uncovered": ["kitchen tasks", "food preparation"]},
            {"unit": 4, "title": "body signals, rest, and food variety",
             "anchors": ["H-PHW-5-5", "H-PHW-5-5-examples", "H-BEPA-5-4-2", "H-BEPA-5-4-8"],
             "coverage": "full", "uncovered": []},
            {"unit": 5, "title": "time, belongings, and help-seeking",
             "anchors": ["H-MEH-5-5-10", "H-SAF-5-3", "SEL-5C"], "coverage": "full",
             "uncovered": []},
            {"unit": 6, "title": "family contribution capstone",
             "anchors": ["SEL-3B", "H-MEH-5-5-9"], "coverage": "partial",
             "uncovered": ["family contribution as a course capstone"]},
        ],
    },
    "ma-g4-ready-for-life": {
        "governing_authority": "manuel-academy",
        "supporting_document": "mde-health-2025 + mde-sel-2017",
        "supporting_scope": ("Health Education Standards Guidelines grade span 3-5; SEL "
                             "Competencies and Indicators (2017) band 3-5"),
        "required_label": None,
        "units": [
            {"unit": 1, "title": "durable home-care routines",
             "anchors": ["SEL-1D", "SEL-5C", "H-MEH-5-5-9"], "coverage": "partial",
             "uncovered": ["home-care routines"]},
            {"unit": 2, "title": "clothing and laundry care with supervision",
             "anchors": ["SEL-5C", "H-PHW-5-5"], "coverage": "partial",
             "uncovered": ["clothing care", "laundry"]},
            {"unit": 3, "title": "kitchen care and food safety",
             "anchors": ["H-SAF-5-5", "H-SAF-5-5-3", "H-BEPA-5-4-8"], "coverage": "partial",
             "uncovered": ["kitchen care", "food safety practice"]},
            {"unit": 4, "title": "body signals, rest, and fueling meals",
             "anchors": ["H-PHW-5-5-examples", "H-BEPA-5-4-2"], "coverage": "full",
             "uncovered": []},
            {"unit": 5, "title": "planning, belongings, and communication",
             "anchors": ["H-MEH-5-5-10", "SEL-5B", "SEL-4A"], "coverage": "full", "uncovered": []},
            {"unit": 6, "title": "family contribution capstone",
             "anchors": ["SEL-3B", "H-MEH-5-5-9"], "coverage": "partial",
             "uncovered": ["family contribution as a course capstone"]},
        ],
    },
}

# Strings that keep their r3 class but gain a pointer to the crosswalk.
CROSSWALK_REF_ONLY = {
    "Grade 3 economics and mathematics connections": "ma-g3-financial-literacy",
    "Grade 4 economics and mathematics connections": "ma-g4-financial-literacy",
}

# Machine-checkable invariants the release must satisfy.
INVARIANTS = [
    {"id": "I1", "applies_to": "financial-literacy",
     "rule": ("No Grade 3/4 citation may contain the phrase 'Michigan Personal Finance', a PF1-PF7 "
              "code, or any claim that Michigan publishes elementary personal finance standards."),
     "check": "forbidden_substring", "value": ["Michigan Personal Finance", "PF1", "PF2", "PF3",
                                               "PF4", "PF5", "PF6", "PF7"],
     "scope": ("Checked against required_label, i.e. the post-relabel state. The release as it "
               "stands TODAY still carries 'Michigan Personal Finance foundations — introductory' "
               "on 72 citations; that is what authored_class records, and this invariant does not "
               "claim otherwise."),
     "execution": "executed"},
    {"id": "I2", "applies_to": "ready-for-life",
     "rule": ("No Ready for Life citation may assert Michigan authorship, adoption, approval or "
              "alignment-as-standard. Supporting connection wording only."),
     "check": "authority_must_be", "value": "manuel-academy",
     "scope": "Every ready-for-life record in the registry, changed or not.",
     "execution": "executed"},
    {"id": "I3", "applies_to": "all",
     "rule": ("A CROSSWALK_SUPPORTING citation must name at least one official anchor carrying "
              "doc_id, locator and a quote presence-checked against held bytes, and must record "
              "governing authority manuel-academy."),
     "check": "crosswalk_well_formed", "value": None,
     "scope": "Every record whose policy_class is CROSSWALK_SUPPORTING.",
     "execution": "executed"},
    {"id": "I4", "applies_to": "all",
     "rule": ("Any substring a citation presents as an official topic, standard or code name must "
              "be byte-present in the cited document."),
     "check": "label_byte_present", "value": None,
     "scope": ("Every relabelled record in every subject, via its resolution's "
               "label_official_names. Each entry must be a substring of required_label AND its "
               "byte_form must be present in the named held document."),
     "execution": "executed"},
    {"id": "I5", "applies_to": "ready-for-life",
     "rule": ("MDE SEL Competencies and Indicators (2017) may be cited as a supporting framework "
              "and never as an academic standard."),
     "check": "sel_never_cited_as_standard", "value": "mde-sel-2017",
     "scope": ("Two executed checks: the document's own self-positioning sentence is byte-present, "
               "and no ready-for-life record carries authority michigan-mde. The further fact that "
               "the document is absent from the MDE Academic Standards index is a WEB OBSERVATION, "
               "recorded in source-custody.json, not an executed check."),
     "execution": "executed-in-part; index absence is a web observation"},
    {"id": "I6", "applies_to": "health",
     "rule": ("A citation naming a Michigan health topic must use the topic name printed on the "
              "topic list; expansions of it are not official names."),
     "check": "label_byte_present", "value": None,
     "scope": "Subsumed by I4; kept as the health-specific statement of the same rule.",
     "execution": "executed"},
]

# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

CLASSES_R3 = ["VERBATIM_VERIFIED", "ALIAS_RESOLVED_VERBATIM", "COMPOSITE_VERIFIED",
              "LOCAL_COMPOSITION", "UNVERIFIED", "HUMAN_REVIEW_REQUIRED"]
CLASSES_R4 = ["VERBATIM_VERIFIED", "ALIAS_RESOLVED_VERBATIM", "COMPOSITE_VERIFIED",
              "CROSSWALK_SUPPORTING", "LOCAL_COMPOSITION", "UNVERIFIED",
              "HUMAN_REVIEW_REQUIRED"]


def w_json(rel, obj):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False, sort_keys=False)
        fh.write("\n")
    return rel


def w_text(rel, text):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return rel


def main():
    # --- 1. verify the r3 input package -------------------------------
    if not os.path.isdir(R3):
        sys.exit(f"ABORT: input package not found: {R3}")
    for rel, pin in R3_PINS.items():
        got = sha256_file(os.path.join(R3, rel))
        if got != pin:
            sys.exit(f"ABORT: input g34-specialty-r3/{rel} sha256 mismatch\n"
                     f"  pinned {pin}\n  actual {got}")

    # --- 2. load every held document ----------------------------------
    docs = {}
    for d in DOCS_HELD:
        docs[d["doc_id"]] = read_pdf(os.path.join(ROOT, "sources", "documents", d["file"]),
                                     d["sha256"], d["doc_id"])
    for d in DOCS_INHERITED:
        docs[d["doc_id"]] = read_pdf(os.path.join(R3, d["path"]), d["sha256"],
                                     d["doc_id"] + " (inherited from g34-specialty-r3)")

    # --- 3. presence-check every anchor quote -------------------------
    extracts = {}
    for aid, a in sorted(ANCHORS.items()):
        doc = docs[a["doc_id"]]
        needle = norm(a["quote"])
        if needle not in doc["norm"]:
            sys.exit(f"ABORT: anchor {aid} not found in {a['doc_id']}\n  quote: {a['quote'][:140]}")
        extracts[aid] = {
            "anchor_id": aid,
            "doc_id": a["doc_id"],
            "locator": a["locator"],
            "quote": a["quote"],
            "verified_against_held_bytes": True,
            "occurrences": doc["norm"].count(needle),
        }

    # --- 4. absence assertions ----------------------------------------
    absences = []
    for ab in ABSENCES:
        doc = docs[ab["doc_id"]]
        n = doc["norm"].count(norm(ab["needle"]))
        if n != 0:
            sys.exit(f"ABORT: absence assertion {ab['id']} failed - "
                     f"{ab['needle']!r} occurs {n}x in {ab['doc_id']}")
        absences.append({**ab, "occurrences": 0, "verified_against_held_bytes": True})

    # --- 5. read what the lane authored, from the r3 record -----------
    r3_records = [json.loads(l) for l in
                  open(os.path.join(R3, "evidence", "citations.jsonl"), encoding="utf-8")]
    in_scope = [r for r in r3_records if r["subject"] in IN_SCOPE_SUBJECTS]
    r3_rollup = json.load(open(os.path.join(R3, "evidence", "rollup.json"), encoding="utf-8"))

    # --- 6. registry ---------------------------------------------------
    registry = []
    for rec in sorted(in_scope, key=lambda r: (r["subject"], r["course_id"], r["code_or_strand"])):
        s = rec["code_or_strand"]
        res = RESOLUTIONS.get(s)
        xw_course = CROSSWALK.get(rec["course_id"]) if res else None
        entry = {
            "record_id": f"{rec['course_id']}::{s}",
            "course_id": rec["course_id"],
            "subject": rec["subject"],
            "grade": rec["grade"],
            "unit_numbers": rec["unit_numbers"],
            "citation_count": rec["citation_count"],
            "lesson_id_set_sha256": rec["lesson_id_set_sha256"],
            "authored_string": s,
            "class_r3": rec["evidence_class"],
            "authored_class": res["authored_class"] if res else rec["evidence_class"],
            "policy_class": res["policy_class"] if res else rec["evidence_class"],
            "changed": bool(res),
            "release_action": res["release_action"] if res else "NONE",
            "required_label": None,
            "authority": (res["authority_after"] if res else rec["authority"]),
            "rule_id": res["rule_id"] if res else rec["rule_id"],
            "resolution_id": res["resolution_id"] if res else None,
            "official_support": [extracts[a] for a in res["official_support"]] if res else [],
            "crosswalk_ref": None,
            "notes": rec["notes"],
        }
        if res:
            entry["required_label"] = (res["required_label"] or
                                       (xw_course or {}).get("required_label"))
            if entry["required_label"] is None:
                sys.exit(f"ABORT: no required_label resolvable for {entry['record_id']}")
            if res["policy_class"] == "CROSSWALK_SUPPORTING":
                if not xw_course:
                    sys.exit(f"ABORT: CROSSWALK_SUPPORTING without a crosswalk: {entry['record_id']}")
                entry["crosswalk_ref"] = f"evidence/crosswalk.json#{rec['course_id']}"
        elif s in CROSSWALK_REF_ONLY:
            entry["crosswalk_ref"] = f"evidence/crosswalk.json#{CROSSWALK_REF_ONLY[s]}"
            entry["notes"] = (rec["notes"] + " r4: unchanged classification; gains a pointer to "
                              "the Grade-exact Social Studies economics crosswalk.")
        registry.append(entry)

    # --- 7. invariant checks against the policy's own output ----------
    inv_results = []
    for inv in INVARIANTS:
        failures = []
        for e in registry:
            if inv["applies_to"] not in ("all", e["subject"]):
                continue
            label = e["required_label"] if e["required_label"] else e["authored_string"]
            if inv["check"] == "forbidden_substring":
                if e["release_action"] == "RELABEL_REQUIRED" or e["changed"]:
                    for bad in inv["value"]:
                        if bad in label:
                            failures.append(f"{e['record_id']}: label contains {bad!r}")
            elif inv["check"] == "authority_must_be":
                if e["authority"] != inv["value"]:
                    failures.append(f"{e['record_id']}: authority is {e['authority']!r}")
            elif inv["check"] == "crosswalk_well_formed":
                if e["policy_class"] == "CROSSWALK_SUPPORTING":
                    if not e["official_support"] or not e["crosswalk_ref"]:
                        failures.append(f"{e['record_id']}: crosswalk incomplete")
                    if e["authority"] != "manuel-academy":
                        failures.append(f"{e['record_id']}: crosswalk authority not manuel-academy")
            elif inv["check"] == "label_byte_present":
                # every relabelled record, every subject: the official names the label
                # asserts must be substrings of it AND byte-present in the named document
                if not e["changed"]:
                    continue
                names = (RESOLUTIONS[e["authored_string"]].get("label_official_names") or
                         CROSSWALK.get(e["course_id"], {}).get("label_official_names"))
                if not names:
                    failures.append(f"{e['record_id']}: relabel declares no official names")
                    continue
                for nm in names:
                    if nm["asserted"] not in label:
                        failures.append(f"{e['record_id']}: {nm['asserted']!r} absent from label")
                    if norm(nm["byte_form"]) not in docs[nm["doc_id"]]["norm"]:
                        failures.append(f"{e['record_id']}: {nm['byte_form']!r} not printed in "
                                        f"{nm['doc_id']}")
            elif inv["check"] == "sel_never_cited_as_standard":
                if e["subject"] == "ready-for-life" and e["authority"] == "michigan-mde":
                    failures.append(f"{e['record_id']}: cites Michigan authority")
        if inv["check"] == "sel_never_cited_as_standard":
            # the document's own self-positioning sentence, from bytes
            if norm(ANCHORS["SEL-not-a-standard"]["quote"]) not in docs[inv["value"]]["norm"]:
                failures.append("SEL self-positioning sentence not present in held bytes")
        inv_results.append({"id": inv["id"], "rule": inv["rule"],
                            "scope": inv.get("scope"), "execution": inv.get("execution"),
                            "result": "PASS" if not failures else "FAIL",
                            "failures": failures})
    if any(r["result"] == "FAIL" for r in inv_results):
        sys.exit("ABORT: invariant failure\n" +
                 json.dumps([r for r in inv_results if r["result"] == "FAIL"], indent=2))

    # --- 8. counts -----------------------------------------------------
    def tally(key, classes, subset=None):
        out = {c: 0 for c in classes}
        for e in (subset if subset is not None else registry):
            out[e[key]] = out.get(e[key], 0) + e["citation_count"]
        return out

    before_scope = tally("class_r3", CLASSES_R3)
    after_scope = tally("policy_class", CLASSES_R4)
    by_subject = {}
    for subj in IN_SCOPE_SUBJECTS:
        sub = [e for e in registry if e["subject"] == subj]
        by_subject[subj] = {
            "citations": sum(e["citation_count"] for e in sub),
            "before": tally("class_r3", CLASSES_R3, sub),
            "after": tally("policy_class", CLASSES_R4, sub),
            "resolved_human_review": (tally("class_r3", CLASSES_R3, sub)["HUMAN_REVIEW_REQUIRED"] -
                                      tally("policy_class", CLASSES_R4, sub)["HUMAN_REVIEW_REQUIRED"]),
        }

    pkg_before = dict(r3_rollup["by_class"])
    pkg_after = {c: 0 for c in CLASSES_R4}
    for c in CLASSES_R3:
        pkg_after[c] = pkg_before.get(c, 0)
    for c in CLASSES_R4:
        pkg_after[c] = pkg_after.get(c, 0) - before_scope.get(c, 0) + after_scope.get(c, 0)

    changed = [e for e in registry if e["changed"]]
    counts = {
        "in_scope_subjects": IN_SCOPE_SUBJECTS,
        "in_scope_citations": sum(e["citation_count"] for e in registry),
        "in_scope_records": len(registry),
        "citations_reclassified": sum(e["citation_count"] for e in changed),
        "records_reclassified": len(changed),
        "human_review_resolved": (before_scope["HUMAN_REVIEW_REQUIRED"] -
                                  after_scope["HUMAN_REVIEW_REQUIRED"]),
        "human_review_remaining_in_scope": after_scope["HUMAN_REVIEW_REQUIRED"],
        "local_composition_in_scope": after_scope["LOCAL_COMPOSITION"],
        "crosswalk_supporting_in_scope": after_scope["CROSSWALK_SUPPORTING"],
        "relabels_required": len(changed),
    }
    return (docs, extracts, absences, registry, inv_results, before_scope, after_scope,
            by_subject, pkg_before, pkg_after, counts, r3_rollup)


def emit(built):
    (docs, extracts, absences, registry, inv_results, before_scope, after_scope,
     by_subject, pkg_before, pkg_after, counts, r3_rollup) = built
    written = []

    # ---- policy ------------------------------------------------------
    written.append(w_json("policy/classification-policy.json", {
        "policy_id": EVIDENCE_ID,
        "supersedes_open_findings": ["F3-financial-literacy-michigan-attribution",
                                     "F4-ready-for-life-michigan-string",
                                     "F5-health-safety-topic-name"],
        "input_evidence_id": INPUT_EVIDENCE_ID,
        "release_id": RELEASE_ID,
        "built": BUILT,
        "scope": {
            "subjects": IN_SCOPE_SUBJECTS,
            "courses": sorted({e["course_id"] for e in registry}),
            "citations": counts["in_scope_citations"],
            "out_of_scope": ("arts-and-music (372 citations, F1) and physical-education (288, F2) "
                             "are untouched here and remain HUMAN_REVIEW_REQUIRED."),
        },
        "classes": {
            "VERBATIM_VERIFIED": "The citation string in full appears verbatim in the cited official document.",
            "ALIAS_RESOLVED_VERBATIM": ("The citation is a house-prefixed form of one official element; strip "
                                        "the documented prefix and the remainder is verbatim official text."),
            "COMPOSITE_VERIFIED": ("The citation combines two or more separately verified official elements "
                                   "into a string that appears nowhere verbatim."),
            "CROSSWALK_SUPPORTING": ("NEW IN r4. The citation's governing authority is Manuel Academy, and one "
                                     "or more official Michigan elements are recorded as a supporting "
                                     "connection: named, located, and quoted from held bytes. It asserts "
                                     "topical correspondence only. It does NOT assert that Michigan authored, "
                                     "adopted, approved or aligned the Manuel Academy sequence, and it never "
                                     "converts a non-standard document into a standard."),
            "LOCAL_COMPOSITION": ("A Manuel Academy curricular anchor. Asserts no state authority. A positive "
                                  "classification, not a failure to verify."),
            "UNVERIFIED": "An official source is named but the exact code or text was not confirmed.",
            "HUMAN_REVIEW_REQUIRED": ("The citation asserts an authority the held documents do not support and "
                                      "the documents do not determine the correction."),
        },
        "classification_axes": {
            "authored_class": "What the string asserts as it stands in the release today.",
            "policy_class": "What it is once release_action is applied. Counts are reported both ways.",
            "release_action": "RELABEL_REQUIRED with an exact required_label, or NONE.",
            "authority": "Who the citation may claim authored the anchor: manuel-academy or michigan-mde.",
        },
        "boundary": ("This package classifies and mandates labels. It edits no lesson and writes nothing "
                     "outside curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/. Until a "
                     "lesson-editing lane applies the relabels, authored_class is what the release says and "
                     "policy_class is what it is entitled to say."),
        "resolutions": [
            {"resolution_id": r["resolution_id"], "subject": r["subject"],
             "authored_string": s, "question": r["question"], "verdict": r["verdict"],
             "authored_class": r["authored_class"], "policy_class": r["policy_class"],
             "release_action": r["release_action"],
             "required_label": (r["required_label"] or
                                "per-course; see evidence/crosswalk.json"),
             "authority_after": r["authority_after"], "rule_id": r["rule_id"],
             "official_support": [extracts[a] for a in r["official_support"]],
             "reasoning": r["reasoning"],
             "human_review_required": r["human_review_required"],
             "why_not_human_review": r["why_not_human_review"]}
            for s, r in RESOLUTIONS.items()
        ],
        "invariants": [{**inv, "verified_at_build": next(
            x["result"] for x in inv_results if x["id"] == inv["id"])} for inv in INVARIANTS],
        "never_assert": [
            "That Michigan publishes, adopts or approves Grade 3/4 personal finance standards.",
            "That Michigan authored, adopted, approved or aligned the Manuel Academy Ready for Life sequence.",
            "That MDE SEL Competencies and Indicators (2017) is an academic standard.",
            "That 'Safety and Injury Prevention' is a Michigan health topic name.",
            "That a supporting crosswalk is a standards alignment.",
        ],
    }))

    # ---- rules -------------------------------------------------------
    written.append(w_json("rules/resolution-rules.json", {
        "policy_id": EVIDENCE_ID,
        "inherits": f"{INPUT_EVIDENCE_ID} rules/classification-rules.json (S1-S9)",
        "method": ("Each rule is executed, not asserted: every quoted anchor is presence-checked "
                   "against the held PDF bytes during this build, and every absence assertion is "
                   "re-counted. A failure aborts before a file is written."),
        "rules": [
            {"id": "P1-health-topic-alias-unique-referent", "subject": "health",
             "supersedes": "S2-health-topic-composite (the HUMAN_REVIEW_REQUIRED branch)",
             "statement": (
                 "'Michigan Health Topic (Grades 3-5): <label>' where <label> is not on the printed "
                 "topic list resolves to COMPOSITE_VERIFIED under a mandatory relabel when BOTH "
                 "hold: (a) exactly one printed topic can be the referent, and (b) the extra words "
                 "are substantively covered by that topic's own indicators in the cited grade span. "
                 "The relabel is to the printed topic name. If two or more topics could be meant, "
                 "or the extra words are covered by no indicator, the citation stays "
                 "HUMAN_REVIEW_REQUIRED.")},
            {"id": "P2-financial-literacy-crosswalk-not-pf-code", "subject": "financial-literacy",
             "supersedes": "S7-financial-literacy-no-elementary-standard",
             "statement": (
                 "A Grade 3/4 financial-literacy citation naming Michigan resolves to "
                 "CROSSWALK_SUPPORTING when it is relabelled to exact-grade Michigan K-12 Social "
                 "Studies Economics expectations for that grade, with governing authority "
                 "manuel-academy. No PF1-PF7 code may be assigned to Grades 3/4 under any "
                 "circumstance: Michigan's personal finance expectations are 9-12 and its credit "
                 "rule is a high school diploma condition. Where no exact-grade economics "
                 "expectation covers a unit, the crosswalk records coverage 'none' and names what "
                 "is uncovered rather than reaching for a looser anchor.")},
            {"id": "P3-ready-for-life-supporting-connection-only", "subject": "ready-for-life",
             "supersedes": "S9-ready-for-life-no-michigan-authority",
             "statement": (
                 "A Ready for Life citation naming Michigan resolves to CROSSWALK_SUPPORTING when "
                 "relabelled to name the supporting documents and disclaim standard status, and "
                 "when each unit's anchors are quoted from held bytes. Governing authority stays "
                 "manuel-academy. A Ready for Life citation may never carry authority michigan-mde, "
                 "and the MDE SEL Competencies may never be described as a standard.")},
            {"id": "P4-relabel-is-not-a-lesson-edit", "subject": "all",
             "statement": (
                 "A resolution may mandate a citation label; it may not edit a lesson. Until a "
                 "lesson-editing lane applies required_label, the release still reads what "
                 "authored_class describes. Both counts are published so neither can be mistaken "
                 "for the other.")},
            {"id": "P5-coverage-is-reported-not-padded", "subject": "all",
             "statement": (
                 "Crosswalk coverage is one of full, partial, none. 'partial' and 'none' name the "
                 "uncovered concepts. A unit with no official anchor gets no anchor.")},
        ],
    }))

    # ---- source custody ----------------------------------------------
    held = []
    for d in DOCS_HELD:
        doc = docs[d["doc_id"]]
        held.append({k: v for k, v in d.items()} | {
            "held_at": f"sources/documents/{d['file']}",
            "custody": "held-in-this-package",
            "bytes": doc["bytes"], "pages": doc["n_pages"],
            "retrieved": RETRIEVED, "retrieval_method": UA_NOTE, "sha256_verified": True,
        })
    for d in DOCS_INHERITED:
        doc = docs[d["doc_id"]]
        held.append({**d, "custody": "inherited-from-g34-specialty-r3",
                     "held_at": f"../g34-specialty-r3/{d['path']}",
                     "bytes": doc["bytes"], "pages": doc["n_pages"],
                     "retrieved": RETRIEVED, "retrieval_method": UA_NOTE,
                     "sha256_verified": True,
                     "note": ("Not copied. The build verifies these bytes against r3's pinned "
                              "SHA256 before reading them, so there is one custody chain, not two "
                              "copies that could drift apart.")})
    written.append(w_json("sources/source-custody.json", {
        "policy_id": EVIDENCE_ID,
        "retrieved": RETRIEVED,
        "retrieval_method": UA_NOTE,
        "documents": held,
        "absence_assertions": absences,
        "doc_pair_diff": {
            "pair": ["mde-health-2025", "mde-health-2025-alt"],
            "closes": "g34-specialty-r3 open question Q5",
            "method": ("Both PDFs extracted page by page with pypdf and compared under this "
                       "package's normalization, 70 pages against 70 pages."),
            "pages_differing": [20],
            "difference": ("PDF page 20 only. The Academic-Standards-index copy held in r3 prints "
                           "'abstinence).'; the press-release copy held here prints 'abstinence, "
                           "contraception).' Nothing else differs anywhere in either document."),
            "bearing_on_this_package": ("None. PDF page 20 is in the Grades 6-8 band (codes 8.x) "
                                        "and the difference is in Sex Education wording. Every "
                                        "anchor this package cites - the topic list, the grade span "
                                        "label, Safety [5.5.SAF] 1 and 3, Safety [5.3.SAF] 2 - is "
                                        "byte-identical in both, and 'Injury Prevention' occurs "
                                        "zero times in both."),
        },
        "web_observations": [
            {"observation_id": "sel-published-under-health-safety-not-academic-standards",
             "url": "https://www.michigan.gov/mde/services/health-safety/social-emotional-learning-sel",
             "observed": RETRIEVED,
             "finding": ("The MDE SEL page publishes 'Social and Emotional Learning Competencies' "
                         "(the 2017 document held here), a talking-points sheet and a fact sheet. "
                         "The same page also links the Health Education Standards Guidelines held "
                         "in r3 - which is where the authored phrase 'Health/SEL' most likely "
                         "comes from. Neither the page nor the document calls the competencies a "
                         "standard.")},
            {"observation_id": "academic-standards-index-omits-sel-and-elementary-pf",
             "url": "https://www.michigan.gov/mde/services/academic-standards",
             "observed": RETRIEVED,
             "finding": ("The Academic Standards index lists no SEL document and no elementary "
                         "personal finance document. Under Personal Finance it lists only the "
                         "9-12 Content Expectations and the Course/Credit Requirements held "
                         "here. It does list the Health Education Standards Guidelines and the "
                         "K-12 Social Studies Standards.")},
            {"observation_id": "mcl-380-1278a-is-a-diploma-condition",
             "url": "https://www.michigan.gov/mde/services/academic-standards/personal-finance",
             "observed": RETRIEVED,
             "finding": ("MCL 380.1278a(3), reproduced in the held course/credit document, "
                         "conditions a high school diploma on a 1/2 credit personal finance "
                         "course for pupils entering grade 8 in 2023 or after. It is a graduation "
                         "requirement, not an elementary content standard.")},
        ],
        "extraction": {"library": "pypdf", "version": pypdf.__version__,
                       "note": ("Quotes below are published in the form the documents print. "
                                "The presence CHECK is looser than that: before comparing, both "
                                "the held text and the quote are whitespace-collapsed, layout "
                                "bullets are dropped, en/em dashes are folded to hyphens, and "
                                "EVERY hyphen between two letters is removed. That last rule is "
                                "what undoes PDF line-break hyphenation ('ser - vices'), but it "
                                "also folds genuine hyphenation, so 'well-rounded' and "
                                "'wellrounded' compare equal and the check could not tell them "
                                "apart. It is applied identically to both sides. The PDF bytes are "
                                "the record; the extraction is the reading of them.")},
    }))

    written.append(w_text("sources/refetch.sh", "\n".join([
        "#!/bin/sh",
        "# Re-fetch the two documents this package holds and check them against the pinned",
        "# SHA256. The three inherited documents are re-fetched by",
        "# ../g34-specialty-r3/sources/refetch.sh - this package verifies their hashes at",
        "# build time but does not hold a second copy.",
        "set -e",
        'cd "$(dirname "$0")/documents"',
        'UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like '
        'Gecko) Chrome/126.0.0.0 Safari/537.36"',
        "",
        "fetch() {",
        '  curl -sS -L -A "$UA" -o "$1.refetch" "$2"',
        '  got=$(shasum -a 256 "$1.refetch" | cut -d\' \' -f1)',
        '  if [ "$got" = "$3" ]; then',
        '    echo "OK       $1"',
        '    rm -f "$1.refetch"',
        "  else",
        '    echo "CHANGED  $1"',
        '    echo "  pinned $3"',
        '    echo "  live   $got"',
        '    echo "  kept as $1.refetch - diff it before trusting any classification against $1"',
        "  fi",
        "}",
        "",
    ] + [f'fetch "{d["file"]}" \\\n      "{d["official_url"]}" \\\n      {d["sha256"]}\n'
         for d in DOCS_HELD])))

    written.append(w_json("sources/extracts/official-anchors.json", {
        "policy_id": EVIDENCE_ID,
        "note": ("Every anchor below was pulled from the held bytes during this build and its "
                 "presence re-checked. Locators are PDF page indices, not the documents' own "
                 "printed page numbers."),
        "anchors": [extracts[k] for k in sorted(extracts)],
        "absence_assertions": absences,
    }))

    # ---- evidence -----------------------------------------------------
    lines = [json.dumps(e, ensure_ascii=False, sort_keys=True) for e in registry]
    written.append(w_text("evidence/registry.jsonl", "\n".join(lines) + "\n"))

    xw_out = {}
    for course, c in CROSSWALK.items():
        res_label = c["required_label"]
        if res_label is None:
            res_label = next(r["required_label"] for r in RESOLUTIONS.values()
                             if r["subject"] == ("ready-for-life" if "ready-for-life" in course
                                                 else "financial-literacy"))
        xw_out[course] = {
            "course_id": course,
            "governing_authority": c["governing_authority"],
            "governing_authority_note": ("The course is a Manuel Academy composition. The anchors "
                                         "below support it; they do not govern it and Michigan has "
                                         "approved no part of the sequence."),
            "supporting_document": c["supporting_document"],
            "supporting_scope": c["supporting_scope"],
            "required_label": res_label,
            "units": [{
                "unit": u["unit"], "title": u["title"], "coverage": u["coverage"],
                "uncovered": u["uncovered"],
                "anchors": [extracts[a] for a in u["anchors"]],
            } for u in c["units"]],
            "coverage_summary": {
                cov: sum(1 for u in c["units"] if u["coverage"] == cov)
                for cov in ("full", "partial", "none")
            },
        }
    written.append(w_json("evidence/crosswalk.json", {
        "policy_id": EVIDENCE_ID,
        "what_this_is": ("Topical correspondence asserted by Manuel Academy between its own units "
                         "and official Michigan text held in custody. It is not a standards "
                         "alignment, was not produced or endorsed by MDE, and is not an "
                         "educator review."),
        "courses": xw_out,
    }))

    written.append(w_json("evidence/before-after.json", {
        "policy_id": EVIDENCE_ID,
        "in_scope": {"subjects": IN_SCOPE_SUBJECTS,
                     "citations": counts["in_scope_citations"],
                     "records": counts["in_scope_records"],
                     "before": before_scope, "after": after_scope},
        "by_subject": by_subject,
        "package_wide": {
            "note": ("g34-specialty-r3 totals with this package's three resolutions applied. "
                     "arts-and-music and physical-education are unchanged."),
            "citations_total": r3_rollup["citations_total"],
            "before": pkg_before, "after": pkg_after,
        },
        "counts": counts,
        "release_mapping_status_before_r3": r3_rollup["release_mapping_status_before"],
    }))

    written.append(w_json("evidence/rollup.json", {
        "policy_id": EVIDENCE_ID,
        "input_evidence_id": INPUT_EVIDENCE_ID,
        "release_id": RELEASE_ID,
        "in_scope_citations": counts["in_scope_citations"],
        "in_scope_records": counts["in_scope_records"],
        "by_class_after": after_scope,
        "by_subject": by_subject,
        "by_authority_after": {
            a: sum(e["citation_count"] for e in registry if e["authority"] == a)
            for a in sorted({e["authority"] for e in registry})
        },
        "by_release_action": {
            a: sum(e["citation_count"] for e in registry if e["release_action"] == a)
            for a in sorted({e["release_action"] for e in registry})
        },
        "counts": counts,
        "invariants": inv_results,
    }))

    # ---- findings -----------------------------------------------------
    written.append(w_json("findings/resolutions.json", {
        "policy_id": EVIDENCE_ID,
        "resolutions": [{
            "resolution_id": r["resolution_id"],
            "closes_finding": fid,
            "subject": r["subject"],
            "authored_string": s,
            "citations_affected": sum(e["citation_count"] for e in registry
                                      if e["authored_string"] == s),
            "verdict": r["verdict"],
            "from_class": "HUMAN_REVIEW_REQUIRED",
            "to_class": r["policy_class"],
            "release_action": r["release_action"],
            "required_label": (r["required_label"] or "per-course; see evidence/crosswalk.json"),
            "reasoning": r["reasoning"],
            "official_support": [extracts[a] for a in r["official_support"]],
            "why_not_human_review": r["why_not_human_review"],
        } for s, r, fid in [
            ("Michigan Health Topic (Grades 3-5): Safety and Injury Prevention",
             RESOLUTIONS["Michigan Health Topic (Grades 3-5): Safety and Injury Prevention"],
             "F5-health-safety-topic-name"),
            ("Michigan Personal Finance foundations — introductory",
             RESOLUTIONS["Michigan Personal Finance foundations — introductory"],
             "F3-financial-literacy-michigan-attribution"),
            ("Michigan Health/SEL connections",
             RESOLUTIONS["Michigan Health/SEL connections"],
             "F4-ready-for-life-michigan-string"),
        ]],
    }))

    _xw_fin = [c for cid, c in xw_out.items() if "financial-literacy" in cid]
    _finlit_uncovered_n = sum(len(u["uncovered"]) for c in _xw_fin for u in c["units"])
    _finlit_partial_n = sum(1 for c in _xw_fin for u in c["units"] if u["coverage"] == "partial")
    _finlit_none_n = sum(1 for c in _xw_fin for u in c["units"] if u["coverage"] == "none")
    written.append(w_json("findings/unresolved.json", {
        "policy_id": EVIDENCE_ID,
        "human_review_remaining_in_scope": counts["human_review_remaining_in_scope"],
        "unresolved_cases": [
            {"id": "U1", "kind": "out-of-scope-by-brief", "subject": "arts-and-music",
             "citations": 372, "state": "HUMAN_REVIEW_REQUIRED",
             "detail": ("F1-arts-wrong-framework. Every Grade 3/4 arts citation labels National "
                        "Core Arts Standards process vocabulary as Michigan. Untouched here."),
             "recommendation": ("Same shape as P2: Michigan prints 186 exact-grade Grade 3/4 arts "
                                "expectations. Either cite them or disclose the process framing as "
                                "non-Michigan. Does not need an educator to decide.")},
            {"id": "U2", "kind": "out-of-scope-by-brief", "subject": "physical-education",
             "citations": 288, "state": "HUMAN_REVIEW_REQUIRED",
             "detail": ("F2-pe-label-text-diverges. PE Standards 2, 3 and 5 are cited with text "
                        "Michigan does not print. Untouched here."),
             "recommendation": ("Same shape as P1: the official text is printed and unambiguous, so "
                                "a relabel resolves it. Standards 1 and 4 already verify.")},
            {"id": "U3", "kind": "carried-open-question", "subject": "health, ready-for-life",
             "citations": 0, "state": "OPEN",
             "detail": ("r3 Q2: the Michigan Health Education Standards Guidelines is titled "
                        "guidelines and the approving press release describes guidance to districts "
                        "under local control. This package inherits that limit and does not upgrade "
                        "the document to 'standards' anywhere."),
             "recommendation": ("A release-level wording decision, not a per-citation one. Whatever "
                                "is decided must apply to all 246 health citations at once.")},
            {"id": "U4", "kind": "closed-here", "subject": "health",
             "citations": 0, "state": "CLOSED",
             "detail": ("r3 Q5: two health PDF filenames are in circulation (the November 2025 "
                        "press release links '---ADA-Final.pdf'; the Academic Standards index links "
                        "the '---ADA-final-with-edits-12-19-25.pdf' held in r3). Both are now held "
                        "and diffed page by page. They differ on PDF page 20 only: 'abstinence).' "
                        "against 'abstinence, contraception).' - Grades 6-8 Sex Education wording. "
                        "Every anchor this package cites is byte-identical in both and neither "
                        "prints 'Injury Prevention'. See source-custody.json#doc_pair_diff."),
             "recommendation": ("None. The question is answered. A lane citing the Grades 6-8 Sex "
                                "Education band must pick a copy deliberately; no Grade 3/4 lane "
                                "is affected.")},
            {"id": "U5", "kind": "scope-boundary", "subject": "financial-literacy",
             "citations": 0, "state": "OPEN",
             "detail": (f"The crosswalk records {_finlit_uncovered_n} Grade 3/4 "
                        "financial-literacy concepts that no Michigan exact-grade economics "
                        "expectation covers, across "
                        f"{_finlit_partial_n} partial and {_finlit_none_n} uncovered units - "
                        "among them needs and wants, saving and savings goals at Grade 3, money "
                        "tools, money privacy, advertising, budgeting and spending plans, "
                        "borrowing and giving. Each is named as uncovered rather than anchored to "
                        "something looser."),
             "recommendation": ("Nothing to fix. These stay LOCAL_COMPOSITION with no supporting "
                                "anchor, which is the honest state. Recorded so a later lane does "
                                "not read blank coverage as an oversight.")},
        ],
        "human_review_recommendations": [
            {"id": "HR1", "priority": "none-required-in-scope",
             "recommendation": ("No in-scope citation still needs a human to decide a "
                                "classification. All 156 are determined by the held documents.")},
            {"id": "HR2", "priority": "advisory",
             "recommendation": ("A licensed health educator should sanity-check the Ready for Life "
                                "unit-to-Health-indicator correspondences before the crosswalk is "
                                "shown to families as anything more than a study aid. That is a "
                                "review of pedagogy, not of provenance - the provenance is settled "
                                "here.")},
            {"id": "HR3", "priority": "advisory",
             "recommendation": ("Nothing in this package is a licensed-educator review. 'Verified' "
                                "means an authored string was compared against an official "
                                "document's bytes.")},
        ],
    }))

    # ---- manifest, readme, sums --------------------------------------
    written.append(w_json("MANIFEST.json", {
        "policy_id": EVIDENCE_ID,
        "status": "G34_HEALTH_FINLIT_RFL_STANDARDS_POLICY_READY",
        "built": BUILT,
        "input_evidence_package": {
            "evidence_id": INPUT_EVIDENCE_ID,
            "path": "curriculum-release-evidence/g34-specialty-r3",
            "pins": R3_PINS, "read_only": True, "files_written_outside_this_dir": 0,
        },
        "release_id": RELEASE_ID,
        "lessons_edited": 0,
        "scope": {"subjects": IN_SCOPE_SUBJECTS,
                  "courses": sorted({e["course_id"] for e in registry}),
                  "citations": counts["in_scope_citations"]},
        "counts": counts,
        "by_class_after": after_scope,
        "documents_in_custody": [
            {"doc_id": d["doc_id"], "custody": "held-in-this-package",
             "sha256": d["sha256"], "bytes": docs[d["doc_id"]]["bytes"],
             "pages": docs[d["doc_id"]]["n_pages"]} for d in DOCS_HELD
        ] + [
            {"doc_id": d["doc_id"], "custody": "inherited-from-g34-specialty-r3",
             "sha256": d["sha256"], "bytes": docs[d["doc_id"]]["bytes"],
             "pages": docs[d["doc_id"]]["n_pages"]} for d in DOCS_INHERITED
        ],
        "invariants": [{"id": r["id"], "result": r["result"]} for r in inv_results],
        "boundary": "Writes only under curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/.",
    }))

    written.append(w_text("README.md", readme(built)))

    # SHA256SUMS last, over everything else
    sums = []
    for rel in sorted(written) + sorted(f"sources/documents/{d['file']}" for d in DOCS_HELD):
        sums.append(f"{sha256_file(os.path.join(ROOT, rel))}  {rel}")
    w_text("SHA256SUMS.txt", "\n".join(sums) + "\n")
    return written


def readme(built):
    (docs, extracts, absences, registry, inv_results, before_scope, after_scope,
     by_subject, pkg_before, pkg_after, counts, r3_rollup) = built

    def row(subj, label):
        b, a = by_subject[subj]["before"], by_subject[subj]["after"]
        return (f"| {label} | {by_subject[subj]['citations']} | "
                f"{b['HUMAN_REVIEW_REQUIRED']} | {a['HUMAN_REVIEW_REQUIRED']} | "
                f"{a['CROSSWALK_SUPPORTING']} | {a['LOCAL_COMPOSITION']} |")

    xw = json.load(open(os.path.join(ROOT, "evidence", "crosswalk.json"), encoding="utf-8"))
    fin = [c for cid, c in xw["courses"].items() if "financial-literacy" in cid]
    rfl = [c for cid, c in xw["courses"].items() if "ready-for-life" in cid]

    def cov(cs, kind):
        return sum(1 for c in cs for u in c["units"] if u["coverage"] == kind)

    fin_units = sum(len(c["units"]) for c in fin)
    fin_none = [f"Grade {c['course_id'][4]} Unit {u['unit']} ({u['title']})"
                for c in fin for u in c["units"] if u["coverage"] == "none"]

    return f"""# Grade 3/4 Health, Financial Literacy and Ready for Life - Standards Policy

`{EVIDENCE_ID}` - status **G34_HEALTH_FINLIT_RFL_STANDARDS_POLICY_READY**

The three systemic classifications `{INPUT_EVIDENCE_ID}` left for a human, resolved against the
official documents. **No lesson was edited and no file outside this directory was written.**

## What was open

r3 classified 816 of 1854 Grade 3/4 specialty citations HUMAN_REVIEW_REQUIRED. 156 of those were
systemic - one authored string repeated across a whole course - and are the subject of this
package. The other 660 (arts 372, PE 288) are untouched.

| Subject | Citations | Human-review before | after | Crosswalk | Local composition |
| --- | ---: | ---: | ---: | ---: | ---: |
{row('health', 'Health')}
{row('financial-literacy', 'Financial Literacy')}
{row('ready-for-life', 'Ready for Life')}

{counts['citations_reclassified']} citations across {counts['records_reclassified']} records are reclassified. All {counts['human_review_resolved']} leave human review; {counts['human_review_remaining_in_scope']} remain in scope.

## Health - the alias holds, the label does not

`Michigan Health Topic (Grades 3-5): Safety and Injury Prevention`, 12 citations.

The mapping is defensible. Michigan's Grades 3-5 band prints exactly two safety groupings,
`Safety [5.3.SAF]` and `Safety [5.5.SAF]`, and both carry the one topic name on the printed list:
`Safety [SAF]`. Nothing else could be meant, so identifying the referent takes no judgement. And
the extra words are that topic's own content at that band - `[5.5.SAF] 1` says *reduce the risk of
injuries in various situations* and lists fire prevention, water, firearms, motor vehicles and
pedestrian contexts; `[5.5.SAF] 3` covers getting help when someone is poisoned or injured.

The label is still not Michigan's. **`Injury Prevention` occurs zero times in the document.** No
other topic absorbs it either: `Personal Health and Wellness [5.5.PHW] 1` mentions pedestrian and
sun safety only as examples of health-promoting behaviour.

So: **COMPOSITE_VERIFIED under a mandatory relabel** to `Michigan Health Topic (Grades 3-5):
Safety`. It is not held for a human, because the document decides it - the same rule the package
already applies to the other six topics.

## Financial Literacy - two things, separated

`Michigan Personal Finance foundations — introductory`, 72 citations.

Michigan publishes no Grade 3/4 personal finance standard, and this package proves it twice.
r3 proved it from the content expectations (PF1-PF7, `Grade 3` and `Grade 4` each occur zero
times). This package adds the credit rule, which quotes MCL 380.1278a(3): a **high school
diploma** condition for pupils entering grade 8 in 2023 or after. `Grade 3` and `elementary`
occur zero times there too. **No PF code is manufactured.**

What Michigan does publish for these exact grades is economics, in the K-12 Social Studies
Standards: `3 - E1.0.1` through `3 - E3.0.1`, and `4 - E1.01` through `4 - E3.0.1`. Real codes,
right grades, different subject. They become a **supporting crosswalk**, not the course's
governing standard, and the Manuel Academy progression stays what it already was -
LOCAL_COMPOSITION, {by_subject['financial-literacy']['after']['LOCAL_COMPOSITION']} citations of it.

The crosswalk reports what it does not cover. {len(fin_none)} of {fin_units} financial literacy
units get **no anchor at all** - {", ".join(fin_none)} - because no exact-grade economics
expectation touches them: `needs` and `wants` occur zero times in Michigan's Grade 3 economics,
and so do `saving`, `budget` and `advertis*`. The remaining {cov(fin, "partial")} are `partial`;
{cov(fin, "full")} reach `full`. Every uncovered concept is named in `evidence/crosswalk.json`,
not padded out, and an anchor that was considered and judged too loose says so.

## Ready for Life - support exists, and it is not a standard

`Michigan Health/SEL connections`, 72 citations.

r3 recorded that MDE publishes SEL Competencies and Indicators (2017) but did not retrieve it.
This package holds it. It is real: five competencies, indicators 1A-5C, and a 3-5 benchmark band
for each, with text that genuinely corresponds to Ready for Life units - *identify and organize
materials needed to be prepared for class*, *identify roles they have that contribute to their
school, home, and neighboring community*.

The same bytes say what it is not. Its first page: *Currently, Michigan has Content State
Standards that focus on academics. However, there is little that attend to the other aspects of
learning for children/students.* It places itself beside the standards, and the K-12 competencies
cited here carry no State Board adoption line. (The document does say its separate *Early
Childhood* competencies come from SBE-approved standards - a different band, not cited here.)

Two further facts are **web observations, not bytes**, and are recorded as such in
`sources/source-custody.json#web_observations`: the document is published under MDE's Health &
Safety services rather than Academic Standards, and it is absent from the Academic Standards
index.

So the string becomes a **supporting connection with named anchors** and may never become a
state-standard claim. Ready for Life stays Manuel Academy authorship;
{by_subject['ready-for-life']['after']['LOCAL_COMPOSITION']} of its citations are already
LOCAL_COMPOSITION and stay so. **`Ready for Life` occurs zero times in every Michigan document
held across both packages.** Michigan has approved no part of the sequence, and
`policy/classification-policy.json#never_assert` forbids saying otherwise.

## The new class

`CROSSWALK_SUPPORTING` is the only class r4 adds. It means: governing authority is Manuel
Academy, and one or more official Michigan elements are recorded as a supporting connection -
named, located, and quoted from held bytes. It asserts topical correspondence. It does not assert
that Michigan authored, adopted, approved or aligned anything, and it never turns a non-standard
document into a standard. Invariant `I3` refuses to let one exist without an anchor.

## Two classifications, on purpose

This package mandates labels; it does not edit lessons. So every record carries both:

- `authored_class` - what the release says today
- `policy_class` - what it is entitled to say once `required_label` is applied

{counts['relabels_required']} relabels are required. Until a lesson-editing lane applies them, the
release still reads the authored form, and both counts are published so neither can be mistaken
for the other.

## Package-wide effect

| Class | r3 | r4 |
| --- | ---: | ---: |
| VERBATIM_VERIFIED | {pkg_before.get('VERBATIM_VERIFIED', 0)} | {pkg_after['VERBATIM_VERIFIED']} |
| ALIAS_RESOLVED_VERBATIM | {pkg_before.get('ALIAS_RESOLVED_VERBATIM', 0)} | {pkg_after['ALIAS_RESOLVED_VERBATIM']} |
| COMPOSITE_VERIFIED | {pkg_before.get('COMPOSITE_VERIFIED', 0)} | {pkg_after['COMPOSITE_VERIFIED']} |
| CROSSWALK_SUPPORTING | 0 | {pkg_after['CROSSWALK_SUPPORTING']} |
| LOCAL_COMPOSITION | {pkg_before.get('LOCAL_COMPOSITION', 0)} | {pkg_after['LOCAL_COMPOSITION']} |
| UNVERIFIED | {pkg_before.get('UNVERIFIED', 0)} | {pkg_after['UNVERIFIED']} |
| HUMAN_REVIEW_REQUIRED | {pkg_before.get('HUMAN_REVIEW_REQUIRED', 0)} | {pkg_after['HUMAN_REVIEW_REQUIRED']} |
| **Total** | **{r3_rollup['citations_total']}** | **{sum(pkg_after.values())}** |

## Source custody

Three documents are held here byte for byte, pinned by SHA256. Three more are **inherited** from
g34-specialty-r3: not copied, but verified against r3's pinned hashes before a byte is read, so
there is one custody chain rather than two copies that could drift.

| doc_id | custody | pages |
| --- | --- | ---: |
| mde-sel-2017 | held here | {docs['mde-sel-2017']['n_pages']} |
| mde-health-2025-alt | held here | {docs['mde-health-2025-alt']['n_pages']} |
| mde-pf-course-credit | held here | {docs['mde-pf-course-credit']['n_pages']} |
| mde-health-2025 | inherited from r3 | {docs['mde-health-2025']['n_pages']} |
| mde-social-studies | inherited from r3 | {docs['mde-social-studies']['n_pages']} |
| mde-personal-finance | inherited from r3 | {docs['mde-personal-finance']['n_pages']} |

{len(extracts)} anchors are quoted, and every one is presence-checked against those bytes at build
time. {len(absences)} absence assertions are re-counted the same way - including the three that
carry the argument: `Injury Prevention` in the health guidelines, `Grade 3` in the personal
finance documents, and `Ready for Life` in every Michigan document held.

r3's open question Q5 is closed rather than carried. Both health PDF filenames are now held and
diffed page by page: they differ on PDF page 20 only, `abstinence).` against `abstinence,
contraception).`, in the Grades 6-8 Sex Education band. Every anchor this package cites is
byte-identical in both.

## Layout

```
g34-specialty-health-finlit-rfl-r4/
  MANIFEST.json                        identity, counts, input pin, boundary
  SHA256SUMS.txt
  policy/classification-policy.json    the machine-readable policy: classes, resolutions, invariants
  rules/resolution-rules.json          P1-P5, and which r3 rule each supersedes
  sources/documents/*.pdf              the three documents newly in custody
  sources/source-custody.json          url, sha256, pages, retrieval, absence assertions
  sources/extracts/official-anchors.json   every quoted anchor, pulled from bytes at build time
  sources/refetch.sh                   re-fetch and re-check the two held documents
  evidence/registry.jsonl              one record per authored citation string per course
  evidence/crosswalk.json              unit -> official anchors, with honest coverage
  evidence/before-after.json           counts before and after, in scope and package-wide
  evidence/rollup.json                 counts by class, subject, authority, action
  findings/resolutions.json            the three closures, with reasoning and support
  findings/unresolved.json             what is still open, and what a human is actually needed for
  tools/build-r4.py                    regenerates all of the above
```

## Reproducing

```bash
python3 curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/tools/build-r4.py
```

It verifies all five documents and the three pinned r3 inputs before reading a byte, aborts on any
mismatch, aborts if any quoted anchor is not present in the held bytes, aborts if any absence
assertion is violated, and aborts if any invariant fails. Same inputs produce a byte-identical
tree.

## Read before promoting

- Nothing here is a licensed-educator review. `verified` means an authored string was compared
  against an official document's bytes.
- A crosswalk is not an alignment. The unit-to-anchor correspondences are Manuel Academy's claim
  about its own material, not MDE's about it.
- The relabels are not applied. This package writes no lesson; it says what the labels must
  become.
- A `PASS` on invariant I1 is a statement about `required_label`, not about the release as it
  stands. 72 citations still read `Michigan Personal Finance foundations — introductory` today;
  that is exactly what `authored_class` records.
- r3's open question Q2 is inherited, not answered: the health document is titled *guidelines* and
  the approving press release describes guidance to districts under local control. Nothing here
  upgrades it to "standards".
- {pkg_after['HUMAN_REVIEW_REQUIRED']} citations still need a human, all of them arts or PE. Both
  look resolvable the same way these were - printed official text, unambiguous - but neither was
  in this brief.
"""


if __name__ == "__main__":
    built = main()
    files = emit(built)
    counts = built[10]
    print(f"{EVIDENCE_ID}")
    print(f"  files written           {len(files) + 1}")
    print(f"  in-scope citations      {counts['in_scope_citations']}")
    print(f"  reclassified            {counts['citations_reclassified']}")
    print(f"  human review resolved   {counts['human_review_resolved']}")
    print(f"  human review remaining  {counts['human_review_remaining_in_scope']}")
    print(f"  crosswalk supporting    {counts['crosswalk_supporting_in_scope']}")
    print(f"  local composition       {counts['local_composition_in_scope']}")
    for r in built[4]:
        print(f"  invariant {r['id']}            {r['result']}")
