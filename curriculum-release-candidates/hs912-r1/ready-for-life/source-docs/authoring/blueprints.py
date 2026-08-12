"""Course blueprints for High School Ready for Life 9-12.

Extends the published Manuel Academy Ready for Life progression (grades 5, 7, 8 in
curriculum-content/manuel-academy/1.0.0) without modifying it. Shape matches the
published Grade 8 course exactly: 6 units x 6 lessons = 36 lessons per course, so
the Grade 8 -> Grade 9 handoff is structurally seamless.

Ready for Life has no external standards body. Competency codes here are local and
declared as such in ../standards/manuel-academy-rfl-9-12-competencies.json.
"""

SUBJECT = "ready-for-life"
GRADES = (9, 10, 11, 12)
UNITS_PER_COURSE = 6
LESSONS_PER_UNIT = 6
TOTAL_LESSONS = UNITS_PER_COURSE * LESSONS_PER_UNIT  # 36
DAYS_PER_WEEK = 1
WEEKS = 36

PHASES = (
    "Launch and planning",
    "Skill model",
    "Guided practice",
    "Supervised application",
    "Independent application",
    "Unit performance task",
)

# Lessons whose evidence depends on a real-world action need adult attestation.
GUARDIAN_SIGNOFF_DAYS = (4, 6)

GRADE_THEMES = {
    9:  ("Systems for Independence",
         "Grade 9 turns the Grade 8 routines into durable personal systems the learner runs "
         "themselves, with supervision where a task carries real risk."),
    10: ("Work, Documents, and Community",
         "Grade 10 moves outward: career exploration, job readiness, professional communication, "
         "and the consumer and civic tasks of participating in a community."),
    11: ("Postsecondary and Adult Systems",
         "Grade 11 plans the transition itself: pathways, applications and deadlines, health "
         "self-management, housing, and structured problem solving under real constraint."),
    12: ("Transition to Adulthood",
         "Grade 12 operates the systems of adult life end to end and closes with the "
         "transition-to-adulthood capstone."),
}

BLUEPRINTS = {
9: [
 dict(title="Planning Systems and Time Management", domains=["RFL.PLAN", "RFL.SOLVE"],
      essential_question="What planning system does this learner actually keep using when a week gets hard?",
      performance_task="Run a personal planning system for two weeks, then report what it caught, what it missed, and one change made.",
      topics=["choosing a calendar and task system that fits","capturing commitments before they are forgotten","breaking a multi-week obligation into steps","estimating how long a task really takes","protecting sleep, study, and recovery time","reviewing a week and adjusting the system"]),
 dict(title="Household Independence and Home Systems", domains=["RFL.HOME"],
      essential_question="Which household systems can this learner keep running without being reminded?",
      performance_task="Take documented ownership of two recurring household systems for two weeks with adult review.",
      topics=["laundry, cleaning, and supply rotation as a system","safe use of household appliances with supervision","recognising a repair that needs a qualified adult","routine upkeep and seasonal tasks","storing and labelling supplies safely","handing a task back with a clear status"]),
 dict(title="Food Systems: Planning, Shopping, and Cooking", domains=["RFL.FOOD"],
      essential_question="How does a person get a week of decent meals planned, bought, and cooked safely?",
      performance_task="Plan, shop for, and prepare three balanced meals across a week with adult supervision for heat and knives.",
      topics=["planning meals across a week","building a shopping list from a plan","food safety, storage, and expiry","knife and heat safety under supervision","cooking three balanced meals","reducing waste and using leftovers"]),
 dict(title="Transportation and Trip Planning", domains=["RFL.MOVE"],
      essential_question="How does a person get somewhere unfamiliar, on time, with a backup plan?",
      performance_task="Plan a complete round trip to an unfamiliar destination including timing, cost, contingency, and a check-in plan, and complete it with the agreed supervision.",
      topics=["reading schedules, maps, and routes","planning a trip backwards from an arrival time","comparing travel options on time, cost, and reliability","what to do when a connection fails","personal safety and check-in agreements","local rules for travel and identification"]),
 dict(title="Communication and Self-Advocacy", domains=["RFL.COMM"],
      essential_question="How does this learner ask for what they need, clearly and without apology?",
      performance_task="Prepare and carry out one real request or appointment conversation with adult support, then evaluate how it went.",
      topics=["stating a need clearly and specifically","asking a question of an unfamiliar adult","making and confirming an appointment","writing a short, clear message that gets a response","listening, confirming, and taking notes","following up when there is no reply"]),
 dict(title="Grade 9 Independence Capstone", domains=["RFL.PLAN", "RFL.ADULT"], capstone_level="year",
      essential_question="Can this learner run their own week — plan, home, food, travel, and communication — and show it?",
      performance_task="Run a documented one-week independence plan covering planning, a household system, meals, one trip, and one communication task, with adult attestation and a written review.",
      topics=["integrating the year's systems into one week","documenting evidence without oversharing","adult attestation of real-world tasks","identifying what still needs support","planning the next step honestly","presenting the week and defending the choices"]),
],
10: [
 dict(title="Career Exploration and Pathway Mapping", domains=["RFL.WORK"],
      essential_question="What kinds of work actually fit this learner's interests, strengths, and constraints?",
      performance_task="Research three careers of genuine interest and map each to its pathway, daily reality, and entry requirements.",
      topics=["identifying interests, strengths, and constraints","what a job actually involves day to day","entry requirements and training pathways","informational conversations with adults","comparing pathways honestly","recording findings and revisiting them"]),
 dict(title="Job Readiness: Applications, Resumes, and Interviews", domains=["RFL.WORK"],
      essential_question="What does a person need ready before they can credibly apply for work?",
      performance_task="Assemble a complete job-readiness portfolio and complete one practice interview with adult feedback.",
      topics=["building a resume from real experience","writing a short, specific application message","gathering references appropriately","practising common interview questions","interview preparation and follow-up","understanding working-age rules locally"]),
 dict(title="Professional Communication", domains=["RFL.COMM"],
      essential_question="How does communication change when the audience is a workplace rather than a friend?",
      performance_task="Handle a set of simulated workplace communication scenarios, including one difficult message, and justify the choices made.",
      topics=["professional email and message conventions","tone, register, and audience","asking for clarification without hedging","reporting a problem or a mistake early","requesting time off or a schedule change","receiving and acting on feedback"]),
 dict(title="Consumer Tasks and Everyday Agreements", domains=["RFL.CIVIC"],
      essential_question="What is a person agreeing to in ordinary transactions, and what can they do when it goes wrong?",
      performance_task="Work through a simulated consumer problem end to end: identify the term at issue, document it, and draft the escalation.",
      topics=["reading an everyday agreement before signing","what a receipt, warranty, or confirmation is for","returning, cancelling, or disputing something","keeping records that make a dispute winnable","recognising pressure tactics and scams","where to get help with a consumer problem"]),
 dict(title="Civic Participation and Public Systems", domains=["RFL.CIVIC"],
      essential_question="How does a person actually use the public systems around them?",
      performance_task="Produce a guide to navigating three public systems relevant to this learner, verified against current local sources.",
      topics=["finding and verifying current local information","libraries, transit, health, and community services","identification and records: what exists and why","voter registration and civic participation in outline","making a request or an enquiry of an office","verifying rules locally rather than assuming"]),
 dict(title="Grade 10 Work-Readiness Capstone", domains=["RFL.WORK", "RFL.COMM"], capstone_level="year",
      essential_question="Is this learner ready to seek, hold, and communicate within a first job?",
      performance_task="Complete a work-readiness capstone: portfolio, practice interview, professional communication set, and a documented plan for a first job, with adult attestation.",
      topics=["integrating readiness evidence into a portfolio","rehearsing the full application sequence","professional communication under time pressure","knowing local rules before applying","planning realistically around school","presenting readiness and naming remaining gaps"]),
],
11: [
 dict(title="Postsecondary Pathways", domains=["RFL.POST"],
      essential_question="Which postsecondary pathways are genuinely open to this learner, and what does each require?",
      performance_task="Compare four postsecondary pathways against this learner's goals, producing a documented shortlist with requirements and deadlines.",
      topics=["college, trade, apprenticeship, military, and direct work","entry requirements and realistic timelines","cost and funding in outline, verified not assumed","fit: setting, structure, and support needs","talking to people on each pathway","building a shortlist that survives scrutiny"]),
 dict(title="Applications, Deadlines, and Documentation", domains=["RFL.POST", "RFL.PLAN"],
      essential_question="What system makes sure nothing is missed when several deadlines overlap?",
      performance_task="Build and run an application-tracking system across a full cycle of simulated and real deadlines with adult review.",
      topics=["building a deadline and document tracker","assembling transcripts, records, and references","writing a personal statement in the learner's own voice","proofreading and requesting feedback","submitting and confirming receipt","recovering when a deadline is missed"]),
 dict(title="Health and Wellness Self-Management", domains=["RFL.HEALTH"],
      essential_question="What health responsibilities shift to the learner as they approach adulthood?",
      performance_task="Build a personal health-management plan covering appointments, records, and help-seeking, without disclosing private detail.",
      topics=["making and preparing for an appointment","keeping personal health records privately","describing a concern accurately to a professional","routine care, prevention, and sleep","recognising when to seek help urgently","who to call and how, before it is needed"]),
 dict(title="Housing and Living Arrangements", domains=["RFL.ADULT", "RFL.HOME"],
      essential_question="What does it actually take to live somewhere, and what is a tenant agreeing to?",
      performance_task="Produce a simulated housing analysis: compare options, read a sample agreement, and build a move-in checklist and budget.",
      topics=["comparing housing options on total cost and fit","reading a sample lease and naming its obligations","utilities, deposits, and setup sequence","roommates, shared costs, and written agreements","inspection, documentation, and moving out","verifying tenancy rules locally"]),
 dict(title="Problem Solving Under Constraint", domains=["RFL.SOLVE"],
      essential_question="How does a person make a good decision when time, money, and information are all short?",
      performance_task="Work a realistic multi-constraint problem to a defended decision, documenting the tradeoffs and the fallback.",
      topics=["defining the actual problem before solving it","generating more than two options","weighing tradeoffs explicitly","deciding under incomplete information","building a fallback before committing","reviewing a decision after the outcome"]),
 dict(title="Grade 11 Transition-Planning Capstone", domains=["RFL.POST", "RFL.TRANS"], capstone_level="year",
      essential_question="Does this learner have a credible, documented plan for what happens after high school?",
      performance_task="Produce a documented postsecondary transition plan with pathway, requirements, timeline, funding outline, support needs, and contingencies, reviewed and attested by a guardian.",
      topics=["assembling the year's work into one plan","timeline with verified dates and requirements","naming support needs without shame","contingency planning for the primary pathway","identifying who helps with what","presenting the plan and revising it"]),
],
12: [
 dict(title="The Adult-Life Operating System", domains=["RFL.ADULT", "RFL.PLAN"],
      essential_question="What recurring systems does an adult have to keep running, and how are they tracked?",
      performance_task="Build and run a personal adult-systems tracker covering records, renewals, appointments, and recurring obligations.",
      topics=["records, documents, and where they live","renewals, expiries, and advance reminders","recurring obligations across a year","secure storage of sensitive documents","a weekly and monthly review routine","what to do when something lapses"]),
 dict(title="Independent Living Simulation", domains=["RFL.HOME", "RFL.ADULT"],
      essential_question="Could this learner run a household for a month without it quietly falling apart?",
      performance_task="Run a one-month simulated independent-living plan covering home, food, transport, and logistics, with adult review and no real account data.",
      topics=["operating a household across a full month","meal and supply planning at scale","home upkeep and knowing when to call a professional","transport and logistics over time","handling a disruption mid-month","reviewing the month honestly"]),
 dict(title="Workplace Entry and Professional Systems", domains=["RFL.WORK", "RFL.COMM"],
      essential_question="What happens in the first weeks of a job, and what is expected without being said?",
      performance_task="Work a simulated first-job sequence from offer through onboarding, first weeks, and a difficult workplace conversation.",
      topics=["accepting an offer and simulated onboarding","unwritten workplace expectations","asking for help early and well","handling conflict or a mistake professionally","understanding a pay statement and schedule","knowing where workplace rights information lives"]),
 dict(title="Civic and Legal Adulthood", domains=["RFL.CIVIC"],
      essential_question="What changes legally and civically at the age of majority, and what should be verified locally?",
      performance_task="Produce a verified, locally-sourced adulthood checklist covering identification, records, registration, and responsibilities.",
      topics=["identification and official records","voter registration and participation","responsibilities that begin at majority","reading an official notice and responding","finding qualified help rather than guessing","verifying every rule against a current local source"]),
 dict(title="Support Networks and Contingency Planning", domains=["RFL.SOLVE", "RFL.HEALTH"],
      essential_question="Who does this learner call, for what, and what happens when a plan fails?",
      performance_task="Build a personal support-and-contingency plan naming roles, thresholds, and steps, kept at the learner's chosen level of privacy.",
      topics=["mapping a support network by role","asking for help before a crisis","thresholds: when to escalate","emergency and urgent-help procedures","building a contingency for the main plan","keeping the plan current and private"]),
 dict(title="Transition-to-Adulthood Capstone", domains=["RFL.TRANS"], capstone_level="senior",
      essential_question="Can this learner present a complete, honest, workable plan for their own adult life, and defend it?",
      performance_task="TRANSITION-TO-ADULTHOOD CAPSTONE: assemble and defend a complete transition portfolio — pathway and next steps, adult-life systems, independent-living evidence, work readiness, civic and legal checklist, health self-management, and a support-and-contingency plan — with guardian attestation of every real-world component and an honest statement of what still needs support.",
      topics=["assembling four years of evidence into one portfolio","stating the plan, the timeline, and the first three steps","naming remaining support needs without shame","contingencies for the parts most likely to fail","guardian review and attestation of real-world evidence","presenting the portfolio and answering challenge"]),
],
}
