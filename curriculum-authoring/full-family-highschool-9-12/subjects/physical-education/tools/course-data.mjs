// HS-M6 — Grades 9-12 Physical Education course data.
//
// Standards anchor: Michigan K-12 Physical Education Standards (State Board
// approved 2017). Five standards, and — unlike every other grade band — grades
// 9-12 are organized into two LEVELS rather than four separate grade sets, so a
// district can run a basic high-school course (LEVEL 1) and a more advanced
// elective (LEVEL 2). Manuel Academy maps that structure onto four years:
// Grades 9-10 = LEVEL 1, Grades 11-12 = LEVEL 2. See ../standards-reference.md
// for sources and mapping_status.
//
// Participation floor (enforced by tools/validate-course.mjs, never restated as
// an exception anywhere in this file): nothing in these courses scores body
// size, weight, weight change, body composition, or appearance; nothing requires
// a photograph, video, or voice recording as evidence; nothing requires
// performing in front of an audience; and every unit carries an inclusive
// adaptation that reaches the same standard by another route.

export const STANDARD = {
  1: 'Michigan PE Standard 1: Demonstrates competency in a variety of motor skills and movement patterns.',
  2: 'Michigan PE Standard 2: Applies knowledge of concepts, principles, strategies and tactics related to movement.',
  3: 'Michigan PE Standard 3: Demonstrates the knowledge and skills to achieve and maintain a health-enhancing level of physical fitness.',
  4: 'Michigan PE Standard 4: Exhibits responsible personal and social behavior that respects self and others.',
  5: 'Michigan PE Standard 5: Recognizes the value of physical activity for health, enjoyment, challenge, self-expression and/or social interaction.',
}

export const LEVEL = {
  1: 'Michigan PE Grades 9-12 LEVEL 1 (foundational high-school physical education)',
  2: 'Michigan PE Grades 9-12 LEVEL 2 (advanced/elective high-school physical education)',
}

export const anchor = (standard, level) => `${STANDARD[standard]} [${LEVEL[level]}]`

export const COURSES = [
  {
    grade: 9,
    courseId: 'ma-g9-physical-education',
    level: 1,
    title: 'Grade 9 Physical Education',
    days: 108,
    focusStatement:
      'Opens LEVEL 1 by re-establishing safe self-management on the learner’s own terms, then broadens movement competence across every activity category so later specialization is a choice rather than a default.',
    description:
      'A Grade 9 physical-education course on the Michigan K-12 Physical Education Standards LEVEL 1 expectations. It develops movement competence across invasion, net/wall, target, striking, rhythmic, individual, and outdoor activity categories, plus fitness literacy grounded in training principles rather than body measurement, and responsible, inclusive participation. No body size, weight, body composition, or appearance is measured or scored; no photograph, video, or voice recording is required; no public performance is required.',
    capstone:
      'A personal movement portfolio: activity-category evidence, a self-managed warm-up and progression, a safety and stop-rule plan, and a reasoned choice of activities to carry into Grade 10.',
    units: [
      {
        title: 'Safe Start: Personal Movement Readiness and Self-Management',
        standards: [3, 4, 5],
        essentialQuestion: 'How do I get my own body ready to work, and how do I know when to stop?',
        secondPass: 'in a full session the learner runs start to finish without prompting, in a space and on a day they did not choose',
        topics: [
          'self-directed warm-up and cool-down design',
          'effort scales described by feel, breath, and speech rather than by device',
          'the stop rule: pain, dizziness, breathing difficulty, head impact, unsafe conditions',
          'space, surface, footwear, weather, and equipment checks',
          'hydration and recovery around activity',
          'setting a personal starting point without comparison',
        ],
        performanceTask:
          'Design and run a personal warm-up, effort-management, and stop-rule routine, then revise it after using it across several sessions. Evidence is the written or described routine and its revision, not a measured result.',
        materials: ['open safe space (indoor or outdoor)', 'supportive footwear if available', 'course notebook or digital equivalent'],
        adapted:
          'Every element has a seated, supported, low-impact, and reduced-range version. A learner using a mobility aid, working from a chair, or managing a condition designs the same routine around the movements available to them, and that routine is assessed as fully equivalent.',
        inclusion:
          'The learner sets their own starting point; no baseline is compared to any other learner, to a norm table, or to a prior year.',
        guardian: {
          equipment: 'No specialized equipment. Optional supportive footwear.',
          environment: 'Clear indoor or outdoor space free of obstacles.',
          movement_hazards: 'General activity risk. Guardian confirms the space and surface are safe and agrees the stop rule with the learner before the unit.',
          supervision_note: 'Guardian sets whether activity is supervised or independent for this learner and this space.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Movement Competence: Invasion Activity Category',
        standards: [1, 2, 4],
        essentialQuestion: 'What do all invasion activities have in common once you stop naming the sport?',
        secondPass: 'under an unpredictable tactical constraint that forces an immediate decision, using a live opponent when safely available or a solo wall, target, self-pass, or diagrammed sequence that preserves the same decision pressure',
        secondPassEvidence: 'Full transfer credit requires an immediate tactical decision under changing pressure. A live, solo, or diagrammed route earns equal credit only when the evidence shows the same cue, decision, and recovery response.',
        topics: [
          'sending, receiving, and carrying an object under light pressure',
          'creating and denying space',
          'support angles and off-object movement',
          'transition between attacking and defending',
          'shared rules, fair play, and safe contact limits',
          'adapting an activity so everyone present can play it',
        ],
        performanceTask:
          'Demonstrate the core invasion skills and explain one tactical principle using a diagram or description, then modify the activity so a person with a different mobility profile can play the same game.',
        materials: ['one ball or substitute object', 'markers or household objects for boundaries', 'open safe space'],
        adapted:
          'Activities run in seated, walking, reduced-space, reduced-pace, or no-contact versions. Solo learners use wall, target, and self-pass variants; the tactical understanding, not the game size, is what is assessed.',
        inclusion:
          'The learner may complete the entire unit without another participant, and modifying an activity for access is itself a graded skill rather than a concession.',
        guardian: {
          equipment: 'One ball or soft substitute; improvised boundary markers.',
          environment: 'Open space clear of hazards and breakables.',
          movement_hazards: 'Running, changes of direction, and object contact. No person-to-person contact is required at any point.',
          supervision_note: 'Guardian confirms space size and whether any second participant is involved.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Movement Competence: Net/Wall, Target, and Striking Categories',
        standards: [1, 2, 5],
        essentialQuestion: 'How does the goal of an activity change the movement it asks for?',
        secondPass: 'in a rally, round, or innings decision sequence where a played or modelled score state creates pressure and the routine has to hold anyway',
        secondPassEvidence: 'Full transfer credit requires the learner to show how the decision changes as the score state changes. Playing, diagramming, or fully describing the sequence earns equal credit when it preserves that score-dependent decision evidence; a numeric result is not required.',
        topics: [
          'net/wall rallying: contact, control, and recovery position',
          'target activities: aim, consistency, and routine',
          'striking and fielding: contact mechanics and reading the object',
          'accuracy under a small amount of pressure',
          'reading an opponent or a target situation',
          'choosing an activity in this family worth continuing',
        ],
        performanceTask:
          'Show competence in one activity from each of the three categories and explain what each demanded that the others did not.',
        materials: ['wall or net substitute', 'ball, racket, or striking implement or substitute', 'safe targets'],
        adapted:
          'Distances, implement size, object speed, and target size are all learner-set. Seated and one-handed versions of every activity are provided, and a learner may substitute a self-designed activity that meets the same category description.',
        inclusion:
          'Equipment substitutions from household items are expected and never treated as a lesser version of the task.',
        guardian: {
          equipment: 'Improvised implements and soft objects are acceptable; no purchase is required.',
          environment: 'Space with a usable wall or open area, clear of windows and breakables.',
          movement_hazards: 'Struck or thrown objects. Guardian confirms target direction and clear background before the unit.',
          supervision_note: 'Guardian approves any implement used for striking.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Fitness Literacy I: Training Principles Without Body Metrics',
        standards: [3, 2],
        essentialQuestion: 'What actually makes a body more capable, and how would I notice it?',
        secondPass: 'across a complete training-week plan populated with the learner’s real constraints or an equivalent privacy-safe scenario rather than a single worked example',
        secondPassEvidence: 'Full transfer credit requires day-by-day evidence across the complete week, including at least one adjustment to frequency, intensity, time, type, or recovery. Executing or fully modelling the week earns equal credit when the same planning and revision evidence is present.',
        topics: [
          'the health-related fitness components and what each one does',
          'overload, progression, specificity, reversibility, and recovery',
          'frequency, intensity, time, and type as design levers',
          'monitoring effort by feel, breath, and speech',
          'noticing capability change through what the learner can now do',
          'evaluating fitness claims and products critically',
        ],
        performanceTask:
          'Design a four-week progression for one self-chosen capability and state how progress will be recognized through tasks the learner can perform — never through weight, size, body composition, or appearance.',
        materials: ['course notebook or digital equivalent', 'open safe space'],
        adapted:
          'The chosen capability may be endurance, strength, mobility, coordination, balance, or a functional task; a learner with a medical restriction designs the progression inside that restriction with guardian input.',
        inclusion:
          'No fitness test battery, norm table, percentile, or peer comparison is used. Progress is defined by the learner’s own stated task.',
        guardian: {
          equipment: 'Bodyweight only unless the guardian supplies equipment.',
          environment: 'Clear indoor or outdoor space.',
          movement_hazards: 'Progressive loading. Guardian reviews the progression before it starts and confirms it fits any medical restriction.',
          supervision_note: 'Guardian confirms any medical restriction is respected; the course does not ask for the restriction’s diagnosis or details, only for what movement is allowed.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Rhythm, Dance, and Expressive Movement',
        standards: [1, 5, 2],
        essentialQuestion: 'What can movement say that words cannot?',
        secondPass: 'through a complete sequence in which the learner safely pauses when needed and recovers a lost count or interrupted phrase without restarting the evidence from the beginning',
        secondPassEvidence: 'Full transfer credit requires a complete sequence plus evidence of recovering the count or phrase after an interruption. Performing, notating, storyboarding, or fully describing the sequence earns equal credit, and a safety pause or rest is responsible completion rather than failure.',
        topics: [
          'beat, tempo, and phrasing',
          'locomotor and non-locomotor sequencing',
          'dance forms across cultures, treated with accuracy and respect',
          'composing an original short sequence',
          'refining a sequence through self-review',
          'movement as expression and as stress relief',
        ],
        performanceTask:
          'Compose, refine, and perform a short original movement sequence for an audience of one trusted adult, or describe and notate it in full if the learner prefers not to perform.',
        materials: ['music or rhythm source', 'open safe space', 'course notebook or digital equivalent'],
        adapted:
          'Sequences may be seated, small-range, hand-and-arm only, or built at any tempo. Notation, description, or storyboarding is an accepted alternative to performing.',
        inclusion:
          'No performance is recorded, filmed, photographed, or shown to any audience beyond one trusted adult, and the learner may decline to perform entirely without losing any credit.',
        guardian: {
          equipment: 'Music source only.',
          environment: 'Clear space with safe flooring.',
          movement_hazards: 'Turning, level changes, and travel. Learner sets range and tempo.',
          supervision_note: 'Guardian confirms who, if anyone, watches; the default is no audience.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Individual and Dual Lifetime Activities',
        standards: [1, 5, 3],
        essentialQuestion: 'Which activities would I still be doing at thirty?',
        secondPass: 'through a safe trial when available or a full no-cost or no-equipment trial simulation in the learner’s own setting, with their real access constraints applying',
        secondPassEvidence: 'Full transfer credit requires applying the learner’s actual access, cost, equipment, location, and time constraints and recording the resulting choice or adjustment. A safe trial or fully modelled trial earns equal credit when it preserves all of that decision evidence.',
        topics: [
          'walking, hiking, cycling, and self-paced endurance activity',
          'strength, mobility, and bodyweight practice',
          'yoga, stretching, and mindful movement',
          'racket, throwing, and precision activities for two',
          'access: cost, equipment, location, and time as real constraints',
          'trialing an activity honestly before judging it',
        ],
        performanceTask:
          'Trial three individual or dual activities, evaluate each against enjoyment, access, cost, and sustainability, and justify which one is worth continuing.',
        materials: ['whatever the trialed activities require; free and household options are always offered', 'course notebook or digital equivalent'],
        adapted:
          'Every activity family includes a seated, low-impact, indoor, and zero-cost option, and a learner may design a substitute activity that meets the same description.',
        inclusion:
          'Activity choice is the learner’s. No activity is required that the household cannot access or afford.',
        guardian: {
          equipment: 'Varies by chosen activity; free options are always available.',
          environment: 'Guardian approves any location outside the home.',
          movement_hazards: 'Varies by activity. Guardian approves each trialed activity and its location before it begins.',
          supervision_note: 'Guardian decides supervision level for any activity away from home.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Outdoor and Community Activity Foundations',
        standards: [3, 5, 4],
        essentialQuestion: 'What does it take to be active outside safely and repeatedly?',
        secondPass: 'through a guardian-approved outdoor, home-yard, or indoor route scenario where changing weather, terrain, or timing requires the plan to be revised without compromising safety',
        secondPassEvidence: 'Full transfer credit requires a route plan, a realistic adverse condition, a safe revision, and the reason for that revision. Completing or fully modelling an approved outdoor, home-yard, or indoor scenario earns equal credit when those same planning decisions are evidenced.',
        topics: [
          'weather, terrain, daylight, and clothing decisions',
          'route planning and telling someone where you are going',
          'hydration, fuel, and pacing for longer outdoor activity',
          'trail, road, and shared-space etiquette',
          'environmental care and leave-no-trace practice',
          'finding free public activity spaces in a community',
        ],
        performanceTask:
          'Plan and complete one guardian-approved outdoor activity, including the safety plan, and produce a map of free activity spaces reachable from home.',
        materials: ['weather-appropriate clothing', 'water', 'course notebook or digital equivalent'],
        adapted:
          'Distance, duration, terrain, and pace are learner-set. An indoor or home-yard equivalent is available in full for any learner for whom outdoor activity is unsafe, inaccessible, or not approved.',
        inclusion:
          'The community-space map is built from public information; the learner never records their own route, precise location, or a photograph of themselves.',
        guardian: {
          equipment: 'Weather-appropriate clothing and water.',
          environment: 'Outdoor location approved by the guardian, or the indoor equivalent.',
          movement_hazards: 'Traffic, terrain, weather, heat, cold, and sun exposure. Guardian approves the location, route, duration, and supervision before the activity.',
          supervision_note: 'Guardian decides whether the learner is accompanied. No precise location is stored by the course.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Responsible Participation, Inclusion, and Etiquette',
        standards: [4, 2, 5],
        essentialQuestion: 'What makes an activity one that people actually want to come back to?',
        secondPass: 'through a live activity when people are safely available or a written, diagrammed, or rehearsed scenario that requires the same in-the-moment inclusion or conflict decision',
        secondPassEvidence: 'Full transfer credit requires identifying the unplanned inclusion or conflict cue, choosing an immediate response, and explaining its effect. Live participation, writing, diagramming, or rehearsal earns equal credit when it preserves that decision evidence.',
        topics: [
          'safety responsibility toward yourself and others',
          'rules, officiating basics, and honest self-calling',
          'winning and losing without changing how you treat people',
          'designing for inclusion rather than adding it afterward',
          'giving and receiving feedback about performance, never about bodies',
          'conflict during activity and how to resolve it',
        ],
        performanceTask:
          'Redesign a standard activity so that three people with different mobility, experience, and confidence profiles can all participate meaningfully in the same game, and defend each design choice.',
        materials: ['course notebook or digital equivalent', 'equipment from any earlier unit'],
        adapted:
          'The redesign may be written, diagrammed, described aloud, or trialed practically. Practical trial is optional.',
        inclusion:
          'This unit makes inclusive design an assessed competency in its own right rather than an accommodation applied to someone else.',
        guardian: {
          equipment: 'Reuses equipment from earlier units.',
          environment: 'Indoor study space; practical trial optional.',
          movement_hazards: 'None required.',
          supervision_note: 'No additional supervision needed for the written redesign.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Grade 9 Capstone: Personal Movement Portfolio',
        standards: [1, 2, 3, 4, 5],
        essentialQuestion: 'What can I now do, and what am I choosing to carry forward?',
        secondPass: 'assembled into the portfolio itself and defended against a question the learner did not prepare for',
        topics: [
          'assembling evidence across all activity categories',
          'self-assessment against stated criteria rather than against others',
          'explaining a tactical or training principle in the learner’s own words',
          'documenting progress by capability, never by body',
          'choosing Grade 10 activity directions and justifying the choice',
          'reviewing the safety and stop-rule plan against a year of use',
        ],
        performanceTask:
          'Assemble and present the portfolio to one trusted adult: category evidence, a training principle explained, the revised safety plan, and a justified plan for Grade 10.',
        materials: ['the year’s course notebook or digital equivalent'],
        adapted:
          'Presentation may be spoken one-to-one, written, or submitted as an annotated document. No recording, video, photograph, or audience beyond one adult is required.',
        inclusion:
          'Portfolio evidence is described in words; no photographic or video proof of any performance is requested or accepted as a requirement.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor space for a one-to-one review.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian acts as reviewer. The review is a conversation, not a recorded artifact.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 10,
    courseId: 'ma-g10-physical-education',
    level: 1,
    title: 'Grade 10 Physical Education',
    days: 108,
    focusStatement:
      'Completes LEVEL 1 by moving from performing a skill to analyzing and directing it: the learner refines technique from self-observation, plays with intent, and writes the first training program they own.',
    description:
      'A Grade 10 physical-education course completing the Michigan K-12 Physical Education Standards LEVEL 1 expectations. It develops movement analysis and refinement, tactical decision making across activity categories, self-designed training programs, recovery and injury prevention, adapted and alternative activity options, movement composition, and cooperative leadership. No body size, weight, body composition, or appearance is measured or scored; no photograph, video, or voice recording is required; no public performance is required.',
    capstone:
      'A personal activity plan and LEVEL 1 transition file: a self-analyzed skill refinement, a self-designed training block with its review, and a justified LEVEL 2 specialization proposal.',
    units: [
      {
        title: 'Movement Analysis and Skill Refinement',
        standards: [1, 2],
        essentialQuestion: 'How do I find the flaw in my own movement without anyone filming me?',
        secondPass: 'applied to a movement the learner has never analysed before, diagnosed and corrected inside a single session',
        topics: [
          'critical features of a movement and what each contributes',
          'self-observation by feel, mirror, shadow, and outcome pattern',
          'diagnosing from the result rather than from an image',
          'targeted correction and the practice design that fixes it',
          'transfer of a corrected pattern into an activity',
          'plateaus and what to change when progress stops',
        ],
        performanceTask:
          'Choose one skill, identify its critical features, diagnose the learner’s own limiting feature from outcome evidence, design and run the corrective practice, and document the change.',
        materials: ['equipment for the chosen skill or a substitute', 'optional mirror', 'course notebook or digital equivalent'],
        adapted:
          'Any skill the learner can perform, in any range or position, is a valid choice, including a mobility-aid skill or a seated skill. Analysis may be described, drawn, or tabled.',
        inclusion:
          'No video or photograph is required, requested, or used for analysis; self-observation and outcome evidence are the intended method, not a fallback.',
        guardian: {
          equipment: 'Equipment for the chosen skill; substitutes are always acceptable.',
          environment: 'Space appropriate to the chosen skill.',
          movement_hazards: 'Repeated practice of one pattern. Learner applies the stop rule and varies practice to avoid overuse.',
          supervision_note: 'Guardian approves the chosen skill and the practice space.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Tactics and Strategy in Invasion Activities',
        standards: [2, 1, 4],
        essentialQuestion: 'How do you win space before you win the ball?',
        secondPass: 'against an opponent who adjusts in response, so the first plan stops working and a second has to be found mid-activity',
        topics: [
          'principles of attack: penetration, support, width, mobility',
          'principles of defense: delay, depth, balance, concentration',
          'reading a situation and choosing between options',
          'set situations and rehearsed starts',
          'communicating intent quickly and clearly',
          'adjusting tactics when the plan is not working',
        ],
        performanceTask:
          'Analyze a described game situation, propose two tactical solutions with their tradeoffs, then apply one in play or in a solo simulation and evaluate the result.',
        materials: ['ball or substitute', 'markers for boundaries', 'open safe space', 'course notebook or digital equivalent'],
        adapted:
          'Tactical understanding may be demonstrated through play, walk-through pace, a tabletop or diagram simulation, or written analysis; each route reaches the same standard.',
        inclusion:
          'A learner with no other participants completes the unit fully through solo simulation and analysis.',
        guardian: {
          equipment: 'Ball or soft substitute; improvised markers.',
          environment: 'Open space clear of hazards.',
          movement_hazards: 'Running and changes of direction; no person-to-person contact is required.',
          supervision_note: 'Guardian confirms space and any second participant.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Tactics in Net/Wall, Striking/Fielding, and Target Activities',
        standards: [2, 1, 5],
        essentialQuestion: 'How do you make an opponent or a target problem easier before you solve it?',
        secondPass: 'across a full played or modelled contest where selection and risk have to change as the score state changes',
        secondPassEvidence: 'Full transfer credit requires decisions from the beginning, middle, and end of the contest and an explanation of how score state changed selection or risk. Playing, diagramming, or fully describing the contest earns equal credit when it preserves that complete tactical evidence; a numeric result is not required.',
        topics: [
          'creating and exploiting space across a net',
          'shot selection and risk management',
          'striking and fielding placement, positioning, and anticipation',
          'target activities: routine, consistency, and pressure management',
          'scoring systems and how they change optimal strategy',
          'self-scouting: knowing your own tendencies',
        ],
        performanceTask:
          'Build a tactical profile for one activity — strengths, tendencies, and the two adjustments most likely to improve results — then test it and revise.',
        materials: ['wall, net, or target setup', 'implement or substitute', 'course notebook or digital equivalent'],
        adapted:
          'Court size, target distance, implement, and object speed are learner-set. Seated, one-handed, and reduced-range versions are provided for every activity.',
        inclusion:
          'A learner may substitute a self-designed activity in the same category and is assessed on the same tactical reasoning.',
        guardian: {
          equipment: 'Improvised implements and soft objects are acceptable.',
          environment: 'Space with a usable wall or open area, clear background.',
          movement_hazards: 'Struck or thrown objects; guardian confirms clear direction and background.',
          supervision_note: 'Guardian approves any striking implement.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Fitness Literacy II: Designing a Personal Program',
        standards: [3, 2, 5],
        essentialQuestion: 'Can I write a program that I would actually finish?',
        secondPass: 'applied to the learner’s own program while it is running, revised from what actually happened rather than from what was planned',
        topics: [
          'setting a capability goal that is specific and testable by task',
          'building a weekly structure around real constraints',
          'sequencing sessions and balancing hard and easy days',
          'progressing safely and recognizing when to hold',
          'adherence: what makes a program survive a bad week',
          'reviewing and revising a program mid-cycle',
        ],
        performanceTask:
          'Write, run, and review a six-week personal program built around a self-chosen capability goal, documenting one mid-cycle revision and its reason.',
        materials: ['course notebook or digital equivalent', 'open safe space; equipment optional'],
        adapted:
          'Goals may be endurance, strength, mobility, balance, coordination, skill, or a functional task; any medical restriction is designed around with guardian input.',
        inclusion:
          'No fitness test, norm table, percentile, body measurement, or comparison to another person is used at any point. Success is the goal task, performed.',
        guardian: {
          equipment: 'Bodyweight only unless the guardian supplies equipment.',
          environment: 'Clear indoor or outdoor space.',
          movement_hazards: 'Progressive loading over six weeks. Guardian reviews the program before it starts and reviews the mid-cycle revision.',
          supervision_note: 'Guardian confirms the program respects any medical restriction; the course asks only what movement is allowed, never the underlying condition.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Recovery, Sleep, Hydration, and Injury Prevention',
        standards: [3, 4],
        essentialQuestion: 'Why does what I do between sessions decide what happens in them?',
        secondPass: 'tracked across a real week that includes at least one bad night or missed session, and adjusted rather than abandoned',
        topics: [
          'recovery as part of training rather than a reward for it',
          'sleep and its effect on coordination, mood, and injury risk',
          'hydration and fuelling around activity, without diets or calorie counts',
          'warning signs of overuse and under-recovery',
          'common activity injuries and how they are prevented',
          'returning after illness or injury on a graded plan',
        ],
        performanceTask:
          'Build a recovery protocol for the learner’s own program, including the specific signals that will trigger a reduced or rest day, and a graded return-to-activity plan.',
        materials: ['course notebook or digital equivalent'],
        adapted:
          'The protocol may be written, tabled, or described; a learner managing a condition builds the protocol with guardian input around the constraints they already have.',
        inclusion:
          'No sleep log, wearable data, heart-rate export, weight, or body measurement is requested or recorded. Signals are described in the learner’s own words.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None required.',
          supervision_note: 'Guardian reviews the return-to-activity plan and decides when a clinician should be involved instead. The course does not diagnose injuries.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Aquatics, Alternative, and Adapted Activity Options',
        standards: [1, 5, 4],
        essentialQuestion: 'What does an activity look like when it is designed for a different body than mine?',
        secondPass: 'by taking an activity the learner already does and redesigning it for a body or an access situation that is not their own',
        topics: [
          'water safety and aquatic activity where access exists',
          'adapted and parasport activity forms',
          'alternative activities: climbing, martial arts, skating, and others',
          'equipment adaptation and rule modification',
          'access barriers: cost, transport, facility, and staffing',
          'trying an activity form that is unfamiliar and reflecting honestly',
        ],
        performanceTask:
          'Trial two activity forms new to the learner — at least one adapted or alternative form — and produce an access analysis identifying what would make each sustainable.',
        materials: ['varies by activity; a no-cost, no-facility option is always provided', 'course notebook or digital equivalent'],
        adapted:
          'Aquatics is optional and always substitutable; no learner is required to enter water. Every activity form has a dry-land, indoor, and zero-cost alternative.',
        inclusion:
          'Adapted sport is taught as an activity form in its own right, not as a lesser substitute, and the learner trials it regardless of their own mobility profile.',
        guardian: {
          equipment: 'Varies; free options always available. Aquatics only where the family already has safe, supervised access.',
          environment: 'Guardian approves every location, and approves aquatic activity separately if it is chosen.',
          movement_hazards: 'Water risk if aquatics is elected; otherwise varies by chosen activity. Aquatic activity requires guardian-arranged supervision by a competent adult.',
          supervision_note: 'Guardian explicitly approves or declines the aquatic option; declining it does not reduce the unit.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Dance, Rhythm, and Movement Composition',
        standards: [1, 5, 2],
        essentialQuestion: 'How do I build a sequence that says something and still works as movement?',
        secondPass: 'in a longer sequence built across several sessions and refined from the learner’s own review rather than from instruction',
        topics: [
          'composition: motif, development, repetition, and contrast',
          'space, time, weight, and flow as movement qualities',
          'dance forms across cultures, treated accurately and respectfully',
          'building a longer sequence with structure',
          'refining through self-review and adult feedback',
          'movement as expression, stress relief, and social activity',
        ],
        performanceTask:
          'Compose, refine, and document a structured movement sequence, then present it to one trusted adult or submit a complete written or notated description instead.',
        materials: ['music or rhythm source', 'open safe space', 'course notebook or digital equivalent'],
        adapted:
          'Sequences may be seated, small-range, hand-and-arm only, or built at any tempo. Notation, storyboard, or written description is a full alternative to performing.',
        inclusion:
          'No performance is filmed, photographed, recorded, or shown beyond one trusted adult, and the learner may decline to perform without losing credit.',
        guardian: {
          equipment: 'Music source only.',
          environment: 'Clear space with safe flooring.',
          movement_hazards: 'Turning, level changes, travel; learner sets range and tempo.',
          supervision_note: 'Guardian confirms who, if anyone, watches; the default is no audience.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Cooperation, Leadership, and Officiating',
        standards: [4, 2, 5],
        essentialQuestion: 'How do you run an activity so that everyone in it stays safe and wants to return?',
        secondPass: 'by leading one safely available participant or rehearsing a complete written leadership plan that resolves the same disagreement or mixed-ability problem',
        secondPassEvidence: 'Full transfer credit requires the opening directions, adaptation, feedback, conflict response, and stop signal for the segment. Live leadership or a complete written and rehearsed plan earns equal credit when it preserves each leadership decision; leading a group is not required.',
        topics: [
          'leading a warm-up or activity segment for others',
          'officiating basics: rules, positioning, and consistent judgement',
          'giving feedback about performance and never about bodies',
          'managing a disagreement during activity',
          'organizing an activity that includes mixed abilities by design',
          'reflecting on leadership honestly',
        ],
        performanceTask:
          'Plan and lead one activity segment for at least one other person, or produce a complete leadership plan with a self-run rehearsal if no other participants are available, then evaluate it against inclusion and safety criteria.',
        materials: ['equipment from earlier units', 'course notebook or digital equivalent'],
        adapted:
          'Leading may be done in person, by written plan, or by talking a single participant through the segment. Leading a group is never required.',
        inclusion:
          'Feedback language is explicitly constrained to performance and effort; commenting on a participant’s body, size, or appearance is taught as a failure of the leadership standard.',
        guardian: {
          equipment: 'Reuses earlier equipment.',
          environment: 'Space appropriate to the planned segment.',
          movement_hazards: 'Depends on the planned segment; the leader is responsible for the safety check.',
          supervision_note: 'Guardian approves the segment plan and any participants involved.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Grade 10 Capstone: Personal Activity Plan and LEVEL 1 Transition',
        standards: [1, 2, 3, 4, 5],
        essentialQuestion: 'What have I built that is worth specializing in?',
        secondPass: 'consolidated into the LEVEL 1 portfolio and defended, including the standard the learner is weakest in',
        topics: [
          'consolidating two years of LEVEL 1 evidence',
          'self-assessment against the five standards',
          'identifying the strongest and weakest of the five for the learner',
          'choosing a LEVEL 2 specialization direction and justifying it',
          'planning access, equipment, and time for that direction',
          'setting the safety and self-management rules that carry forward',
        ],
        performanceTask:
          'Present a LEVEL 1 completion file and a justified LEVEL 2 specialization proposal to one trusted adult, and revise the proposal after critique.',
        materials: ['the Grade 9 and Grade 10 portfolios'],
        adapted:
          'Presentation may be spoken one-to-one, written, or submitted as an annotated document. No recording, photograph, or audience beyond one adult is required.',
        inclusion:
          'Evidence is described in words; no photographic or video proof of performance is requested or accepted as a requirement.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor space for a one-to-one review.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian acts as reviewer. The review is a conversation, not a recorded artifact.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 11,
    courseId: 'ma-g11-physical-education',
    level: 2,
    title: 'Grade 11 Physical Education',
    days: 108,
    focusStatement:
      'Opens LEVEL 2: the learner stops receiving a program and starts running one, choosing specializations, periodizing their own training, and taking responsibility for other people’s experience of an activity.',
    description:
      'A Grade 11 physical-education course on the Michigan K-12 Physical Education Standards LEVEL 2 (advanced/elective) expectations. It develops self-directed program design and periodization, two chosen activity specializations, advanced tactical understanding, movement quality and technique, outdoor and community recreation planning, inclusive leadership and event design, and movement for stress management. No body size, weight, body composition, or appearance is measured or scored; no photograph, video, or voice recording is required; no public performance is required.',
    capstone:
      'A LEVEL 2 portfolio: a periodized training cycle with its evidence and revisions, two specialization records, and a facilitated inclusive activity with its design rationale.',
    units: [
      {
        title: 'Self-Directed Program Design and Periodization',
        standards: [3, 2, 5],
        essentialQuestion: 'How do I plan a season rather than a week?',
        secondPass: 'applied to the learner’s own multi-week cycle as it runs, with at least one planned review point actually acted on',
        topics: [
          'planning across a longer horizon with phases',
          'balancing development, maintenance, and recovery blocks',
          'managing competing demands: school, work, and activity',
          'deload and taper concepts in plain terms',
          'building in review points and objective decision rules',
          'adapting a plan when circumstances change',
        ],
        performanceTask:
          'Design a full periodized cycle for a self-chosen capability or activity goal, including phase structure, review points, and pre-committed rules for when to progress, hold, or deload.',
        materials: ['course notebook or digital equivalent', 'space and equipment appropriate to the chosen goal'],
        adapted:
          'Goals may be endurance, strength, mobility, skill, coordination, or a functional task; any medical restriction is planned around with guardian input.',
        inclusion:
          'No body measurement, composition estimate, weight, or appearance target appears in the plan or its review. Phase success is defined by task performance.',
        guardian: {
          equipment: 'Depends on the chosen goal; bodyweight and free options are always viable.',
          environment: 'Space appropriate to the goal.',
          movement_hazards: 'Sustained progressive training. Guardian reviews the full cycle before it begins and at each review point.',
          supervision_note: 'Guardian confirms the plan respects any medical restriction; the course asks only what movement is allowed.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Specialization Pathway A',
        standards: [1, 2, 5],
        essentialQuestion: 'What does real depth in one activity actually require?',
        secondPass: 'sustained across a block long enough for the novelty to wear off, where practice has to continue without motivation',
        topics: [
          'selecting a specialization on interest, access, and sustainability',
          'the technical model for the chosen activity',
          'deliberate practice design for one activity',
          'measuring progress by task, not by body',
          'the knowledge base of the activity: rules, culture, and history',
          'plateau, boredom, and how depth is sustained',
        ],
        performanceTask:
          'Run a documented development block in the chosen specialization: technical model, practice design, evidence of change, and an honest evaluation of what did not improve.',
        materials: ['equipment for the chosen specialization or a substitute', 'course notebook or digital equivalent'],
        adapted:
          'Any activity the learner can access and perform is a valid specialization, including adapted sport, seated activity, and self-designed movement practice.',
        inclusion:
          'Specialization is chosen by the learner, never assigned, and no activity is required that the household cannot access or afford.',
        guardian: {
          equipment: 'Depends on the chosen activity; substitutes and free options are acceptable.',
          environment: 'Guardian approves the practice location.',
          movement_hazards: 'Depends on the activity; guardian approves the specialization and its risk profile before the block begins.',
          supervision_note: 'Guardian sets supervision level for the chosen activity.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Specialization Pathway B',
        standards: [1, 2, 5],
        essentialQuestion: 'What transfers between two very different activities, and what does not?',
        secondPass: 'run alongside the first specialization, where the two goals compete for the same time and the same recovery',
        topics: [
          'choosing a second activity deliberately unlike the first',
          'the technical model for the second activity',
          'transfer: what carried over and what had to be relearned',
          'managing two development goals without overloading',
          'comparing the two activities on sustainability and access',
          'deciding which to carry into Grade 12',
        ],
        performanceTask:
          'Run a second documented development block in a contrasting activity and write a transfer analysis explaining what carried across from Pathway A and what did not.',
        materials: ['equipment for the second activity or a substitute', 'course notebook or digital equivalent'],
        adapted:
          'Contrast may be in category, environment, pace, or social structure; a learner with limited access chooses two contrasting home-based activities.',
        inclusion:
          'A learner may complete both pathways entirely at home with no purchased equipment.',
        guardian: {
          equipment: 'Depends on the chosen activity; substitutes and free options are acceptable.',
          environment: 'Guardian approves the practice location.',
          movement_hazards: 'Depends on the activity; guardian approves the second specialization and its risk profile.',
          supervision_note: 'Guardian confirms combined training load across both pathways is reasonable.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Advanced Tactics and Game Sense',
        standards: [2, 1, 4],
        essentialQuestion: 'How do experienced players decide faster than they can think?',
        secondPass: 'through a constraint-led practice the learner designs and either coaches to an available participant or fully simulates with a diagram and written coaching script',
        secondPassEvidence: 'Full transfer credit requires the designed constraint, the tactical decision it is meant to produce, the coaching cue, and a success check. Live coaching or a full solo simulation earns equal credit when it preserves all four pieces of evidence.',
        topics: [
          'pattern recognition and anticipation',
          'decision speed under constraint',
          'constraints-led practice design',
          'scouting an opponent or a problem honestly',
          'in-activity adjustment and its limits',
          'coaching a tactical idea to someone else',
        ],
        performanceTask:
          'Design a constraints-led practice that forces a specific tactical decision, run it, and evaluate whether the decision improved — then teach the idea to one other person or write the coaching script.',
        materials: ['equipment for the chosen activity', 'course notebook or digital equivalent'],
        adapted:
          'Practice may be run live, walked through, simulated on paper, or modelled on a diagram; the tactical reasoning is what is assessed.',
        inclusion:
          'A solo learner completes the unit fully through simulation and a written coaching script.',
        guardian: {
          equipment: 'Reuses specialization equipment.',
          environment: 'Space appropriate to the chosen activity.',
          movement_hazards: 'Depends on the activity; no person-to-person contact is required.',
          supervision_note: 'Guardian approves any second participant.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Strength, Mobility, and Movement Quality',
        standards: [3, 1],
        essentialQuestion: 'How do I make a movement better before I make it heavier or faster?',
        secondPass: 'programmed into the learner’s live plan and progressed across sessions, including one hold or regression made deliberately',
        topics: [
          'technique before load: sequencing a progression',
          'joint range, control, and mobility work',
          'core and postural control in real movement',
          'progressive loading with bodyweight or available equipment',
          'recognizing technique breakdown and stopping the set',
          'programming strength and mobility into a wider plan',
        ],
        performanceTask:
          'Build a technique-first strength and mobility progression, document the criteria for advancing each movement, and show a completed progression with the criteria met.',
        materials: ['open safe space', 'optional household or gym equipment', 'course notebook or digital equivalent'],
        adapted:
          'Every movement has a seated, supported, reduced-range, and unloaded version. Advancement criteria are set by control and range, never by load lifted relative to any other person.',
        inclusion:
          'No one-rep-max testing, strength norm table, body-composition estimate, or body measurement is used. This unit never compares the learner to anyone.',
        guardian: {
          equipment: 'Bodyweight sufficient; any equipment is guardian-supplied and approved.',
          environment: 'Clear space with safe flooring.',
          movement_hazards: 'Progressive loading and joint range work. Guardian reviews the progression and approves any external load before it is used.',
          supervision_note: 'Guardian decides whether loaded work is supervised; the stop rule governs every session.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Outdoor, Adventure, and Community Recreation Planning',
        standards: [5, 3, 4],
        essentialQuestion: 'How do I plan an activity that is genuinely worth the effort of getting there?',
        secondPass: 'through a guardian-approved outdoor, home-area, or indoor outing scenario where a realistic contingency is triggered and the plan changes without becoming unsafe',
        secondPassEvidence: 'Full transfer credit requires the original plan, a realistic contingency, a safe change, and the reason the revised activity remains viable. Completing or fully modelling an approved outdoor, home-area, or indoor scenario earns equal credit when those same decisions are evidenced.',
        topics: [
          'planning a longer or more demanding outdoor activity',
          'risk assessment for an unfamiliar environment',
          'navigation, communication, and contingency planning',
          'group planning and shared responsibility',
          'cost, transport, permits, and access realities',
          'environmental stewardship and shared-space responsibility',
        ],
        performanceTask:
          'Produce a complete plan for one guardian-approved outdoor or community activity — risk assessment, logistics, contingency, and stewardship — and carry it out if approved, or complete the equivalent local or indoor version.',
        materials: ['weather-appropriate clothing', 'water', 'maps or route information', 'course notebook or digital equivalent'],
        adapted:
          'Scale, distance, terrain, and duration are learner-set. A full indoor or home-area equivalent is available for any learner for whom the outdoor activity is unsafe, inaccessible, or not approved.',
        inclusion:
          'Route information is planning material only; the learner never records their own precise location, live tracking, or a photograph of themselves.',
        guardian: {
          equipment: 'Weather-appropriate clothing, water, and any activity-specific safety equipment.',
          environment: 'Guardian approves the location and the plan in full before execution.',
          movement_hazards: 'Terrain, weather, heat, cold, water, traffic, and remoteness depending on the plan. Guardian approves or vetoes each element and sets the supervision arrangement.',
          supervision_note: 'Nothing in this unit is executed without explicit guardian approval of the specific plan.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Leadership, Coaching, and Inclusive Event Design',
        standards: [4, 2, 5],
        essentialQuestion: 'How do I design an activity where the least confident person present has a good time?',
        secondPass: 'through a live session for safely available participants or a complete plan with a rehearsed walk-through, evaluated against the same inclusion and enjoyment criteria',
        secondPassEvidence: 'Full transfer credit requires the session plan, access choices, feedback language, an in-session adaptation, and evaluation against the least-confident participant profile. A live session or complete rehearsed walk-through earns equal credit when it preserves all of that event-design evidence.',
        topics: [
          'coaching a skill to someone at a different level',
          'designing an event for genuinely mixed abilities',
          'safety planning and responsibility as an organizer',
          'inclusive language, format, and scoring choices',
          'handling conflict, dropout, and unexpected constraints',
          'evaluating an event against inclusion rather than turnout',
        ],
        performanceTask:
          'Design and facilitate one small inclusive activity session, then evaluate it against stated inclusion and safety criteria and revise the design.',
        materials: ['equipment appropriate to the designed session', 'course notebook or digital equivalent'],
        adapted:
          'The session may be run for one person, for a household group, or delivered as a complete plan with a rehearsed walk-through if no participants are available.',
        inclusion:
          'The session must be designed so participation is possible without disclosing any health information, without being photographed, and without performing in front of spectators.',
        guardian: {
          equipment: 'Depends on the designed session.',
          environment: 'Guardian approves the venue and any participants.',
          movement_hazards: 'Depends on the session; the learner produces the safety plan and the guardian approves it before delivery.',
          supervision_note: 'Guardian approves who participates and supervises any session involving people outside the household.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Stress Management, Mental Skills, and Movement',
        standards: [5, 3, 4],
        essentialQuestion: 'What does movement do for a difficult week, and what does it not do?',
        secondPass: 'applied across a genuinely demanding stretch of the learner’s own term, evaluated honestly including where it did not help',
        topics: [
          'movement as a regulation tool and its realistic limits',
          'attention, arousal, and performance under pressure',
          'routines, breathing, and refocusing techniques',
          'motivation, discipline, and what to do when both are gone',
          'the difference between healthy commitment and compulsive activity',
          'when a difficulty needs support beyond movement',
        ],
        performanceTask:
          'Build a movement-and-regulation toolkit with a routine for a good week, a routine for a hard week, and a written statement of when the learner would seek support beyond movement.',
        materials: ['course notebook or digital equivalent', 'open space'],
        adapted:
          'Every technique has a seated, still, low-intensity, and silent version; the learner selects what their body and setting allow.',
        inclusion:
          'No mood scale, symptom checklist, diagnosis, screening score, or private reflection is requested or recorded. This course does not diagnose and does not assess mental-health status.',
        guardian: {
          equipment: 'None.',
          environment: 'Quiet space with a break area available.',
          movement_hazards: 'Low; learner-paced throughout.',
          supervision_note: 'Unit names compulsive-exercise warning signs and directs concerns to a guardian or clinician. Guardian reviews the support statement.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Grade 11 Capstone: LEVEL 2 Portfolio',
        standards: [1, 2, 3, 4, 5],
        essentialQuestion: 'What can I now direct on my own, and what still needs someone else?',
        secondPass: 'defended under questioning, including the part of the cycle that failed',
        topics: [
          'assembling periodization, specialization, and leadership evidence',
          'self-assessment against LEVEL 2 expectations',
          'evaluating the cycle honestly, including what failed',
          'identifying remaining dependencies on adult direction',
          'setting the Grade 12 independence goal',
          'defending design choices under questioning',
        ],
        performanceTask:
          'Present the LEVEL 2 portfolio to one trusted adult, defend the design choices in the training cycle and the facilitated session, and revise the Grade 12 plan after critique.',
        materials: ['the year’s portfolio'],
        adapted:
          'Presentation may be spoken one-to-one, written, or submitted as an annotated document. No recording, photograph, or audience beyond one adult is required.',
        inclusion:
          'Evidence is described in words; no photographic or video proof of performance is requested or accepted as a requirement.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor space for a one-to-one review.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian acts as reviewer. The review is a conversation, not a recorded artifact.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
  {
    grade: 12,
    courseId: 'ma-g12-physical-education',
    level: 2,
    title: 'Grade 12 Physical Education',
    days: 108,
    focusStatement:
      'Completes LEVEL 2 and the four-year arc by removing the school scaffold: the learner audits what will still be available to them after graduation and builds a movement life that survives without a course, a coach, or a facility.',
    description:
      'A Grade 12 physical-education course completing the Michigan K-12 Physical Education Standards LEVEL 2 (advanced/elective) expectations, oriented toward independent adult activity. It covers lifetime-activity auditing and transition planning, an independently run training cycle, access and cost realities, advanced specialization, movement for mental health, inclusive lifelong activity design, leadership facilitation, and self-care limits. No body size, weight, body composition, or appearance is measured or scored; no photograph, video, or voice recording is required; no public performance is required.',
    capstone:
      'An adult lifetime movement plan: a self-run training cycle with evidence, an access and cost plan that works on a real budget, an inclusive activity the learner facilitated, and a defended plan for the first year after high school.',
    units: [
      {
        title: 'Lifetime Activity Audit and Adult Transition Planning',
        standards: [5, 3, 4],
        essentialQuestion: 'Which of the things I do now will still be possible next year?',
        secondPass: 'tested against the learner’s actual post-graduation constraints, with the plan surviving the loss of school structure',
        topics: [
          'auditing current activities against post-graduation reality',
          'time, money, transport, facility, and social access after high school',
          'what disappears when school activity structures end',
          'activities that require nothing but space and time',
          'building a minimum viable activity week',
          'setting a realistic first-year activity commitment',
        ],
        performanceTask:
          'Audit every activity the learner currently does against post-graduation constraints, then design a minimum viable activity week that would survive the worst plausible version of next year.',
        materials: ['course notebook or digital equivalent', 'the Grade 9-11 portfolios'],
        adapted:
          'The audit may be written, tabled, or spoken. A learner whose next year is uncertain builds the plan against two or three scenarios instead of one.',
        inclusion:
          'No household income, address, or family financial detail is entered into course records; cost planning uses general figures the learner supplies at whatever precision they choose.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian discusses realistic post-graduation constraints with the learner; nothing financial is recorded by the course.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Independent Training Cycle: Plan, Execute, Adjust',
        standards: [3, 2, 5],
        essentialQuestion: 'Can I run a full cycle without anyone checking on me?',
        secondPass: 'carried independently through a guardian-approved cycle or a fully modelled cycle, with the pre-committed rules honoured rather than renegotiated at each stage',
        secondPassEvidence: 'Full transfer credit requires evidence from every stage of the cycle, including the pre-committed adjustment rules and the decision made at each review point. Executing or fully modelling the cycle earns equal credit when the complete decision record is present.',
        topics: [
          'planning a cycle the learner will run unsupervised',
          'self-monitoring by feel, performance, and adherence',
          'pre-committed rules for progressing, holding, and deloading',
          'diagnosing a stalled cycle',
          'adjusting mid-cycle without abandoning the plan',
          'honest evaluation, including of a cycle that did not work',
        ],
        performanceTask:
          'Run a complete self-directed training cycle end to end, documenting every adjustment and its reason, and write an honest evaluation of what worked and what did not.',
        materials: ['course notebook or digital equivalent', 'space and equipment appropriate to the goal'],
        adapted:
          'Goal, modality, and volume are the learner’s; any medical restriction is planned around with guardian input.',
        inclusion:
          'No weight, body composition, measurement, or appearance target appears anywhere in the cycle or its evaluation. Success is defined by the goal task and adherence.',
        guardian: {
          equipment: 'Depends on the goal; bodyweight and free options are always viable.',
          environment: 'Space appropriate to the goal.',
          movement_hazards: 'Sustained independent training. Guardian reviews the plan before it begins and remains the escalation point for pain, injury, or illness.',
          supervision_note: 'Independence is the learning target; guardian oversight of safety is not withdrawn.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Access, Cost, Facilities, and Community Resources',
        standards: [5, 4],
        essentialQuestion: 'What does it actually cost to stay active, and what costs nothing?',
        secondPass: 'costed against a real budget the learner sets, building an activity life at the lowest workable spend',
        topics: [
          'the real cost of gyms, clubs, leagues, and equipment',
          'free and low-cost public activity infrastructure',
          'contracts, memberships, and cancellation terms',
          'community, workplace, and campus activity options',
          'transport and time as the binding constraints',
          'building an activity life on a small budget',
        ],
        performanceTask:
          'Produce an access plan comparing at least three ways to stay active after graduation on different budgets, including one that costs nothing, and identify the failure point of each.',
        materials: ['course notebook or digital equivalent', 'publicly available facility and program information'],
        adapted:
          'The comparison may be written, tabled, or spoken; publicly available information is supplied if the learner cannot research independently.',
        inclusion:
          'No membership is purchased, no account is created, and no payment information is used. Household income is never requested or recorded.',
        guardian: {
          equipment: 'None. No purchase or signup is required at any point.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian approves any facility visit; the written comparison requires none.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Advanced Specialization and Personal Challenge',
        standards: [1, 2, 5],
        essentialQuestion: 'What would I like to be genuinely good at, and what will that cost me?',
        secondPass: 'carried through a safe attempt when available or a detailed simulation of the attempt, including a realistic setback and an honest evaluation afterwards',
        secondPassEvidence: 'Full transfer credit requires the goal, attempt plan, realistic setback, response, and evidence-based evaluation. A safe attempt or detailed simulation earns equal credit when it preserves every part of that challenge-and-revision evidence.',
        topics: [
          'setting a challenging but achievable personal goal',
          'the technical and physical demands the goal implies',
          'building the preparation the goal requires',
          'managing setbacks, illness, and interruption',
          'attempting the goal and evaluating the attempt',
          'deciding whether to continue, adjust, or change direction',
        ],
        performanceTask:
          'Set, prepare for, and attempt one significant personal movement challenge chosen by the learner, then evaluate both the attempt and the preparation that led to it.',
        materials: ['equipment appropriate to the chosen challenge', 'course notebook or digital equivalent'],
        adapted:
          'The challenge is defined entirely by the learner relative to their own current capability; any goal that is meaningful and safe for that learner qualifies.',
        inclusion:
          'The challenge is never a body-composition, weight, or appearance goal, is never compared to another person’s result, and is never required to be witnessed, filmed, or published.',
        guardian: {
          equipment: 'Depends on the challenge.',
          environment: 'Guardian approves the location and conditions.',
          movement_hazards: 'The challenge is the highest-demand task in the course. Guardian reviews and approves the goal, the preparation, and the attempt conditions before the attempt.',
          supervision_note: 'Guardian sets supervision for the attempt and may require it to be supervised or declined.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Movement for Mental Health and Sustainable Routine',
        standards: [5, 3],
        essentialQuestion: 'How do I keep moving through a year that gives me every reason not to?',
        secondPass: 'sustained through a low-motivation stretch using the smallest version of a session that still counts',
        topics: [
          'movement and mood: what the evidence supports and what it does not',
          'routine design for low-motivation periods',
          'the smallest version of a session that still counts',
          'social activity, accountability, and isolation',
          'compulsive activity, overtraining, and warning signs',
          'when to seek support beyond movement',
        ],
        performanceTask:
          'Design a sustainable activity routine with a full version, a minimum version, and a restart procedure, and state the warning signs that would prompt the learner to seek support.',
        materials: ['course notebook or digital equivalent'],
        adapted:
          'Every routine element has a low-intensity, seated, short-duration, and at-home version; the minimum version must be achievable on the learner’s worst realistic day.',
        inclusion:
          'No mood scale, symptom checklist, diagnosis, screening score, or private reflection is requested or recorded. This course does not diagnose.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          supervision_note: 'Unit names compulsive-exercise and overtraining warning signs and directs concerns to a guardian or clinician.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Adapted and Lifelong Inclusive Activity Design',
        standards: [4, 5, 2],
        essentialQuestion: 'How does an activity have to change to still be there at forty, or after an injury?',
        secondPass: 'by redesigning the learner’s own activity for age forty, for a changed capability, and for a mixed-age group',
        topics: [
          'activity across a lifespan and how demands change',
          'adapting an activity after injury, illness, or changed capability',
          'adapted sport and inclusive formats as durable options',
          'designing activity for a group with mixed ages and abilities',
          'the social side: finding people to be active with as an adult',
          'letting go of an activity without letting go of activity',
        ],
        performanceTask:
          'Take one activity the learner values and produce three adapted versions of it — for reduced mobility, for very limited time, and for a mixed-age group — with the reasoning for each.',
        materials: ['course notebook or digital equivalent'],
        adapted:
          'Adaptations may be written, diagrammed, described aloud, or trialed practically; practical trial is optional.',
        inclusion:
          'Adaptation is taught as the normal life cycle of an activity rather than as an accommodation granted to someone else.',
        guardian: {
          equipment: 'None required.',
          environment: 'Indoor study space; practical trial optional.',
          movement_hazards: 'None required.',
          supervision_note: 'No additional supervision needed for the written design.',
          guardian_confirmation_required: false,
        },
      },
      {
        title: 'Leadership Capstone: Facilitating an Inclusive Activity',
        standards: [4, 2, 5],
        essentialQuestion: 'Can I run something that other people leave better than they arrived?',
        secondPass: 'facilitated for one or more safely available participants or rehearsed as a complete facilitation plan, adapted in the moment when the plan meets a realistic access need, and evaluated on inclusion',
        secondPassEvidence: 'Full transfer credit requires the setup, directions, access choices, an in-the-moment adaptation, feedback, stop signal, and inclusion evaluation. Live facilitation or a complete rehearsed plan earns equal credit when it preserves each facilitation decision; group size is not scored.',
        topics: [
          'designing a session for a real group with real constraints',
          'safety planning and organizer responsibility',
          'inclusive format, language, and scoring decisions',
          'adapting live when the plan meets reality',
          'gathering feedback that is actually useful',
          'evaluating the session against inclusion, not turnout',
        ],
        performanceTask:
          'Design, deliver, and evaluate one inclusive activity session for a real group, or deliver it for one participant with a complete plan if a group is not available, and revise the design from feedback.',
        materials: ['equipment appropriate to the session', 'course notebook or digital equivalent'],
        adapted:
          'Group size is never a requirement; a session delivered to one person with a complete plan meets the standard fully.',
        inclusion:
          'The session must be designed so participation requires no health disclosure, no photography, no recording, and no performing in front of spectators.',
        guardian: {
          equipment: 'Depends on the session.',
          environment: 'Guardian approves the venue and every participant.',
          movement_hazards: 'Depends on the session; the learner produces the safety plan and the guardian approves it before delivery.',
          supervision_note: 'Guardian supervises any session involving people outside the household and decides whether it proceeds.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Safety, Self-Care, and Knowing When to Stop',
        standards: [3, 4],
        essentialQuestion: 'What does taking care of myself look like when no one is telling me to?',
        secondPass: 'built as a learner-managed protocol for a full training-block scenario, executed when guardian-approved or fully modelled, including a realistic stop decision and the required adult-escalation boundary',
        secondPassEvidence: 'Full transfer credit requires the complete block protocol, warning cue, stop decision, recovery boundary, and adult-escalation step. Guardian-approved execution, a table, or a full written or described model earns equal credit when all of that safety reasoning is present.',
        topics: [
          'the stop rule as an adult habit rather than a class instruction',
          'distinguishing training discomfort from warning pain',
          'illness, injury, and graded return without a coach',
          'sleep, fuel, and recovery as the base of any plan',
          'when to see a clinician and how to describe a problem',
          'building self-care into a plan instead of bolting it on',
        ],
        performanceTask:
          'Write the self-care and stop-rule protocol the learner will actually run as an adult, including the specific conditions under which they will stop, rest, or seek professional care.',
        materials: ['course notebook or digital equivalent'],
        adapted:
          'The protocol may be written, tabled, or described; a learner managing an ongoing condition builds it with guardian input around constraints they already have.',
        inclusion:
          'No body measurement, wearable export, sleep log, or health data is requested or recorded. The protocol is written in the learner’s own descriptive language.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor study space.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian reviews the protocol and confirms the household escalation path to a clinician. The course does not diagnose.',
          guardian_confirmation_required: true,
        },
      },
      {
        title: 'Capstone: Adult Lifetime Movement Plan and Defense',
        standards: [1, 2, 3, 4, 5],
        essentialQuestion: 'What is the plan I would still be running in a year, and can I defend every part of it?',
        secondPass: 'defended under questioning and then revised from the critique without abandoning the plan',
        topics: [
          'integrating four years of evidence into one working plan',
          'stating the reasoning behind each element',
          'the access, cost, and time plan that makes it real',
          'the review points and the conditions that trigger revision',
          'defending the plan under questioning',
          'revising after critique without abandoning the plan',
        ],
        performanceTask:
          'Present the adult lifetime movement plan to one trusted adult, defend every element with reasoning and evidence from the four-year portfolio, and produce a revised final version.',
        materials: ['the Grade 9-12 portfolios'],
        adapted:
          'The defense may be spoken one-to-one, written, presented as annotated slides, or delivered as a conversation. No public presentation, recording, or audience is required.',
        inclusion:
          'The plan is written so it can be reviewed without exposing anything private, and no recording of the defense is made.',
        guardian: {
          equipment: 'None.',
          environment: 'Indoor space for a one-to-one review.',
          movement_hazards: 'None expected.',
          supervision_note: 'Guardian acts as reviewer. The review is a conversation, not a recorded or published artifact.',
          guardian_confirmation_required: true,
        },
      },
    ],
  },
]
