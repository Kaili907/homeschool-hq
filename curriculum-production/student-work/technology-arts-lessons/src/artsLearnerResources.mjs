/**
 * Offline, text-native Arts/Music resources for modes that require a model,
 * reference work, or scaffold. All content below is Manuel Academy original.
 */
import { artsTeachingProfile } from './artsProductionDepth.mjs'

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
const ANCHOR_ID = 'ma-g9-arts-and-music-u01-l02'

const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function visualModelAsset(lesson, gradeDir) {
  const title = `${lesson.focus} — relationship study`
  const description = `An Academy-original three-stage visual model for ${lesson.focus}. Stage one shows evenly weighted circle, rectangle, and triangle forms. Stage two isolates one dark circle and lowers contrast elsewhere. Stage three adds a directional path and a materially different alternate arrangement. Labels, pattern, value, size, and position carry the comparison without relying on colour alone.`
  const relativePath = `resources/arts-music/${gradeDir}/${lesson.lesson_id}.arts-model.svg`
  const locator = `curriculum-production/student-work/technology-arts-lessons/${relativePath}`
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520" role="img" aria-labelledby="model-title model-description">
  <title id="model-title">${xml(title)}</title><desc id="model-description">${xml(description)}</desc>
  <rect width="960" height="520" fill="#fffaf0"/><text x="48" y="48" font-family="system-ui,sans-serif" font-size="25" font-weight="700" fill="#172033">${xml(lesson.focus)}</text>
  <g font-family="system-ui,sans-serif" fill="#172033"><text x="48" y="90" font-size="16">1 — even start</text><text x="350" y="90" font-size="16">2 — isolate one relationship</text><text x="652" y="90" font-size="16">3 — build and test a path</text></g>
  <g stroke="#172033" stroke-width="4"><rect x="48" y="110" width="260" height="300" rx="16" fill="#f4efe3"/><circle cx="118" cy="205" r="32" fill="#969696"/><rect x="170" y="250" width="70" height="58" fill="#969696"/><path d="M105 360 L180 320 L255 365 Z" fill="#969696"/>
  <rect x="350" y="110" width="260" height="300" rx="16" fill="#f4efe3"/><circle cx="414" cy="188" r="27" fill="#20242b"/><rect x="470" y="250" width="72" height="58" fill="#a7a7a7"/><path d="M405 370 L490 322 L562 375 Z" fill="#ded7c8"/>
  <rect x="652" y="110" width="260" height="300" rx="16" fill="#f4efe3"/><circle cx="712" cy="185" r="26" fill="#20242b"/><rect x="764" y="245" width="70" height="58" fill="#a7a7a7"/><path d="M700 370 L795 320 L865 380 Z" fill="#ded7c8"/><path d="M735 200 Q790 205 798 240 Q810 305 820 330" fill="none" stroke="#7a4d22" stroke-width="6" stroke-dasharray="12 8"/></g>
  <g font-family="system-ui,sans-serif" font-size="15" fill="#172033"><text x="48" y="448">NON-EXAMPLE: equal weight leaves the route unsettled.</text><text x="48" y="478">WORKED CHANGE: one stronger relationship leads; quiet areas support it.</text><text x="48" y="506">VALID VARIATION: reverse, distribute, or soften the route when evidence serves the learner’s intent.</text></g></svg>\n`
  return { relativePath, locator, content }
}

function anchorResource(lesson) {
  const resourceId = `ma-resource:${lesson.lesson_id}`
  const locator = 'curriculum-production/student-work/technology-arts-lessons/resources/arts-music/grade-09/ma-g9-arts-and-music-u01-l02.visual-hierarchy-model.svg'
  const sourceReference = [
    'ATTACHED MANUEL ACADEMY LEARNER RESOURCE', `Resource ID: ${resourceId}`, `Lesson focus: ${lesson.focus}`,
    'Title: Three Stops — an annotated visual-hierarchy model', 'Creator: Manuel Academy curriculum team',
    'Role: technique model, worked artistic example, partial exemplar, and one possible finished exemplar',
    'The delivered SVG shows a flat start, an intermediate state using placement, value, scale, and isolation, a finished three-stop visual path, and a triangle-first variation. The variation proves that the model’s exact arrangement is not the answer.',
    'Technique sequence: state a focal point; arrange large masses; create the strongest useful difference at the focal point; repeat or direct a feature to build a path; step back or blur-and-glance; revise one variable at a time. Common trouble spot: increasing every contrast equally can make all parts compete.',
    'Access parallel: pencil or pen and scrap paper are enough. For a tactile route, use three raised or cut-paper shapes. Make one shape noticeably rougher, taller, or more isolated, connect the shapes with string, and trace the intended order by touch.',
    'Rights: Manuel Academy original; licensed CC BY 4.0 for learner use and adaptation. No third-party work is included.',
  ].join('\n\n')
  return {
    sourceReference,
    taskInstruction: 'Use the attached Academy-original Three Stops model before guided work; no outside search or teacher-supplied example is required.',
    materialLine: `Supplied reference ${resourceId}: the complete annotated SVG model and its verbal and tactile description are included with this lesson.`,
    media: { required: true, kind: 'SVG_VISUAL_MODEL', locator, fallback: 'Use the supplied full verbal description and the tactile three-shape-and-string route. The reference is a committed Academy asset, not a teacher-supplied or outside-search requirement.' },
    metadata: { resource_id: resourceId, kind: 'ACADEMY_ORIGINAL_MODEL', profile: 'visual', availability: 'ATTACHED_IN_PACKAGE', academy_original: true, license: 'CC-BY-4.0', third_party_content: false, external_dependencies: [], required_paid_tools: [], required_specialized_materials: [], household_accessible: true, silent_text_route_equal_credit: true },
  }
}

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

function focusSpecificContent({ lesson, mode, lessonType }) {
  const p = artsTeachingProfile(lesson.focus, lessonType)
  const worked = `Worked example for ${lesson.focus}: ${p.example}`
  const contextBoundary = p.key === 'contextAnalysis'
    ? ' Source boundary: this invented Academy example teaches analysis procedure only. It is not evidence about a real creator, community, tradition, place, or historical event. Make a real-world context claim only when a substantive cited source is already supplied and accessible; if none is available, label that limitation and keep the response scoped to the Academy example.'
    : ''
  if (mode === 'MODEL_A') {
    return `MODEL A — “One relationship at a time.” ${p.definition} ${p.mechanism} ${worked} Starting state: state the intended effect, question, or criterion before acting. First decision: locate ${p.evidence}. Intermediate state: complete one bounded study, loop, map, or comparison while most features stay stable. Check: cite what changed before judging it. Finished or intentionally partial result: keep the evidence even when it challenges the first intention. Common misapplication: ${p.nonExample} Legitimate variation: another learner may choose different ${p.choices.join(', ')} and still meet the criterion.${contextBoundary}`
  }
  if (mode === 'MODEL_B') {
    return `MODEL B — contrasting route for ${lesson.focus}. Reconnect: ${p.definition} Model A demonstrates: ${p.example} Model B deliberately tests the opposite pressure described here: ${p.tradeoff} Compare the two by locating ${p.evidence}; do not rank them by polish or resemblance. Mark which condition makes each route useful. Then make a third small case that borrows the relationship—not the model’s subject, sequence, wording, style, or interpretation.${contextBoundary}`
  }
  if (mode === 'GUIDED_A') {
    return `GUIDED SCAFFOLD A — first supported pass for ${lesson.focus}. 1 INTENT: name what the study should do. 2 SETUP: choose a safe, available route. 3 NOTICE: locate ${p.evidence}. 4 ACT: complete one small study using this cue—${p.mechanism} 5 CHECK: point to the result before using “works” or “does not work.” 6 SECOND STUDY: change one relationship only. Keep both attempts and circle the exact prompt you are ready to remove. ${worked}${contextBoundary}`
  }
  if (mode === 'GUIDED_B') {
    return `GUIDED SCAFFOLD B — support-fading pass for ${lesson.focus}. Earlier-pass substitute: ${p.example} Mark the relationship involving ${p.evidence.split(', ')[0]} as the fragile move, then hide this resource. Make two new studies, loops, maps, or responses without the prompt. Reopen only afterward; compare the order of decisions and the evidence. Report whether the fragile move held. If it did not, use the criteria to name the mismatch without changing the learner’s intent or copying the example.${contextBoundary}`
  }
  return `REFERENCE WORK — Academy study for ${lesson.focus}. Purpose: give the learner a complete work, event map, process record, or described artifact to observe rather than inventing a missing source. ${p.definition} Reference content: ${p.example} Supplied context: ${p.mechanism} Analysis boundary: first describe ${p.evidence}; then interpret; then use only the supplied context. Tradeoff available for evaluation: ${p.tradeoff} Non-example of evidence use: ${p.nonExample} This Academy instructional reference is not presented as an authentic historical or culturally specific work.${contextBoundary}`
}

function instructionFor(mode, elementary) {
  if (elementary) return 'Use the attached Manuel Academy resource in this package. It gives you the model, example, or help sheet needed for this task.'
  if (mode === 'MODEL_A') return 'Use the attached Academy-original Model A as the first model work; no outside search or teacher-supplied example is required.'
  if (mode === 'MODEL_B') return 'Use the attached Model A recap and contrasting Model B as the two works for comparison; no earlier source file is required.'
  if (mode === 'GUIDED_A') return 'Use the attached Academy-created guided scaffold for both supported studies, then mark the prompt you are ready to remove.'
  if (mode === 'GUIDED_B') return 'Use the attached earlier-pass substitute when prior work is unavailable, hide it as directed, and finish both unassisted studies before checking.'
  return 'Use the attached Academy-original reference work as the work under investigation; no outside artwork, recording, performance, or web source is required.'
}

export function buildArtsLearnerResource({ lesson, unit, mode, taskType, elementary, gradeDir }) {
  if (!ARTS_RESOURCE_MODES.has(mode)) return null
  if (lesson.lesson_id === ANCHOR_ID) return anchorResource(lesson)
  const profile = profileFor(lesson.focus, unit.title, taskType)
  const key = mode === 'MODEL_A' ? 'modelA' : mode === 'MODEL_B' ? 'modelB'
    : mode === 'GUIDED_A' ? 'scaffoldA' : mode === 'GUIDED_B' ? 'scaffoldB' : 'reference'
  const kind = kindFor(mode)
  const resourceId = `ma-resource:${lesson.lesson_id}`
  const instruction = instructionFor(mode, elementary)
  const rights = 'Manuel Academy original; licensed CC BY 4.0 for learner use and adaptation. No third-party text, image, score, lyric, melody, recording, or performance is included.'
  const sourceContent = focusSpecificContent({ lesson, mode, lessonType: taskType })
  const sourceReference = [
    'ATTACHED MANUEL ACADEMY LEARNER RESOURCE',
    `Resource ID: ${resourceId}`,
    `Lesson focus: ${lesson.focus}`,
    `Resource type: ${kind}`,
    `${sourceContent} Use it to study ${lesson.focus}; describe evidence before judging and adapt the demonstrated relationship rather than copying a finished work.`,
    `How to use it: ${instruction}`,
    `Rights: ${rights}`,
    `Access and materials: ${HOUSEHOLD_ARTS_MATERIAL_ROUTE}`,
  ].join('\n\n')
  const asset = ['visual', 'context'].includes(profile) ? visualModelAsset(lesson, gradeDir) : null
  const media = asset
    ? { required: true, kind: 'SVG_VISUAL_MODEL', locator: asset.locator, fallback: 'Use the complete adjacent verbal description and recreate the relationships with raised or movable paper forms. The required Academy model is attached; no outside search is needed.' }
    : profile === 'music'
      ? { required: true, kind: 'LOCALLY_PERFORMABLE_TEXT_NOTATION', locator: `${lesson.lesson_id}#sourceReference`, fallback: 'Count, point through, tap, speak, gesture, or read the complete pulse and pitch map silently; no instrument, speaker, microphone, or recording is required.' }
      : { required: true, kind: 'ATTACHED_TEXT_MODEL_OR_REFERENCE', locator: `${lesson.lesson_id}#sourceReference`, fallback: 'Use the complete supplied beat map, script, evidence record, or event description. No teacher handout or outside search is required.' }
  return {
    sourceReference,
    taskInstruction: instruction,
    materialLine: `Attached Manuel Academy resource ${resourceId}: the complete model, reference work, or scaffold required by this lesson; available in the Source or reading section.`,
    media,
    ...(asset ? { generatedAsset: asset } : {}),
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
