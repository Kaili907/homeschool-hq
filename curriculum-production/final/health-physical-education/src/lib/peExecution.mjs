/**
 * Deterministic production-depth PE lesson families.
 *
 * The authored course records supply the grade, phase, focus, standards, and
 * protected source authority. This projection turns those records into a
 * runnable homeschool lesson without requiring a facility, purchase, group,
 * recording, body metric, or Tutor claim of physical completion.
 */

const REST_STOP_RULES = [
  'REST / ADJUST: You may pause, rest, reduce pace or range, use support, switch to an approved route, or finish for the day at any time. You may resume only when comfortable and the environment is safe. Rest and adaptation never reduce credit.',
  'STOP AND TELL: Stop immediately for pain, dizziness, unusual breathing difficulty, a head impact, an injury concern, damaged equipment, or an unsafe environment. Tell a trusted adult and do not continue to test the concern.',
  'DO NOT RESUME: After a head impact, an injury concern, or a symptom that persists or worsens, remain out until the authorized guardian or qualified professional says it is safe. A learner, browser, or Tutor cannot provide clearance.',
]

const TYPE_KEYS = [
  'MOVEMENT_CONCEPT_CUES',
  'SKILL_DEVELOPMENT',
  'TACTICS_DECISION_MAKING',
  'FITNESS_SELF_MANAGEMENT',
  'SAFETY_STOP_DECISION',
  'COOPERATIVE_CREATIVE_ACTIVITY',
  'REVIEW_RETRIEVAL',
  'REMEDIATION_RETRY',
  'MASTERY_PERFORMANCE',
  'PROJECT_LIFETIME_ACTIVITY',
]

const FAMILY_PLANS = {
  MOVEMENT_CONCEPT_CUES: {
    purpose: 'identify, model, and apply the target cue or movement concept',
    guided: 'Compare a supplied example with a non-example and name the one observable feature that changes.',
    independent: 'Apply the concept to a new example that was not used in the model.',
    evidencePurpose: 'knowledge, cue application, error analysis, and completion',
  },
  SKILL_DEVELOPMENT: {
    purpose: 'build the target movement from a controlled entry version to a fresh application',
    guided: 'Rehearse the start, action, and finish separately before joining them in one controlled whole.',
    independent: 'Use the complete cue sequence in a new learner-chosen safe variation.',
    evidencePurpose: 'safe participation, skill evidence, cue knowledge, and revision',
  },
  TACTICS_DECISION_MAKING: {
    purpose: 'read supplied information and choose a safe tactical response',
    guided: 'Name two available options, one constraint, and the cue that makes one option stronger.',
    independent: 'Solve a fresh arrangement without answer-bearing coaching and explain the choice.',
    evidencePurpose: 'decision quality, tactical reasoning, planning, and reflection',
  },
  FITNESS_SELF_MANAGEMENT: {
    purpose: 'plan and manage a learner-selected activity demand safely',
    guided: 'Choose the entry demand, one check, one rest option, and the single variable that may change.',
    independent: 'Build and use or describe a fresh bounded self-management sequence.',
    evidencePurpose: 'self-management, planning, safe participation, and reflection',
  },
  SAFETY_STOP_DECISION: {
    purpose: 'distinguish rest, stop-and-tell, and do-not-resume decisions',
    guided: 'Contrast a learner-chosen comfort break with a named warning sign or unsafe event.',
    independent: 'Classify a fresh fictional condition and state the action and return authority.',
    evidencePurpose: 'decision quality, safety knowledge, planning, and completion',
  },
  COOPERATIVE_CREATIVE_ACTIVITY: {
    purpose: 'create or communicate an inclusive activity response',
    guided: 'Model the role, consent or space rule, inclusive choice, and cue-based feedback separately.',
    independent: 'Create a fresh solo sequence or briefing that includes the same access and safety choices.',
    evidencePurpose: 'communication, inclusion, creative sequence, planning, and completion',
  },
  REVIEW_RETRIEVAL: {
    purpose: 'retrieve prior cues and combine them in a fresh variation',
    guided: 'Recall two named prior cues, re-model the less secure cue, and explain when each cue applies.',
    independent: 'Use the retrieved cues in a varied example with no new untaught movement.',
    evidencePurpose: 'retrieval, cue selection, varied application, and reflection',
  },
  REMEDIATION_RETRY: {
    purpose: 'repair one observable cue or decision with a different model',
    guided: 'Name the exact gap, simplify the setup, and contrast the original pattern with a different cue or representation.',
    independent: 'Use one bounded practice change and then a fresh retry rather than repeating the same attempt.',
    evidencePurpose: 'correction, cue use, fresh retry, and exit readiness',
  },
  MASTERY_PERFORMANCE: {
    purpose: 'supply fresh independent evidence of the taught target',
    guided: 'Review permitted support and one brief model before the independent evidence begins.',
    independent: 'Complete a fresh bounded application without answer-bearing coaching; receive feedback only after the evidence is supplied.',
    evidencePurpose: 'independent skill or decision evidence, safety, explanation, and completion',
  },
  PROJECT_LIFETIME_ACTIVITY: {
    purpose: 'build a bounded plan that transfers the target to an accessible setting',
    guided: 'Stage the access check, setup, safe simulation or description, evidence choice, and finish before combining the plan.',
    independent: 'Complete a fresh safe simulation or described plan with honest scope and guardian authority where required.',
    evidencePurpose: 'planning, decision quality, application, reflection, and completion',
  },
}

const CATEGORY_RULES = [
  {
    id: 'safety-stop-decision',
    pattern: /stop rule|warning sign|head impact|injur|knowing when to stop|safe return|emergency|hazard|risk management|self-care/i,
    centralType: 'SAFETY_STOP_DECISION',
    cues: ['NOTICE the supplied condition without diagnosing it.', 'PAUSE before choosing whether activity may continue.', 'ACT by resting or adjusting when safe, or by stopping and telling when a warning sign or unsafe event appears.', 'HOLD after an impact, injury concern, or persistent or worsening symptom until authorized clearance.'],
    model: {
      startingPosition: 'Begin with a supplied fictional situation and the three visible lanes REST / ADJUST, STOP AND TELL, and DO NOT RESUME.',
      action: 'Name the observable condition, choose the safer lane, state the next action, and identify who controls return.',
      keyCue: 'Warning sign or unsafe event? Stop first; tell next.',
      commonError: 'Continuing for one more attempt to see whether a warning sign settles.',
      correction: 'Do not test a concern by continuing. Stop and hand the decision to the authorized adult.',
      notice: 'Notice the condition and authority boundary, not a diagnosis or a performance score.',
    },
    optionalEquipment: 'Optional: three scrap-paper labels for REST / ADJUST, STOP AND TELL, and DO NOT RESUME.',
    substitute: 'Point, sign, speak, draw, or use three familiar objects as decision-lane markers.',
    noEquipment: 'Equal-credit no-equipment route: hear or read the fictional situation, state the lane and next safe action, and identify the adult or professional boundary. No movement or real stop event is required.',
    space: 'Use one safe, comfortable seat, desk, or communication station. This non-movement route needs no activity area; if the immediate space is unsafe, stop setup and tell a trusted adult.',
    warmUp: null,
    entry: 'Sort one comfortable-break example and one warning-sign example into different lanes.',
    simplePractice: 'Classify a supplied safe-environment comfort break and name the allowed adjustment.',
    variable: 'Add one named warning sign or environmental change.',
    independent: 'Classify a fresh fictional condition, cite the fact that controls the choice, state the next safe action, and name who controls return.',
    maximum: 'Never induce a symptom, impact, injury, collision, equipment failure, or real stop event.',
    safety: 'Use only supplied fictional conditions. Do not diagnose, prescribe, recreate a hazard, or use activity as a symptom test.',
    evidence: ['DECISION_QUALITY', 'SAFETY_KNOWLEDGE', 'PLANNING', 'COMPLETION'],
  },
  {
    id: 'outdoor',
    pattern: /outdoor|walking|hiking|cycling|trail|route|navigation|map|compass|weather|terrain|daylight|water safety|leave-no-trace|road|shared-space etiquette/i,
    centralType: 'PROJECT_LIFETIME_ACTIVITY',
    cues: ['SCAN the next section for surface, traffic, weather, boundaries, and people.', 'PLAN a route, turnaround point, and trusted-adult contact before activity.', 'PACE so stopping and speaking comfortably remain possible.', 'TURN BACK before conditions, daylight, access, or control become unsafe.'],
    model: { startingPosition: 'Mark a start, safe boundary, and turnaround point on paper or in a clear indoor space.', action: 'Scan the next section, choose a controlled route, state the help plan, and stop at the planned boundary.', keyCue: 'Scan, plan, pace, turn back.', commonError: 'Choosing distance or destination before checking conditions and return options.', correction: 'Set the boundary and turnaround first; shorten or describe the route when conditions are uncertain.', notice: 'Notice route decisions, controlled stopping, and changing conditions rather than speed or distance.' },
    optionalEquipment: 'Optional: paper map, weather-appropriate clothing, or activity-specific safety equipment when available and guardian-approved.',
    substitute: 'Use a hand-drawn route, imaginary landmarks, or soft household markers indoors.',
    noEquipment: 'Equal-credit low-space no-equipment route: point through an imaginary indoor route and explain the surface, weather, traffic, hydration, help, and turnaround decisions.',
    space: 'Clear one arm-span for an indoor route model. Real outdoor, road, water, isolated-area, or unfamiliar-route activity requires guardian permission and appropriate supervision/equipment.',
    warmUp: ['Trace the route slowly with a finger, hand, steps, or wheel pushes.', 'Rehearse one controlled stop and turnaround at comfortable range.'],
    entry: 'Identify the safest start, boundary, and turnaround on a simple supplied route.',
    simplePractice: 'Travel, gesture, or point through one short clear segment and stop at the boundary.',
    variable: 'Add one surface, weather, access, or route-choice change.',
    independent: 'Create or demonstrate a fresh route with a start, boundary, turnaround, condition check, and help plan.',
    maximum: 'No real road, water, isolated area, unfamiliar route, or worsening weather is entered for lesson evidence.',
    safety: 'Use a described indoor route unless a guardian has approved the real location, conditions, supervision, and activity-specific safety equipment.',
    evidence: ['PLANNING', 'DECISION_QUALITY', 'SAFE_PARTICIPATION', 'REFLECTION'],
  },
  {
    id: 'object-control',
    pattern: /throw|catch|pass|receiv|carry|kick|trap|dribbl|ball|object tracking|sending/i,
    centralType: 'SKILL_DEVELOPMENT',
    cues: ['READY with a balanced base, soft joints, and eyes tracking the object.', 'AIM the non-working side and contact path toward the target.', 'SOFTEN the receiving hand, foot, or implement to keep the object close.', 'FOLLOW THROUGH toward the intended path, then recover under control.'],
    model: { startingPosition: 'Stand, sit, or use a mobility aid behind a clear boundary with a soft object held close and the target below shoulder height.', action: 'Aim, send or receive with a short controlled motion, soften contact, and recover before resetting.', keyCue: 'Track, soften, control.', commonError: 'Using force before the object path and receiving shape are controlled.', correction: 'Move closer, use a slower or imaginary object, shorten the motion, and finish toward the target.', notice: 'Notice object path, soft contact, and recovery rather than force or successful outcome alone.' },
    optionalEquipment: 'Optional: one soft ball or target.',
    substitute: 'Use rolled socks, crumpled paper, a balloon, or an imaginary object.',
    noEquipment: 'Equal-credit no-equipment route: rehearse ready, aim, contact, follow-through, and recovery in slow motion, then draw or describe the intended object path.',
    space: 'Clear one arm-span in front and to each side. Face away from people, pets, windows, and breakables; keep all objects below shoulder height.',
    warmUp: ['Open and close the receiving shape gently.', 'Trace the send-and-follow-through path with an empty hand or foot.'],
    entry: 'Freeze in ready, contact, and recovery positions with an imaginary object.',
    simplePractice: 'Send or receive one soft or imaginary object over a short learner-chosen distance.',
    variable: 'Change only target size, object speed, pathway, or distance.',
    independent: 'Choose a fresh target or pathway and complete a controlled send/receive sequence while naming the cue used.',
    maximum: 'No hard object, full-force send, strike toward a person, or movement outside the cleared boundary.',
    safety: 'Use only soft unbreakable objects below shoulder height and reset any object before it leaves the clear area.',
    evidence: ['SKILL_EVIDENCE', 'SAFE_PARTICIPATION', 'CUE_KNOWLEDGE', 'REFLECTION'],
  },
  {
    id: 'striking-target',
    pattern: /strik|racket|racquet|paddle|rally|net\/wall|net or wall|target|aim|serve|shot|fielding/i,
    centralType: 'SKILL_DEVELOPMENT',
    cues: ['READY with the full swing or reach path clear.', 'TRACK the soft or imaginary object into a comfortable contact area.', 'CONTACT in front or beside the body with a short controlled action.', 'RECOVER to a stable ready position before the next choice.'],
    model: { startingPosition: 'Begin seated or standing with a stable base, a short empty-hand reach, and a clear arm-and-implement buffer.', action: 'Track, make a short controlled contact motion toward a paper or imaginary target, and recover to ready.', keyCue: 'Short path, clear space, controlled finish.', commonError: 'Taking a large fast swing before checking the complete path.', correction: 'Remove the implement, shorten the path, slow the motion, and freeze at contact and recovery.', notice: 'Notice clear space, contact position, and recovery rather than power.' },
    optionalEquipment: 'Optional: balloon, rolled socks, paper target, or short adult-approved household paddle substitute.',
    substitute: 'Use an open hand and imaginary object; no racket, net, wall, or sport facility is needed.',
    noEquipment: 'Equal-credit no-equipment route: shadow the ready/contact/recovery sequence, point to the safe path and target, and explain the control cue.',
    space: 'Clear one full arm-and-implement length on every side. Remove hard objects, people, pets, windows, and breakables from the target direction.',
    warmUp: ['Trace a short empty-hand contact path.', 'Freeze at ready, contact, and recovery with continuous breathing.'],
    entry: 'Model ready, contact, and recovery without an object or implement.',
    simplePractice: 'Use one short tap or shadow contact toward a large close target.',
    variable: 'Change only target position, object path, or contact timing.',
    independent: 'Select a fresh safe target and show or describe one controlled ready-to-recovery sequence.',
    maximum: 'No hard object, full-force swing, overhead smash, long implement, or strike toward a person or breakable.',
    safety: 'Check the complete swing path before each attempt and switch to empty-hand shadow practice whenever clearance is uncertain.',
    evidence: ['SKILL_EVIDENCE', 'SAFE_PARTICIPATION', 'CUE_KNOWLEDGE', 'COMPLETION'],
  },
  {
    id: 'rhythm-sequence',
    pattern: /rhythm|beat|tempo|dance|motif|choreo|sequence|movement qualit|expression|composition|synchron|folk|cultural context|performance and critique/i,
    centralType: 'COOPERATIVE_CREATIVE_ACTIVITY',
    cues: ['COUNT a steady internal beat or quiet tap.', 'SHAPE one small movement inside personal space.', 'CHANGE one feature such as level, direction, shape, or tempo.', 'FINISH in a stable shape on the chosen count.'],
    model: { startingPosition: 'Choose a stable seated, supported, standing, or described position inside one arm-span.', action: 'Count four comfortable beats, make one repeatable shape, change one feature, and finish under control.', keyCue: 'Count, shape, change, finish.', commonError: 'Adding several changes so the sequence loses its beat or safe boundary.', correction: 'Return to one small shape and one change, use a slower internal count, and mark the finish.', notice: 'Notice timing, clear change, and controlled transition rather than copying body shape.' },
    optionalEquipment: 'Optional: quiet music or a rhythm source.',
    substitute: 'Count, clap, tap, sign, or use an internal beat.',
    noEquipment: 'Equal-credit solo route: create, gesture, draw, or describe a four-count seated or standing sequence with a start, one change, and a stable finish.',
    space: 'Clear one arm-span on a non-slip surface or use one stable seat. No partner, audience, lift, inversion, throw, or public performance is required.',
    warmUp: ['Tap or count a comfortable steady beat.', 'Rehearse the starting and finishing shapes at reduced range.'],
    entry: 'Repeat one small movement on a steady four-count.',
    simplePractice: 'Add one clear shape change while keeping the same count.',
    variable: 'Change only level, direction, shape, tempo, or order.',
    independent: 'Create a fresh short sequence with a clear start, one chosen change, and stable finish; then name how the choice fits the focus.',
    maximum: 'No lift, inversion, forced contact, unfamiliar acrobatics, public performance, or movement beyond personal space.',
    safety: 'Keep every movement within a comfortable range and personal boundary; use the described route if the surface or space is uncertain.',
    evidence: ['CREATIVE_SEQUENCE', 'SKILL_EVIDENCE', 'DECISION_QUALITY', 'REFLECTION'],
  },
  {
    id: 'balance-strength-mobility',
    pattern: /balance|stability|mobility|stretch|yoga|strength|bodyweight|joint range|core|postural|landing|rolling|weight transfer|gymnastic|stance|martial|muscular|flexibility|technique before load/i,
    centralType: 'FITNESS_SELF_MANAGEMENT',
    cues: ['BASE on a stable surface with approved support within reach.', 'ALIGN the moving part with the intended path.', 'BREATHE continuously through a comfortable controlled range.', 'RETURN while control is steady; reduce range or leverage before form changes.'],
    model: { startingPosition: 'Choose a seated, supported, mobility-aid, or standing base with a stable chair or wall positioned before movement.', action: 'Move one joint or body segment through a comfortable range while breathing, pause under control, and return.', keyCue: 'Stable base, comfortable range, continuous breath.', commonError: 'Increasing range, load, or hold time after alignment or breathing changes.', correction: 'Reduce range or leverage, remove load, add support, and resume only if comfortable.', notice: 'Notice alignment, breathing, and controlled return rather than depth, load, or duration.' },
    optionalEquipment: 'Optional: stable chair, wall, towel, or light adult-approved household object.',
    substitute: 'Use a smaller lever, gentle isometric action, or hand model of the joint path.',
    noEquipment: 'Equal-credit no-equipment route: use a seated, supported, reduced-range, or gentle isometric version, or model the joint path with hands while explaining alignment and breathing.',
    space: 'Clear one arm-span on a dry non-slip surface and place any stable support before beginning. Do not use rolling or tipping furniture.',
    warmUp: ['Move the target joint through a small comfortable range.', 'Rehearse the breathing and return cue with support.'],
    entry: 'Show the start and finish positions with support and no added load.',
    simplePractice: 'Complete one comfortable controlled movement or isometric shape while breathing.',
    variable: 'Change only range, support, leverage, direction, or light resistance.',
    independent: 'Choose a fresh comfortable variation and show or describe stable base, alignment, breath, and controlled return.',
    maximum: 'No maximal resistance, forced stretch, inversion, breath-holding, unstable support, or movement through pain.',
    safety: 'Use stable supports and learner-selected range; stop before alignment or breathing breaks down.',
    evidence: ['SKILL_EVIDENCE', 'SELF_MANAGEMENT', 'SAFE_PARTICIPATION', 'REFLECTION'],
  },
  {
    id: 'locomotor-space',
    pattern: /space|locomotor|travel|dodg|pathway|direction|start|walk|run|hop|jump|skip|gallop|slide|leap|movement readiness|body control|off-ball/i,
    centralType: 'SKILL_DEVELOPMENT',
    cues: ['READY with a balanced base, soft joints, eyes up, and the path clear.', 'TRAVEL with quiet controlled steps, wheel pushes, or an in-place pattern.', 'SLOW before changing direction or pathway.', 'STOP inside the boundary with control.'],
    model: { startingPosition: 'Begin behind a visible or imaginary boundary with a stable base and enough room for a controlled stop.', action: 'Travel or gesture along one short pathway, slow before the change, and finish inside the boundary.', keyCue: 'Eyes up, slow first, stop inside.', commonError: 'Looking down or changing direction before reducing pace.', correction: 'Use a fixed eye-level point, shorten the path, and rehearse slow-change-stop in place.', notice: 'Notice spacing, pathway, and controlled start/stop rather than speed.' },
    optionalEquipment: 'Optional: two soft household objects as pathway markers.',
    substitute: 'Use imaginary lines, floor points, or seated arm patterns.',
    noEquipment: 'Equal-credit low-space option: travel in place or use seated arm/wheel-path gestures to show start, pathway change, controlled stop, and spacing decisions.',
    space: 'Clear a dry non-slip path of two arm-spans when available. Low-space route: stay within one arm-span seated, supported, standing, or using a mobility aid.',
    warmUp: ['Rehearse the start and controlled stop in place.', 'Trace the pathway change at a comfortable pace.'],
    entry: 'Show ready and controlled stop without traveling.',
    simplePractice: 'Travel or gesture along one short straight pathway.',
    variable: 'Change only direction, pathway shape, level, or learner-selected pace.',
    independent: 'Choose a fresh pathway and complete or describe ready, travel, slow-change, and controlled stop.',
    maximum: 'No indoor running, uncertain jump, collision path, or movement beyond the cleared boundary.',
    safety: 'Use no jumping when surface, ceiling, footwear, or support is uncertain; use the in-place route whenever full travel is not safe.',
    evidence: ['SKILL_EVIDENCE', 'SPACE_DECISION', 'SAFE_PARTICIPATION', 'COMPLETION'],
  },
  {
    id: 'tactics-games',
    pattern: /offense|defense|attack|tactic|strategy|position|transition|creating and closing space|support angle|opponent|pressure|scout|decision speed|set situation|game|play|rule modification/i,
    centralType: 'TACTICS_DECISION_MAKING',
    cues: ['SCAN the whole supplied space or diagram.', 'CHOOSE the open or protective option before moving.', 'ACT with a controlled point, gesture, step, or wheel path.', 'RECOVER to protect the next likely option.'],
    model: { startingPosition: 'Use three paper marks, objects, or imagined points for self, target, and open space.', action: 'Scan the arrangement, choose one option, show the path with a point or controlled movement, and recover to a useful position.', keyCue: 'Scan, choose, act, recover.', commonError: 'Following the object or first option without checking open space and the next play.', correction: 'Freeze the diagram, name two options, choose one reason, and mark the recovery point before moving.', notice: 'Notice information and decision quality rather than opponent outcome or speed.' },
    optionalEquipment: 'Optional: three soft household markers or a paper diagram.',
    substitute: 'Use fingers, drawn points, or imaginary positions.',
    noEquipment: 'Equal-credit solo route: point, gesture, draw, or describe ready position, open space, one decision, and recovery; no opponent or group is required.',
    space: 'Use one tabletop or one arm-span of clear floor. Real opponent, contact, court, scored contest, or group play is not required.',
    warmUp: ['Point to open and protected space in a simple three-point model.', 'Rehearse one controlled move-and-recover path without an opponent.'],
    entry: 'Choose between two supplied position options and explain one reason.',
    simplePractice: 'Show one open-space or protective-position decision on a fixed diagram.',
    variable: 'Change only one target, boundary, defender marker, teammate marker, or rule.',
    independent: 'Solve a fresh arrangement by naming the information, choice, action path, and recovery position.',
    maximum: 'No contact, collision, real opponent, scored contest, or movement toward another person.',
    safety: 'Use solo diagram, shadow, or walk-through practice; tactical evidence never requires guarding contact, wrestling, tackling, or collision.',
    evidence: ['DECISION_QUALITY', 'TACTICAL_REASONING', 'PLANNING', 'REFLECTION'],
  },
  {
    id: 'training-planning',
    pattern: /fitness|cardiorespiratory|endurance|effort|exertion|talk test|warm-up|cool-down|recovery|hydration|sleep|fuel|goal|training|program|plan|progress|overload|frequency|intensity|adherence|cycle|period|deload|taper|baseline|screening|self-monitor|practice design|capability|self-care/i,
    centralType: 'FITNESS_SELF_MANAGEMENT',
    cues: ['START with a comfortable movement or fully described plan.', 'CHECK control, breathing, and ability to speak comfortably; no device or body data is needed.', 'CHANGE only one variable and keep intensity and range learner-selected.', 'FINISH by reducing demand and naming the next safe adjustment.'],
    model: { startingPosition: 'Choose a seated, supported, in-place, or described sequence and state the planned rest and stop choices first.', action: 'Begin comfortably, monitor control and breathing, change one approved variable, and return to an easy finish.', keyCue: 'Start easy, change one, finish in control.', commonError: 'Changing duration, pace, range, and resistance together or treating the plan as mandatory.', correction: 'Return to the entry version, keep one variable, and choose rest, regression, or a described route without penalty.', notice: 'Notice self-management and repeatable control rather than calories, body change, norms, or maximal result.' },
    optionalEquipment: 'Optional household activity equipment when safe, available, and guardian-approved.',
    substitute: 'Use comfortable in-place movement, seated reaches, gentle mobility, or a paper sequence.',
    noEquipment: 'Equal-credit home route: build and try or fully describe a short prepare-practice-finish sequence and justify the pace, rest, stop, and next-adjustment choices.',
    space: 'Clear one arm-span seated or standing, or use a safe study space for the complete planning route. No gym, wearable, machine, weight, or purchase is required.',
    warmUp: ['Use one easy version of the planned movement.', 'Rehearse the learner-controlled rest and stop choices before adding demand.'],
    entry: 'Arrange a prepare-practice-finish sequence with one rest point.',
    simplePractice: 'Try or describe the easiest controlled version of the central activity.',
    variable: 'Change only pace, range, support, sequence, or learner-chosen duration.',
    independent: 'Build a fresh short plan, try or describe it, and explain one self-management decision and one next adjustment.',
    maximum: 'No maximal effort, punishment exercise, breath-holding, forced duration, symptom testing, body metric, or fitness norm.',
    safety: 'Keep demand learner-selected, use continuous breathing, and choose regression, rest, or the described route before control changes.',
    evidence: ['SELF_MANAGEMENT', 'PLANNING', 'DECISION_QUALITY', 'REFLECTION'],
  },
  {
    id: 'leadership-inclusion',
    pattern: /lead|coach|teach|feedback|officiat|fair|conflict|inclus|mixed abilit|organizing|responsibility|communication|role|event|group|partner|social activity/i,
    centralType: 'COOPERATIVE_CREATIVE_ACTIVITY',
    cues: ['PREVIEW space, equipment, start, stop, and adaptation before activity.', 'MODEL one observable action or decision at a time.', 'OFFER seated, supported, reduced-demand, solo, and no-equipment choices before practice.', 'FEEDBACK names the cue or decision, never a body, ability, effort, or character.'],
    model: { startingPosition: 'Use a solo planning station with the opening cue, boundary, stop signal, and adaptation choices visible.', action: 'State one direction, model or describe it slowly, offer equal-credit routes, and give one cue-based feedback sentence.', keyCue: 'Direction, model, choice, feedback.', commonError: 'Giving many directions at once or presenting adaptation only after a learner struggles.', correction: 'Chunk one action, offer routes before practice, and rewrite feedback around an observable cue.', notice: 'Notice clarity, consent, inclusion, and safe organization rather than compliance or athletic result.' },
    optionalEquipment: 'Optional: soft household markers or a written cue card.',
    substitute: 'Use spoken, signed, drawn, or imagined directions and boundaries.',
    noEquipment: 'Equal-credit solo route: design and speak, sign, write, or demonstrate the opening cue, setup, adaptation, feedback statement, and stop signal; no partner or audience is required.',
    space: 'Use a safe seat or one arm-span. A team, public role, audience, contact, spotting, lifting, or real event is not required.',
    warmUp: ['Rehearse the opening and stop signals.', 'Model one target cue slowly from a stable position.'],
    entry: 'Turn one multi-action direction into two one-action cues.',
    simplePractice: 'Present one direction and one equal-credit choice to an imagined learner.',
    variable: 'Add only one role, communication need, rule, or access constraint.',
    independent: 'Create a fresh solo activity briefing with setup, model, adaptation, stop signal, and cue-based feedback.',
    maximum: 'No required partner, contact, public leadership, audience, spotting, lifting, or responsibility for another person’s safety decision.',
    safety: 'Use a solo plan or one trusted household partner only; consent and stop signals apply before any shared activity.',
    evidence: ['COMMUNICATION', 'INCLUSION_DECISION', 'PLANNING', 'COMPLETION'],
  },
  {
    id: 'movement-literacy',
    pattern: /./,
    centralType: 'MOVEMENT_CONCEPT_CUES',
    cues: ['START in a stable position that fits the available space.', 'SHOW one movement feature at a time through motion, gesture, object, or description.', 'COMPARE an example and non-example using the target cue.', 'FINISH by explaining which adjustment improved control or understanding.'],
    model: { startingPosition: 'Choose a stable seated, supported, standing, mobility-aid, or described position and identify the target movement feature.', action: 'Show or describe one example, contrast one non-example, correct it with the key cue, and return to a stable finish.', keyCue: 'Name it, show it, compare it, correct it.', commonError: 'Repeating the direction without showing what changes between the example and non-example.', correction: 'Freeze both versions, name one visible difference, and apply one correction cue.', notice: 'Notice the target relationship, cue, or decision rather than cosmetic body position.' },
    optionalEquipment: 'Optional: one soft marker, cue card, or household object.',
    substitute: 'Use hand gestures, drawing, pointing, or an imagined movement path.',
    noEquipment: 'Equal-credit no-equipment route: demonstrate in place, seated, supported, or with hand gestures, or draw and explain the example, non-example, correction, and safety choice.',
    space: 'Clear one arm-span on a safe surface or work from one stable seat. Keep people, pets, cords, and breakables outside the boundary.',
    warmUp: ['Preview the target feature with a small comfortable motion or gesture.', 'Rehearse the stable start and finish positions.'],
    entry: 'Identify the target feature in one supplied example.',
    simplePractice: 'Show or describe one controlled example and one non-example.',
    variable: 'Change only one relationship, direction, range, pathway, timing, or support.',
    independent: 'Apply the concept to a fresh movement, gesture, drawing, or described situation and explain the correction cue.',
    maximum: 'No maximal force, unsafe range, comparison, public performance, or movement beyond the cleared boundary.',
    safety: 'Use a small comfortable range and switch to gesture, drawing, or description whenever movement or space is not appropriate.',
    evidence: ['KNOWLEDGE', 'CUE_APPLICATION', 'ERROR_ANALYSIS', 'COMPLETION'],
  },
]

function categoryFor(focus) {
  return CATEGORY_RULES.find((rule) => rule.pattern.test(focus))
}

function lessonTypeFor(lesson, category) {
  const phase = lesson.phase ?? ''
  if (/Reteach|Correction/i.test(phase)) return 'REMEDIATION_RETRY'
  if (/Unit assessment|Independent application/i.test(phase)) return 'MASTERY_PERFORMANCE'
  if (/Synthesis and review/i.test(phase)) return 'REVIEW_RETRIEVAL'
  if (/Performance task build/i.test(phase)) return 'PROJECT_LIFETIME_ACTIVITY'
  if (/Launch and diagnostic/i.test(phase)) return 'MOVEMENT_CONCEPT_CUES'
  return category.centralType
}

function ageTechniqueNote(grade, primaryType) {
  if (grade <= 5) return `Use one short action at a time, say the main cue before the attempt, keep the ${primaryType.toLowerCase().replaceAll('_', ' ')} choice concrete, and ask a trusted adult to confirm any required permission or space check.`
  if (grade <= 8) return `Rehearse the model slowly, change one variable, and explain the cue or decision before adding complexity.`
  return `Self-manage setup, demand, and feedback while keeping intensity and range learner-selected and the evidence tied to the taught cue or decision.`
}

function authoredCues(lesson) {
  return Array.isArray(lesson.cues)
    ? lesson.cues.filter((cue) => typeof cue === 'string' && cue.trim()).map((cue) => cue.trim())
    : []
}

function buildAdaptationRoutes(category, focus) {
  return {
    seated: `Use a stable seated position and preserve the ${category.model.keyCue} evidence through upper-body movement, pointing, gesture, object modeling, or description.`,
    supported: `Place an approved stable support before beginning and use it through the whole attempt; score the cue or decision for ${focus}, not unsupported balance.`,
    reducedRange: `Use the smallest comfortable movement, eye-gaze choice, point, or gesture that still shows the target cue or decision for ${focus}.`,
    reducedPaceOrDemand: 'Complete one stage at a time with learner-chosen breaks, remain at the entry version, or split the lesson across short sittings.',
    mobilityAidCompatible: `Keep the mobility aid positioned and used as approved; adapt the path around the aid and score the same ${category.model.keyCue} evidence.`,
    solo: 'Use the supplied solo, shadow, diagram, imagined-role, or fictional-situation route; no partner, opponent, group, or audience is required.',
    lowSpace: `Use the one-arm-span or one-seat setup: ${category.noEquipment}`,
    noEquipment: category.noEquipment,
    describedOrDecisionRoute: `Describe, draw, gesture, point, sign, or model ${category.independent} This is a complete equal-credit route when movement is not appropriate.`,
  }
}

function buildProgression(category, focus, family) {
  return [
    {
      round: 1,
      name: 'Entry version',
      task: `${family.guided} ${category.simplePractice}`,
      targetCue: category.model.keyCue,
      successCheck: `Show or explain the target for ${focus} once with the safe boundary intact.`,
      changedVariable: 'None; begin with the simplest safe version.',
      learnerChoice: 'Remain here, reduce range or pace, add support, rest, or switch to the described route.',
      maximumBoundary: category.maximum,
    },
    {
      round: 2,
      name: 'One change',
      task: `${category.simplePractice} Then ${category.variable.toLowerCase()} Keep the ${family.evidencePurpose} purpose visible.`,
      targetCue: category.model.keyCue,
      successCheck: 'Name what changed and keep the same cue, control, decision, and safety boundary.',
      changedVariable: category.variable,
      learnerChoice: 'Progress only by choice; repeat or regress whenever the cue or control is not clear.',
      maximumBoundary: category.maximum,
    },
    {
      round: 3,
      name: 'Fresh application',
      task: `${family.independent} ${category.independent}`,
      targetCue: category.model.keyCue,
      successCheck: 'Complete the fresh bounded application and identify the cue or decision that controlled it.',
      changedVariable: 'The learner selects a new safe example, arrangement, or condition.',
      learnerChoice: 'Use any standard or equal-credit route, take breaks, or finish through description without penalty.',
      maximumBoundary: category.maximum,
    },
  ]
}

function buildGuidedPractice(category, focus, family) {
  return [
    {
      id: 'guided-1',
      prompt: `${family.guided} ${category.entry} Apply it to ${focus}.`,
      support: `Use the model cue: ${category.model.keyCue}`,
      feedback: `If the target is unclear, return to the starting position and use this correction: ${category.model.correction}`,
    },
    {
      id: 'guided-2',
      prompt: category.simplePractice,
      support: `Watch for this contrast: ${category.model.commonError}`,
      feedback: `Keep the safe version when the learner can show or explain ${category.model.notice.toLowerCase()}`,
    },
  ]
}

function buildActivitySteps(primaryType) {
  const independentVerb = primaryType === 'SAFETY_STOP_DECISION' ? 'Classify the fresh condition.' : 'Complete the fresh application.'
  return [
    'Choose a standard or equal-credit response route.',
    'Check the required permission.',
    'Check the space.',
    'Check any optional equipment.',
    'Read the REST / ADJUST rule.',
    'Read the STOP AND TELL rule.',
    'Complete the warm-up when it applies.',
    'Study the model.',
    'Name the key cue.',
    'Complete guided attempt 1.',
    'Complete guided attempt 2.',
    'Choose a progression round.',
    independentVerb,
    'Use the safe finish when it applies.',
    'Provide the selected evidence.',
    'Answer the short reflection or leave it blank.',
  ]
}

function buildCompletionCriteria(focus, category) {
  return [
    `The learner uses a safe setup or accurately describes it for ${focus}.`,
    `The learner applies ${category.model.keyCue} in one guided attempt and one fresh application or complete described equivalent.`,
    'The learner distinguishes learner-controlled rest from STOP AND TELL and DO NOT RESUME conditions.',
    'Any seated, supported, reduced-range, reduced-pace, mobility-aid, solo, low-space, no-equipment, or described route earns equal credit for the same cue or decision evidence.',
  ]
}

function buildRetryPlan(category, focus) {
  return {
    trigger: `Retry when the evidence does not yet show the target cue or decision for ${focus}; name the missing observable part without judging the learner.`,
    simplerSetup: category.entry,
    differentCue: `Replace the full cue set with: “${category.model.keyCue}”`,
    alternateModel: `Contrast this common error — ${category.model.commonError} — with this correction — ${category.model.correction}`,
    boundedPractice: category.simplePractice,
    freshRetry: `${category.independent} Use a new safe example rather than repeating the scored attempt.`,
    exitCriterion: `Return to independent work when the fresh retry shows or explains ${category.model.notice.toLowerCase()} A safety stop, rest, or adaptation is never recorded as failure.`,
  }
}

export function buildPeExecution(lesson, grade) {
  const focus = typeof lesson.focus === 'string' && lesson.focus.trim() ? lesson.focus.trim() : 'the lesson focus'
  const category = categoryFor(focus)
  const primaryLessonType = lessonTypeFor(lesson, category)
  const family = FAMILY_PLANS[primaryLessonType]
  const sourceCues = authoredCues(lesson)
  const movementCues = sourceCues.length >= 3 ? sourceCues : category.cues
  const techniqueLevel = ageTechniqueNote(grade, primaryLessonType)
  const movementModel = {
    title: `Model for ${focus}`,
    ...category.model,
    commonError: lesson.common_error ?? category.model.commonError,
    adaptedModel: `Use the seated, supported, mobility-aid, reduced-range, object-modeled, or described route and preserve this evidence: ${category.model.notice}`,
    safetyBoundary: `${category.safety} ${category.maximum}`,
  }
  const practiceProgression = buildProgression(category, focus, family)
  const adaptationRoutes = buildAdaptationRoutes(category, focus)
  const completionCriteria = buildCompletionCriteria(focus, category)
  const retryPlan = buildRetryPlan(category, focus)
  const nonMovement = primaryLessonType === 'SAFETY_STOP_DECISION'
  const warmUpAndFinishPolicy = nonMovement
    ? {
        applicability: 'NOT_APPLICABLE_NON_MOVEMENT',
        warmUp: null,
        coolDown: null,
        rationale: `The evidence for ${focus} is a supplied fictional decision and described protocol. No movement or induced safety event is required.`,
      }
    : {
        applicability: 'REQUIRED_FOR_MOVEMENT',
        warmUp: category.warmUp,
        coolDown: ['Return to the easiest comfortable version or rest.', 'Restore optional equipment and space safely.', 'Name one cue, safety choice, or next adjustment without reporting body data.'],
        rationale: null,
      }

  return {
    standards: lesson.standards ?? [],
    primaryLessonType,
    secondaryLessonTypes: [...new Set([category.centralType, primaryLessonType === 'SKILL_DEVELOPMENT' ? 'MOVEMENT_CONCEPT_CUES' : 'SKILL_DEVELOPMENT'])].filter((type) => type !== primaryLessonType).slice(0, 2),
    lessonFamilyPlan: {
      instructionalPurpose: family.purpose,
      guidedEmphasis: family.guided,
      independentEvidence: family.independent,
      evidencePurpose: family.evidencePurpose,
    },
    goal: `I can ${family.purpose} for ${focus}, using a safe standard or equal-credit adapted route, and explain the cue or decision that shows success.`,
    successOverview: `Success is safe setup, use of the taught ${category.model.keyCue} cue or decision, a fresh bounded application, and a short explanation. Credit never depends on body position, speed, athletic talent, comparison, or use of the standard route.`,
    readinessCheck: [
      category.entry,
      'Choose movement, seated, supported, mobility-aid, low-space, no-equipment, or described evidence without explaining why.',
      'Use the complete described route if guardian permission, safe space, equipment, movement, a partner, or a real setting is unavailable.',
    ],
    movementCues,
    techniqueLevel,
    movementModel,
    guidedPractice: buildGuidedPractice(category, focus, family),
    practiceProgression,
    independentActivity: {
      title: `Fresh application: ${focus}`,
      directions: [
        'Choose one approved route.',
        category.independent,
        `Use this cue or decision: ${category.model.keyCue}`,
        'Stop at the maximum boundary.',
        'Provide the selected evidence without a recording or body metric.',
      ],
      freshTask: `${family.independent} ${category.independent}`,
      independenceBoundary: 'A trusted human or future Tutor may read directions, define a cue, and offer an approved route. They may not perform the decision for the learner, claim unapproved observation, certify physical completion, or provide medical or return clearance.',
    },
    warmUpAndFinishPolicy,
    spaceSetup: `${category.space} Low-space access remains available before and during the lesson. Cleanup: return optional items only after movement has stopped and the path is clear.`,
    equipmentRequirements: {
      required: ['No specialized equipment is required.'],
      optional: [category.optionalEquipment],
      householdSubstitutes: [category.substitute],
      prohibited: [category.maximum],
      equalCreditNoEquipment: category.noEquipment,
    },
    safetyRules: [
      'Check the surface, ceiling, boundary, people, pets, cords, breakables, footwear or mobility supports, and any optional item before movement.',
      category.safety,
      'Use learner-selected range, pace, and demand. Control, decisions, and understanding matter more than force, distance, duration, or repetitions.',
      'If the environment cannot be made safe, do not perform movement; use the equal-credit described route or stop and tell a trusted adult.',
    ],
    stoppingRules: REST_STOP_RULES,
    adaptationRoutes,
    accessibleAdaptation: `Choose or change any seated, supported, reduced-range, reduced-pace, mobility-aid, solo, low-space, no-equipment, or described route without explaining why. Every route earns equal credit for the same ${category.model.notice.toLowerCase()} The standard route is never required and adaptation never lowers credit.`,
    lowSpaceNoEquipmentAlternative: category.noEquipment,
    activitySteps: buildActivitySteps(primaryLessonType),
    completionCriteria,
    evidenceExpectations: {
      evidenceTypes: category.evidence,
      learnerEvidence: [`One guided response using ${category.model.keyCue}.`, `One fresh bounded application or complete described equivalent for ${focus}.`, 'One cue, decision, safety, or next-step explanation.'],
      physicalCompletion: 'NOT_TUTOR_CERTIFIABLE',
      observer: 'A learner may self-check a cue and a trusted human may review the selected evidence. A Tutor, browser, camera, wearable, or self-report cannot certify physical completion, guardian permission, or safe return.',
      doNotCollect: ['weight, appearance, body composition, calories, body shape, fitness norms, speed versus peers, or athletic talent', 'diagnosis, disability reason, symptom history, or private medical information', 'photo, video, audio, wearable data, location proof, or exercise log'],
    },
    retryPlan,
    guardianAuthority: {
      level: nonMovement ? 'NONE' : 'GUARDIAN_PERMISSION',
      when: nonMovement ? 'No guardian is required for the complete fictional or described lesson.' : 'Guardian permission is required before real movement, optional equipment, a real location, partner, outdoor route, or progression is used.',
      requiredAction: nonMovement ? 'Use the supplied fictional situation only.' : 'The guardian confirms that the bounded space, optional equipment, and activity route are permitted before movement.',
      minimumRecord: 'Record only permission status or that the equal-credit described route was used; collect no body, health, media, location, or performance data.',
      confirmationBoundary: 'Guardian confirmation may establish permission or occurrence only. It does not certify academic mastery, physical quality, diagnosis, effort, body status, or safe return.',
      equalCreditAlternative: 'When guardian review, real movement, equipment, space, partner, or location is unavailable, the supplied solo described/decision route is the complete equal-credit lesson.',
      tutorOrLearnerMaySubstitute: false,
    },
    keyPoints: [category.model.startingPosition, category.model.action, category.model.keyCue, category.model.correction],
    privacySafeScenario: `Use a supplied or invented non-personal example of ${focus}; do not disclose private health information or recreate a hazard.`,
    studentTask: `${family.independent} ${category.independent} Use any approved standard or equal-credit route. Name the cue or decision that controlled the result; no body metric, comparison, recording, or physical-completion claim is required.`,
    knowledgeCheck: `State the starting position, action, key cue, common error, and correction for ${focus}. Then distinguish optional REST / ADJUST from STOP AND TELL and DO NOT RESUME.`,
    reflectionPrompt: `Which cue, decision, safety check, or adaptation preserved the target for ${focus}, and what would you keep or change in a next safe attempt?`,
    remediation: `Name the observable gap for ${focus}. Use the simpler setup, replace the original wording with “${category.model.keyCue},” contrast the common error with the correction, practise one bounded change, then use the fresh retry. Offer rest or another route without penalty.`,
    scoring: {
      successCriteria: completionCriteria,
      rubricDimensions: [`Target evidence: applies ${category.model.keyCue}.`, 'Safety and self-management: uses setup, rest, stop, and maximum boundaries correctly.', 'Independent application: completes a fresh bounded attempt or equivalent described route.', 'Explanation and revision: identifies the cue or decision and a useful next adjustment.', 'Access parity: supplies the same target evidence through any approved route.'],
      scoringGuidance: 'Score safe participation when performed, decision quality, taught cue or skill evidence, planning, knowledge, reflection, revision, and completion as appropriate to the lesson type. Never score weight, appearance, body fat, calories, athletic talent, speed versus peers, body shape, fitness norms, standard-body performance, or willingness to avoid rest. Never reduce credit for adaptation, assistive technology, learner-controlled rest, a safety stop, guardian restriction, or a described route.',
      masteryRule: 'Require accurate independent evidence of the taught cue, decision, sequence, tactic, or self-management on at least two occasions separated by time, setting, or meaningful variation when feasible. Physical occurrence, attendance, reflection alone, Tutor confidence, standard-route use, body data, speed, or self-report alone when adult confirmation is required cannot establish mastery.',
      protectedAuthority: [`Target cue or decision: ${category.model.keyCue}`, `Acceptable evidence: ${category.model.notice}`, `Safety-critical boundary: ${category.maximum}`, 'Every approved adaptation is equivalent when it supplies the same target evidence.', 'A Tutor cannot claim observation, certify physical completion, replace guardian permission, diagnose, prescribe, or clear return.'],
      sufficientEvidence: `One guided response, one fresh bounded application or described equivalent, and one cue/decision explanation for ${focus}. A safety stop is responsible evidence treatment, not failure.`,
      adaptiveRoutes: [
        { signal: 'starting position or setup is unclear', action: category.entry },
        { signal: 'target cue is missing', action: `Use the alternate cue “${category.model.keyCue},” then model the contrast once.` },
        { signal: 'common error appears', action: category.model.correction },
        { signal: 'standard route is unavailable or declined', action: category.noEquipment },
        { signal: 'pain, dizziness, unusual breathing difficulty, head impact, injury concern, damaged equipment, or unsafe conditions occur', action: 'Stop immediately and tell a trusted adult. Do not resume to finish evidence; use a described retry later only when appropriate.' },
        { signal: 'fresh retry is needed', action: retryPlan.freshRetry },
      ],
    },
    tutorMetadata: {
      scope: 'CURRICULUM_METADATA_ONLY',
      may: ['explain approved content and vocabulary', 'cue the approved model', 'offer an approved presentation or activity route', 'coach how the learner presents their own evidence', 'route to rest, stop, retry, or adult handoff'],
      mustNot: ['cannot diagnose, prescribe, rehabilitate, or give medical clearance', 'cannot claim unapproved observation or certify physical completion', 'cannot override rest, stop, adaptation, guardian authority, professional authority, or safe return', 'cannot choose the answer or action for fresh independent evidence', 'cannot score body data, norms, appearance, talent, or peer comparison'],
    },
    repairCategory: category.id,
  }
}

export const PE_STOP_RULES = REST_STOP_RULES
export const PE_LESSON_TYPES = TYPE_KEYS

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasTextArray(value, minimum) {
  return Array.isArray(value) && value.filter(hasText).length >= minimum
}

function hasModel(model) {
  return model
    && ['startingPosition', 'action', 'keyCue', 'commonError', 'correction', 'safetyBoundary'].every((key) => hasText(model[key]))
    && hasText(model.notice ?? model.whatToNotice)
}

/** Independent field audit used by generation, validation, and production QA. */
export function auditPeLessonExecutability(lessons) {
  const result = {
    lessonsAudited: lessons.length,
    missingMovementCues: [],
    equipmentBlockers: [],
    missingSafety: [],
    missingAdaptation: [],
    homeUseBlockers: [],
    missingCompletionCriteria: [],
    missingGoalOrReadiness: [],
    missingLessonFamilyPlan: [],
    missingModel: [],
    missingGuidedPractice: [],
    missingProgression: [],
    missingIndependentActivity: [],
    missingRestStopDistinction: [],
    missingEvidenceBoundary: [],
    missingRetry: [],
    missingGuardianBoundary: [],
    missingTutorBoundary: [],
    invalidLessonType: [],
  }
  const routeKeys = ['seated', 'supported', 'reducedRange', 'reducedPaceOrDemand', 'mobilityAidCompatible', 'solo', 'lowSpace', 'noEquipment', 'describedOrDecisionRoute']

  for (const lesson of lessons) {
    const id = lesson.lessonId ?? '<unknown>'
    if (!hasTextArray(lesson.movementCues, 3) || !hasText(lesson.ageAppropriateTechnique)) result.missingMovementCues.push(id)
    const equipment = lesson.equipmentRequirements
    if (!(equipment && hasTextArray(equipment.required, 1) && hasTextArray(equipment.optional, 1) && hasTextArray(equipment.householdSubstitutes, 1) && hasText(equipment.equalCreditNoEquipment) && /equal-credit|earns equal credit/i.test(equipment.equalCreditNoEquipment))) result.equipmentBlockers.push(id)
    if (!hasTextArray(lesson.safetyRules, 3) || !hasTextArray(lesson.stoppingRules, 3)) result.missingSafety.push(id)
    if (!hasText(lesson.accessibleAdaptation) || !routeKeys.every((key) => hasText(lesson.adaptationRoutes?.[key])) || !/without explaining why/i.test(lesson.accessibleAdaptation) || !/equal credit/i.test(lesson.accessibleAdaptation)) result.missingAdaptation.push(id)
    if (!hasText(lesson.spaceSetup) || !/low-space/i.test(lesson.spaceSetup) || !hasText(lesson.lowSpaceNoEquipmentAlternative) || !hasTextArray(lesson.activitySteps, 8)) result.homeUseBlockers.push(id)
    if (!hasTextArray(lesson.completionCriteria, 4)) result.missingCompletionCriteria.push(id)
    if (!hasText(lesson.goal) || !hasTextArray(lesson.readinessCheck, 3)) result.missingGoalOrReadiness.push(id)
    if (lesson.sourceProvenance?.directorSampleRevision !== 'physical-education-director-sample-r1'
      && (!lesson.lessonFamilyPlan || !['instructionalPurpose', 'guidedEmphasis', 'independentEvidence', 'evidencePurpose'].every((key) => hasText(lesson.lessonFamilyPlan[key])))) result.missingLessonFamilyPlan.push(id)
    if (!hasModel(lesson.movementModel) && !hasModel(lesson.decisionModel)) result.missingModel.push(id)
    if (!Array.isArray(lesson.guidedPractice) || lesson.guidedPractice.length < 2 || lesson.guidedPractice.some((item) => !hasText(item.prompt) || !hasText(item.support) || !hasText(item.feedback))) result.missingGuidedPractice.push(id)
    if (!Array.isArray(lesson.practiceProgression) || lesson.practiceProgression.length < 3 || lesson.practiceProgression.some((round) => !hasText(round.task) || !hasText(round.successCheck) || !hasText(round.changedVariable) || !hasText(round.learnerChoice))) result.missingProgression.push(id)
    if (!lesson.independentActivity || !hasText(lesson.independentActivity.independenceBoundary) || !(hasText(lesson.independentActivity.freshTask) || Array.isArray(lesson.independentActivity.scenarios))) result.missingIndependentActivity.push(id)
    if (!/^REST \/ ADJUST:/i.test(lesson.stoppingRules?.[0] ?? '') || !/^STOP AND TELL:/i.test(lesson.stoppingRules?.[1] ?? '') || !/^DO NOT RESUME:/i.test(lesson.stoppingRules?.[2] ?? '')) result.missingRestStopDistinction.push(id)
    if (!lesson.evidenceExpectations || !hasText(lesson.evidenceExpectations.physicalCompletion) || !/Tutor/i.test(lesson.evidenceExpectations.observer ?? '')) result.missingEvidenceBoundary.push(id)
    if (!lesson.retryPlan || !['simplerSetup', 'differentCue', 'alternateModel', 'boundedPractice', 'freshRetry', 'exitCriterion'].every((key) => hasText(lesson.retryPlan[key]))) result.missingRetry.push(id)
    if (!lesson.guardianAuthority || lesson.guardianAuthority.tutorOrLearnerMaySubstitute !== false || !hasText(lesson.guardianAuthority.equalCreditAlternative)) result.missingGuardianBoundary.push(id)
    if (lesson.tutorMetadata?.scope !== 'CURRICULUM_METADATA_ONLY' || !Array.isArray(lesson.tutorMetadata.mustNot) || !/certify physical completion/i.test(lesson.tutorMetadata.mustNot.join(' '))) result.missingTutorBoundary.push(id)
    if (!TYPE_KEYS.includes(lesson.primaryLessonType)) result.invalidLessonType.push(id)
  }
  return result
}
