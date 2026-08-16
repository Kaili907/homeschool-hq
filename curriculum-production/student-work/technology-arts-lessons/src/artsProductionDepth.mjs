/**
 * Production-depth Arts/Music composition.
 *
 * This module owns the disciplinary teaching layer that phase-only task shells
 * cannot supply: canonical lesson type, focus-aware explanation, usable
 * technique sequence, differently shaped learner work, learner-owned choices,
 * focus-facing rubric language, and genuinely different retry instruction.
 */

const ANCHOR_ID = 'ma-g9-arts-and-music-u01-l02'

const slug = (value) => value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const TYPE_LABELS = {
  VISUAL_ART_CONCEPT: 'Visual art concept', TECHNIQUE: 'Technique', ART_ANALYSIS: 'Art analysis',
  ART_HISTORY_CONTEXT: 'Art history and context', DESIGN: 'Design', CREATION_STUDIO: 'Creation studio',
  MUSIC_CONCEPT: 'Music concept', RHYTHM: 'Rhythm', MELODY: 'Melody', LISTENING: 'Listening',
  PERFORMANCE: 'Performance', COMPOSITION: 'Composition', CRITIQUE_REFLECTION: 'Critique and reflection',
  REVIEW: 'Review', REMEDIATION: 'Remediation', MASTERY: 'Mastery', PROJECT: 'Project',
}

const MODE_TYPE = {
  RETEACH: 'REMEDIATION', SYNTHESIZE: 'REVIEW', ASSESS: 'MASTERY', CORRECT: 'CRITIQUE_REFLECTION',
  INCREMENT: 'PROJECT',
}

const rx = (value, pattern) => pattern.test(value.toLowerCase())

export function classifyArtsLessonType({ lesson, unit, mode }) {
  const focus = lesson.focus
  if (MODE_TYPE[mode]) return MODE_TYPE[mode]
  if (rx(focus, /portfolio|capstone|concentration|sustained investigation|project management|production schedule|proposal|scope timeline|milestone/)) return 'PROJECT'
  if (rx(focus, /histor|cultur|tradition|context|appropriat|ownership|representation|stereotype|censor|public funding|social impact|artist context|precedent/)) return 'ART_HISTORY_CONTEXT'
  if (rx(focus, /critique|criticism|feedback|reflection|self-assessment|revision|giving and receiving|giving kind|resolving unresolved/)) return 'CRITIQUE_REFLECTION'
  if (rx(focus, /design|client|stakeholder|wayfinding|typograph|prototype|audience experience|camera and framing|cinematograph|presentation concept|format choice/)) return 'DESIGN'
  if (rx(focus, /rhythm|beat|meter|syncopat|duration|pulse/)) return 'RHYTHM'
  if (rx(focus, /melod|pitch|high and low|interval/)) return 'MELODY'
  if (rx(focus, /active listening|respectful listening|ear training|transcription|instrument families|voices|score reading|analysis of .*works/)) return 'LISTENING'
  if (rx(focus, /compos|arrang|harmon|chord|counterpoint|voice leading|form|notation|sequenc|mixing|audio production|recording|sonic|sound and editing/)) return 'COMPOSITION'
  if (rx(focus, /perform|rehears|ensemble|acting|voice|gesture|movement|choreograph|blocking|character|scene|script|directing|stage|audition/)) return 'PERFORMANCE'
  if (rx(focus, /line|shape|colou?r|texture|value|space|perspective|visual hierarchy|focal point|composition|symbol|metaphor/)) return 'VISUAL_ART_CONCEPT'
  if (rx(focus, /tool|material|paint|draw|print|collage|mixed media|three-dimensional|sculpt|craft|safety|technique|studio practice|digital imaging|editing/)) return 'TECHNIQUE'
  if (rx(focus, /analy|interpret|compare|aesthetic|describe|evaluate|looking at new art|critical response/)) return 'ART_ANALYSIS'
  if (rx(focus, /music theory|scale|dynamic|tempo|timbre|musical/)) return 'MUSIC_CONCEPT'
  if (rx(`${focus} ${unit.title}`, /portfolio|capstone|project|production/)) return 'PROJECT'
  return 'CREATION_STUDIO'
}

function profileKey(focus, type) {
  if (rx(focus, /visual hierarchy|focal point|composition/)) return 'visualHierarchy'
  if (rx(focus, /colou?r|value|mood/)) return 'colourValue'
  if (rx(focus, /line|shape|drawing|observation|perspective|space|texture|paint|print|collage|three-dimensional|sculpt|mixed media/)) return 'visualMaking'
  if (['DESIGN'].includes(type) || rx(focus, /design|typograph|wayfinding|camera|framing|cinematograph/)) return 'design'
  if (type === 'RHYTHM') return 'rhythm'
  if (type === 'MELODY') return 'melody'
  if (rx(focus, /instrument families|voices|timbre|listening|aural|ear training|recording|mixing|audio|sound/)) return 'timbreListening'
  if (['MUSIC_CONCEPT', 'COMPOSITION', 'LISTENING'].includes(type)) return 'musicStructure'
  if (type === 'PERFORMANCE' && rx(focus, /scene|script|character|acting|blocking|gesture|movement|choreograph|direct/)) return 'theatreMovement'
  if (type === 'PERFORMANCE') return 'performance'
  if (type === 'ART_HISTORY_CONTEXT' || type === 'ART_ANALYSIS') return 'contextAnalysis'
  if (type === 'PROJECT' || rx(focus, /portfolio|capstone|proposal|documentation|rights|pathway|career|pricing|commission/)) return 'portfolioProject'
  if (type === 'TECHNIQUE') return 'visualMaking'
  return 'crossModal'
}

const P = {
  visualHierarchy: {
    discipline: 'visual art', action: 'arrange and revise visual relationships', evidence: 'placement, scale, value, edge, isolation, repetition, and direction',
    definition: 'Visual hierarchy is the order in which a composition invites attention.',
    mechanism: 'A focal area becomes strong through a noticeable relationship with nearby areas; quiet space and repeated directions can lead attention to later stops.',
    tradeoff: 'A steep hierarchy reads quickly but can silence later areas. A shallow hierarchy can feel open but may make a precise route harder to read.',
    example: 'A small dark isolated form can lead a large pale form because the local value jump and open space are stronger than size alone.',
    nonExample: 'Making every edge, colour, and value equally strong creates competition rather than a controllable path.',
    terms: [['visual hierarchy', 'the order in which a composition invites attention'], ['focal point', 'the area intended as the strongest or first stop'], ['value contrast', 'a difference between light and dark']],
    choices: ['subject or abstraction', 'format and medium', 'focal point', 'hierarchy variables', 'final visual path and revision'],
  },
  colourValue: {
    discipline: 'visual art', action: 'mix, place, or compare colour and value relationships', evidence: 'hue, value, saturation, temperature, adjacency, pattern, and labelled contrast',
    definition: 'Colour names a hue; value names how light or dark it is. Mood comes from relationships among choices, not from one universal colour meaning.',
    mechanism: 'Changing value contrast changes visibility and emphasis; changing saturation or temperature changes energy and distance when viewed beside another colour.',
    tradeoff: 'Strong contrast can improve clarity but reduce subtle transitions. Closely related values can feel unified but may need pattern or labels for access.',
    example: 'Two blue shapes can separate clearly when one is pale and one is dark; two different hues can disappear together when their values match.',
    nonExample: 'Calling every red energetic or every blue calm ignores context, culture, value, saturation, and the maker’s intent.',
    terms: [['hue', 'a colour family such as red, blue, or green'], ['value', 'how light or dark a colour or mark is'], ['saturation', 'how intense or muted a colour appears']],
    choices: ['palette', 'medium', 'mood or purpose', 'contrast strategy', 'revision after the access check'],
  },
  visualMaking: {
    discipline: 'visual studio practice', action: 'test a material or mark-making process', evidence: 'tool pressure, direction, layering, joining, edge, surface, proportion, and safe control',
    definition: 'A studio technique is a repeatable material action used on purpose, not a required personal style.',
    mechanism: 'Pressure, angle, speed, sequence, moisture, layering, or joining changes the visible and tactile result; isolating one variable makes cause and effect easier to notice.',
    tradeoff: 'More control can increase clarity, while a looser action may preserve energy or texture. The useful choice depends on intent and safe material limits.',
    example: 'Three short studies that change only pressure reveal which marks stay light, become dark, or damage the surface.',
    nonExample: 'Copying a polished image without recording setup, actions, and changes hides the technique the lesson is meant to teach.',
    terms: [['study', 'a small experiment made to learn from rather than to display'], ['technique', 'a repeatable way of handling a material or process'], ['craft', 'how deliberately and safely material choices are controlled']],
    choices: ['subject', 'safe material route', 'mark or construction vocabulary', 'degree of finish', 'revision that serves the stated intent'],
  },
  design: {
    discipline: 'design', action: 'define a purpose, generate alternatives, test use, and revise', evidence: 'purpose, audience need, hierarchy, legibility, constraints, feedback, and iteration',
    definition: 'Design organizes choices to serve a stated purpose under real constraints.',
    mechanism: 'A brief turns a need into testable criteria; contrasting sketches expose tradeoffs before time is spent refining one direction.',
    tradeoff: 'A solution can maximize speed, clarity, expression, access, or cost, but rarely all at once. A strong rationale names what was prioritized and why.',
    example: 'Two wayfinding drafts can use the same words but different hierarchy; a five-second find test reveals which supports the stated route.',
    nonExample: 'Choosing the most polished draft without checking it against the brief treats taste as evidence.',
    terms: [['brief', 'a statement of purpose, audience, constraints, and success criteria'], ['prototype', 'a version made to test a decision'], ['iteration', 'a purposeful revision based on a check']],
    choices: ['visual or material direction', 'which need to prioritize', 'prototype format', 'feedback to act on', 'final tradeoff'],
  },
  rhythm: {
    discipline: 'music', action: 'hear, map, create, or perform duration against a steady pulse', evidence: 'pulse, beat placement, duration, subdivision, rest, accent, and grouping',
    definition: 'Pulse is the steady underlying count; rhythm is the pattern of sounds and silences placed against it.',
    mechanism: 'Duration and silence change expectation. Repetition establishes a pattern; displacement, subdivision, or a rest can create contrast without losing the pulse.',
    tradeoff: 'Dense subdivision adds motion but can obscure the main pulse. More space can strengthen shape but may weaken continuity if the count is not maintained.',
    example: 'Count 1 2 3 4 | 1 2 3 4 while using TA TA TI-TI TA | rest TA TA-A TA; the rest changes the rhythm but not the pulse.',
    nonExample: 'Speeding up after a rest changes the pulse instead of performing the intended silence inside it.',
    terms: [['pulse', 'the steady underlying count'], ['rhythm', 'a pattern of sounds and silences'], ['subdivision', 'splitting one beat into smaller equal parts']],
    choices: ['sound, tap, gesture, or silent notation route', 'tempo within a comfortable range', 'pattern shape', 'accent placement', 'final variation'],
  },
  melody: {
    discipline: 'music', action: 'hear, map, create, or perform pitch relationships', evidence: 'pitch direction, interval size, contour, phrase, repetition, arrival, and tonal centre',
    definition: 'Melody is an organized line of pitches heard across time; contour is the shape made by its rises, falls, and repeated tones.',
    mechanism: 'Stepwise motion often connects smoothly, leaps create sharper contrast, and repetition helps the listener recognize a phrase or arrival.',
    tradeoff: 'A narrow range can feel unified but limit contrast. A wide range adds drama but may be harder to sing, play, or track accurately.',
    example: 'C D E G | E D C creates a rise, a high arrival, and a return; arrows or numbered steps preserve the same contour without an instrument.',
    nonExample: 'Naming pitch letters without preserving their order does not show melodic contour.',
    terms: [['melody', 'an organized line of pitches across time'], ['contour', 'the shape of a melody’s rises, falls, and repeated tones'], ['phrase', 'a musical idea that feels grouped as one unit']],
    choices: ['comfortable pitch or symbol set', 'sound or silent notation route', 'contour', 'phrase length', 'final expressive change'],
  },
  timbreListening: {
    discipline: 'music listening and sound', action: 'produce or hear a safe sound contrast, map its qualities, compare evidence, and revise a listening claim', evidence: 'attack, sustain, decay, brightness, density, register, layer, and source action',
    definition: 'Timbre is sound quality—the set of audible features that helps two sources or actions sound different even at a similar pitch and loudness.',
    mechanism: 'The material and action shape a sound’s beginning, continuation, and ending. A quick tap has a sharp attack and short decay; rubbed paper has a softer attack and continuing noise.',
    tradeoff: 'A dense mix can feel full but mask individual layers. A sparse texture reveals timbre clearly but may reduce weight or momentum.',
    example: 'Tap a tabletop once, then rub one sheet of paper for the same count. Map each as ATTACK → SUSTAIN → DECAY and cite the moment that distinguishes them. A trusted adult may produce the two sounds if needed.',
    nonExample: 'Calling one source “better” or naming an instrument family without citing an audible or supplied source feature is preference or recall, not listening evidence.',
    terms: [['timbre', 'the audible quality that distinguishes sound sources or actions'], ['attack', 'how a sound begins'], ['decay', 'how a sound fades or stops']],
    choices: ['safe household sound or supplied event-map route', 'comparison order', 'quality words supported by evidence', 'layer to foreground', 'final listening or production revision'],
  },
  musicStructure: {
    discipline: 'music', action: 'organize, hear, notate, compare, or revise musical relationships', evidence: 'rhythm, contour, harmony, texture, form, dynamics, timbre, and phrase structure',
    definition: 'Musical structure is the pattern of repetition, contrast, layering, and return that makes events relate across time.',
    mechanism: 'A repeated idea creates recognition; contrast changes expectation; return lets the listener compare what changed. Notation or an event map preserves those decisions for checking.',
    tradeoff: 'More layers can enrich texture but hide a main idea. More repetition can create coherence but become predictable without meaningful variation.',
    example: 'An A–B–A plan can keep the pulse constant, change texture in B, and return to A more softly so the return is recognizable but not copied exactly.',
    nonExample: 'Adding unrelated events without a preserved pattern makes the form difficult to hear or verify.',
    terms: [['form', 'the large-scale organization of musical events'], ['texture', 'how many sound layers are present and how they relate'], ['motif', 'a short recognizable musical idea']],
    choices: ['sound source or silent notation', 'form', 'texture', 'expressive change', 'revision after a comparison'],
  },
  theatreMovement: {
    discipline: 'theatre and movement', action: 'rehearse and shape action through space and time', evidence: 'objective, obstacle, gesture, level, distance, pause, pathway, timing, and sequence',
    definition: 'Performance choices make an intention observable through action, timing, space, sound, or stillness.',
    mechanism: 'A pause changes expectation; distance changes relationship; a repeated gesture creates a motif. Each choice gains meaning from what comes before and after it.',
    tradeoff: 'A large gesture reads clearly but can reduce subtlety. A restrained choice can invite attention but may need stronger timing or position to remain legible.',
    example: 'START by the table → LOOK toward the exit → PAUSE two counts → WRITE a plan turns four actions into a readable decision.',
    nonExample: 'Explaining a character’s feeling without making any choice visible in action, timing, or space does not demonstrate performance evidence.',
    terms: [['objective', 'what a character or performer is trying to achieve'], ['blocking', 'planned positions and movement in performance space'], ['pause', 'intentional stillness or silence held for an effect']],
    choices: ['character or abstract movement', 'private performance or paper blocking', 'gesture vocabulary', 'timing', 'interpretive revision'],
  },
  performance: {
    discipline: 'music performance', action: 'prepare, rehearse, interpret, and privately demonstrate a short passage', evidence: 'steady timing, accurate events, phrasing, dynamics, articulation, recovery, and interpretive intent',
    definition: 'Performance turns a preserved plan into time-based evidence through controlled choices and recovery.',
    mechanism: 'A short rehearsal loop isolates one demanding moment; slowing, counting, speaking, fingering silently, or mapping events makes the cause of a break easier to notice.',
    tradeoff: 'A faster or more dramatic interpretation may increase energy but reduce control. A secure tempo can reveal phrasing more clearly.',
    example: 'Loop four events slowly, mark the exact transition that breaks, practise only the two events around it, then return to the full phrase.',
    nonExample: 'Repeating a whole passage from the beginning without identifying the unstable transition produces volume, not focused rehearsal.',
    terms: [['rehearsal loop', 'a short section repeated for one named purpose'], ['interpretation', 'performer choices that shape meaning or effect'], ['recovery', 'a planned way to continue after a break']],
    choices: ['private performance, gesture, or notation evidence route', 'comfortable tempo', 'interpretive emphasis', 'rehearsal strategy', 'final revision'],
  },
  contextAnalysis: {
    discipline: 'arts analysis and context', action: 'separate observation, supplied context, interpretation, and evaluation', evidence: 'specific visible, audible, textual, spatial, or process details plus a cited source claim',
    definition: 'Observation records what is present; interpretation makes a supported claim about meaning or effect; context uses verified information beyond the work.',
    mechanism: 'Keeping those layers separate prevents assumptions about a maker, culture, or intention from being presented as evidence.',
    tradeoff: 'A narrow claim can be strongly supported; a broad historical or cultural claim needs more source evidence and careful limits.',
    example: '“Six arrows stop at a border” is observation. “The interruption may suggest restricted movement” is an interpretation supported by that detail.',
    nonExample: 'Guessing identity, culture, or intent from style alone turns an assumption into a claim.',
    terms: [['observation', 'a neutral detail that can be checked in the work'], ['interpretation', 'a claim about meaning or effect supported by evidence'], ['context', 'verified information about circumstances beyond the work']],
    choices: ['which defensible claim to pursue', 'response format', 'evidence to prioritize', 'question to leave open', 'whether the criteria support revision'],
  },
  portfolioProject: {
    discipline: 'portfolio and project practice', action: 'plan, select, sequence, document, test, and revise a sustained body of work', evidence: 'purpose, milestone, artifact record, decision trail, rights note, criteria check, and next step',
    definition: 'A portfolio or project is a purposeful sequence of work and decisions, not simply a pile of finished pieces.',
    mechanism: 'Selection and sequencing create an argument about growth or purpose; process evidence makes revisions and authorship traceable without continuous surveillance.',
    tradeoff: 'More items can show range but weaken focus. Fewer items can create coherence but must provide enough evidence for the stated goal.',
    example: 'A three-item sequence—question, experiment, revision—can reveal a clearer process than ten unrelated polished pieces.',
    nonExample: 'Choosing only favourites without criteria does not explain why the group belongs together.',
    terms: [['curation', 'purposeful selection and sequencing'], ['artifact', 'a piece of work or process evidence'], ['milestone', 'a bounded checkpoint with reviewable evidence']],
    choices: ['project question', 'items to develop or select', 'private presentation format', 'sequence', 'revision and next-step priorities'],
  },
  crossModal: {
    discipline: 'cross-modal arts practice', action: 'organize events, marks, sounds, words, objects, or movements', evidence: 'sequence, repetition, spacing, duration, scale, contrast, transition, and stated intent',
    definition: 'An artistic relationship can be tested across more than one medium when the same structure—such as repetition, contrast, or sequence—remains observable.',
    mechanism: 'Changing one feature while preserving the others reveals what that feature contributes to the intended effect.',
    tradeoff: 'Moving between media can reveal structure but may change the measured skill; name which evidence transfers and which does not.',
    example: 'Short → short-short → long can be drawn, tapped, moved, or silently counted while preserving its pattern of arrival, urgency, and rest.',
    nonExample: 'Switching media and changing every relationship at once makes it impossible to tell what caused the new effect.',
    terms: [['sequence', 'an intentional order of events'], ['contrast', 'a noticeable difference between related parts'], ['iteration', 'a purposeful version made to test one choice']],
    choices: ['medium', 'subject or source material', 'sequence', 'criterion to test', 'final revision'],
  },
}

const AGE = {
  3: { ref: 'grade-3', language: 'Short sections, one action at a time, and concrete noticing words.', independence: 'Try the first small step yourself; a grown-up may read or demonstrate on separate material.' },
  4: { ref: 'grade-4', language: 'Short ordered steps, defined arts words, and a visible or audible cue beside each action.', independence: 'Complete the bounded study yourself before asking for a cue.' },
  5: { ref: 'grade-5', language: 'Scannable steps with reasons for the main artistic choices.', independence: 'Complete the independent work yourself and explain the reason for each main choice.' },
  7: { ref: 'grade-7-8', language: 'Direct middle-school arts language with constraints, choices, and stopping points separated.', independence: 'Use available definitions and examples, but keep intent and scored decisions your own.' },
  8: { ref: 'grade-7-8', language: 'Direct middle-school arts language with established vocabulary and explicit checkpoints.', independence: 'Anticipate one likely weak point and check it without surrendering the artistic decision.' },
  9: { ref: 'grade-9-12', language: 'Discipline-specific secondary language with new terms defined at first use.', independence: 'Set criteria before making and evaluate observable evidence against them.' },
  10: { ref: 'grade-9-12', language: 'Discipline-specific secondary language with concrete tradeoffs and alternatives.', independence: 'Justify the chosen approach against one considered alternative.' },
  11: { ref: 'grade-9-12', language: 'Advanced studio, rehearsal, analysis, and project language without unnecessary abstraction.', independence: 'Set a meaningful constraint and revise from self-run checks.' },
  12: { ref: 'grade-9-12', language: 'Portfolio-ready disciplinary language with limitations and decisions stated precisely.', independence: 'Produce defensible evidence with intent, method, limitation, and revision traceable.' },
}

const BLOCK_PLAN = {
  PROBE: ['DIAGNOSTIC', 'REFLECTION'],
  MODEL: ['GUIDED_PRACTICE', 'INDEPENDENT_TRANSFER', 'REFLECTION', 'KNOWLEDGE_CHECK'],
  MODEL_A: ['GUIDED_PRACTICE', 'INDEPENDENT_CREATION', 'REFLECTION', 'CRITIQUE', 'KNOWLEDGE_CHECK'],
  MODEL_B: ['COMPARATIVE_MODEL', 'GUIDED_PRACTICE', 'INDEPENDENT_TRANSFER', 'REFLECTION'],
  GUIDED: ['GUIDED_PRACTICE', 'INDEPENDENT_TRANSFER', 'REFLECTION'],
  GUIDED_A: ['GUIDED_PRACTICE', 'INDEPENDENT_TRANSFER', 'REFLECTION'],
  GUIDED_B: ['GUIDED_PRACTICE', 'INDEPENDENT_TRANSFER', 'CRITIQUE', 'REFLECTION'],
  APPLY: ['INDEPENDENT_CREATION', 'CRITIQUE', 'REFLECTION'],
  BUILD: ['PROJECT_BUILD', 'CRITIQUE', 'REVISION', 'REFLECTION'],
  INVESTIGATE: ['REFERENCE_ANALYSIS', 'INDEPENDENT_ANALYSIS', 'REFLECTION', 'KNOWLEDGE_CHECK'],
  RETEACH: ['ALTERNATE_EXPLANATION', 'SUPPORTED_RETRY', 'FRESH_TRANSFER'],
  INCREMENT: ['MILESTONE_PLAN', 'PROJECT_BUILD', 'CRITIQUE', 'REVISION'],
  DEMONSTRATE: ['INDEPENDENT_EVIDENCE', 'SELF_CHECK'],
  SYNTHESIZE: ['REVIEW_MAP', 'INDEPENDENT_TRANSFER', 'REFLECTION'],
  ASSESS: ['INDEPENDENT_EVIDENCE', 'SELF_CHECK'],
  CORRECT: ['ERROR_ANALYSIS', 'SUPPORTED_REVISION', 'FRESH_TRANSFER'],
}

function blockFor(type, i, lesson, profile, age) {
  const id = `work:${lesson.lesson_id}:${slug(type)}`
  const common = { id, type, order: i + 1 }
  const prompts = {
    DIAGNOSTIC: `Before instruction, make or analyse a brief first attempt involving ${lesson.focus}. Keep it unchanged; record three concrete noticings and one question.`,
    COMPARATIVE_MODEL: `Compare the supplied contrasting models for ${lesson.focus}. Locate one shared structure and one decision that changes the effect; do not rank styles.`,
    GUIDED_PRACTICE: /Guided practice B/i.test(lesson.phase)
      ? `Begin the second pass on ${lesson.focus} with the earlier model and cue closed. Make two new studies, compare them with the first supported pass, and report whether the previously fragile move now holds without the prompt.`
      : `Complete the first supported pass on ${lesson.focus} with the supplied model or scaffold visible. Make two short studies, keep one relationship stable, change one ${profile.evidence.split(', ')[0]}, and circle the exact cue you will remove next time.`,
    INDEPENDENT_CREATION: `Create a fresh, bounded work involving ${lesson.focus}. State an intent, choose at least two relevant relationships, preserve one intermediate state, check the result, and make or deliberately decline one revision with a reason.`,
    INDEPENDENT_TRANSFER: /Guided practice B/i.test(lesson.phase)
      ? `Transfer ${lesson.focus} to a third, unfamiliar case without reopening the scaffold. Revisit the move marked fragile in the first pass and cite the independent evidence that shows whether it now works.`
      : `Use ${lesson.focus} in a new case with the model closed. State the intended effect, make or analyse the case, and cite the exact evidence that supports or challenges the intention.`,
    REFERENCE_ANALYSIS: `Use the attached reference for ${lesson.focus}. Separate neutral description, supplied context, interpretation, and criteria-based evaluation.`,
    INDEPENDENT_ANALYSIS: `Make a fresh claim about a different part or event in the supplied reference. Support it with two locatable details and name one reasonable alternative reading.`,
    CRITIQUE: `Describe before judging. Locate evidence, compare it with the maker’s stated intent, ask one genuine question, and offer options; the maker keeps final authority. A private self-critique receives full credit.`,
    REFLECTION: `Compare an earlier and later state. Name the choice that changed, cite what became visible, audible, notated, or workable, and state the next revision or reason to keep the result.`,
    KNOWLEDGE_CHECK: `Explain how one choice changes the effect in ${lesson.focus}, distinguish the worked example from the non-example, and describe the tradeoff in your own words.`,
    PROJECT_BUILD: `Complete one reviewable project increment using ${lesson.focus}. Record the starting state, today’s bounded finish, a criteria check, and one learner-chosen revision.`,
    REVISION: `Change one relationship in response to a named criterion. Preserve the earlier version and explain why the change better serves—or intentionally changes—the stated intent.`,
    MILESTONE_PLAN: `Define today’s purpose, available materials, non-negotiable constraints, learner-owned choices, and the evidence that will mark this ${lesson.focus} milestone complete.`,
    INDEPENDENT_EVIDENCE: `With models and exact cues closed, produce fresh evidence of ${lesson.focus}. Complete the required artistic work independently and preserve enough process evidence for the rubric.`,
    SELF_CHECK: `Check objective constraints first, then cite artistic evidence for each judgment-based criterion. Do not score similarity to a model, polish unrelated to the target, or personal taste.`,
    REVIEW_MAP: `Reconnect ${lesson.focus} with at least two previously taught unit ideas. Label each relationship and identify where it can be observed in actual work.`,
    ALTERNATE_EXPLANATION: `Rebuild ${lesson.focus} through a different representation: reduce it to three events, shapes, values, positions, or decisions and identify the one relationship that carries the target.`,
    SUPPORTED_RETRY: `Use the reduced representation for one supported attempt. Change only one feature, name what you expect, and compare the result with the criterion.`,
    FRESH_TRANSFER: `Put the support away and make a new arrangement, passage, response, or plan. Record what the fresh evidence shows; keep the earlier attempt without penalty.`,
    ERROR_ANALYSIS: `Name the observable mismatch in earlier work without judging taste or effort. Locate it, compare it with the stated criterion, and choose the smallest useful repair.`,
    SUPPORTED_REVISION: `Test the repair on a separate small study before changing the scored work. Use a different cue or representation and record what the test reveals.`,
  }
  return {
    ...common,
    title: type.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
    prompt: prompts[type],
    observable_criterion: `The record locates ${profile.evidence} evidence and explains how it relates to the learner’s stated purpose.`,
    learner_owned_choices: ['intent', ...profile.choices],
    permitted_support: `Definitions, a separate demonstration, a noticing question, material alternatives, and criterion restatement are allowed. ${age.independence} No one else may choose or make a scored artistic decision.`,
    support_fade: /GUIDED|SUPPORTED/.test(type) ? 'Close the model or cue before the next independent or fresh-transfer block.' : undefined,
  }
}

function anchorDepth(base) {
  const focus = base.lesson.focus
  const profile = P.visualHierarchy
  const depth = productionDepth(base, 'VISUAL_ART_CONCEPT', profile)
  depth.contract_version = 'manuel-academy.arts-music-lesson-r1.sample-1'
  depth.learning_goal = 'Use visual-hierarchy variables to create and test an intentional order of attention in an original composition.'
  depth.concept_registry = [
    ['composition', 'The arrangement and relationship of parts within the edges of a work.', 'TAUGHT'],
    ['visual-hierarchy', 'The order in which a composition invites attention.', 'TAUGHT_AND_PRACTICED'],
    ['focal-point', 'The area an artist intends as the strongest or first stop.', 'TAUGHT_AND_PRACTICED'],
    ['negative-space', 'The open area around and between forms, used here to create isolation.', 'TAUGHT_AND_PRACTICED'],
    ['shape-form', 'A bounded visual or tactile area used as a compositional element.', 'PREREQUISITE'],
    ['value', 'Relative lightness or darkness.', 'PREREQUISITE'],
  ].map(([id, meaning, role]) => ({ id: `concept:visual-art:${id}`, meaning, role }))
  depth.technique_registry = [
    ['hierarchy-by-value', 'Create emphasis by controlling the size and location of light-dark differences.', 'MODELED_AND_APPLIED'],
    ['hierarchy-by-scale', 'Create emphasis by controlling relative size without assuming largest must lead.', 'MODELED_AND_AVAILABLE_FOR_APPLICATION'],
    ['hierarchy-by-placement', 'Create emphasis through location, spacing, clustering, and isolation.', 'GUIDED_AND_APPLIED'],
    ['visual-path-test', 'Use a brief first-impression check to record the observed order of attention before judging it.', 'MODELED_AND_APPLIED'],
    ['thumbnail-sketch', 'Make a small, quick composition study to test relationships without aiming for polish.', 'PREREQUISITE'],
  ].map(([id, meaning, role]) => ({ id: `technique:visual-art:${id}`, meaning, role }))
  depth.reference_registry = [
    { ref: 'ref:ma-g9-am-u01-l02:three-stops-svg', role: 'REFERENCE_WORK', title: 'Three Stops — annotated visual-hierarchy model', creator: 'Manuel Academy curriculum team', provenance: 'Academy original created for instruction', rights: 'CC BY 4.0', locator: 'curriculum-production/student-work/technology-arts-lessons/resources/arts-music/grade-09/ma-g9-arts-and-music-u01-l02.visual-hierarchy-model.svg', access_parallel_ref: 'ref:ma-g9-am-u01-l02:three-stops-description' },
    { ref: 'ref:ma-g9-am-u01-l02:three-stops-description', role: 'ACCESSIBLE_PARALLEL', title: 'Three Stops — verbal and tactile description', creator: 'Manuel Academy curriculum team', provenance: 'Embedded in sourceReference', rights: 'CC BY 4.0', locator: `${base.lesson.lesson_id}#sourceReference` },
  ]
  depth.model_registry = [
    { ref: 'model:ma-g9-am-u01-l02:flat-start', role: 'PARTIAL_EXEMPLAR', stage: 1, notice: 'Similar visual weight leaves the first stop unsettled.', creator_choice: 'Use similar mid-values and even spacing as a deliberate non-example.' },
    { ref: 'model:ma-g9-am-u01-l02:build-path', role: 'TECHNIQUE_MODEL', stage: 2, notice: 'Isolation and the largest value jump make the small circle arrive first.', creator_choice: 'Keep the large triangle pale so size does not automatically win.' },
    { ref: 'model:ma-g9-am-u01-l02:three-stops', role: 'WORKED_EXAMPLE_AND_FINISHED_EXEMPLAR', stage: 3, notice: 'A curved directional line and repeated stripe angle carry attention through three stops.', creator_choice: 'The circle-first route is one solution; the alternate panel makes a triangle-first route with different choices.' },
  ]
  depth.work_blocks = [
    { id: 'work:ma-g9-am-u01-l02:guided-placement', type: 'GUIDED_PRACTICE', title: 'Guided study — move the first stop', estimated_minutes: 10, prompt: `Make two 8–10 cm thumbnails with the same three simple forms. In A, cluster the forms evenly. In B, move one form away from the others. Keep size and value as similar as you can.`, bounded_choice: 'Choose which form to isolate and where to place it.', observable_criterion: 'Your notes identify which form arrives first in each thumbnail and cite spacing or placement as evidence.', attempt_before_support: 'Complete both thumbnails and record a first impression before opening the placement cue.', optional_cue: 'If the isolated form still does not lead, enlarge the open space around it without darkening or enlarging the form.', support_fade: 'Close the model and cue before beginning the independent composition.' },
    { id: 'work:ma-g9-am-u01-l02:independent-composition', type: 'INDEPENDENT_CREATION', title: 'Independent studio — design a visual path', estimated_minutes: 25, prompt: 'Choose a subject or use abstract forms. Plan three possible thumbnails, select one, and develop a composition with an intended first, second, and third stop.', objective_constraints: ['Use three or more forms or areas.', 'Name one intended focal point before developing the study.', 'Use at least two hierarchy variables.', 'Preserve one intermediate state.', 'Run one visual-path check and make or deliberately decline one revision with a reason.'], learner_owned_choices: ['subject or abstraction', 'medium and format', 'style, palette, and mood', 'which hierarchy variables to use', 'whether critique evidence calls for revision', 'the final visual path'], permitted_support: 'Definitions, the technique sequence, a parallel example, material alternatives, and criterion restatement remain available. No one else may choose the focal point or alter the scored composition.' },
    { id: 'work:ma-g9-am-u01-l02:reflection', type: 'REFLECTION', title: 'Reflection — trace your decisions', estimated_minutes: 6, prompts: ['Name your intended first, second, and third stops. Cite one visible feature at each location.', 'Compare your preserved intermediate state with the later state. What variable changed, and what did that change do?', 'Which tradeoff did you accept: a steeper route with quieter later areas, or a subtler route with more openness? Explain from the work.'] },
    { id: 'work:ma-g9-am-u01-l02:critique', type: 'CRITIQUE', title: 'Private critique — evidence before advice', estimated_minutes: 6, protocol: ['Describe the first area noticed without judging it.', 'Point to the contrast, spacing, scale, edge, repetition, or direction that produced that stop.', 'Compare the observed path with the artist’s stated intent.', 'Ask one genuine question about the route.', 'Offer two revision possibilities; the artist may choose either, invent another, or keep the work with evidence.'], private_route: 'Use the protocol on your own work after turning it away for one minute. No peer, audience, or public post is required.' },
    { id: 'work:ma-g9-am-u01-l02:knowledge-check', type: 'KNOWLEDGE_CHECK', title: 'Knowledge check — explain the mechanism', estimated_minutes: 4, prompts: ['A large pale form and a small dark isolated form share a page. Give two reasons the small form might arrive first.', 'Why can increasing contrast everywhere weaken an intended hierarchy?', 'Name one situation in which a subtle hierarchy could serve an artist’s intent better than a steep one.'], note: 'This check supports concept understanding but does not replace the independent visual work.' },
  ]
  depth.common_technique_errors = anchorErrors()
  depth.remediation_paths = anchorRemediation()
  depth.rubric_ref = 'rubric:ma-g9-am-u01-l02:visual-hierarchy-r1'
  depth.legitimate_variation = [
    'Difference from the Academy model is never an error and resemblance earns no extra credit.',
    'Subject, abstraction, medium, format, style, palette, and mood remain learner-owned choices.',
    'A focal point may be created through value, scale, placement, isolation, repetition, edge, direction, or another defensible visual relationship.',
    'A learner may support a steep, subtle, distributed, ambiguous, or deliberately nonhierarchical route when the evidence matches the stated intent.',
    'A learner may revise the artwork, revise the stated intention, or keep the result with an evidence-based reason.',
  ]
  depth.tutor_readiness_manifest = manifestFor(depth, base.mode, base.grade)
  return depth
}

function anchorErrors() {
  return [
    { id: 'error:visual-hierarchy:global-contrast-competition', observable_mismatch: 'Several major areas use similarly strong value jumps, hard edges, or detail, so the intended focal point is not a reliably distinct first stop.', not_an_error_when: 'The learner states and supports an intent for distributed, ambiguous, or nonhierarchical attention.', remediation_ref: 'remediation:visual-hierarchy:value-map' },
    { id: 'error:visual-hierarchy:intended-first-stop-not-evidenced', observable_mismatch: 'The learner names a focal point, but two separate three-second checks identify another area first and the learner cannot cite a hierarchy variable supporting the intended area.', not_an_error_when: 'The learner revises the stated intent to match a defensible observed route.', remediation_ref: 'remediation:visual-hierarchy:one-variable-retry' },
  ]
}

function anchorRemediation() {
  return [
    { ref: 'remediation:visual-hierarchy:value-map', for_error_id: 'error:visual-hierarchy:global-contrast-competition', different_instruction: 'Reduce the work to a three-value map. Label each major area light, middle, or dark; circle every large jump. Keep one large jump and lower the others in a fresh thumbnail.', supported_attempt: 'Use three forms and only pencil pressure. Create one dark-light jump at the intended first stop; keep the other forms middle or pale.', self_noticing_cue: 'Squint or use the tactile value labels: can you locate one strongest difference?', fresh_retry: 'Make a new thumbnail with different placements and run a new three-second check.' },
    { ref: 'remediation:visual-hierarchy:one-variable-retry', for_error_id: 'error:visual-hierarchy:intended-first-stop-not-evidenced', different_instruction: 'Cover the work except for the intended focal point and one competing area. Compare only those two; choose whether value, scale, isolation, edge, or direction should separate them.', supported_attempt: 'On scrap paper, redraw the two areas and change exactly one chosen variable.', self_noticing_cue: 'Name the changed variable before deciding which area arrives first.', fresh_retry: 'Return all areas in a fresh thumbnail and test the intended path without the model in view.' },
  ]
}

function manifestFor(depth, mode, grade) {
  const directConcepts = depth.concept_registry.filter((x) => !String(x.role).includes('PREREQUISITE')).map((x) => x.id)
  const prereqConcepts = depth.concept_registry.filter((x) => String(x.role).includes('PREREQUISITE')).map((x) => x.id)
  const directTechniques = depth.technique_registry.filter((x) => !String(x.role).includes('PREREQUISITE')).map((x) => x.id)
  const prereqTechniques = depth.technique_registry.filter((x) => String(x.role).includes('PREREQUISITE')).map((x) => x.id)
  return {
    concept_ids: directConcepts, technique_ids: directTechniques,
    prerequisite_concept_ids: prereqConcepts, prerequisite_technique_ids: prereqTechniques,
    common_technique_error_ids: depth.common_technique_errors.map((x) => x.id),
    reference_refs: depth.reference_registry.map((x) => x.ref), model_refs: depth.model_registry.map((x) => x.ref),
    rubric_refs: [depth.rubric_ref], phase: mode,
    allowed_support: ['DEFINE_TERM', 'DIRECT_ATTENTION', 'REPLAY_OR_REVIEW_MODEL', 'BREAK_PROCESS_INTO_STEPS', 'OFFER_PARALLEL_EXAMPLE', 'ASK_NOTICING_QUESTION', 'RESTATE_CRITERION', 'PROMPT_SELF_EVALUATION', 'SUGGEST_APPROVED_MATERIAL_ALTERNATIVE', 'INVITE_LEARNER_CHOSEN_REVISION'],
    age_policy_ref: `policy:manuel-academy:arts-music:${AGE[grade].ref}-r1`,
  }
}

function productionDepth(base, lessonType, profile) {
  const { lesson, mode, grade, learnerResource } = base
  const focusSlug = slug(lesson.focus)
  const lessonRef = slug(lesson.lesson_id.replace('arts-and-music', 'am').replace('arts-music', 'am'))
  const age = AGE[grade]
  const conceptRegistry = [
    { id: `concept:arts-music:${focusSlug}`, meaning: profile.definition, role: 'TAUGHT_AND_PRACTICED' },
    { id: `concept:${slug(profile.discipline)}:intent-evidence`, meaning: `The relationship among artistic intent, observable ${profile.evidence}, and a criteria-based conclusion.`, role: 'TAUGHT_AND_PRACTICED' },
    { id: `concept:arts-music:${slug(profile.terms[0][0])}`, meaning: profile.terms[0][1], role: 'PREREQUISITE' },
  ]
  const techniqueRegistry = [
    { id: `technique:${slug(profile.discipline)}:${focusSlug}-controlled-study`, meaning: `Isolate and test one ${profile.evidence.split(', ')[0]} relationship while working on ${lesson.focus}.`, role: 'MODELED_AND_APPLIED' },
    { id: `technique:${slug(profile.discipline)}:criteria-check`, meaning: 'Record observable evidence before judging, then choose or decline a revision with a reason.', role: 'GUIDED_AND_APPLIED' },
    { id: `technique:arts-music:small-study`, meaning: 'Use a bounded study, loop, excerpt, map, or prototype to test one relationship without demanding polish.', role: 'PREREQUISITE' },
  ]
  const ref = learnerResource ? `ref:${lessonRef}:attached-resource` : null
  const modelRef = learnerResource && String(learnerResource.metadata.kind).includes('MODEL') ? `model:${lessonRef}:worked-example` : null
  const referenceRegistry = learnerResource ? [{
    ref, role: learnerResource.metadata.kind === 'ACADEMY_ORIGINAL_REFERENCE_WORK' ? 'REFERENCE_WORK' : 'INSTRUCTIONAL_RESOURCE',
    title: `${lesson.focus} — Academy learner resource`, creator: 'Manuel Academy curriculum team',
    provenance: 'Academy original created for instruction', rights: 'CC BY 4.0', locator: `${lesson.lesson_id}#sourceReference`,
  }] : []
  const modelRegistry = modelRef ? [{
    ref: modelRef, role: mode === 'MODEL_B' ? 'CONTRASTING_MODEL' : 'WORKED_EXAMPLE', stage: 1,
    notice: profile.mechanism, creator_choice: `${profile.example} This is one possible route, not the required artistic answer.`,
  }] : []
  const errors = [
    { id: `error:${focusSlug}:relationship-not-locatable`, observable_mismatch: `The stated intent for ${lesson.focus} is present, but the record does not yet locate ${profile.evidence} that supports it.`, not_an_error_when: 'The learner supports a different, ambiguous, subtle, or intentionally open effect with observable evidence.', remediation_ref: `remediation:${focusSlug}:reduced-map` },
    { id: `error:${focusSlug}:all-variables-changed`, observable_mismatch: 'Several relationships changed at once, so the learner cannot yet tell which choice caused the observed effect.', not_an_error_when: 'The task is an intentionally exploratory diagnostic and no causal claim is being scored.', remediation_ref: `remediation:${focusSlug}:one-variable` },
  ]
  const remediation = [
    { ref: `remediation:${focusSlug}:reduced-map`, for_error_id: errors[0].id, different_instruction: `Reduce ${lesson.focus} to three locatable events, areas, steps, or decisions. Label the intended effect beside each and underline the one ${profile.evidence.split(', ')[0]} relationship that should carry it.`, supported_attempt: 'Use a separate small study, four-event loop, thumbnail, evidence table, or paper plan. The adult may model the noticing process on different material but may not change the learner’s work.', self_noticing_cue: `Point to or name the exact ${profile.evidence.split(', ')[0]} evidence before deciding whether it serves the intent.`, fresh_retry: 'Put the support away and make a new arrangement, passage, response, or plan; record what the new evidence shows.' },
    { ref: `remediation:${focusSlug}:one-variable`, for_error_id: errors[1].id, different_instruction: `Return to the last understandable state. Hold every relationship steady except one chosen feature from ${profile.evidence}; predict what that single change should do.`, supported_attempt: 'Test the feature on scrap paper, a silent count, a two-event rehearsal loop, movable shapes, or a short evidence sentence before changing the scored work.', self_noticing_cue: 'Name what stayed the same, what changed, and the first observable result—without using “better” as the evidence.', fresh_retry: 'Create a different small case using the same one-variable method, then transfer the finding to the original task only if it serves the learner’s intent.' },
  ]
  const depth = {
    contract_version: 'manuel-academy.arts-music-lesson-r1.production-1', lesson_type: lessonType, phase: mode,
    learning_goal: `${TYPE_LABELS[lessonType]}: ${profile.action} through ${lesson.focus}, then use observable evidence to explain or revise a learner-owned decision.`,
    prerequisite_summary: `${profile.terms[0][0]} plus the ability to complete a short study, loop, observation, or plan without aiming for polish.`,
    concept_registry: conceptRegistry, technique_registry: techniqueRegistry,
    age_policy: { ref: `policy:manuel-academy:arts-music:${age.ref}-r1`, grade, language: age.language, safety: 'Use familiar low-risk materials, stop or adjust any physical or sound action that causes discomfort, and require adult help for cutting, heat, fumes, or heavy equipment.', privacy: 'Private work and self-critique carry full credit; no public display, identifiable media, account, or recording is required.' },
    vocabulary: profile.terms.map(([term, definition]) => ({ term, definition })),
    concept_instruction: /PROBE|ASSESS/.test(mode) ? [] : [
      { id: `teach:${lessonRef}:definition`, title: `What ${lesson.focus} means here`, body: profile.definition },
      { id: `teach:${lessonRef}:mechanism`, title: 'How the relationship changes the result', body: profile.mechanism },
      { id: `teach:${lessonRef}:tradeoff`, title: 'Choice and tradeoff', body: `${profile.tradeoff} Worked example: ${profile.example} Non-example: ${profile.nonExample}` },
    ],
    reference_registry: referenceRegistry, model_registry: modelRegistry,
    technique_sequence: /PROBE|ASSESS/.test(mode) ? [] : [
      { step: 1, action: 'State the intended effect or question before making or judging.', notice: 'The statement creates a criterion that can be checked.', why: 'Arts evidence is interpreted in relation to purpose, not personal taste.' },
      { step: 2, action: `Identify or set up the relevant ${profile.evidence}.`, notice: `Locate the first relationship that can be observed in ${lesson.focus}.`, why: profile.mechanism },
      { step: 3, action: 'Complete one small controlled study or rehearsal loop.', notice: 'Keep most relationships stable so one decision remains readable.', why: 'A bounded test makes cause and effect easier to notice.' },
      { step: 4, action: 'Transfer the idea to a fresh work, excerpt, source detail, or project decision.', notice: 'Close the model or cue before the independent decision.', why: 'Transfer—not copying—shows usable understanding.' },
      { step: 5, action: 'Check against criteria and choose a revision or a reasoned decision to keep the result.', notice: 'Cite a location, moment, event, or process fact before judging.', why: 'Evidence protects creative variation and learner authority.' },
    ],
    work_blocks: BLOCK_PLAN[mode].map((type, i) => blockFor(type, i, lesson, profile, age)),
    common_technique_errors: errors, remediation_paths: remediation,
    rubric_ref: `rubric:${lessonRef}:${focusSlug}-r1`,
    legitimate_variation: [`Different ${profile.choices.join(', ')} choices are valid when the learner meets objective constraints and supports the result with evidence.`, 'Difference from an Academy model is never an error and resemblance earns no extra credit.', 'A learner may revise the work, revise the stated intention, support ambiguity, or keep the result when the evidence-based reasoning is coherent.'],
  }
  depth.tutor_readiness_manifest = manifestFor(depth, mode, grade)
  return depth
}

export function buildArtsProductionDepth(base) {
  const lessonType = classifyArtsLessonType(base)
  const profile = P[profileKey(base.lesson.focus, lessonType)]
  const depth = base.lesson.lesson_id === ANCHOR_ID ? anchorDepth(base) : productionDepth(base, lessonType, profile)
  return { lessonType: depth.lesson_type, profile, depth }
}

export function artsTeachingProfile(focus, lessonType) {
  const key = profileKey(focus, lessonType)
  return { key, ...P[key] }
}

export function buildArtsRubric({ depth, profile, mode, focus }) {
  if (depth.contract_version.includes('sample-1')) {
    return [
      { dimension: 'Objective constraints', criterion_kind: 'OBJECTIVE', exceeds: 'All five evidence groups are present: guided pair, original three-form study with named focal point, two named variables, preserved intermediate state plus path check and revision decision, and evidence-based reflection and critique.', meets: 'All required evidence is present; one note may be brief, but the guided pair, original study, two variables, intermediate state, path check, revision decision, reflection, and critique can each be located.', developing: 'The independent visual study is present, but one or two required evidence parts are missing or cannot be located, such as the intermediate state, path check, revision decision, reflection, or critique.', beginning: 'The submitted evidence does not yet include an independent three-form visual study with a named focal point, or several required process parts are absent.' },
      { dimension: 'Visual-hierarchy evidence', criterion_kind: 'JUDGMENT_BASED', exceeds: 'At least two hierarchy variables work together to establish the intended first stop and a readable later route; the learner precisely locates the strongest relationships and explains a meaningful tradeoff.', meets: 'At least two named variables create observable emphasis related to the intended focal point, and the learner cites where the eye or hand moves next using evidence from the work.', developing: 'Hierarchy variables are attempted, but the stated route and the observable relationships only partly align, or the explanation names variables without locating their effect in the work.', beginning: 'The work or explanation does not yet show a testable intended order of attention. This is a signal for focused reteaching, not a judgment about style or ability.' },
      { dimension: 'Intent and interpretation', criterion_kind: 'JUDGMENT_BASED', exceeds: 'The learner makes a coherent, evidence-supported case for the chosen hierarchy and recognizes another defensible reading or a deliberate ambiguity without treating it as failure.', meets: 'The learner states the intended order and connects specific value, scale, placement, isolation, repetition, edge, or direction evidence to that intention.', developing: 'The intended order is stated, but several claims rely on preference or general praise instead of observable evidence from specific locations.', beginning: 'The response does not yet state an intention or connect a reading to observable evidence; no particular style, subject, mood, or arrangement is required.' },
      { dimension: 'Process and learner-owned revision', criterion_kind: 'JUDGMENT_BASED', exceeds: 'The intermediate state, path check, and later state show what was tested; the learner isolates a variable, evaluates its effect, and gives an evidence-based reason to revise or deliberately keep the result.', meets: 'The record shows an intermediate state, one criteria-based check, and a learner-chosen revision or reasoned decision to keep the work.', developing: 'A change is documented, but the record does not yet make clear what evidence prompted it or which hierarchy variable changed.', beginning: 'No intermediate state or revision decision is visible yet. Invite a small fresh test; do not direct the learner’s aesthetic choice or complete the work.' },
    ]
  }
  const objective = depth.work_blocks.flatMap((b) => b.objective_constraints ?? []).slice(0, 4)
  const modeNeed = /ASSESS|DEMONSTRATE/.test(mode) ? 'fresh independent evidence' : /PROBE/.test(mode) ? 'an unchanged baseline' : /RETEACH|CORRECT/.test(mode) ? 'the alternate explanation, supported attempt, and new transfer' : 'the required work blocks and one reviewable process state'
  return [
    { dimension: 'Objective evidence', criterion_kind: 'OBJECTIVE', exceeds: `All required evidence for ${focus} is present, clearly labelled, and includes ${modeNeed} plus a complete criteria check.`, meets: `The submission contains ${modeNeed}; each required artifact, study, response, or process note can be located.`, developing: `The central Arts work is present, but one required evidence part for ${focus} is missing or cannot be located.`, beginning: `The submission does not yet contain the central ${profile.discipline} evidence required by this lesson.` },
    { dimension: `${TYPE_LABELS[depth.lesson_type]} evidence`, criterion_kind: 'JUDGMENT_BASED', exceeds: `The learner precisely locates ${profile.evidence}, explains how multiple relationships work together, and identifies a meaningful tradeoff.`, meets: `The learner locates relevant ${profile.evidence} and explains how the evidence relates to the stated intent, claim, or criterion.`, developing: `Relevant choices are attempted, but the explanation does not yet locate their effect or connect it consistently with the stated purpose.`, beginning: `The work does not yet provide locatable evidence of ${focus}; use the registered retry route without judging style or ability.` },
    { dimension: 'Intent, interpretation, and choice', criterion_kind: 'JUDGMENT_BASED', exceeds: 'The reasoning supports the learner’s choices, recognizes another defensible route, and distinguishes objective constraints from open artistic decisions.', meets: 'The learner states an intent or claim and supports it with observable evidence while retaining ownership of artistic decisions.', developing: 'An intent or interpretation is stated, but key claims rely on preference, polish, or resemblance rather than evidence.', beginning: 'No supported intent or interpretation is visible yet; no particular style, mood, subject, or model-like result is required.' },
    ...(/ASSESS|DEMONSTRATE/.test(mode) ? [{ dimension: 'Independent transfer', criterion_kind: 'OBJECTIVE', exceeds: 'The fresh evidence is complete, independently produced, checked against every stated criterion, and supported by a clear process record.', meets: 'The required fresh work was produced independently with models and exact cues closed, then checked against the stated criteria.', developing: 'The central work is present, but the record shows more support than the evidence condition permits or an independent check is incomplete.', beginning: 'Fresh independent evidence is not yet available; do not infer mastery from a copied model, cued continuation, or reflection alone.' }] : []),
    ...(BLOCK_PLAN[mode].some((x) => /REVISION|REFLECTION|CRITIQUE|TRANSFER|PROJECT/.test(x)) ? [{ dimension: 'Process and learner-owned revision', criterion_kind: 'JUDGMENT_BASED', exceeds: 'Earlier and later evidence makes the tested relationship traceable; the learner gives a criteria-based reason to revise or deliberately keep the result.', meets: 'The process record shows a check and a learner-chosen revision or reasoned decision to keep the result.', developing: 'A change is visible, but the evidence that prompted it or the relationship changed is unclear.', beginning: 'No check or revision decision is visible yet; invite a bounded test without directing the learner’s artistic choice.' }] : []),
  ]
}

export function artsPrimaryProjection({ depth, lesson, grade }) {
  const teachingCount = depth.contract_version.includes('sample-1') || /MODEL|INVESTIGATE/.test(depth.phase)
    ? depth.concept_instruction.length
    : /GUIDED/.test(depth.phase)
      ? Math.min(2, depth.concept_instruction.length)
      : /APPLY|INCREMENT/.test(depth.phase)
        ? Math.min(1, depth.concept_instruction.length)
        : 0
  const teaching = depth.concept_instruction.slice(0, teachingCount).map((x) => `${x.title}: ${x.body}`).join(' ')
  const steps = depth.work_blocks.map((x, i) => `${i + 1}. ${x.title}: ${x.prompt}`).join(' ')
  const choice = `Your choices remain yours: ${depth.legitimate_variation[0]}`
  const authoredTarget = `Target for this ${depth.phase.toLowerCase()} session: ${lesson.learning_objectives.join(' ')} Closing evidence check: ${lesson.formative_check}`
  const primaryTask = `${authoredTarget} ${teaching ? `${teaching} ` : ''}${steps} ${choice}`
  const taskSteps = [3, 4, 5].includes(grade)
    ? depth.work_blocks.flatMap((block) =>
        block.prompt.split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence, index) =>
          index === 0 ? `${block.title}: ${sentence}` : sentence,
        ),
      )
    : undefined
  const taskBrief = `${TYPE_LABELS[depth.lesson_type]} work on ${lesson.focus}. ${depth.learning_goal} ${AGE[grade].independence}`
  return { taskBrief, primaryTask, taskSteps }
}

export function artsRemediationProjection(depth) {
  return depth.remediation_paths.map((path, i) => `Route ${i + 1}: ${path.different_instruction} ${path.supported_attempt} Check yourself: ${path.self_noticing_cue} New attempt: ${path.fresh_retry}`).join(' ')
}

export function artsScoringGuidance({ depth, profile, focus, mode }) {
  if (depth.contract_version.includes('sample-1')) return 'Score the submitted evidence against the four focus-specific dimensions. First record objective presence without judging polish. For hierarchy, intent, and revision, cite a location or process fact from the learner’s work. Do not compare the work with the model’s shapes, arrangement, palette, mood, or style. If the observed path differs from the learner’s first intention, accept a reasoned revision of either the work or the stated intention. A reviewer may offer options, but the learner owns the final choice. Record NOT_YET_EVIDENCED when evidence is absent; never infer talent, care, motivation, diagnosis, or character.'
  return `Score ${focus} with the focus-facing rubric, not a fixed answer key. Record objective presence first. For judgment-based dimensions, cite locatable ${profile.evidence} from the actual submission and connect it to the learner’s intent or claim. ${depth.legitimate_variation.join(' ')} ${/ASSESS|DEMONSTRATE/.test(mode) ? 'This evidence must be independent; clarification may not reveal or complete the artistic answer.' : 'A rough or model-different result can meet the lesson when the evidence and reasoning satisfy the criterion.'} Never infer talent, taste, effort, motivation, diagnosis, or character from the work.`
}

export const ARTS_ANCHOR_ID = ANCHOR_ID
