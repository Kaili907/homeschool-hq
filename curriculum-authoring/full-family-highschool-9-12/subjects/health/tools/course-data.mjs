// HS-M6 — Grades 9-12 Health course data.
//
// Standards anchor: Michigan Health Education Standards Guidelines 2025 (HESG),
// approved by the Michigan State Board of Education on 2025-11-13, ADA-final
// 2025-12-19. The HESG replaces the term "Standard" with "Practice", defines six
// Practices K-12, and consolidates expectations into four grade spans
// (K-2, 3-5, 6-8, 9-12). All four high-school grades sit inside the single 9-12
// band, so the four courses share the band's Practice and Topic anchors and
// differ by depth, independence, and transfer distance -- not by standard.
//
// Indicators inside each Practice are grouped by eight Topics. The HESG codes a
// grade span by its terminal grade (confirmed examples in the official State
// Board deck: 5.3.SE, 5.5.SE, 8.2.SE, 8.3.SE), so the 9-12 band codes read
// 12.<practice>.<TOPIC>. See ../standards-reference.md for how each anchor's
// mapping_status was decided; per-indicator numbers were NOT read off the source
// and are never invented here.
//
// Privacy floor (enforced by tools/validate-course.mjs, never restated as an
// exception anywhere in this file): no course requires weight, BMI, body-fat,
// calorie counts, diet or body-size goals, medical history, mental-health
// diagnosis, sexual history, body photographs, or voice/video evidence.

export const PRACTICE = {
  1: 'Michigan Health Practice 1: Self-Awareness and Analyzing Influences',
  2: 'Michigan Health Practice 2: Social Awareness, Relationship, and Communication Skills',
  3: 'Michigan Health Practice 3: Information and Resource Seeking',
  4: 'Michigan Health Practice 4: Decision Making and Problem Solving',
  5: 'Michigan Health Practice 5: Self-Management and Goal Setting',
  6: 'Michigan Health Practice 6: Advocacy and Health Promotion',
}

// The eight HESG topic areas and their official bracket abbreviations.
export const TOPIC = {
  BEPA: 'Balanced Eating and Physical Activity',
  CEH: 'Community and Environmental Health',
  HR: 'Healthy Relationships',
  MEH: 'Mental and Emotional Health',
  PHW: 'Personal Health and Wellness',
  SAF: 'Safety',
  SU: 'Substance Use and Misuse',
  SE: 'Sex Education',
}

// A 9-12 band anchor: practice number + topic abbreviation.
export const anchor = (practice, topicKey) =>
  `Michigan HESG 2025 Grades 9-12 [12.${practice}.${topicKey}] ${TOPIC[topicKey]} — ${PRACTICE[practice].replace('Michigan Health Practice ' + practice + ': ', '')}`

// HESG Section 1 is content Michigan law requires: HIV instruction, CPR/AED, and
// physiology and hygiene as it relates to substance use. Units carrying that
// content are flagged so the course guide can surface it for guardians.
export const SECTION_1 = 'Michigan HESG 2025 Section 1 (content required by Michigan law)'

export const COURSES = [
  {
    grade: 9,
    courseId: 'ma-g9-health',
    title: 'Grade 9 Health',
    days: 36,
    focusStatement:
      'Carries Grade 8 health literacy into high school: the learner moves from recognizing reliable health information to using it inside their own decisions, and from naming coping tools to running them without being prompted.',
    description:
      'A Grade 9 health course on the Michigan Health Education Standards Guidelines 2025 Grades 9-12 band. It builds high-school health literacy, decision making, mental and emotional self-management, safety and emergency response including CPR/AED awareness, substance-use prevention, and non-diet fueling, movement, sleep, and recovery. No weight, BMI, body-fat, calorie count, diet goal, medical history, diagnosis, sexual history, body photograph, or voice/video recording is ever required.',
    capstone:
      'A private-safe personal health decision file: a source-evaluation record, a rehearsed decision process, a coping and help-seeking plan, and an emergency-response readiness summary. Nothing private has to be disclosed to complete it.',
    units: [
      {
        title: 'Health Literacy and Decision Making in High School',
        practices: [1, 3, 4],
        topics_codes: ['PHW'],
        essentialQuestion:
          'How do I turn health information I trust into a decision I can actually defend?',
        topics: [
          'what health literacy means at the high-school level',
          'internal and external influences on a health decision',
          'source quality: authorship, evidence, currency, and conflict of interest',
          'a repeatable decision process for health choices',
          'short-term convenience versus longer-term consequence',
          'reviewing a decision after the fact without self-blame',
        ],
        performanceTask:
          'Work a fictional high-school health decision end to end: name the influences, evaluate two competing sources, run the decision process, and state what evidence would change the decision. The learner never has to use a real decision from their own life.',
        materials: ['course notebook or digital equivalent', 'two contrasting written health sources supplied by the course or guardian'],
        adapted:
          'The decision process may be written, typed, spoken to an adult, diagrammed, recorded on a graphic organizer, or built from sentence stems. A learner may substitute any scenario for another supplied scenario without penalty.',
        privacy:
          'All scenarios are fictional. The learner is never asked to describe a real health decision, condition, or family situation.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Scenarios reference everyday high-school health choices only.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Mental and Emotional Health: Stress, Coping, and Help-Seeking',
        practices: [1, 5, 3],
        topics_codes: ['MEH'],
        essentialQuestion:
          'How do I manage stress in a way that still works on a bad week, and how do I ask for help early?',
        topics: [
          'the stress response and what it does to attention, sleep, and mood',
          'coping strategies that are sustainable versus strategies that cost more later',
          'building a personal regulation routine',
          'recognizing when a difficulty is bigger than self-management',
          'trusted adults, school supports, and crisis lines',
          'supporting a peer without taking responsibility for their care',
        ],
        performanceTask:
          'Build a two-tier support plan: strategies the learner can run alone, and the named point at which they contact a trusted adult or professional. The plan may be written entirely with general categories rather than personal detail.',
        materials: ['course notebook or digital equivalent', 'a guardian-approved list of local and national help resources'],
        adapted:
          'Coping strategies may be movement-based, still, sensory, verbal, written, or silent; every learner selects strategies their body and setting actually allow. Responses may be selected from options rather than composed.',
        privacy:
          'No mental-health diagnosis, symptom inventory, screening score, trauma history, or private reflection is requested, recorded, or shared. The learner may complete the plan using only general language.',
        guardian: {
          equipment: 'None.',
          environment: 'Quiet indoor space with a break area available.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit names distress and crisis-support pathways. Guardian reviews the resource list before the unit and decides which contacts are appropriate for the household.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Safety, Injury Prevention, and Emergency Response',
        practices: [4, 5, 6],
        topics_codes: ['SAF'],
        section_1: true,
        essentialQuestion:
          'If something goes wrong in front of me, what do I actually do in the first two minutes?',
        topics: [
          'recognizing an emergency and activating help',
          'CPR and AED awareness: what they are, when they are used, and how to get trained',
          'bleeding control, choking response, and basic first aid concepts',
          'concussion and head-injury recognition and the stop rule',
          'vehicle, water, fire, and home-hazard prevention',
          'bystander responsibility and safe intervention limits',
        ],
        performanceTask:
          'Produce an emergency-readiness brief for one fictional setting: hazards present, prevention steps, the first three actions in an incident, and who is called. Skills are described and rehearsed verbally or on a manikin if the family has one; no certification is claimed by this course.',
        materials: ['course notebook or digital equivalent', 'optional CPR manikin or training kit if the family has one', 'household emergency contact information'],
        adapted:
          'Every response step may be described, sequenced, or narrated rather than physically performed. A learner who cannot perform compressions plans and rehearses the call, scene-safety, AED-retrieval, and hand-off roles instead, which are full contributions and are scored as such.',
        privacy:
          'No medical history, condition, medication list, or injury record is requested. Emergency contacts stay in the household and are never entered into course records.',
        guardian: {
          equipment: 'Optional training manikin or first-aid kit. No live practice on another person.',
          environment: 'Indoor space with floor room if a manikin is used.',
          movement_hazards: 'Kneeling and sustained arm effort if compressions are rehearsed on a manikin; the learner may stop at any point and may choose the non-physical roles instead.',
          sensitive_content_note: 'Unit discusses injuries and medical emergencies in general, non-graphic terms.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Substance Use Prevention: Alcohol, Nicotine, Cannabis, and Medication Safety',
        practices: [1, 4, 5],
        topics_codes: ['SU'],
        section_1: true,
        essentialQuestion:
          'What actually happens in the body, and how do I hold a decision under pressure from people I like?',
        topics: [
          'physiology of alcohol, nicotine and vaping products, and cannabis on the adolescent body and brain',
          'dependence, tolerance, and why adolescent timing matters',
          'marketing, social media, and normalization pressure',
          'prescription and over-the-counter medication safety and storage',
          'refusal and exit strategies that survive real social pressure',
          'overdose and poisoning response, and where families get help',
        ],
        performanceTask:
          'Write and rehearse three refusal and exit scripts for three different fictional pressure situations, then analyze one substance marketing artifact for the influence technique it uses.',
        materials: ['course notebook or digital equivalent', 'one guardian-approved advertisement or marketing example'],
        adapted:
          'Scripts may be written, typed, spoken to an adult, signed, or selected from a supplied bank and then adapted. Rehearsal with an adult is offered but never required in front of a group.',
        privacy:
          'No learner or family substance-use history, treatment history, or personal disclosure is requested at any point. All pressure situations are fictional.',
        guardian: {
          equipment: 'None. No substance, product, or paraphernalia is handled.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit names alcohol, nicotine and vaping, cannabis, and medication misuse directly and factually. Guardian reviews the marketing example before it is used.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Fueling, Movement, Sleep, and Recovery Without Diet Culture',
        practices: [5, 1],
        topics_codes: ['BEPA'],
        essentialQuestion:
          'How do I keep my body supplied for school, work, and activity across a real week?',
        topics: [
          'adequate fueling for growth, school load, and activity',
          'hydration across a day',
          'sleep need, sleep debt, and circadian timing in high school',
          'recovery after effort, illness, or a heavy week',
          'evaluating supplement, energy-product, and fitness-industry claims',
          'body respect and resisting appearance-based health messaging',
        ],
        performanceTask:
          'Evaluate three fictional wellness plans for adequacy, safety, evidence, flexibility, and cost, then revise the weakest one. No calorie counts, weights, body-size targets, diet rules, or good/bad food labels are used or produced.',
        materials: ['course notebook or digital equivalent', 'three course-supplied fictional wellness plans'],
        adapted:
          'Evaluation may be written, spoken, chart-based, or completed against a supplied criteria checklist. Learners with food allergies, medical diets, cultural or religious food practices, or limited food access work entirely with the fictional plans and are never asked to describe their own eating.',
        privacy:
          'No weight, BMI, body-fat, measurement, calorie count, food log, diet goal, or body-size target is requested, recorded, or scored anywhere in this unit.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit explicitly teaches against diet culture and appearance-based health claims. No food is prepared, measured, or logged.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Personal Wellness, Communicable Conditions, and HIV Basics',
        practices: [3, 5],
        topics_codes: ['PHW'],
        section_1: true,
        essentialQuestion:
          'How do everyday wellness habits and accurate information reduce risk for me and the people around me?',
        topics: [
          'daily wellness systems: hygiene, dental, vision, hearing, and skin care',
          'how communicable conditions transmit and how transmission is interrupted',
          'HIV: accurate transmission and non-transmission facts, testing, and treatment as prevention',
          'immunization concepts and where records live',
          'stigma, accuracy, and respectful language about health conditions',
          'routine care and screening as ordinary adult maintenance',
        ],
        performanceTask:
          'Build an accuracy brief that corrects four fictional but realistic myths about transmission, using cited reliable sources and non-stigmatizing language.',
        materials: ['course notebook or digital equivalent', 'guardian-approved public-health reference sources'],
        adapted:
          'The brief may be written, typed, recorded as spoken notes for an adult, or built as a labeled chart. Reading load may be reduced by using summarized source extracts.',
        privacy:
          'No learner or family health status, test result, immunization record, or medical history is requested or recorded. HIV instruction follows Michigan law; the guardian is notified before it begins and may decline it without penalty.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'This unit contains HIV instruction required by Michigan law (MCL 380.1507). The guardian receives prior notification, may review all materials before instruction, and may opt the learner out without penalty; the remaining five topics are then taught on their own.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 10,
    courseId: 'ma-g10-health',
    title: 'Grade 10 Health',
    days: 36,
    focusStatement:
      'Turns outward from Grade 9 self-management to the relational and informational environment: influence, boundaries, communication under conflict, digital pressure, and the support systems a learner will use for the rest of high school.',
    description:
      'A Grade 10 health course on the Michigan Health Education Standards Guidelines 2025 Grades 9-12 band, concentrating on self-awareness and influence analysis, healthy relationships, boundaries and consent, communication and violence prevention, media and digital influence on health behavior, substance-misuse refusal and support pathways, and mental-health support systems. No weight, BMI, body-fat, calorie count, diet goal, medical history, diagnosis, sexual history, body photograph, or voice/video recording is ever required.',
    capstone:
      'A relationships, communication, and support portfolio: an influence analysis, a boundary and consent script set, a conflict de-escalation plan, a media-claim teardown, and a support-pathway map — all built from fictional scenarios.',
    units: [
      {
        title: 'Self-Awareness, Identity, and Analyzing Influences',
        practices: [1],
        topics_codes: ['MEH'],
        essentialQuestion:
          'Which influences are actually steering my health behavior, and which ones did I choose?',
        topics: [
          'values, needs, and beliefs as internal influences on behavior',
          'family, peer, cultural, and community influences',
          'economic and environmental influences on available choices',
          'identity, belonging, and health behavior',
          'separating an influence from a decision',
          'naming an influence without judging the person carrying it',
        ],
        performanceTask:
          'Map the influence field around a fictional learner facing a health choice, rank which influences carry the most weight, and propose one change that shifts the field rather than blaming the person.',
        materials: ['course notebook or digital equivalent', 'course-supplied scenario set'],
        adapted:
          'The influence map may be drawn, built with movable labels, dictated, typed, or completed on a supplied template with a reduced number of nodes.',
        privacy:
          'The learner analyzes a supplied fictional person, not themselves or their family. No identity, faith, income, immigration, or household disclosure is requested.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit discusses family, cultural, and economic influence in general terms only.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Healthy Relationships, Boundaries, and Consent',
        practices: [2],
        topics_codes: ['HR'],
        essentialQuestion:
          'What does respect look like in practice when a boundary is inconvenient for someone?',
        topics: [
          'characteristics of healthy, unhealthy, and coercive relationship patterns',
          'setting, stating, and holding a personal boundary',
          'consent as ongoing, informed, freely given, and revocable',
          'recognizing pressure, manipulation, and control tactics',
          'ending or stepping back from a relationship safely',
          'where to go when a relationship stops being safe',
        ],
        performanceTask:
          'Build a boundary and consent script set for four fictional situations, including one where the boundary is not accepted the first time, and identify the exit and support step for each.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional scenario set'],
        adapted:
          'Scripts may be written, typed, spoken privately to an adult, signed, or assembled from a supplied phrase bank. No role-play in front of an audience is required.',
        privacy:
          'No sexual history, relationship history, or personal disclosure is requested. This unit covers boundaries, consent, and respect as relationship skills; it is not sex education, which is handled separately and only with guardian activation.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space; a private space is offered for script rehearsal.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit names coercion, manipulation, and unsafe relationship patterns directly. Guardian may review all scenarios first.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Communication, Conflict, and Violence Prevention',
        practices: [2, 4],
        topics_codes: ['SAF', 'HR'],
        essentialQuestion:
          'How do I keep a disagreement from becoming a danger?',
        topics: [
          'assertive communication versus passive and aggressive patterns',
          'de-escalation language and body positioning',
          'conflict resolution and repair after a rupture',
          'bullying, harassment, and hazing: recognition and reporting',
          'warning signs of escalating violence and when to leave',
          'reporting pathways and what happens after a report',
        ],
        performanceTask:
          'Take one fictional conflict from first friction to three different endings — repaired, disengaged, and reported — and justify which ending fits which conditions.',
        materials: ['course notebook or digital equivalent', 'course-supplied conflict scenarios'],
        adapted:
          'Branching may be diagrammed, written, narrated, or completed on a supplied decision-tree template. Verbal rehearsal is optional and never public.',
        privacy:
          'No account of a real conflict, bullying incident, or violent experience is requested. A learner who wants to discuss a real situation is directed to a trusted adult, not to the assignment.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit covers bullying, harassment, and violence escalation. Guardian reviews scenarios and confirms the household reporting pathway.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Media, Technology, and Digital Influence on Health',
        practices: [1, 3],
        topics_codes: ['CEH'],
        essentialQuestion:
          'Who profits when I believe a health claim, and how do I check before I share it?',
        topics: [
          'algorithmic feeds, engagement incentives, and health misinformation',
          'influencer marketing, sponsorship disclosure, and undisclosed advertising',
          'appearance filters, edited imagery, and body-image pressure',
          'evaluating a health claim: source, evidence, plausibility, and incentive',
          'privacy, data, and health information shared online',
          'digital wellbeing: notification load, sleep, and attention',
        ],
        performanceTask:
          'Take apart three fictional but realistic health posts: identify the claim, the incentive, the evidence actually offered, and what a reliable source says instead. Write the correction you would actually post.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional social posts', 'guardian-approved reference sources'],
        adapted:
          'Teardowns may be written, spoken, annotated on printouts, or completed on a supplied four-column template. No account creation, login, or live platform use is required.',
        privacy:
          'No real account, follower list, screen-time report, browsing history, or personal post is submitted. All artifacts analyzed are course-supplied fictions.',
        guardian: {
          equipment: 'None. No social-media account or login is required.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit addresses body-image and appearance pressure directly, using non-shaming language and no body imagery.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Substance Misuse Trends, Refusal Skills, and Support Pathways',
        practices: [4, 5],
        topics_codes: ['SU'],
        section_1: true,
        essentialQuestion:
          'How do I hold a decision when the pressure is quiet, repeated, and from someone close?',
        topics: [
          'current substance-misuse trends and why product forms change quickly',
          'fentanyl contamination, unknown-supply risk, and naloxone awareness',
          'impaired driving and passenger decisions',
          'refusal under sustained rather than one-time pressure',
          'supporting someone who is using, without taking responsibility for them',
          'treatment, recovery, and confidential support pathways',
        ],
        performanceTask:
          'Build a support-pathway map for three fictional situations of escalating seriousness, naming the trusted adult, the service, and the point at which emergency help is called.',
        materials: ['course notebook or digital equivalent', 'guardian-approved local and national support resource list'],
        adapted:
          'The map may be drawn, listed, dictated, or completed on a supplied template. Reading load may be reduced with summarized resource descriptions.',
        privacy:
          'No learner or family substance-use, treatment, or recovery history is requested at any point. All situations are fictional.',
        guardian: {
          equipment: 'None. No substance or product is handled.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit names overdose risk and naloxone. Guardian reviews and approves the resource list and decides which local services are appropriate.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Mental Health Support Systems and Crisis Response',
        practices: [3, 6],
        topics_codes: ['MEH'],
        essentialQuestion:
          'When self-management is not enough, what is the next step and who takes it with me?',
        topics: [
          'the difference between ordinary distress and a situation needing professional support',
          'what school counselors, clinicians, and crisis lines actually do',
          'confidentiality, its limits, and mandatory reporting in plain language',
          'responding when a peer discloses distress',
          'reducing stigma through accurate language',
          'advocating for accessible mental-health support in a community',
        ],
        performanceTask:
          'Write a peer-support response protocol: what to say, what not to promise, who to bring in, and how to hand off — then draft one short advocacy message for better support access.',
        materials: ['course notebook or digital equivalent', 'guardian-approved help resource list'],
        adapted:
          'The protocol may be written, spoken, or built from supplied response cards that the learner orders and adapts.',
        privacy:
          'No diagnosis, screening instrument, symptom checklist, score, or personal mental-health disclosure is used, requested, or recorded. This course does not diagnose and does not ask the learner to self-diagnose or assess anyone else.',
        guardian: {
          equipment: 'None.',
          environment: 'Quiet indoor space with a break area available.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit covers crisis response and peer disclosure of distress. Guardian reviews the resource list and confirms household escalation contacts before the unit.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 11,
    courseId: 'ma-g11-health',
    title: 'Grade 11 Health',
    days: 36,
    focusStatement:
      'Widens the frame from personal and relational health to systems: evidence quality, long-horizon risk, the health of a community and its environment, and how care is actually obtained and paid for.',
    description:
      'A Grade 11 health course on the Michigan Health Education Standards Guidelines 2025 Grades 9-12 band, concentrating on evaluating health information, products, and services; chronic-condition prevention across a long horizon; community and environmental health; navigating health systems, coverage, and confidentiality; community-level substance-use risk; and designing an evidence-based health advocacy project. No weight, BMI, body-fat, calorie count, diet goal, medical history, diagnosis, sexual history, body photograph, or voice/video recording is ever required.',
    capstone:
      'An evidence-and-systems file: a product/service evaluation, a community health-condition analysis, a care-navigation walkthrough using fictional cases, and a designed advocacy project with a measurable outcome.',
    units: [
      {
        title: 'Evaluating Health Information, Products, and Services',
        practices: [3],
        topics_codes: ['PHW'],
        essentialQuestion:
          'What separates a health claim that holds up from one that only sounds like it does?',
        topics: [
          'evidence hierarchy in plain language: anecdote, observation, trial, review',
          'reading a study summary without over-reading it',
          'regulated versus unregulated products and what a label legally means',
          'evaluating a health service: credential, scope, cost, and accountability',
          'conflict of interest and funding disclosure',
          'the cost of being wrong: how to size a risk before acting',
        ],
        performanceTask:
          'Produce a consumer-grade evaluation of three fictional health products or services, ranking them on evidence, safety, cost, and accountability, and stating the one piece of missing information that would change the ranking.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional product and service descriptions', 'guardian-approved reference sources'],
        adapted:
          'Evaluations may be written, tabled, dictated, or completed against a supplied criteria rubric with a reduced item count.',
        privacy:
          'No purchase, account creation, real product order, payment information, or personal health-product use is requested or recorded.',
        guardian: {
          equipment: 'None. No purchase is required at any point.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'All products and services evaluated are fictional course artifacts.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Chronic Conditions and Long-Horizon Wellbeing',
        practices: [1, 5],
        topics_codes: ['PHW', 'BEPA'],
        essentialQuestion:
          'How do decisions made now compound over decades, without turning that into fear or blame?',
        topics: [
          'how chronic conditions develop and why single causes are rare',
          'modifiable and non-modifiable factors, stated without moralizing',
          'genetics, environment, access, and stress as real contributors',
          'sleep, movement, and recovery as long-horizon inputs',
          'screening, early detection, and routine care over a lifetime',
          'living well with an ongoing condition, and why stigma harms outcomes',
        ],
        performanceTask:
          'Build a twenty-year wellbeing model for a fictional adult, showing which inputs are inside personal control, which are structural, and which supports change the picture most.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional case profiles'],
        adapted:
          'The model may be drawn, tabled, narrated, or assembled from supplied factor cards.',
        privacy:
          'No family medical history, genetic information, condition, medication, or personal risk profile is requested, recorded, or inferred. The learner works only from fictional profiles.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit teaches chronic-condition risk without blame framing and without any body-measurement or body-size content.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Community and Environmental Health',
        practices: [6, 1],
        topics_codes: ['CEH'],
        essentialQuestion:
          'Why is health so unevenly distributed across places that are only a few miles apart?',
        topics: [
          'air, water, housing, and neighborhood conditions as health inputs',
          'food access, transportation, and distance to care',
          'environmental hazards and how communities learn about them',
          'public health functions and how a community responds to an outbreak',
          'reading community-level health data honestly',
          'who has standing to change a community health condition',
        ],
        performanceTask:
          'Analyze a fictional community health dataset, identify the two conditions with the largest effect, and write a short brief proposing one realistic intervention with its likely limits.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional community dataset'],
        adapted:
          'Analysis may be written, charted, spoken, or completed on a supplied guided-analysis frame with the dataset pre-summarized.',
        privacy:
          'The dataset is fictional. No real address, neighborhood, household income, or family circumstance is collected or discussed.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit discusses inequality in health outcomes factually and without assigning fault to individuals or communities.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Navigating Health Systems, Coverage, and Confidentiality',
        practices: [3, 4],
        topics_codes: ['PHW'],
        essentialQuestion:
          'How does a person actually get care, and what does it cost them to try?',
        topics: [
          'levels of care: self-care, primary, urgent, emergency, and specialty',
          'insurance vocabulary in plain language: premium, deductible, copay, network',
          'what care costs without coverage, and where low-cost options exist',
          'preparing for an appointment and asking a clinician a real question',
          'minor consent, confidentiality, and its limits in Michigan',
          'medical records, portals, and who can see what',
        ],
        performanceTask:
          'Run three fictional cases through the system: choose the right level of care, estimate the cost path, prepare the questions, and identify the confidentiality rule that applies.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional coverage summaries and case files'],
        adapted:
          'Walkthroughs may be written, charted, narrated, or completed on a supplied decision frame with vocabulary pre-defined.',
        privacy:
          'No real insurance document, policy number, member ID, medical record, portal login, or family coverage detail is used, uploaded, or recorded. Every artifact is a course-supplied fiction.',
        guardian: {
          equipment: 'None. No account, portal, or real document is used.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Confidentiality content is taught as general Michigan-context information, not as legal advice; guardians decide how household care decisions are actually made.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Substance Use, Community Risk, and Harm-Reduction Literacy',
        practices: [3, 4],
        topics_codes: ['SU'],
        section_1: true,
        essentialQuestion:
          'What does the evidence say actually reduces harm, and what only sounds tough?',
        topics: [
          'individual risk versus population-level risk',
          'prevention approaches with evidence behind them',
          'harm-reduction concepts and the arguments made for and against them',
          'policy levers: access, pricing, marketing limits, and enforcement',
          'stigma as a barrier to treatment-seeking',
          'evaluating a prevention campaign for accuracy and effect',
        ],
        performanceTask:
          'Evaluate two fictional community prevention campaigns against stated evidence criteria, then redesign the weaker one and state how its effect would be measured.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional campaign materials'],
        adapted:
          'Evaluation and redesign may be written, storyboarded, dictated, or completed on a supplied criteria template.',
        privacy:
          'No personal or family substance-use history is requested. Campaign artifacts are fictional.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit presents harm-reduction arguments on multiple sides for analysis; guardian may review materials and set the household position.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Advocacy: Designing a Health Promotion Project',
        practices: [6],
        topics_codes: ['CEH'],
        essentialQuestion:
          'What is the smallest change I could actually cause, and how would I know it worked?',
        topics: [
          'choosing a scoped, achievable health promotion goal',
          'audience analysis and message framing without fear appeals',
          'accuracy, citation, and avoiding overclaim in advocacy',
          'partners, permissions, and realistic constraints',
          'defining a measurable outcome before starting',
          'presenting a proposal and taking critique',
        ],
        performanceTask:
          'Design a complete health promotion project proposal — goal, audience, message, partners, constraints, and measurable outcome — for a setting the learner can actually reach. Execution is optional and guardian-approved; the proposal is what is assessed.',
        materials: ['course notebook or digital equivalent', 'guardian-approved reference sources'],
        adapted:
          'The proposal may be written, presented as a slide outline, spoken to an adult, or built on a supplied planning template. No public presentation or published material is required.',
        privacy:
          'If the guardian approves any real-world execution, no learner photograph, voice recording, video, precise location, or contact information is published as part of it.',
        guardian: {
          equipment: 'None for the proposal. Any real execution requires separate guardian approval.',
          environment: 'Indoor study space; any community component is guardian-planned and supervised.',
          movement_hazards: 'None expected for the proposal.',
          sensitive_content_note: 'Execution beyond the proposal is optional and must be approved and supervised by the guardian, who also decides whether anything is shared outside the household.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 12,
    courseId: 'ma-g12-health',
    title: 'Grade 12 Health',
    days: 36,
    focusStatement:
      'Hands the whole system over: the learner leaves running their own health maintenance, care navigation, support network, and emergency readiness without an adult holding the process together.',
    description:
      'A Grade 12 health course on the Michigan Health Education Standards Guidelines 2025 Grades 9-12 band, concentrating on independent adult health self-management, relationships and support networks after high school, sustainable mental-health maintenance, adult safety and emergency readiness, consumer health and care navigation, and a personal health plan with a community advocacy component. No weight, BMI, body-fat, calorie count, diet goal, medical history, diagnosis, sexual history, body photograph, or voice/video recording is ever required.',
    capstone:
      'A transition-ready personal health plan: independent maintenance routines, a care and coverage navigation guide, a named support network, an emergency-readiness summary, and one advocacy commitment — reviewable by a guardian without exposing anything private.',
    units: [
      {
        title: 'Independent Health Self-Management for Adulthood',
        practices: [5],
        topics_codes: ['PHW', 'BEPA'],
        essentialQuestion:
          'What has to keep happening when no one reminds me?',
        topics: [
          'building routines that survive a schedule change',
          'sleep, movement, fueling, and recovery as maintained systems rather than goals',
          'tracking what matters without measuring the body',
          'managing a routine through illness, stress, or a heavy period',
          'restarting after a routine collapses, without self-punishment',
          'deciding what to keep, drop, and add each season',
        ],
        performanceTask:
          'Build an independent maintenance system with a normal-week version, a hard-week fallback version, and a written restart procedure. Progress is described in terms of behaviors kept, never body measurements.',
        materials: ['course notebook or digital equivalent', 'optional planner or calendar tool'],
        adapted:
          'The system may be written, tabled, built as a checklist, entered in a calendar, or described aloud to an adult. Any component the learner cannot perform is planned as a supported or adapted component and scored equally.',
        privacy:
          'No weight, BMI, body-fat, measurement, calorie count, food log, step count, heart-rate export, or body-size goal is requested or recorded. Evidence is the plan and its review, not personal data.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit deliberately excludes all body-metric tracking and all appearance or weight goals.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Relationships, Boundaries, and Support Networks Beyond High School',
        practices: [2],
        topics_codes: ['HR'],
        essentialQuestion:
          'How do I build and keep a support network when the built-in one goes away?',
        topics: [
          'the shape of adult relationships: chosen, professional, and civic',
          'holding boundaries with roommates, coworkers, and supervisors',
          'consent and respect in adult contexts',
          'recognizing coercive control and financial or social pressure',
          'leaving an unsafe situation with a plan',
          'building a support network deliberately rather than by accident',
        ],
        performanceTask:
          'Design a named support network for a fictional graduate — who is contacted for what, what backup exists when a contact is unavailable, and what triggers escalation — then write two boundary scripts for adult settings.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional scenarios'],
        adapted:
          'The network may be diagrammed, listed, dictated, or built on a supplied template. Scripts may be selected from a bank and adapted rather than composed.',
        privacy:
          'The network is designed for a fictional person. No sexual history, relationship history, or personal contact list is requested or recorded.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit names coercive control and unsafe-exit planning. Guardian may review scenarios first.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Mental Health Maintenance and Sustainable Coping',
        practices: [1, 5],
        topics_codes: ['MEH'],
        essentialQuestion:
          'How do I keep myself steady through a transition that removes most of my structure?',
        topics: [
          'transition stress and why capable people struggle during it',
          'maintenance strategies versus emergency strategies',
          'sleep, isolation, and workload as leading indicators',
          'when to seek professional support and how to start that process as an adult',
          'cost, access, and confidentiality of adult mental-health care',
          'supporting others while protecting your own capacity',
        ],
        performanceTask:
          'Write a transition plan with maintenance strategies, early-warning conditions the learner will watch for, and a concrete first step for getting professional support — including how it would be paid for and accessed.',
        materials: ['course notebook or digital equivalent', 'guardian-approved adult support resource list'],
        adapted:
          'The plan may be written, spoken, or assembled from supplied strategy cards. General categories may be used throughout instead of specific personal detail.',
        privacy:
          'No diagnosis, screening tool, score, symptom checklist, treatment history, or private reflection is requested, stored, or shared. This course does not diagnose and never asks the learner to label themselves.',
        guardian: {
          equipment: 'None.',
          environment: 'Quiet indoor space with a break area available.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Unit covers seeking professional mental-health support. Guardian reviews the adult resource list before the unit.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Safety, Risk, and Emergency Readiness as an Independent Adult',
        practices: [4, 5],
        topics_codes: ['SAF'],
        section_1: true,
        essentialQuestion:
          'What do I need ready before something goes wrong, not after?',
        topics: [
          'maintaining CPR/AED and first-aid readiness and where to get certified',
          'home, vehicle, workplace, and travel safety systems',
          'risk assessment for an unfamiliar situation',
          'impaired driving, fatigue, and transportation decisions',
          'emergency communication, documents, and a household plan',
          'knowing the limits of what a bystander should attempt',
        ],
        performanceTask:
          'Assemble an adult emergency-readiness package for a fictional first independent household: hazards, prevention systems, response sequences, contacts, and the certification the learner would pursue.',
        materials: ['course notebook or digital equivalent', 'optional first-aid kit inventory checklist'],
        adapted:
          'The package may be written, listed, charted, or narrated. All response sequences may be described rather than physically performed, and non-physical response roles are full contributions.',
        privacy:
          'The household is fictional. No real address, document, insurance detail, or family contact information is entered into course records.',
        guardian: {
          equipment: 'Optional first-aid kit for inventory only. No live practice on another person.',
          environment: 'Indoor study space.',
          movement_hazards: 'None required; any optional manikin rehearsal is learner-paced and may be declined.',
          sensitive_content_note: 'This course teaches CPR/AED awareness and readiness; it does not issue certification. Guardian decides whether to pursue an external certification course.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Consumer Health, Coverage Literacy, and Care Navigation',
        practices: [3, 4],
        topics_codes: ['PHW'],
        essentialQuestion:
          'How do I get the care I need without being taken advantage of?',
        topics: [
          'choosing and establishing with a primary care provider',
          'coverage options after high school and what each actually covers',
          'reading a bill, an explanation of benefits, and a denial',
          'appealing a denial and asking for an itemized correction',
          'prescription cost, generics, and assistance programs',
          'recognizing predatory health marketing aimed at young adults',
        ],
        performanceTask:
          'Work three fictional cases: establish care, decode a bill and an explanation of benefits, and draft an appeal letter for a denied claim.',
        materials: ['course notebook or digital equivalent', 'course-supplied fictional bills, benefit statements, and denial letters'],
        adapted:
          'Cases may be worked in writing, on annotated printouts, verbally with an adult, or on a supplied guided frame with terms pre-defined.',
        privacy:
          'No real bill, benefit statement, policy number, member ID, portal login, payment method, or family financial detail is used or recorded. Every document is a course-supplied fiction.',
        guardian: {
          equipment: 'None. No real account or payment information is used.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Course content is general consumer education, not individualized insurance, legal, or medical advice.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Capstone: Personal Health Plan and Community Advocacy',
        practices: [6, 5],
        topics_codes: ['PHW', 'CEH'],
        essentialQuestion:
          'What plan would still be running a year from now, and what would I want changed for other people?',
        topics: [
          'integrating four years of health learning into one working plan',
          'stating evidence for each element of the plan',
          'building in review points and revision triggers',
          'choosing one advocacy commitment that is realistic',
          'presenting a plan to a guardian without disclosing private detail',
          'defending choices under questioning and revising after critique',
        ],
        performanceTask:
          'Present the complete personal health plan and advocacy commitment for review, defend each element with evidence and reasoning, then revise it based on the critique received.',
        materials: ['course notebook or digital equivalent', 'the learner’s Grade 9-12 health portfolio'],
        adapted:
          'The defense may be spoken, written, presented as annotated slides, or delivered in a one-to-one conversation with an adult. No public presentation, recording, or audience is required.',
        privacy:
          'The plan is written so that it can be reviewed without exposing anything private: it shows routines, evidence, and next steps, not diagnoses, measurements, or personal disclosures. No recording of the defense is made.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor space for a one-to-one review conversation.',
          movement_hazards: 'None expected.',
          sensitive_content_note: 'Guardian participates as reviewer. The review is a conversation, not a recorded or published artifact.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
]

// Michigan HESG Section 3 (Sex Education) is governed by MCL 380.1507 and
// MCL 380.1169: prior notification, the right to review all materials before
// instruction, and opt-out without penalty. It is therefore NOT part of any
// course's required 36-day sequence. It is authored as a separate, guardian-
// activated module so that a family that declines it still receives a complete,
// unmodified course, and a family that elects it receives standards-aligned
// instruction rather than nothing. See ../sex-education-module.md.
export const OPTIONAL_MODULES = [
  {
    moduleId: 'ma-hs-health-sex-education-optional',
    title: 'Sex Education (Optional, Guardian-Activated)',
    recommendedGrade: 10,
    days: 6,
    guardian_activation_required: true,
    description:
      'A guardian-activated Michigan HESG 2025 Section 3 module. It is never scheduled automatically, never counted in a course’s 36 days, and never required for course completion or credit. A guardian must review the materials and activate the module before any lesson is delivered.',
    unit: {
      title: 'Sex Education (Optional, Guardian-Activated)',
      practices: [2, 3, 5],
      topics_codes: ['SE'],
      section_3: true,
      essentialQuestion:
        'How do I find medically accurate information, understand consent and boundaries, and know where to get care?',
      topics: [
        'anatomy, reproduction, and development described in medically accurate terms',
        'consent, boundaries, and communication in intimate contexts',
        'abstinence and risk reduction presented accurately',
        'sexually transmitted infections including HIV: transmission, prevention, testing, and treatment',
        'locating medically accurate sources and confidential health services',
        'recognizing coercion, exploitation, and where to report it',
      ],
      performanceTask:
        'Build a medically accurate source-and-services reference and a consent-and-boundaries script set, using fictional scenarios only.',
      materials: ['course notebook or digital equivalent', 'guardian-reviewed medically accurate reference sources'],
      adapted:
        'All work may be written, typed, spoken privately to an adult, or assembled from a supplied bank. No group discussion, role-play, or presentation is required.',
      privacy:
        'No sexual history, activity, orientation, identity, relationship status, or any personal disclosure is requested, recorded, or shared at any point. The learner may complete every task using supplied fictional scenarios.',
      guardian: {
        equipment: 'None.',
        environment: 'Private indoor study space.',
        movement_hazards: 'None expected.',
        sensitive_content_note:
          'Michigan law requires prior notification, the right to review all materials before instruction, and opt-out without penalty (MCL 380.1507, MCL 380.1169). This module is delivered only after a guardian reviews the materials and activates it. Declining it does not reduce, delay, or alter any course.',
        guardian_confirmation_required: true,
      },
    },
  },
]
