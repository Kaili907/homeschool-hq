/**
 * Deterministic learner-facing execution details for every PE lesson.
 *
 * The upstream grade bands differ sharply in density: Grade 3/4 provides
 * hand-authored cues, while Grades 5-12 often provide only a focus and a
 * broad application task. This module closes that execution gap without
 * changing scoring, browser behavior, or the upstream source curricula.
 */

const STOP_RULES = [
  'Stop immediately for pain, dizziness, unusual breathing difficulty, a head impact, or any movement that feels unsafe; tell a trusted adult.',
  'Stop when a person, pet, object, or slippery surface enters the movement area. Reset the area before continuing.',
  'After a head impact, injury, or symptoms that do not settle with rest, do not resume the activity until a trusted adult or qualified professional says it is safe.',
]

const CATEGORY_RULES = [
  {
    id: 'outdoor',
    pattern: /outdoor|walking|hiking|cycling|trail|route|navigation|map|compass|weather|terrain|daylight|water safety|leave-no-trace|environmental|road|shared-space etiquette/i,
    cues: [
      'Scan ahead for surface, traffic, weather, and boundary changes before changing pace or direction.',
      'Use a pace that allows steady breathing and controlled stopping; shorten the route or turn back before conditions become unsafe.',
      'Keep posture tall, steps or wheel pushes smooth, and attention on the next safe section of the route.',
      'State the route, turnaround point, and help plan before beginning; safe decisions matter more than distance or speed.',
    ],
    optionalEquipment: 'Weather-appropriate clothing, a paper map, or activity-specific safety equipment may be used only when available and adult-approved.',
    noEquipment: 'Equal-credit home option: mark an indoor route with imaginary points, travel or gesture through it at a controlled pace, and explain the surface, weather, traffic, hydration, and turnaround decisions you would use outdoors. No outdoor trip, bicycle, pool, map, or purchased gear is required.',
    safety: [
      'Do not enter water, roads, isolated areas, or unfamiliar routes for this lesson. Outdoor practice requires a trusted adult, suitable conditions, and the safety equipment appropriate to the activity.',
    ],
  },
  {
    id: 'object-control',
    pattern: /throw|catch|pass|receiv|carry|kick|trap|dribbl|ball|object tracking|sending/i,
    cues: [
      'Begin in a ready position: balanced base, soft joints, eyes tracking the object, and hands or feet prepared.',
      'Point the non-working side toward the target, move smoothly from the center outward, and follow through toward the intended path.',
      'Soften the hands, foot, or implement on contact to absorb force and keep the object close enough to control.',
      'Choose accuracy and control before speed or force; reset the object before it leaves the safe boundary.',
    ],
    optionalEquipment: 'Optional: a soft ball. A rolled pair of socks, crumpled paper, or another soft unbreakable household object is an equivalent substitute.',
    noEquipment: 'Equal-credit no-equipment option: rehearse the same ready position, tracking, weight shift, contact shape, and follow-through in slow motion with an imaginary object, then point to or draw its intended path and explain the cue used.',
    safety: [
      'Use only a soft, unbreakable object below shoulder height, away from windows, people, pets, and breakables. Do not use hard balls indoors.',
    ],
  },
  {
    id: 'striking-target',
    pattern: /strik|racket|racquet|paddle|rally|net\/wall|net or wall|target|aim|serve|shot|fielding/i,
    cues: [
      'Set a balanced ready position and check that the entire swing or reach path is clear before moving.',
      'Track the imagined or soft object into the contact area; use a short, controlled motion before adding range.',
      'Meet the object in front or beside the body at a comfortable distance and follow through toward the target.',
      'Recover to a stable ready position after each motion; placement and control matter more than force.',
    ],
    optionalEquipment: 'Optional: a balloon, rolled socks, paper target, or short household paddle substitute approved by an adult. A racket, net, wall, or sport facility is never required.',
    noEquipment: 'Equal-credit no-equipment option: use a shadow swing or open-hand tap in slow motion, freeze at ready/contact/recovery positions, and point to or draw the safe object path and target area.',
    safety: [
      'Keep an empty arm-and-implement-length buffer on every side. Use no hard object, full-force swing, overhead smash, or strike toward a person, pet, window, or breakable item.',
    ],
  },
  {
    id: 'rhythm-sequence',
    pattern: /rhythm|beat|tempo|dance|motif|choreo|sequence|movement qualit|expression|composition|synchron|folk|cultural context|forms across cultures|performance and critique/i,
    cues: [
      'Choose a steady internal count or quiet tap and begin with a small movement that fits the available space.',
      'Keep joints soft, posture supported, and transitions controlled enough to stop on any count.',
      'Use one clear change in level, direction, shape, or tempo while staying inside the marked personal space.',
      'Finish in a stable shape, then explain how the movement choice communicates the focus or matches the rhythm.',
    ],
    optionalEquipment: 'Optional: quiet music or a rhythm source. Counting, clapping, tapping, signing, or using an internal beat earns equal credit.',
    noEquipment: 'Equal-credit low-space option: create or describe a seated or standing upper-body sequence inside one arm-span, using an internal count and clear start, transition, and finish. Music, a partner, and performance for an audience are not required.',
    safety: [
      'Use a non-slip surface and movement sizes that stay inside the cleared area. Do not attempt lifts, inversions, throws, forced partner contact, or unfamiliar acrobatics.',
    ],
  },
  {
    id: 'balance-strength-mobility',
    pattern: /balance|stability|mobility|stretch|yoga|strength|bodyweight|joint range|core|postural|landing|rolling|weight transfer|gymnastic|stance|martial|muscular|flexibility|technique before load/i,
    cues: [
      'Start with a stable base, soft joints, long spine, and a chair or wall within reach if support would help.',
      'Brace gently while breathing continuously; move only through a comfortable, controlled range.',
      'Align knees, hands, or wheels with the direction of travel and spread force across the whole base of support.',
      'End the movement while technique is still steady; reduce range, leverage, or resistance at the first sign of form breakdown.',
    ],
    optionalEquipment: 'Optional: a stable chair, wall, towel, or light household object approved by an adult. Weights, machines, mats, and gym access are not required.',
    noEquipment: 'Equal-credit no-equipment option: use a seated, supported, reduced-range, or gentle isometric version of the same shape and control cues, or demonstrate the joint path with hands while explaining alignment and breathing.',
    safety: [
      'Use only stable supports that cannot roll or tip. Do not use maximal resistance, hold the breath, force a stretch, invert, or add load when alignment is not controlled.',
    ],
  },
  {
    id: 'locomotor-space',
    pattern: /space|locomotor|travel|dodg|pathway|direction|speed|start|stop|walk|run|hop|jump|skip|gallop|slide|leap|movement readiness|body control|off-ball/i,
    cues: [
      'Begin in a ready position with a balanced base, soft knees, eyes up, and the travel path clear.',
      'Move with quiet, controlled steps or wheel pushes and keep enough room to stop without crossing the boundary.',
      'Change direction by slowing first, lowering the center of control, and pushing smoothly into the new path.',
      'Finish under control inside the space; smooth starts, stops, and spacing matter more than speed.',
    ],
    optionalEquipment: 'Optional: two soft household objects may mark a path. Floor tape, cones, a track, and a gym are not required.',
    noEquipment: 'Equal-credit low-space option: travel in place or use seated arm patterns to show start, pathway change, controlled stop, and spacing decisions, then name the cue that kept the movement controlled.',
    safety: [
      'Keep the pace below running indoors unless a trusted adult has approved a larger clear area. Use no jumping when the surface, ceiling, footwear, or balance support is uncertain.',
    ],
  },
  {
    id: 'tactics-games',
    pattern: /offense|defense|attack|tactic|strategy|position|transition|creating and closing space|support angle|principles of|opponent|pressure|scout|decision speed|set situation|game|play|rule modification/i,
    cues: [
      'Start balanced with eyes scanning the whole space, not fixed on one object or person.',
      'Move or point into open space, then recover to a position that protects the next likely option.',
      'Decide early, communicate the choice clearly, and use controlled movement with no contact required.',
      'Pause after the pattern and explain what cue changed the decision; good positioning matters more than speed.',
    ],
    optionalEquipment: 'Optional: three small household objects may represent boundaries, teammates, or targets. Sport equipment, a court, and additional players are not required.',
    noEquipment: 'Equal-credit home option: use hand signals, floor points, or a paper diagram to show ready position, open space, one decision, and recovery; then walk, wheel, gesture, or describe the pattern in a cleared area.',
    safety: [
      'Use solo, shadow, or walk-through practice at home. No collision, guarding contact, wrestling, tackling, or movement toward another person is required.',
    ],
  },
  {
    id: 'training-planning',
    pattern: /fitness|cardiorespiratory|endurance|effort|exertion|talk test|warm-up|cool-down|recovery|hydration|sleep|fuel|goal|training|program|plan|progress|overload|frequency|intensity|adherence|cycle|period|deload|taper|baseline|screening|self-monitor|practice design|capability|injur|illness|self-care|warning sign/i,
    cues: [
      'Begin gradually with an easy movement the learner can control, then change only one variable at a time.',
      'Use feel, breathing, and the ability to speak comfortably to choose a sustainable effort; no device or body measurement is needed.',
      'Keep posture supported, movements smooth, and breathing continuous; hold or reduce the challenge when technique changes.',
      'Finish with an easier transition and record the movement choice, safety check, and next adjustment rather than a maximal result.',
    ],
    optionalEquipment: 'Optional household or activity equipment may be used when safe and available, but no wearable, machine, weight, gym membership, or purchased item is required.',
    noEquipment: 'Equal-credit home option: build and try or fully describe a short sequence using comfortable in-place marching or rolling, seated reaches, gentle mobility, and paced breathing; justify how it prepares, challenges, and settles the body.',
    safety: [
      'Use a self-selected easy-to-moderate effort, allow rest at any time, and never use maximal effort, breath-holding, punishment exercise, or exercise through pain.',
    ],
  },
  {
    id: 'leadership-inclusion',
    pattern: /lead|coach|teach|feedback|officiat|fair|conflict|inclus|mixed abilit|organizing|responsibility|communication|role|event|group|partner|social activity/i,
    cues: [
      'Model the movement slowly from a stable position and name one observable action cue at a time.',
      'Give directions for space, equipment, start, stop, and adaptation before anyone moves.',
      'Offer seated, supported, reduced-range, solo, and no-equipment choices before practice; each choice earns equal credit.',
      'Use feedback about the movement or decision, never a person’s body or character, and stop the activity when safety or inclusion breaks down.',
    ],
    optionalEquipment: 'Optional household markers may help organize space. A team, audience, facility, uniform, or sport equipment is not required.',
    noEquipment: 'Equal-credit solo option: design and speak, sign, write, or demonstrate the opening cue, safe setup, adaptation, feedback statement, and stop signal for the activity; no partner or public leadership is required.',
    safety: [
      'Use a solo plan or one trusted household partner only. No learner must touch, spot, lift, compete with, or perform in front of another person.',
    ],
  },
]

const DEFAULT_CATEGORY = {
  id: 'movement-literacy',
  cues: [
    'Choose a stable start position and a movement small enough to control in the available space.',
    'Move smoothly while breathing continuously; change one feature at a time so its effect is clear.',
    'Keep attention on alignment, space, and the lesson focus rather than speed, force, or comparison.',
    'Return to a stable finish and explain the cue, decision, or adjustment that made the movement safer or more effective.',
  ],
  optionalEquipment: 'Optional household equipment may be used only when it is safe, available, and helpful. No specialized or purchased equipment is required.',
  noEquipment: 'Equal-credit no-equipment option: demonstrate the movement pattern in place, seated, supported, or with hand gestures, or draw and explain the movement path and safety decision when movement is not appropriate.',
  safety: [],
}

function categoryFor(focus) {
  return CATEGORY_RULES.find((rule) => rule.pattern.test(focus)) ?? DEFAULT_CATEGORY
}

function ageTechniqueNote(grade) {
  if (grade <= 5) return 'Practice slowly enough to say each cue, and ask a trusted adult to check the cleared area before movement begins.'
  if (grade <= 8) return 'Rehearse the pattern slowly, add only one challenge at a time, and use a trusted adult for any environment or equipment check you cannot confirm.'
  return 'Self-manage the task by rehearsing at low intensity, changing one variable at a time, and choosing control and repeatable technique over a maximal result.'
}

function authoredCues(lesson) {
  return Array.isArray(lesson.cues)
    ? lesson.cues.filter((cue) => typeof cue === 'string' && cue.trim()).map((cue) => cue.trim())
    : []
}

function buildActivitySteps(focus) {
  return [
    'Setup: read the equipment, space, safety, and stop rules; clear the area and choose the standard or adapted path.',
    'Prepare: begin with comfortable joint movements and an easy version of the lesson pattern while breathing normally.',
    `Practice: apply the movement cues for ${focus} at a self-selected easy-to-moderate challenge, resting or reducing the range whenever control changes.`,
    `Apply: show, describe, draw, sign, or write one controlled example of ${focus}, including the cue or decision that made it work.`,
    'Finish: transition to easy movement or rest, then name one safety check and one adjustment for next time. No score, measurement, photo, or recording is needed.',
  ]
}

function buildCompletionCriteria(focus) {
  return [
    `The learner clears or accurately describes the safe space and selects the standard, accessible, or no-equipment path for ${focus}.`,
    'The learner completes or fully describes one controlled practice-and-application sequence using at least one stated movement cue; stopping or resting for safety still counts as responsible completion.',
    'The learner identifies the equipment choice (including none), one safety or stop rule, and one technique adjustment or next step.',
    'A seated, supported, reduced-range, solo, low-space, or no-equipment version earns the same credit when it demonstrates the same cue and decision.',
  ]
}

export function buildPeExecution(lesson, grade) {
  const focus = typeof lesson.focus === 'string' && lesson.focus.trim() ? lesson.focus.trim() : 'the lesson focus'
  const category = categoryFor(focus)
  const sourceCues = authoredCues(lesson)
  const movementCues = sourceCues.length > 0
    ? sourceCues
    : [...category.cues, ageTechniqueNote(grade)]

  return {
    movementCues,
    techniqueLevel: ageTechniqueNote(grade),
    spaceSetup: 'Clear a dry, non-slip area at least two arm-spans wide when available. Mark the boundary with visible household objects or imaginary lines, remove furniture, cords, pets, and breakables, and keep a stable chair or wall nearby if support helps. Low-space path: clear one arm-span while seated or standing and keep every movement in place.',
    equipmentRequirements: {
      required: ['No specialized equipment is required.'],
      optional: [category.optionalEquipment],
      householdSubstitutes: ['Use only soft, unbreakable household items that a trusted adult approves; imaginary equipment and paper planning are always valid substitutes.'],
      equalCreditNoEquipment: category.noEquipment,
    },
    safetyRules: [
      'Check the floor, ceiling, footwear or mobility supports, boundary, and any optional item before moving. Keep people, pets, furniture, cords, and breakables outside the boundary.',
      'Use a self-selected easy-to-moderate challenge, breathe continuously, and choose control over speed, force, distance, or repetition.',
      'Rest, reduce range or pace, use support, or choose the non-movement planning path at any time without losing credit.',
      ...category.safety,
    ],
    stoppingRules: STOP_RULES,
    accessibleAdaptation: 'Use the same cues while seated, supported by a stable chair or wall, using a mobility aid, working through a comfortable reduced range, or describing/gesturing the movement when movement is not appropriate. Work solo or with one trusted adult. The adapted path is assessed for the same control, decision, and explanation and earns equal credit.',
    lowSpaceNoEquipmentAlternative: category.noEquipment,
    activitySteps: buildActivitySteps(focus),
    completionCriteria: buildCompletionCriteria(focus),
    repairCategory: category.id,
  }
}

export const PE_STOP_RULES = STOP_RULES

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasTextArray(value, minimum) {
  return Array.isArray(value) && value.filter(hasText).length >= minimum
}

/** Independent-field audit used by both generation evidence and validation. */
export function auditPeLessonExecutability(lessons) {
  const missingMovementCues = []
  const equipmentBlockers = []
  const missingSafety = []
  const missingAdaptation = []
  const homeUseBlockers = []
  const missingCompletionCriteria = []

  for (const lesson of lessons) {
    const id = lesson.lessonId ?? '<unknown>'
    if (!hasTextArray(lesson.movementCues, 3) || !hasText(lesson.ageAppropriateTechnique)) {
      missingMovementCues.push(id)
    }

    const equipment = lesson.equipmentRequirements
    const hasResolvedEquipment = equipment
      && hasTextArray(equipment.required, 1)
      && hasTextArray(equipment.optional, 1)
      && hasTextArray(equipment.householdSubstitutes, 1)
      && hasText(equipment.equalCreditNoEquipment)
      && /equal-credit|earns equal credit/i.test(equipment.equalCreditNoEquipment)
    if (!hasResolvedEquipment) equipmentBlockers.push(id)

    if (!hasTextArray(lesson.safetyRules, 3) || !hasTextArray(lesson.stoppingRules, 3)) {
      missingSafety.push(id)
    }

    if (!hasText(lesson.accessibleAdaptation)
      || !/seated/i.test(lesson.accessibleAdaptation)
      || !/supported/i.test(lesson.accessibleAdaptation)
      || !/equal credit/i.test(lesson.accessibleAdaptation)) {
      missingAdaptation.push(id)
    }

    if (!hasText(lesson.spaceSetup)
      || !/low-space/i.test(lesson.spaceSetup)
      || !hasText(lesson.lowSpaceNoEquipmentAlternative)
      || !hasTextArray(lesson.activitySteps, 5)) {
      homeUseBlockers.push(id)
    }

    if (!hasTextArray(lesson.completionCriteria, 4)) missingCompletionCriteria.push(id)
  }

  return {
    lessonsAudited: lessons.length,
    missingMovementCues,
    equipmentBlockers,
    missingSafety,
    missingAdaptation,
    homeUseBlockers,
    missingCompletionCriteria,
  }
}
