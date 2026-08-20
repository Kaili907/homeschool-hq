/**
 * Substantive Health instruction for the 252 grade 5 and 7-12 lessons whose
 * upstream records contain only focus-interpolated instructional scaffolds.
 *
 * This is intentionally a Health-only production-content repair. Grade 3 and
 * grade 4 already have hand-authored key points, and PE is outside this lane.
 * Each array is ordered by lesson number within the corresponding six-lesson
 * unit. The learner task builder adds a concrete, private-safe application of
 * the fact instead of projecting the upstream "apply <focus>" placeholder.
 */

export const HEALTH_CONTENT_REPAIR_GRADES = new Set([5, 7, 8, 9, 10, 11, 12])

const FACTS = {
  '5-1': [
    'Health includes physical, mental, emotional, social, and environmental wellbeing; one dimension can affect another, so a whole-person view is more useful than judging one behavior.',
    'A trusted helper listens, respects boundaries, and gets appropriate help; different concerns may call for a caregiver, school staff member, nurse, clinician, counselor, or emergency responder.',
    'Reliable health information names who created it, uses evidence, has a recent review date, and separates education from advertising or a promise to sell something.',
    'A personal boundary describes what contact, space, topic, or activity feels acceptable; people may state or change a boundary without owing private details.',
    'Help-seeking is a skill: name the concern in as much or as little detail as is safe, identify the kind of help needed, and keep asking another trusted adult if the first response does not help.',
    'An emergency involves immediate danger or a person who may be seriously hurt or unable to respond; non-emergency concerns still deserve timely support through a trusted adult or professional.',
  ],
  '5-2': [
    'Hunger and fullness are body signals that can vary with growth, activity, sleep, illness, and schedule; noticing them supports care without turning food into a reward or moral judgment.',
    'Variety helps provide different nutrients and adequacy means having enough food across the day; culture, allergies, access, preference, and family routines shape many valid eating patterns.',
    'Water supports temperature control, circulation, and concentration; regular access and drinking with meals, activity, or warm conditions is more dependable than waiting for intense thirst.',
    'A useful meal or snack combines available foods that provide lasting energy, satisfaction, and variety; there is no single required menu and foods are not morally good or bad.',
    'Body-focused media may use editing, selective images, sponsorships, and unrealistic comparisons; a health claim needs evidence and should not equate appearance with worth or wellbeing.',
    'Food-safety planning includes clean hands and surfaces, separation of raw items, safe storage, and taking allergies seriously by checking labels and avoiding unapproved sharing.',
  ],
  '5-3': [
    'Emotion words such as disappointed, worried, frustrated, calm, and proud describe different experiences; naming an emotion can help a person choose a response without labeling the person.',
    'Stress can show up through thoughts, feelings, attention, sleep, or body sensations; a signal is information to notice, not proof that someone has failed or has a condition.',
    'Coping tools work in different ways: slow breathing can settle arousal, movement can release tension, a short plan can reduce uncertainty, and connection can add support.',
    'A sleep routine uses repeatable cues such as a wind-down activity, a consistent sequence, and a quieter setting; routines support rest even when every night is not identical.',
    'A small problem may be handled with a pause and a plan; danger, repeated harm, or a problem that keeps disrupting daily life needs trusted-adult or professional support.',
    'Tell a trusted adult promptly when someone may be unsafe, is being harmed, cannot stay safe, or needs care beyond a peer’s role; getting help is not tattling.',
  ],
  '5-4': [
    'Respectful communication names the situation and need without insults, threats, or guessing another person’s motives; a clear request makes the next step easier to understand.',
    'Active listening means giving attention, reflecting the main idea, and asking a clarifying question; listening shows understanding but does not require agreement.',
    'Personal space differs by person and situation; ask before entering someone’s space, notice words and body cues, and move back immediately when asked.',
    'Permission must be clear and specific to the activity; silence, uncertainty, or an earlier yes is not permission now, and either person can change their answer.',
    'Conflict repair includes naming what happened, taking responsibility for one’s part, offering a specific repair, and changing the behavior rather than demanding forgiveness.',
    'Bullying involves repeated or serious harm and often a power difference; document only necessary facts, move toward safety, and report to a trusted adult rather than retaliating.',
  ],
  '5-5': [
    'Body systems have different jobs and work together: the respiratory system exchanges gases, circulation transports materials, digestion processes food, and the nervous system coordinates signals.',
    'Germs can spread through air, droplets, contact, food, water, or body fluids; prevention works by interrupting the relevant route rather than blaming a person who is ill.',
    'Effective handwashing uses soap, clean running water, rubbing all hand surfaces, rinsing, and drying; key times include before food handling and after restroom use or coughing.',
    'Oral care removes plaque from teeth and along the gumline; brushing, cleaning between teeth, and routine dental care protect function as well as comfort.',
    'Sleep supports learning and recovery, while regular enjoyable movement supports muscles, bones, mood, and coordination; both are care practices rather than punishments.',
    'Medicines should be used only as directed by a responsible adult or qualified professional; unknown substances and household poisons should not be touched, tasted, or shared.',
  ],
  '5-6': [
    'Safety planning starts by spotting a hazard, reducing exposure, using protective equipment correctly, and knowing which adult or emergency service to contact.',
    'Online safety includes limiting personal details, checking who can contact or view an account, leaving uncomfortable interactions, saving only needed evidence, and telling a trusted adult.',
    'A strong refusal is brief and clear, may include a reason, and is paired with an exit or help plan; nobody has to debate in order to leave an unsafe offer.',
    'First response begins with scene safety and adult or emergency help; a learner should not attempt a rescue or medical procedure beyond their training.',
    'A health decision can follow four steps: name the choice, compare likely effects and reliable information, choose a safe feasible option, and review the result.',
    'Community health actions address a shared condition through accurate information and a realistic request; effective action identifies who can make the change and how progress will be checked.',
  ],
  '7-1': [
    'Health reflects physical, mental, emotional, and social factors plus conditions such as safety, housing, access, culture, and environment; these determinants affect options without defining a person.',
    'A reliable source identifies authorship, relevant expertise, evidence, date, and purpose; a confident tone, popularity, or a personal story alone does not establish accuracy.',
    'Healthcare roles differ: primary-care teams handle routine needs, specialists focus on an area, pharmacists support medicine safety, counselors support mental health, and emergency teams address immediate danger.',
    'A support network is stronger when it includes more than one trusted person and a clear route for routine questions, emotional support, school concerns, and emergencies.',
    'Confidentiality means information is handled with privacy, but rules and safety exceptions vary by setting, age, and location; ask a provider what is private before sharing details.',
    'Emergency action prioritizes immediate safety, contacting emergency services or a responsible adult, giving a clear location and observable facts, and following dispatcher instructions.',
  ],
  '7-2': [
    'Growing bodies need adequate food across the day and a range of foods that supply energy and nutrients; restriction and appearance-based rules can interfere with wellbeing.',
    'Hydration needs change with heat, activity, illness, and access; practical planning means having a permitted drink source and taking regular opportunities to drink.',
    'Sleep cycles repeat through different stages that support learning, mood, and recovery; consistent timing and a wind-down period can help the sleep-wake system work predictably.',
    'Movement creates a need for recovery, including rest, sleep, fluids, and adequate food; pain, illness, or unusual symptoms are signals to stop and involve an adult.',
    'Body-image messages often reflect editing, narrow ideals, and marketing incentives; media literacy separates a person’s worth and health from appearance-based claims.',
    'Allergy and food-safety plans identify the allergen or hazard, prevent cross-contact, check labels, and specify which trained adult handles an exposure or emergency response.',
  ],
  '7-3': [
    'The stress response prepares the body to act and can narrow attention; it can be useful briefly, but repeated activation calls for recovery practices and support.',
    'Regulation tools change either the body, attention, situation, or support available; choosing a tool depends on safety, time, location, and what the person needs next.',
    'Effective help-seeking names the impact, requests a specific kind of support, and uses another trusted route if the concern continues or the first helper is unavailable.',
    'Grief is a response to loss or major change and does not follow one schedule; supportive care allows different feelings and connects the person with trusted support.',
    'Warning signs such as immediate danger, talk of self-harm, inability to stay safe, or severe disruption require prompt adult or crisis support rather than peer-only problem solving.',
    'A supportive peer listens without promising secrecy, avoids acting as a counselor, and brings in a trusted adult when safety or ongoing care is involved.',
  ],
  '7-4': [
    'Respect includes honoring stated limits, privacy, identity, and equal dignity; a boundary is valid even when another person does not understand or prefer it.',
    'Consent is a clear, ongoing, specific, and reversible agreement; pressure, fear, impairment, silence, or uncertainty means there is no usable agreement.',
    'Assertive communication states a limit or need directly and respectfully, then repeats it or exits if pressure continues; it differs from passive avoidance and aggressive harm.',
    'Conflict repair works only when people are safe enough to participate; it uses observable facts, responsibility, a specific change, and follow-through.',
    'Harassment and bullying are not ordinary conflict when behavior targets, intimidates, humiliates, or persists; safety and reporting take priority over forced mediation.',
    'Online relationships require the same respect as in-person ones plus privacy checks; messages can be copied, accounts can be misrepresented, and blocking or reporting is a valid boundary.',
  ],
  '7-5': [
    'Medicine safety means using the correct person’s medicine exactly as directed, keeping it in its labeled container, and involving an adult or pharmacist when instructions are unclear.',
    'Nicotine, alcohol, and other drugs can affect attention, coordination, judgment, mood, breathing, and the developing brain in different ways; product form does not make use harmless.',
    'Influence may come from peers, media, stress, or access; refusal is stronger when a clear no is paired with an exit route and a person to contact.',
    'Impairment reduces reliable judgment and reaction; a safety plan removes driving, riding with an impaired driver, water activity, and other high-risk tasks from the situation.',
    'Possible overdose or poisoning is an emergency: get an adult, contact emergency services, share observable facts, and follow dispatcher directions without leaving the person alone if it is safe to stay.',
    'Trusted-adult support can help with safety, transportation, medical care, or ongoing substance concerns; asking for help should focus on protection rather than punishment or shame.',
  ],
  '7-6': [
    'Puberty involves normal variation in timing and changes across reproductive and other body systems; diagrams and fictional cases can teach the concepts without personal comparison.',
    'Personal boundaries apply to touch, conversation, images, and relationships; consent must be freely given, specific, current, and reversible.',
    'Infection prevention depends on how a particular infection spreads; accurate information, hygiene, vaccination when applicable, and healthcare guidance interrupt different routes.',
    'Reliable adults and health services provide accurate information, explain confidentiality and its limits, and connect a young person with appropriate care without requiring classroom disclosure.',
    'Media myths often use stereotypes, fear, or unrealistic claims about bodies and relationships; checking an authoritative source helps separate fact from popularity.',
    'Health advocacy uses respectful, accurate language, a specific audience, and a feasible request; it protects privacy and avoids speaking for people whose experiences were not offered.',
  ],
  '8-1': [
    'Health determinants include biology, behavior, relationships, income, education, environment, discrimination, and access to care; they shape opportunity and risk without assigning blame.',
    'Navigating services starts by matching the need to the level of care, checking access requirements and cost, and preparing a concise question for the provider or service.',
    'Consent and confidentiality are related but different: consent concerns permission for care, while confidentiality concerns who may receive information; both have legal and safety limits.',
    'A health claim is stronger when the author has relevant expertise, evidence is cited, the information is current, uncertainty is acknowledged, and financial incentives are visible.',
    'Self-advocacy uses a clear description of the need, a specific request, questions about options, and confirmation of the next step; it does not require revealing unrelated private details.',
    'Crisis support addresses immediate danger or inability to stay safe; contact emergency services or a crisis resource and involve a trusted adult instead of managing the situation alone.',
  ],
  '8-2': [
    'Adequate fueling supports growth, learning, daily activity, and recovery; regular access to satisfying food matters more than appearance-based rules or product marketing.',
    'Hydration supports circulation and temperature regulation; needs vary, so access, weather, activity, illness, and individual guidance matter more than a single universal target.',
    'The circadian system helps time sleep and wakefulness, while sleep pressure builds during waking hours; regular timing, morning light, and a wind-down routine support both processes.',
    'Recovery is an active part of training and daily life; rest, sleep, food, fluids, and gradual return reduce the chance that ordinary fatigue becomes injury or illness.',
    'Supplement and energy-product claims may omit risks, interactions, serving-size details, or weak evidence; check independent sources and a qualified adult before use.',
    'Body respect means treating bodies with dignity and supporting function, comfort, access, and care; edited images and narrow ideals are not reliable measures of health.',
  ],
  '8-3': [
    'Stress is a body-and-brain response, while coping is the set of actions used afterward; helpful coping improves safety or functioning without creating a larger later problem.',
    'Anxiety and depression literacy means recognizing patterns that may deserve support, not labeling oneself or another person; only qualified professionals assess health conditions.',
    'Protective factors include supportive relationships, coping skills, safe environments, belonging, access to care, sleep, and opportunities for meaningful activity.',
    'Supporting a peer means listening, validating the concern, and connecting to an adult or professional; a peer should not promise secrecy or become responsible for treatment.',
    'Immediate danger, self-harm statements, inability to stay safe, or severe disconnection from reality require urgent adult, crisis, or emergency support.',
    'A help-seeking plan names several trusted contacts, routine and urgent routes, how to start the conversation, and what to do if the first route is unavailable.',
  ],
  '8-4': [
    'Healthy relationships use respect and shared power; control over friends, clothing, location, passwords, money, or communication is a warning sign rather than proof of care.',
    'Consent must be informed, freely given, specific, ongoing, and reversible; pressure, threats, manipulation, impairment, silence, or uncertainty invalidate the process.',
    'A refusal can be short: state the boundary, repeat it without debate, move toward safety, and contact support if the other person continues.',
    'Dating and friendship boundaries may cover time, touch, topics, devices, and privacy; each person can set limits, and retaliation for a boundary is not respectful.',
    'Digital images can be copied or redistributed beyond the original audience; protect privacy by declining requests, not forwarding others’ images, and reporting coercion to a trusted adult.',
    'A bystander can interrupt safely by distracting, delegating to an adult, documenting only necessary facts, checking in afterward, or reporting; direct confrontation is not always safest.',
  ],
  '8-5': [
    'Substances can change brain signaling and body functions such as attention, mood, coordination, heart rate, and breathing; effects depend on the substance, amount, route, and individual.',
    'Nicotine, alcohol, cannabis, and other drugs have different effects and risks; labels such as natural, legal, or common do not establish safety for adolescents.',
    'Medication and opioid safety requires the correct person, medicine, dose, and directions, secure storage, and prompt adult or professional help for an error or suspected poisoning.',
    'Impaired driving risk includes driving, riding with an impaired driver, and using bikes, scooters, or watercraft; an advance ride-and-contact plan removes pressure from the moment.',
    'Naloxone can temporarily reverse an opioid overdose, but emergency services are still required; follow local training and dispatcher directions and do not assume the danger has passed.',
    'Social influence can be direct or subtle; a refusal plan combines a clear response, an exit, transportation, and a trusted contact rather than relying on willpower alone.',
  ],
  '8-6': [
    'Reproductive health instruction explains structures, functions, development, and care using accurate terms; normal variation exists and personal history is not needed for learning.',
    'Pregnancy and infection prevention methods differ in purpose and effectiveness; accurate comparison uses current health guidance and distinguishes barrier, behavioral, and medical approaches.',
    'Testing and healthcare support can provide information, prevention, or treatment; ask the provider what a service includes, whether consent is needed, and how privacy works.',
    'Coercion uses pressure, threats, manipulation, or power to override choice; consent is absent when agreement is not informed, freely given, current, and reversible.',
    'Media myths about sexual health often rely on stereotypes, missing context, or popularity; compare the claim with current public-health or clinical information.',
    'Respectful advocacy states accurate information, avoids stigma, protects privacy, and makes a specific feasible request to the person or organization able to act.',
  ],
  '9-1': [
    'Health literacy is the ability to find, understand, evaluate, and use health information and services; it includes asking questions and acting on information, not merely recognizing terms.',
    'Internal influences include values, needs, knowledge, and emotions, while external influences include peers, culture, access, cost, environment, and media; naming them makes a decision more deliberate.',
    'Source quality depends on authorship, relevant expertise, supporting evidence, currency, transparency, and conflicts of interest; a testimonial cannot establish a general health effect.',
    'A repeatable decision process defines the choice, gathers reliable information, compares benefits and risks, checks feasibility and values, acts, and later reviews the result.',
    'Short-term convenience and longer-term consequence can point in different directions; a defensible choice states the time horizon, affected people, uncertainty, and a backup plan.',
    'Reviewing a decision means comparing the outcome with the information available at the time, identifying what changed, and revising the process without turning hindsight into self-blame.',
  ],
  '9-2': [
    'The stress response can alter attention, sleep, mood, muscle tension, and heart rate; short activation can be useful, while sustained disruption is a reason to add recovery and support.',
    'Sustainable coping reduces the current load without creating a larger later cost; avoidance, unsafe substance use, or harming others may delay rather than solve the problem.',
    'A regulation routine pairs an early signal with a brief action, a practical next step, and a support option; it should be simple enough to use under stress.',
    'When distress is persistent, worsening, unsafe, or interfering with sleep, school, relationships, or daily tasks, self-management should expand to trusted-adult or professional support.',
    'School staff, trusted adults, clinicians, and crisis services have different roles; a plan should distinguish routine support from urgent and emergency routes.',
    'Supporting a peer means listening and connecting, not assessing or treating; never promise secrecy when safety is involved, and bring in a responsible adult promptly.',
  ],
  '9-3': [
    'An emergency involves immediate threat to life, safety, or serious injury; activate trained help, give the location and observable facts, and follow dispatcher directions.',
    'CPR supports circulation and an AED analyzes heart rhythm and may deliver a shock; awareness is not certification, so learners should use current hands-on training and dispatcher guidance.',
    'Bleeding, choking, and other first-aid situations require scene safety, rapid help, and skill-specific training; do not perform a procedure that exceeds current training.',
    'A possible concussion or head injury requires stopping activity and adult medical evaluation; symptoms can appear later, so a person should not return the same day based on self-testing.',
    'Vehicle, water, fire, and home safety use layers: remove hazards, use protective equipment, follow capacity and supervision rules, and keep an emergency exit or contact plan.',
    'A bystander’s duty is to get appropriate help without becoming another victim; safe options include delegating, calling, guiding responders, and providing trained aid within limits.',
  ],
  '9-4': [
    'Alcohol, nicotine products, and cannabis affect the adolescent brain and body differently, including attention, coordination, judgment, mood, heart rate, and breathing; mixing substances can increase uncertainty and danger.',
    'Tolerance means more may be needed for the same effect, while dependence involves adaptation and withdrawal; earlier repeated exposure can interfere with development and increase later risk.',
    'Marketing can normalize use through imagery, flavors, sponsorship, selective stories, and influencer placement; identify who benefits before treating a message as health information.',
    'Prescription and over-the-counter medicines can cause harm when shared, mixed, stored unsafely, or used against directions; use the labeled medicine for the intended person and consult an adult or pharmacist.',
    'A durable refusal plan includes a brief statement, repetition without debate, an exit, transportation, and a trusted contact; it anticipates pressure instead of improvising inside it.',
    'Suspected overdose or poisoning requires emergency help and poison-control or dispatcher guidance; give observable facts and available product information without delaying the call.',
  ],
  '9-5': [
    'Adequate fueling supports growth, concentration, activity, and repair; consistent access to satisfying food is a health need, not a test of discipline or appearance.',
    'Hydration changes across a day with heat, activity, illness, and access; planning drink opportunities and noticing ordinary body signals is safer than following extreme product claims.',
    'Sleep pressure and the circadian clock jointly shape sleep timing; irregular schedules and late light exposure can shift the system, while consistent cues support learning and alertness.',
    'Recovery after effort, illness, or a demanding week may require reduced load, sleep, food, fluids, and gradual return; pain or worsening symptoms call for adult or professional guidance.',
    'Supplement, energy-product, and fitness claims need scrutiny for evidence, dose, interactions, independent testing, sponsorship, and unrealistic promises; availability does not prove effectiveness or safety.',
    'Body respect separates dignity and care from appearance; health messages that shame, promise rapid transformation, or use edited ideals are poor guides to wellbeing.',
  ],
  '9-6': [
    'Routine hygiene and dental, vision, hearing, and skin care protect comfort and function; maintenance includes knowing when a change needs a trusted adult or professional.',
    'Communicable conditions spread through specific routes such as air, contact, food, water, or body fluids; prevention works by interrupting the actual route with appropriate measures.',
    'HIV is transmitted through specific body fluids, not casual contact; testing provides information, and effective treatment can protect health and prevent sexual transmission.',
    'Immunization trains immune memory without causing the target disease, and records are often held by caregivers, clinics, schools, pharmacies, or state systems.',
    'Stigma discourages testing, care, and honest communication; accurate person-first language separates a health condition from someone’s identity or worth.',
    'Routine care and screening aim to prevent problems or find them earlier; which services apply depends on age, history, current guidance, and a clinician’s judgment.',
  ],
  '10-1': [
    'Values, needs, beliefs, knowledge, and emotions can influence behavior internally; naming an influence makes it available for reflection but does not automatically dictate the choice.',
    'Family, peers, culture, and community communicate norms and support; influence can offer strength or pressure, and people may choose which parts align with their values and safety.',
    'Cost, transportation, neighborhood conditions, time, and availability shape feasible health choices; evaluating a decision honestly includes constraints rather than blaming the decision-maker.',
    'Identity and belonging can shape which messages feel safe or credible; supportive health practice respects identity while checking claims and consequences with evidence.',
    'An influence explains pressure or opportunity, while a decision is the selected action; separating them creates room to compare options and recruit support.',
    'Neutral analysis describes the message, source, context, and effect without assigning character; people can carry an influence without endorsing or controlling it.',
  ],
  '10-2': [
    'Healthy patterns include respect, trust, shared decision-making, boundaries, and support; coercive patterns use fear, isolation, surveillance, threats, or control.',
    'A boundary plan states the limit, describes the action the speaker will take, identifies support, and follows through; it cannot depend on forcing another person to agree.',
    'Consent is informed, freely given, specific, ongoing, and revocable; power differences, pressure, manipulation, fear, impairment, silence, or uncertainty undermine agreement.',
    'Manipulation tactics include guilt, threats, isolation, repeated pressure, monitoring, and making care conditional on compliance; naming the tactic helps separate it from affection.',
    'Stepping back safely may require a private plan, trusted support, secure transportation, communication limits, and professional help; direct confrontation is not required.',
    'When a relationship is unsafe, use a trusted adult, counselor, advocate, crisis service, or emergency service suited to the urgency; preserve only information needed for help.',
  ],
  '10-3': [
    'Assertive communication is direct and respectful, passive communication hides the need, and aggressive communication threatens or harms; tone alone does not determine the pattern.',
    'De-escalation uses space, a calm voice, short neutral statements, visible exits, and nonthreatening positioning; leaving and getting help take priority when danger rises.',
    'Conflict resolution seeks a workable agreement, while repair addresses harm through responsibility, a specific change, and follow-through; neither process is appropriate during coercion or danger.',
    'Bullying, harassment, and hazing use power, targeting, humiliation, exclusion, or unsafe demands; reporting is a safety action and should not depend on confronting the person responsible.',
    'Escalating violence may involve threats, weapons, stalking, blocked exits, destruction, or rapid loss of control; move toward safety and contact trained help rather than mediate.',
    'Reporting pathways may include school, workplace, platform, advocacy, or emergency channels; a useful report states observable facts, timing, location, and the requested safety response.',
  ],
  '10-4': [
    'Algorithmic feeds optimize predicted engagement, not health accuracy; repetition can make a claim feel familiar even when the evidence remains weak.',
    'Influencer marketing may use sponsorships, affiliate links, gifts, or personal brands; disclosure shows an incentive but does not by itself prove or disprove the claim.',
    'Filters, posing, selection, and editing produce images that are not neutral records; repeated comparison can create appearance pressure without providing health information.',
    'Evaluate a claim by checking source expertise, cited evidence, biological plausibility, size of the promised effect, uncertainty, and what the speaker gains.',
    'Health searches, app entries, location, contacts, and messages can reveal sensitive patterns; check permissions, retention, sharing, and deletion before providing information.',
    'Notification load and late-night device use can fragment attention and delay sleep; environmental changes such as scheduled quiet periods reduce reliance on willpower.',
  ],
  '10-5': [
    'Substance products and delivery forms change faster than school materials; reliable prevention uses current public-health information and focuses on effects and unknown contents rather than brand recognition.',
    'Illicit supplies may contain fentanyl or other unexpected substances; naloxone can temporarily reverse opioid overdose, but emergency services and trained response remain necessary.',
    'Impairment affects reaction, coordination, and judgment; a transportation plan must cover both driving and riding with a driver who may be impaired.',
    'Sustained pressure requires more than one refusal line: repeat the boundary, change location, contact an ally, and use a preplanned exit or ride.',
    'Supporting someone who uses substances means caring, setting limits, and connecting to qualified help; peers cannot control another person’s use or become their treatment plan.',
    'Treatment and recovery may include medical, counseling, peer, and community supports; access, confidentiality, and level of care vary, so a trusted professional can explain options.',
  ],
  '10-6': [
    'Ordinary distress can be painful and temporary; persistent, worsening, unsafe, or function-disrupting distress signals a need for professional support rather than a character judgment.',
    'School counselors coordinate school support, clinicians assess and treat, and crisis services address urgent safety; each role has a different scope and response time.',
    'Confidentiality protects information within defined rules, but safety threats and reporting laws can create exceptions; ask the helper to explain limits before sharing details.',
    'When a peer discloses distress, listen, thank them for telling, ask whether immediate safety is involved, and connect to a responsible adult or crisis resource.',
    'Accurate language describes experiences and support needs without using a condition as an insult or assuming a label; stigma can delay care and isolate people.',
    'Accessible mental-health support considers cost, language, disability access, transportation, wait time, culture, privacy, and crisis coverage—not only whether a service exists.',
  ],
  '11-1': [
    'An anecdote describes one experience, an observation detects a pattern, a controlled trial compares outcomes, and a systematic review synthesizes studies; each supports different claims.',
    'A study summary should be read for population, comparison, outcome, size, uncertainty, and limitations; association alone does not establish cause.',
    'Regulation varies by product and claim; a legal label can describe ingredients or permitted wording without proving that a product is effective for every person.',
    'A health service should be evaluated for relevant credentials, scope of practice, evidence, cost, privacy, complaint process, and accountability for harm or error.',
    'Funding and conflicts of interest can shape questions, analysis, or presentation; disclosure helps readers evaluate incentive but does not automatically invalidate the work.',
    'The cost of being wrong depends on severity, reversibility, probability, delay, and available alternatives; higher-stakes choices require stronger evidence and qualified guidance.',
  ],
  '11-2': [
    'Chronic conditions usually develop through interacting biological, environmental, behavioral, and social factors over time; a single-cause story is often incomplete.',
    'Modifiable factors can sometimes change, while non-modifiable factors cannot; neither category justifies blame because access, constraints, and biology also shape outcomes.',
    'Genetics can affect susceptibility, while environment, stress, discrimination, and access can change exposure and care; risk is not certainty.',
    'Sleep, movement, food access, rest, and recovery are long-horizon inputs whose effects accumulate; sustainable support matters more than perfection.',
    'Screening looks for risk or early signs before symptoms are obvious; usefulness depends on age, evidence, benefits, harms, follow-up, and professional guidance.',
    'Living well with an ongoing condition can include treatment, accommodation, monitoring, relationships, and meaningful activity; stigma creates barriers rather than improving outcomes.',
  ],
  '11-3': [
    'Air, water, housing, temperature, noise, and neighborhood safety affect exposure and opportunity; community conditions can influence health beyond individual choices.',
    'Food access, transportation, distance, schedule, cost, and disability access determine whether a service or resource is practically reachable, not merely listed.',
    'Communities identify environmental hazards through monitoring, reports, inspections, health data, and resident knowledge; strong claims distinguish measured exposure from suspected source.',
    'Public health functions include surveillance, communication, prevention, testing support, coordination, and policy; outbreak response changes as evidence changes.',
    'Community health data need denominators, time periods, comparison groups, uncertainty, and privacy protection; a count alone can misrepresent scale or trend.',
    'Residents, agencies, property owners, schools, employers, courts, and lawmakers hold different authority; effective advocacy targets the actor able to change the condition.',
  ],
  '11-4': [
    'Self-care suits minor manageable needs, primary care supports routine and ongoing needs, urgent care handles prompt non-life-threatening problems, emergency care handles immediate danger, and specialists address focused needs.',
    'A premium pays for coverage, a deductible is an amount paid before many benefits begin, a copay is a set service charge, and a network is a contracted provider group.',
    'Care costs reflect service price, setting, coverage, network, and assistance; community clinics, public programs, payment plans, and financial-assistance policies may reduce barriers.',
    'Appointment preparation uses a concise concern, timeline, current medicines if relevant, questions, and a next-step summary; a fictional case can practice the skill privately.',
    'Minor consent and confidentiality rules vary by service, circumstance, and jurisdiction; verify current Michigan information with the provider rather than assuming every visit follows one rule.',
    'Medical records and portals may include notes, results, messages, billing, and proxy access; ask who can view each section and how access changes at adulthood.',
  ],
  '11-5': [
    'Individual risk describes a person’s probability under specific conditions, while population risk describes patterns across groups; one cannot be substituted for the other without context.',
    'Evidence-supported prevention can change availability, environment, skills, norms, or support; effectiveness should be judged by outcomes rather than fear or visibility.',
    'Harm reduction aims to reduce injury or death among people who may continue a risky behavior; evaluating it requires evidence, goals, limits, and implementation context.',
    'Policy levers such as access rules, pricing, marketing limits, and enforcement affect different parts of a system and may create intended and unintended effects.',
    'Stigma can deter people from seeking treatment or disclosing risk to a provider; person-first, accurate language supports safety without approving harmful behavior.',
    'A prevention campaign should identify audience, claim, evidence, requested action, access to support, unintended stigma, and a measurable outcome.',
  ],
  '11-6': [
    'A scoped health-promotion goal identifies one audience, behavior or condition, setting, feasible change, responsible actor, and time frame.',
    'Audience analysis considers prior knowledge, language, trust, access, values, and barriers; effective framing offers agency and evidence instead of shame or fear.',
    'Accurate advocacy distinguishes fact, estimate, and opinion, cites traceable sources, states uncertainty, and avoids promising outcomes the evidence cannot support.',
    'Partners contribute authority, expertise, access, or resources; permissions, privacy, cost, time, and maintenance determine whether a plan is realistic.',
    'A measurable outcome is defined before action and matches the goal, such as reach, use, response time, or access; a visible product alone is not proof of impact.',
    'A proposal should state the problem, evidence, audience, action, owner, resources, safeguards, and measure; critique is used to revise assumptions and feasibility.',
  ],
  '12-1': [
    'A durable routine uses a clear cue, minimum viable action, flexible time window, and restart rule so a schedule change does not turn one disruption into abandonment.',
    'Sleep, movement, fueling, and recovery work as maintained systems with access, cues, and backup options; they are not one-time goals or tests of discipline.',
    'Useful tracking measures actions, access, symptoms needing care, or task completion without measuring appearance; collect only information that changes a decision.',
    'During illness, stress, or heavy workload, a routine can shrink to its safety-critical minimum, postpone nonessential steps, and use support until capacity returns.',
    'Restarting works best with a small next action and a barrier review; punishment adds burden but does not repair the system that failed.',
    'Seasonal review asks what still serves the purpose, what creates burden, what condition changed, and which single addition or removal is feasible.',
  ],
  '12-2': [
    'Adult support networks may include chosen relationships, family, coworkers, neighbors, clinicians, community groups, and civic services; different ties provide different kinds of support.',
    'Roommate, workplace, and supervisory boundaries should be specific about space, time, communication, property, and role; document agreements through appropriate channels when useful.',
    'Consent and respect apply across adult contexts: agreement must be informed, freely given, specific, current, and reversible, including where power differences exist.',
    'Coercive control can use money, housing, transportation, social isolation, monitoring, threats, or workplace power; dependency does not make the control acceptable.',
    'Leaving an unsafe situation may require confidential support, transportation, documents, money access, device safety, and timing; specialist advocates can help build a safer plan.',
    'A deliberate network includes routine connection, practical help, health support, and emergency contacts, with more than one route when a person or service is unavailable.',
  ],
  '12-3': [
    'Transitions increase uncertainty, role change, workload, and loss of familiar support; struggling during change can reflect load and access rather than lack of ability.',
    'Maintenance strategies reduce ordinary strain over time, while emergency strategies protect immediate safety; a complete plan distinguishes the two and names escalation points.',
    'Changes in sleep, isolation, workload, concentration, or daily functioning can serve as early signals to adjust load and seek support without self-labeling.',
    'Starting professional support involves identifying urgency, finding an appropriate service, asking about access and privacy, and preparing a concise concern or question.',
    'Adult mental-health care varies in cost, coverage, location, wait time, modality, and confidentiality; comparing access details is part of choosing a workable route.',
    'Supporting others requires consent, role limits, and shared responsibility; listen and connect while protecting time, safety, and capacity instead of becoming the sole helper.',
  ],
  '12-4': [
    'CPR, AED, and first-aid readiness depends on current hands-on training, equipment awareness, and knowing how to activate emergency help; reading alone is not certification.',
    'Home, vehicle, workplace, and travel safety systems use maintenance, protective equipment, secure storage, communication, and backup plans rather than memory alone.',
    'Risk assessment identifies hazard, exposure, severity, likelihood, controls, escape options, and who can help; unfamiliarity increases the need to pause and gather information.',
    'Impairment and fatigue both reduce driving performance; a transportation plan includes alternate rides, a safe place to wait, and permission to change plans without debate.',
    'Emergency readiness includes contacts, meeting locations, accessibility needs, essential supplies, and secure access to needed document copies without exposing them publicly.',
    'A bystander should protect scene safety, activate trained help, follow instructions, and provide only aid within current training; unsafe rescue attempts can add victims.',
  ],
  '12-5': [
    'Choosing primary care involves location, network, cost, accessibility, communication, scope, and appointment availability; establishing care before an urgent need supports continuity.',
    'Post-high-school coverage may come through family plans, employers, marketplaces, public programs, or schools; compare eligibility, network, covered services, and total cost.',
    'A medical bill requests payment, an explanation of benefits describes how a claim was processed, and a denial states why coverage was not approved; the amounts may not match.',
    'A denial appeal uses the reason code, plan rule, supporting records, deadline, and requested review; an itemized bill can reveal duplicate, incorrect, or unexplained charges.',
    'Prescription costs can differ by generic availability, formulary tier, pharmacy, quantity, and assistance; a pharmacist or prescriber can explain safe lower-cost options.',
    'Predatory health marketing uses urgency, secrecy, guaranteed results, unsupported testimonials, hidden subscriptions, or shame; pause and verify evidence, seller identity, terms, and refund rules.',
  ],
  '12-6': [
    'A working health plan integrates routines, preventive care, support, safety, and access into a small set of maintainable systems with backup routes.',
    'Each plan element needs a reason grounded in credible information, the person’s stated priorities, and actual constraints; evidence should match the size of the claim.',
    'Review points occur on a schedule, while revision triggers respond to changes in access, symptoms, workload, evidence, or safety; both prevent a plan from becoming obsolete.',
    'A realistic advocacy commitment names one issue, action, audience, available capacity, safeguard, and review date rather than promising unlimited involvement.',
    'A guardian review can focus on logistics, safety, resources, and support while the learner keeps private health details out of the shared version.',
    'Defending a plan means explaining evidence and tradeoffs, listening for a valid challenge, and revising the plan when critique reveals a safety, accuracy, or feasibility gap.',
  ],
}

function skillPoint(lesson) {
  const lower = lesson.focus.toLowerCase()
  const unit = lesson.unit_title.toLowerCase()
  if (/stigma/.test(lower)) {
    return 'Use accurate person-first language, separate a condition or behavior from a person’s worth, and explain how stigma can obstruct information, support, testing, or treatment.'
  }
  if (/chronic conditions|long-horizon wellbeing/.test(unit)) {
    return 'Represent long-term health as an interaction among biology, environment, access, behavior, and support; distinguish changeable from fixed factors without assigning blame.'
  }
  if (/health promotion|community advocacy/.test(unit)) {
    return 'A defensible advocacy product uses accurate evidence, a defined audience and responsible actor, a feasible request, privacy and access safeguards, and a measure for review.'
  }
  if (/minor consent|confidentiality and consent|professional support.*process|cost, access, and confidentiality/.test(lower)) {
    return 'Match the need to the appropriate service, ask how consent and confidentiality work in that setting, identify access constraints, and confirm the next step before sharing details.'
  }
  if (/emergency|crisis|overdose|poison|first.response|first aid|cpr|aed|choking|bleeding|head.injury|concussion/.test(lower)) {
    return 'Classify urgency from observable facts, protect scene safety, activate trained help, and stay within current training rather than attempting an unsafe rescue.'
  }
  if (/source|information|claim|media|marketing|study|evidence|campaign|advertis|algorithm|influencer|supplement|product/.test(lower)) {
    return 'Check authorship, expertise, evidence, currency, uncertainty, and incentive before using a health message; confidence, popularity, and testimonials are not substitutes for support.'
  }
  if (/consent|boundary|boundaries|permission|coerc|relationship|communication|refusal|conflict|bully|harass|hazing|peer|de-escalation/.test(lower)) {
    return 'A safe communication plan states the limit clearly, recognizes pressure or danger, identifies an exit, and brings in adult or professional support when direct engagement is unsafe.'
  }
  if (/stress|coping|regulation|grief|mental|distress|stigma|support network|help.seeking|warning signs|isolation/.test(lower)) {
    return 'Match the response to the level of need: use a practical coping step for ordinary strain, add trusted support when functioning is disrupted, and use urgent help for immediate danger.'
  }
  if (/food|fuel|hunger|fullness|hydrat|sleep|circadian|movement|recovery|body|oral|hygiene|skin|dental|vision|hearing/.test(lower)) {
    return 'Compare care options by function, access, safety, and sustainability; avoid appearance rules, shame, rigid perfection, or assumptions about another person’s habits.'
  }
  if (/medicine|medication|drug|substance|nicotine|alcohol|cannabis|opioid|fentanyl|impaired|naloxone|tolerance|dependence/.test(lower)) {
    return 'Risk reduction combines accurate information, an advance prevention or refusal plan, a safe exit, and trained help; one protective step should not be treated as a guarantee.'
  }
  if (/infection|communicable|hiv|immun|allerg|germ|transmission|reproductive|pregnancy|testing/.test(lower)) {
    return 'Identify the actual biological process or transmission route, choose prevention or care that interrupts it, and correct myths without blaming or stigmatizing a person.'
  }
  if (/care|service|provider|coverage|insurance|cost|bill|benefit|denial|record|portal|confidential|screening|appointment/.test(lower)) {
    return 'Match the need to the appropriate service or administrative step, ask about access, cost, and privacy, and confirm what action or document comes next.'
  }
  if (/community|environment|advoc|public health|promotion|proposal|policy|data|outbreak|determinant|access/.test(lower)) {
    return 'A defensible community response uses accurate data, identifies the actor with authority, proposes a feasible change, protects privacy and access, and defines how progress will be measured.'
  }
  if (/routine|system|plan|tracking|restart|season|schedule|decision|influence|risk|review|critique|self.management/.test(lower)) {
    return 'A durable plan names the goal, constraints, feasible options, support and backup routes, plus the evidence or condition that should trigger review and revision.'
  }
  return 'Use observable facts, reliable information, and the appropriate support route; do not infer a person’s health, motives, or character from one detail.'
}

function buildTask(lesson) {
  const focus = lesson.focus
  const lower = focus.toLowerCase()
  const unit = lesson.unit_title.toLowerCase()
  if (/stigma/.test(lower)) {
    return `Review four supplied fictional statements about ${focus}. Label each as accurate, unsupported, or stigmatizing; revise two statements with person-first factual language, and explain how each revision could make information or help-seeking more accessible.`
  }
  if (/chronic conditions|long-horizon wellbeing/.test(unit)) {
    return `Build a causal web for a supplied fictional case about ${focus}. Include biological, environmental or access, behavioral, and support factors; mark which factors can change, add one realistic support, and explain why the web does not assign blame.`
  }
  if (/health promotion|community advocacy/.test(unit)) {
    return `Draft a one-page fictional advocacy component for ${focus}: state the goal with two facts, identify the audience and actor able to respond, propose one feasible action, add a privacy or access safeguard, and define one measure or critique question for revision.`
  }
  if (/minor consent|confidentiality and consent|professional support.*process|cost, access, and confidentiality/.test(lower)) {
    return `Route two supplied fictional needs involving ${focus}. For each, choose the appropriate service, list two consent, confidentiality, cost, or access questions, and write the next action the fictional person can take without revealing unrelated details.`
  }
  if (/emergency|crisis|overdose|poison|first.response|first aid|cpr|aed|choking|bleeding|head.injury|concussion/.test(lower)) {
    return `Read three supplied fictional situations about ${focus}. For each, mark routine, urgent, or emergency; list the first safe action, the trained help to contact, and one action a bystander should avoid. Support each classification with a fact from the lesson.`
  }
  if (/source|information|claim|media|marketing|study|evidence|campaign|advertis|algorithm|influencer|supplement|product/.test(lower)) {
    return `Compare two supplied fictional messages about ${focus}. Build a four-row check for source or author, evidence, date or context, and incentive; then choose the stronger message, cite two details, and state what remains uncertain.`
  }
  if (/consent|boundary|boundaries|permission|coerc|relationship|communication|refusal|conflict|bully|harass|hazing|peer|de-escalation/.test(lower)) {
    return `Annotate a supplied fictional exchange about ${focus}: underline the stated limit, circle any pressure or respectful check-in, and write a two-sentence response that states a boundary plus a safe next step. Add when a trusted adult should enter the plan.`
  }
  if (/stress|coping|regulation|grief|mental|distress|stigma|support network|help.seeking|warning signs|isolation/.test(lower)) {
    return `Complete a fictional support-plan card for ${focus}: identify one observable signal, choose one immediate coping or communication step, name a routine support route and an urgent route, and explain why the plan does not make a peer responsible for care.`
  }
  if (/food|fuel|hunger|fullness|hydrat|sleep|circadian|movement|recovery|body|oral|hygiene|skin|dental|vision|hearing/.test(lower)) {
    return `Use the supplied fictional day to create a care plan for ${focus}. Identify two needs or barriers, choose two feasible supports, and explain how each supports function or recovery without appearance rules, shame, or a requirement to reveal personal habits.`
  }
  if (/medicine|medication|drug|substance|nicotine|alcohol|cannabis|opioid|fentanyl|impaired|naloxone|tolerance|dependence/.test(lower)) {
    return `Analyze a supplied fictional situation about ${focus}. Make a three-part safety plan—risk cue, refusal or prevention step, and adult or emergency support—and explain why the plan is safer than relying on one warning or one refusal line.`
  }
  if (/infection|communicable|hiv|immun|allerg|germ|transmission|reproductive|pregnancy|testing/.test(lower)) {
    return `Create a cause-and-interruption map for a supplied fictional case about ${focus}: name the relevant process or transmission route, add two accurate prevention or care supports, and correct one misconception using the lesson facts.`
  }
  if (/care|service|provider|coverage|insurance|cost|bill|benefit|denial|record|portal|confidential|screening|appointment/.test(lower)) {
    return `Route two supplied fictional needs involving ${focus}. For each, choose the appropriate service or administrative step, list two access or privacy questions to ask, and write the next action the fictional person can complete without disclosing unrelated details.`
  }
  if (/community|environment|advoc|public health|promotion|proposal|policy|data|outbreak|determinant|access/.test(lower)) {
    return `Draft a one-page fictional community response about ${focus}: state the condition with two facts, identify who has authority to act, propose one feasible change, name a privacy or access safeguard, and define one measure that would show progress.`
  }
  if (/routine|system|plan|tracking|restart|season|schedule|decision|influence|risk|review|critique|self.management/.test(lower)) {
    return `Build a decision organizer for a fictional person working on ${focus}. Record the goal, two influences or constraints, two options, the safest feasible choice, a support or backup route, and the evidence that would trigger a later revision.`
  }
  return `Apply the lesson facts to a supplied fictional case about ${focus}. Produce a three-part response that identifies the key concept, chooses a safe and feasible action, and explains the choice with two details from the instruction plus an appropriate support route.`
}

export function healthContentRepair(lesson, unit, subject, grade) {
  if (subject !== 'health' || !HEALTH_CONTENT_REPAIR_GRADES.has(grade)) return null
  const key = `${grade}-${lesson.unit_number}`
  const facts = FACTS[key]
  const fact = facts?.[lesson.day_in_unit - 1]
  if (!fact || facts.length !== 6) throw new Error(`Health content repair missing ${lesson.lesson_id}`)
  return {
    keyPoints: [
      fact,
      skillPoint(lesson),
      `For ${lesson.focus}, a strong response distinguishes fact from assumption, uses a fictional or public case, and includes a safe next step or appropriate source of support.`,
    ],
    studentTask: buildTask(lesson),
    knowledgeCheck: `In two or three sentences, explain the most important distinction in ${lesson.focus}; use one lesson fact and name the evidence, safety check, or support route that makes the explanation dependable.`,
    completionCriteria: [
      `The response completes every named part of the ${lesson.focus} task using the supplied fictional or public case.`,
      'The response uses at least two accurate details from the lesson instruction and distinguishes evidence from assumption.',
      'The response gives a safe, feasible next step or support route and does not depend on private disclosure, body comparison, or recorded media proof.',
    ],
  }
}
