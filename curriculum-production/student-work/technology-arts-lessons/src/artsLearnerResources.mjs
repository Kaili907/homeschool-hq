/**
 * Offline, text-native Arts/Music resources for modes that require a model,
 * reference work, or scaffold. All content below is Manuel Academy original.
 */

export const ARTS_RESOURCE_MODES = new Set([
  'MODEL_A', 'MODEL_B', 'GUIDED_A', 'GUIDED_B', 'INVESTIGATE',
])

export const HOUSEHOLD_ARTS_MATERIAL_ROUTE =
  'Household-accessible route: pencil or pen and scrap paper are enough. For sound or performance work, tap, clap, use spoken syllables, move a finger, or notate silently. Specialized art materials, instruments, paid software, cameras, microphones, and recording devices are optional and never affect credit.'

const VISUAL = /\b(colou?r|line|shape|texture|value|space|composition|visual|paint|draw|collage|print|media|typograph|hierarchy|photograph|sketch|sculpt|material|design|wayfinding|contrast)\b/i
const MUSIC = /\b(music|rhythm|beat|meter|syncopat|melod|pitch|harmon|chord|interval|triad|counterpoint|notation|arrang|tempo|dynamic|aural|transcri|voice leading|sonic|mixing|audio)\b/i
const THEATRE = /\b(theatre|theater|scene|script|character|gesture|movement|dance|choreograph|blocking|acting|direct|rehears|ensemble|stage|performance|dramaturg|voice|audience|presentation)\b/i
const PORTFOLIO = /\b(portfolio|artist statement|curat|exhibition|documentation|archiv|pathway|career|application|proposal|scope|timeline|pricing|commission|compensation|goal setting|rights|permission|attribution|research|sourcing)\b/i
const CONTEXT = /\b(culture|tradition|context|identity|representation|stereotype|censor|appropriation|appreciation|ethic|critique|criticism|aesthetic|historical|funding|social impact|access|ownership)\b/i

function profileFor(focus, unitTitle, taskType) {
  // The day's focus outranks the broad unit title and the legacy task-type
  // classifier. This keeps, for example, "audio production" on a music model
  // inside a digital-media unit and "community traditions" on a context model
  // inside a mixed art/music unit.
  if (PORTFOLIO.test(focus)) return 'portfolio'
  if (THEATRE.test(focus)) return 'theatre'
  if (VISUAL.test(focus)) return 'visual'
  if (MUSIC.test(focus)) return 'music'
  if (CONTEXT.test(focus)) return 'context'
  if (PORTFOLIO.test(unitTitle) || taskType === 'portfolio_and_capstone') return 'portfolio'
  if (THEATRE.test(unitTitle) || taskType === 'theatre_and_movement') return 'theatre'
  if (VISUAL.test(unitTitle) || ['visual_studio_practice', 'design_and_communication'].includes(taskType)) return 'visual'
  if (MUSIC.test(unitTitle) || taskType === 'music_theory_and_listening') return 'music'
  if (CONTEXT.test(unitTitle) || taskType === 'critical_response_and_context') return 'context'
  return 'cross-modal'
}

const PROFILES = {
  visual: {
    modelA: 'MODEL A — "Near, Middle, Far." Imagine a small dark circle at upper left, a medium striped rectangle at centre, and a large pale triangle touching the lower edge. A thin curved line links them. The strongest contrast surrounds the circle. Intent: guide the eye from circle to rectangle to triangle. Notice placement, contrast, repetition, and scale. For a one-element pencil study, draw three shapes and alter exactly one choice.',
    modelB: 'MODEL B — "Even Field," contrasting with "Near, Middle, Far." Imagine nine same-size grey squares in a three-by-three grid. Equal spacing and value remove a single focal point; one square rotates slightly but is not darker or larger. Model A directs the eye through scale and contrast. Model B makes the eye scan for a quiet exception. Make a pencil study using equality plus one exception.',
    scaffoldA: 'GUIDED SCAFFOLD A — Make two pencil-box studies. For each fill INTENT (calm, energy, balance, or tension); CHOICE (line, shape, value, spacing, or scale); MAKE (five marks or fewer); CHECK (point to the mark doing the work); REVISE (change one mark). Keep both and circle the box you cannot yet complete without the prompt.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: copy this plan—small dark circle, two parallel lines, pale triangle, curved connector—and label its focal point. Mark contrast as fragile, then hide this resource. Make two fresh five-mark studies from memory, changing one relationship in each. Reopen only afterward; compare placement, contrast, and effect.',
    reference: 'REFERENCE WORK — "Window Rhythm." On a portrait rectangle are twelve outlined squares. The top row is evenly spaced. In the middle row, two squares overlap and one is dark. The bottom row has wider gaps and one square is cut off by the edge. A thin diagonal crosses lower left to upper right. The work uses only black, white, line, shape, spacing, overlap, and value.',
  },
  music: {
    modelA: 'MODEL A — "Four-Step Signal," an eight-beat idea. Pulse: 1 2 3 4 | 1 2 3 4. Rhythm: TA TA TI-TI TA | rest TA TI-TI TA. Optional pitches: C D E G | rest E D C. Shape: rise for four beats, pause, then return. Perform by tapping, speaking syllables, moving a finger, or reading silently. Change one event for a short study.',
    modelB: 'MODEL B — "Off-Centre Signal," contrasting with "Four-Step Signal." Pulse: 1 2 3 4 | 1 2 3 4. Rhythm: TA TI-TI rest TA | TI-TI TA-A TA. Optional pitches: C E D G | E D C C. Model A pauses at the bar line; Model B places silence inside the first group and lengthens a later event. Compare stability and surprise.',
    scaffoldA: 'GUIDED SCAFFOLD A — Use two four-pulse grids. In each box write or tap TA, TI-TI, rest, or hold. State an intent, point or perform through it, and circle the event creating the effect. In grid 2 change one box only. Mark the result same, stronger, or weaker and give one reason. Circle the step you still need prompted.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: TA TA TI-TI TA | rest TA TI-TI TA, or eight drawn pulse boxes. Mark the rest as fragile, then hide this resource. Create two new eight-pulse patterns. Reopen only afterward; compare order, pulse, and effect, then report whether the fragile move held. No instrument or audio is needed.',
    reference: 'REFERENCE WORK — "Returning Steps," a text-notated micro-composition. Pulse: 1 2 3 4 | 1 2 3 4. Rhythm: TA TI-TI TA rest | TA-A TI-TI TA. Optional pitches: C D E G | G E D C. Dynamics: soft for beats 1–4, medium for beats 5–7, soft on beat 8. Form: opening rise, held arrival, return.',
  },
  theatre: {
    modelA: 'MODEL A — "The Missing Note," a private micro-scene. A crosses three steps toward a table, stops, and says, "I left it here." B points away and answers, "Then start with the last place you remember." A looks toward the exit but remains still for two counts. Intent: show uncertainty becoming a decision through distance, pause, gesture, and dialogue.',
    modelB: 'MODEL B — "The Doorway," contrasting with "The Missing Note." A begins beside the exit and says, "I know where to look." B takes one step into A\'s path and answers, "Knowing is not the same as checking." A turns away, pauses one count, then writes a plan. Model A uses stillness for uncertainty; Model B changes position to show conflict and choice.',
    scaffoldA: 'GUIDED SCAFFOLD A — Build two four-beat scene or movement studies. Fill 1 WHERE/START; 2 WANT; 3 OBSTACLE OR CHANGE; 4 CHOICE/END. Add one pause and one change of distance. In Study 2 change either pause or distance, not both. Name the intended effect and exact beat creating it. Paper figures, arrows, or writing count fully.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: START by table → LOOK toward exit → PAUSE two counts → WRITE a plan. Mark PAUSE as fragile, then hide this resource. Create two new four-beat sequences with paper markers, arrows, or performance. Reopen only afterward; compare start, change, pause, and ending effect.',
    reference: 'REFERENCE WORK — "Choice at the Table," a four-beat scene. Beat 1: Rowan stands two steps from a table and wants a folded note. Beat 2: Kai places an open hand beside—never on—the note and asks, "Do you want time before we decide?" Beat 3: Rowan steps back, pauses, and says, "Read only the first line." Beat 4: Kai nods and both turn their chairs toward the table.',
  },
  portfolio: {
    modelA: 'MODEL A — Work record for "Three Routes." Intent: make a viewer compare three paths. Evidence: thumbnail 1 was crowded; thumbnail 2 had one focal point; version 3 enlarged the centre path after a pencil test. Statement: "I repeated angled lines to suggest choice. I widened the centre path because equal widths made every route feel equally important." Identify claim, evidence, and revision reason.',
    modelB: 'MODEL B — Contrast record for "One Clear Route." Intent: make a viewer follow one path. Two thumbnails were rejected because three equal paths weakened the message. The final uses one continuous line and empty space. Statement: "I removed two paths after checking whether a reader could name the focal route in five seconds." Compare this evidence-first decision with Model A.',
    scaffoldA: 'GUIDED SCAFFOLD A — Complete two evidence records. Each has ITEM OR IDEA; INTENT; ONE OBSERVABLE CHOICE; CHECK USED; NEXT REVISION. Record 1 may use Model A. Record 2 uses a different choice or your own plan. Underline sentences pointing to evidence; revise words such as good, bad, or like. Circle the prompt still needed.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: ITEM "Three Routes"; INTENT compare choices; EVIDENCE three paths became one after a focal-point check; NEXT STEP test spacing. Mark EVIDENCE as fragile, then hide this resource. Write two fresh records. Reopen only afterward; compare specificity, evidence, and next step.',
    reference: 'REFERENCE WORK — Mini-portfolio "Routes." Item A: three pencil thumbnails testing path direction. Item B: a four-event notated sound pattern testing repetition. Item C: a one-page reflection comparing which revision clarified intent. Sequence rationale: question → experiment → evidence. Rights log: every item is an Academy-original example. Access note: each item has a text description and may be reviewed privately.',
  },
  context: {
    modelA: 'MODEL A — "Meeting Place," a described paper construction of overlapping door-shaped forms made from imaginary transit tickets. Blue forms cluster at the edges; one orange form is central. A caption says the maker considered how shared spaces can welcome some people while confusing others. Separate observation, supplied context, and an interpretation supported by a visible choice.',
    modelB: 'MODEL B — "Closed Map," contrasting with "Meeting Place." It is a monochrome map-like drawing with six paths stopping at thick borders and no marked centre. The maker note says the work asks how directions can appear neutral while limiting access. Model A uses a welcoming centre and layered colour; Model B uses interruption and restricted movement. Do not infer beyond the supplied notes.',
    scaffoldA: 'GUIDED SCAFFOLD A — Use "Meeting Place," then "Closed Map." For each fill OBSERVE (three neutral details); CONTEXT (only the supplied note); INTERPRET (one claim); EVIDENCE (the exact supporting detail). Cross out any claim assuming identity, intention, or culture beyond the note. Circle the box you cannot complete without labels.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: OBSERVE blue door forms around one orange centre; CONTEXT caption discusses shared space; INTERPRET centre may signal access; EVIDENCE colour and position. Mark the evidence link as fragile, then hide this resource. Analyse "Closed Map" twice from memory. Reopen only afterward and check that observation, context, interpretation, and evidence remain separate.',
    reference: 'REFERENCE WORK — "Shared Directions," a described installation. Six cardboard arrows point toward a low central platform; two include raised dots and every colour difference also has a word label. A maker note says an imaginary town requested a meeting marker understandable without colour vision, reading aloud, or personal disclosure. A process note says a first version used colour alone and changed after an access check.',
  },
  'cross-modal': {
    modelA: 'MODEL A — "Three Signals." Event 1 is one short dark mark or tap. Event 2 repeats it twice, closer together. Event 3 is a long light mark or held silent count. Intent: move from arrival to urgency to rest. Name how repetition, spacing, duration, scale, or contrast produces the effect. Re-create one event with pencil, household objects, movement, or silent notation.',
    modelB: 'MODEL B — "One Long Signal," contrasting with "Three Signals." It uses one continuous line, held count, or slow gesture interrupted once at the midpoint. Model A changes three events; Model B builds tension inside one event. Compare structure, pacing, and effect, then create a study using continuity plus one interruption.',
    scaffoldA: 'GUIDED SCAFFOLD A — Make two three-event studies. For each fill INTENT → EVENT 1 → EVENT 2 → EVENT 3 → CHECK. Events may be marks, taps, household-object sounds, gestures, words, or silent symbols. Change one feature between studies: spacing, duration, scale, repetition, or contrast. Name the effect and circle the prompt still needed.',
    scaffoldB: 'GUIDED SCAFFOLD B — Earlier-pass substitute: short event → repeated short event → long event; effect arrival → urgency → rest. Mark the middle event as fragile, then hide this resource. Make two new three-event studies. Reopen only afterward; compare sequence, contrast, and effect, then report whether the fragile move held.',
    reference: 'REFERENCE WORK — "Pause / Turn / Return." Read it as three pencil events, silent gestures, or sound events: a short mark or tap, a turn or repeated mark, then a longer return event. The first and third share one feature; the middle interrupts it. Intent: make a pattern feel changed without losing coherence.',
  },
}

function kindFor(mode) {
  if (mode.startsWith('MODEL')) return 'ACADEMY_ORIGINAL_MODEL'
  if (mode.startsWith('GUIDED')) return 'ACADEMY_CREATED_SCAFFOLD'
  return 'ACADEMY_ORIGINAL_REFERENCE_WORK'
}

function instructionFor(mode, elementary) {
  if (elementary) return 'Use the attached Manuel Academy resource in this package. It gives you the model, example, or help sheet needed for this task.'
  if (mode === 'MODEL_A') return 'Use the attached Academy-original Model A as the first model work; no outside search or teacher-supplied example is required.'
  if (mode === 'MODEL_B') return 'Use the attached Model A recap and contrasting Model B as the two works for comparison; no earlier source file is required.'
  if (mode === 'GUIDED_A') return 'Use the attached Academy-created guided scaffold for both supported studies, then mark the prompt you are ready to remove.'
  if (mode === 'GUIDED_B') return 'Use the attached earlier-pass substitute when prior work is unavailable, hide it as directed, and finish both unassisted studies before checking.'
  return 'Use the attached Academy-original reference work as the work under investigation; no outside artwork, recording, performance, or web source is required.'
}

export function buildArtsLearnerResource({ lesson, unit, mode, taskType, elementary }) {
  if (!ARTS_RESOURCE_MODES.has(mode)) return null
  const profile = profileFor(lesson.focus, unit.title, taskType)
  const key = mode === 'MODEL_A' ? 'modelA' : mode === 'MODEL_B' ? 'modelB'
    : mode === 'GUIDED_A' ? 'scaffoldA' : mode === 'GUIDED_B' ? 'scaffoldB' : 'reference'
  const kind = kindFor(mode)
  const resourceId = `ma-resource:${lesson.lesson_id}`
  const instruction = instructionFor(mode, elementary)
  const rights = 'Manuel Academy original; licensed CC BY 4.0 for learner use and adaptation. No third-party text, image, score, lyric, melody, recording, or performance is included.'
  const sourceReference = [
    'ATTACHED MANUEL ACADEMY LEARNER RESOURCE',
    `Resource ID: ${resourceId}`,
    `Lesson focus: ${lesson.focus}`,
    `Resource type: ${kind}`,
    `${PROFILES[profile][key]} Use it to study ${lesson.focus}; describe evidence before judging and adapt the example rather than copying a finished work.`,
    `How to use it: ${instruction}`,
    `Rights: ${rights}`,
    `Access and materials: ${HOUSEHOLD_ARTS_MATERIAL_ROUTE}`,
  ].join('\n\n')
  return {
    sourceReference,
    taskInstruction: instruction,
    materialLine: `Attached Manuel Academy resource ${resourceId}: the complete model, reference work, or scaffold required by this lesson; available in the Source or reading section.`,
    metadata: {
      resource_id: resourceId,
      kind,
      profile,
      availability: 'ATTACHED_IN_PACKAGE',
      academy_original: true,
      license: 'CC-BY-4.0',
      third_party_content: false,
      external_dependencies: [],
      required_paid_tools: [],
      required_specialized_materials: [],
      household_accessible: true,
      silent_text_route_equal_credit: true,
    },
  }
}
