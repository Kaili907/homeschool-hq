# -*- coding: utf-8 -*-
"""Course text banks.

Three rights categories only:
  original       - written for Manuel Academy; the Academy holds the rights.
  public_domain  - published before 1929 in the United States, or a US federal
                   government work; free to reproduce in full.
  rights_required - named by a standard as an example but still in copyright.
                   NEVER reproduced here. The course supplies a public-domain
                   substitute that meets the same standard, and the family may
                   substitute the named work if they hold or obtain access.
"""

def orig(cid, title, form, summary, passage):
    return {"text_id": cid, "title": title, "form": form, "rights": "original",
            "author": "Manuel Academy", "year": 2026,
            "source": "Authored for Manuel Academy High School ELA; Academy-held rights.",
            "summary": summary, "opening_passage": passage, "reproducible_in_full": True}

def pd(cid, title, author, year, form, source, note=""):
    return {"text_id": cid, "title": title, "form": form, "rights": "public_domain",
            "author": author, "year": year,
            "source": source,
            "summary": note, "reproducible_in_full": True}

def gated(cid, title, author, standard_ref, substitute):
    return {"text_id": cid, "title": title, "form": "reference-only", "rights": "rights_required",
            "author": author, "year": None,
            "source": "Named as an example in the Michigan ELA standards. Text is NOT included in this package.",
            "standard_reference": standard_ref,
            "reproducible_in_full": False,
            "access_route": "Family-supplied: library loan, licensed classroom edition, or rights-holder's authorized publication.",
            "public_domain_substitute": substitute}

GUT = "Project Gutenberg (public domain)"
NARA = "U.S. National Archives (federal government work, public domain)"

BANKS = {
 "english-9": [
  orig("ma-hs-ela-t-901", "The Second Reading", "short story",
       "A student re-reads a letter they thought they understood and finds the second reading contradicts the first. Written to make 'strong and thorough evidence' a felt problem rather than a definition.",
       "The letter had been on the counter for three days before Nadia read it properly. The first time, she had read it the way you read a sign in a language you half know - catching the shape of it, filling the rest in from what she expected it to say."),
  orig("ma-hs-ela-t-902", "Two Clocks", "short story",
       "A narrative told on two timelines that converge, built so that pacing and flashback are analyzable at the sentence level.",
       "At 6:14 the kitchen was still dark. Eleven years earlier, at 6:14, it had been the brightest room in a different house."),
  orig("ma-hs-ela-t-903", "The Ordinance Nobody Read", "argument",
       "A local-government argument with a deliberately planted unsupported inference and one genuinely sufficient evidence chain, for validity-versus-sufficiency work.",
       "Supporters of the ordinance say the intersection is dangerous. The record shows eleven collisions in four years. Whether eleven is many depends on a comparison the sponsors have not made."),
  orig("ma-hs-ela-t-904", "Field Notes on a Retreating Shore", "explanatory",
       "An explanatory article with headings and a data figure, written as a model for W.2 organization and graphics that genuinely aid comprehension.",
       "The shoreline moves every year. What changed recently is not the movement but our ability to measure it at the scale of a single season."),
  pd("ma-hs-ela-t-905", "The Gettysburg Address", "Abraham Lincoln", 1863, "speech", NARA,
     "272 words; a compact object for cumulative diction and structural analysis."),
  pd("ma-hs-ela-t-906", "Declaration of Sentiments (Seneca Falls)", "Elizabeth Cady Stanton and the Seneca Falls Convention", 1848, "public document", GUT,
     "Deliberately modeled on the Declaration of Independence; a clean case for source transformation."),
  pd("ma-hs-ela-t-907", "The Story of an Hour", "Kate Chopin", 1894, "short story", GUT,
     "Short enough to read whole in one session; irony and structural reversal are unmissable."),
  pd("ma-hs-ela-t-908", "Ozymandias", "Percy Bysshe Shelley", 1818, "poem", GUT,
     "Frame-within-frame point of view in fourteen lines."),
  pd("ma-hs-ela-t-909", "The Iliad (Butler translation), Book I", "Homer, tr. Samuel Butler", 1898, "epic poetry", GUT,
     "Public-domain translation; supports world-literature point of view (9-10.RL.6)."),
  pd("ma-hs-ela-t-910", "Narrative of the Life of Frederick Douglass, Chapters I-VII", "Frederick Douglass", 1845, "autobiography", GUT,
     "Rhetorical purpose and evidence in a first-person account."),
  pd("ma-hs-ela-t-911", "A Modest Proposal", "Jonathan Swift", 1729, "satire", GUT,
     "Satire that fails safely when read literally, so the gap between stated and meant is teachable."),
  gated("ma-hs-ela-t-912", "Letter from Birmingham Jail", "Martin Luther King Jr.", "9-10.RI.9",
        "ma-hs-ela-t-910 (Douglass) and ma-hs-ela-t-905 (Gettysburg Address) together meet 9-10.RI.9 using public-domain seminal U.S. texts."),
 ],
 "english-10": [
  orig("ma-hs-ela-t-1001", "Reconstruction of a Wednesday", "short story",
       "A story told out of order whose events only cohere on re-reading; built for RL.5 structural analysis without an exemplar.",
       "The part everyone remembers is the part that happened last. This is inconvenient, because it is also the only part that makes no sense on its own."),
  orig("ma-hs-ela-t-1002", "Two Reports, One River", "paired informational",
       "A municipal report and a community newsletter describing the same water-quality event, differing in emphasis and omission.",
       "The Department's summary runs to four pages and mentions the smell twice. The newsletter mentions it in the first sentence and does not stop."),
  orig("ma-hs-ela-t-1003", "The Case for the Slower Route", "argument",
       "A sustained argument written for a named external audience, with an explicitly fair counterclaim.",
       "The fastest route is not in dispute. What is in dispute is whether speed is the thing this road is for."),
  orig("ma-hs-ela-t-1004", "How a Correction Travels", "explanatory",
       "Publication-quality explanatory model tracing how a factual correction propagates - and fails to - across formats.",
       "A correction is not the opposite of an error. It is a much slower, much quieter document that must travel the same distance the error already covered."),
  pd("ma-hs-ela-t-1005", "Washington's Farewell Address", "George Washington", 1796, "public document", NARA,
     "Named in 9-10.RI.9; public domain and reproducible in full."),
  pd("ma-hs-ela-t-1006", "What to the Slave Is the Fourth of July?", "Frederick Douglass", 1852, "speech", GUT,
     "A seminal U.S. text whose rhetoric is the analysis, not decoration."),
  pd("ma-hs-ela-t-1007", "The Declaration of Independence", "Second Continental Congress", 1776, "public document", NARA,
     "Pairs with Seneca Falls and Douglass for related-themes analysis (9-10.RI.9)."),
  pd("ma-hs-ela-t-1008", "The Yellow Wallpaper", "Charlotte Perkins Gilman", 1892, "short story", GUT,
     "Unreliable narration; structure and sanity are the same analytic object."),
  # ma-hs-ela-t-1009 was withdrawn during authoring: it duplicated the gated Auden
  # entry (ma-hs-ela-t-1013) as a pseudo-catalogue row. IDs are stable and are not
  # renumbered after withdrawal, so 1009 is intentionally absent.
  pd("ma-hs-ela-t-1010", "Landscape with the Fall of Icarus (painting)", "after Pieter Bruegel the Elder", 1560, "visual art",
     "Royal Museums of Fine Arts of Belgium, Brussels; public domain. NOTE: scholarly consensus now treats the Brussels panel as a later copy rather than an autograph Bruegel. Public domain either way; the attribution question is worth naming to students.",
     "The visual half of the two-mediums comparison in 9-10.RL.7."),
  pd("ma-hs-ela-t-1011", "To a Friend Whose Work Has Come to Nothing", "W. B. Yeats", 1916, "poem", GUT,
     "Public-domain poem for medium-comparison work."),
  pd("ma-hs-ela-t-1012", "The Fall of Icarus (Ovid, Metamorphoses VIII, Golding translation)", "Ovid, tr. Arthur Golding", 1567, "narrative poetry", GUT,
     "Public-domain substitute completing the two-mediums pairing with Bruegel for 9-10.RL.7 without using an in-copyright poem."),
  gated("ma-hs-ela-t-1013", "Musee des Beaux Arts", "W. H. Auden", "9-10.RL.7",
        "ma-hs-ela-t-1012 (Ovid/Golding) paired with ma-hs-ela-t-1010 (Bruegel) meets 9-10.RL.7 entirely in the public domain."),
 ],
 "english-11": [
  orig("ma-hs-ela-t-1101", "What the Minutes Omit", "informational",
       "Meeting minutes plus a participant account that disagree in ways neither resolves; written so 11-12.RL.1 uncertainty is unavoidable.",
       "The minutes record that the motion carried. They do not record that two members later said they had understood the motion to mean something else."),
  orig("ma-hs-ela-t-1102", "The Dissent", "argument",
       "An original judicial-style dissent with explicit premises, for legal-reasoning analysis without needing a full case record.",
       "I agree with the majority about what the statute says. I disagree that the statute is the only thing here that speaks."),
  orig("ma-hs-ela-t-1103", "Three Sources on a Drought", "paired informational",
       "Three sources with genuinely irreconcilable figures, requiring the student to bound rather than resolve the discrepancy.",
       "The state says the reservoir fell nine feet. The district says six. Both are measuring, and both are measuring something real."),
  pd("ma-hs-ela-t-1104", "The Federalist No. 10", "James Madison", 1787, "public document", GUT,
     "Named in 11-12.RI.4 and 11-12.RI.8; the definition of faction is refined across the essay."),
  pd("ma-hs-ela-t-1105", "Lincoln's Second Inaugural Address", "Abraham Lincoln", 1865, "speech", NARA,
     "Named in 11-12.RI.9; public domain."),
  pd("ma-hs-ela-t-1106", "The Bill of Rights", "First United States Congress", 1791, "public document", NARA,
     "Named in 11-12.RI.9; public domain."),
  pd("ma-hs-ela-t-1107", "Self-Reliance", "Ralph Waldo Emerson", 1841, "essay", GUT,
     "Nineteenth-century foundational work; dense enough to require scaffolded entry."),
  pd("ma-hs-ela-t-1108", "Bartleby, the Scrivener", "Herman Melville", 1853, "short story", GUT,
     "Nineteenth-century foundational fiction whose refusals the text never explains."),
  pd("ma-hs-ela-t-1109", "Selected Poems", "Emily Dickinson", 1890, "poetry", GUT,
     "Compression, dashes, and syntax that reward 11-12.L.3 syntactic study."),
  pd("ma-hs-ela-t-1110", "Macbeth", "William Shakespeare", 1623, "drama", GUT,
     "Satisfies the Shakespeare requirement in 11-12.RL.4 and 11-12.RL.7."),
  pd("ma-hs-ela-t-1111", "The Souls of Black Folk, Chapters I-III", "W. E. B. Du Bois", 1903, "essay", GUT,
     "Early-twentieth-century foundational work; rhetoric and structure are inseparable."),
  pd("ma-hs-ela-t-1112", "Trifles", "Susan Glaspell", 1916, "drama", GUT,
     "A public-domain American dramatist, satisfying the American-drama half of 11-12.RL.7."),
  pd("ma-hs-ela-t-1113", "Declaration of Independence", "Second Continental Congress", 1776, "public document", NARA,
     "Named in 11-12.RI.9."),
 ],
 "english-12": [
  orig("ma-hs-ela-t-1201", "A Question Worth Four Months", "instructional text",
       "An original guide to converting a topic into a researchable question, written as a model the student critiques rather than follows.",
       "Most research fails at the first sentence, where a topic is mistaken for a question. A topic can be described forever. A question can be answered, or shown to be unanswerable, and either outcome is a result."),
  orig("ma-hs-ela-t-1202", "Six Sources, Ranked", "informational",
       "Six sources on one question, deliberately spanning peer-reviewed, trade, advocacy, and self-published, for warranted-credibility ranking.",
       "None of these six sources is worthless, and none is authoritative on every part of the question. Ranking them requires saying what each is authoritative about."),
  orig("ma-hs-ela-t-1203", "The Limits Paragraph", "instructional text",
       "An original model of the paragraph most student research omits: what the evidence does not establish.",
       "The strongest paragraph in a research paper is usually the one that concedes. It is also the one most often cut, because it feels like weakness and reads like authority."),
  orig("ma-hs-ela-t-1204", "Two Fields, One Word", "explanatory",
       "One term used differently in two disciplines, written to force discipline-convention awareness in writing.",
       "In one field the word means a measured quantity. In the other it means an inference about a quantity. Papers that borrow across the two without noticing produce sentences that are true in neither."),
  pd("ma-hs-ela-t-1205", "The Federalist No. 51", "James Madison", 1788, "public document", GUT,
     "Structural argument whose effectiveness is itself the object of 11-12.RI.5 analysis."),
  pd("ma-hs-ela-t-1206", "Preamble to the Constitution", "Constitutional Convention", 1787, "public document", NARA,
     "Named in 11-12.RI.9."),
  pd("ma-hs-ela-t-1207", "Civil Disobedience", "Henry David Thoreau", 1849, "essay", GUT,
     "Public advocacy with stated premises, for 11-12.RI.8."),
  pd("ma-hs-ela-t-1208", "Hamlet", "William Shakespeare", 1603, "drama", GUT,
     "Satisfies the Shakespeare requirement in 11-12.RL.7 and supports multiple-interpretation work."),
  pd("ma-hs-ela-t-1209", "The Emperor Jones", "Eugene O'Neill", 1920, "drama", GUT,
     "A public-domain American dramatist, completing the 11-12.RL.7 pairing."),
  pd("ma-hs-ela-t-1210", "A Room of One's Own, Chapters I-II", "Virginia Woolf", 1929, "essay", GUT,
     "Extended argument that models the limits paragraph in practice."),
  pd("ma-hs-ela-t-1211", "The Waste Land", "T. S. Eliot", 1922, "poem", GUT,
     "Allusive density appropriate to independent 11-CCR reading."),
  pd("ma-hs-ela-t-1212", "Address to the Second Annual Convention of the People's Party", "Mary Elizabeth Lease", 1892, "speech",
     "Contemporary newspaper transcription, 1892; public domain. NOTE: the transmitted text of Lease's speeches is historically contested and no single authoritative text exists. Facilitators should treat textual variance as part of the analysis, and should cite the specific transcription used.",
     "Public advocacy for rhetorical-power analysis (11-12.RI.6). Textual instability is itself instructive for source evaluation."),
 ],
}
