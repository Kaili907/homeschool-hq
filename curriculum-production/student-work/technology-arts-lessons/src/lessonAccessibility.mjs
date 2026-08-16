/**
 * Task-specific access provisions.
 *
 * Every authored lesson already carries an `accessibility_and_accommodations`
 * list, but for grades 3-8 that list is one generic block repeated across the
 * whole band — it says "adjust representation or response mode" without ever
 * naming the barrier a particular task actually creates. These provisions are
 * derived from what the task concretely demands (a motor act, reading a
 * diagram, hearing a pitch, sustaining a multi-session build, handling studio
 * materials) and are added alongside the authored list, not in place of it.
 *
 * The hard rule: where the barrier IS the learning target — a keyboarding
 * lesson, an ear-training lesson — an alternate route must be named
 * explicitly, because "change the response mode" cannot help when the response
 * mode is the thing being assessed.
 */

const MOTOR_FOCUS = /(typing|keyboard|mouse|trackpad|touchpad|handwriting|instrument|fingering|grip|drawing by hand|manipulat)/i
const AURAL_FOCUS = /(listening|ear|pitch|beat|rhythm|melod|harmon|timbre|tempo|dynamic|loud and soft|high and low|chord|interval|transcrib|aural)/i
const VISUAL_FOCUS = /(colour|color|line|shape|texture|value|composition|notation|score|diagram|graph|chart|layout|typograph|contrast|sketch)/i
const STUDIO_FOCUS = /(paint|clay|sculpt|print|carve|solder|glue|marker|charcoal|pastel|dust|fume|kiln|blade|tool)/i
const PERFORMANCE_FOCUS = /(perform|rehears|stage|movement|dance|theatre|theater|scene|voice|sing|recital|ensemble)/i

/** Modes whose work spans sessions and therefore loads executive function. */
const SUSTAINED_MODES = new Set(['BUILD', 'INCREMENT', 'ASSESS', 'SYNTHESIZE', 'APPLY'])
/** Modes built on studying an external model or source. */
const SOURCE_MODES = new Set(['MODEL', 'MODEL_A', 'MODEL_B', 'INVESTIGATE'])

export function buildAccessibilityProvisions({ focus, mode, subjectKey, elementary }) {
  const isTech = subjectKey === 'technology'
  const out = []
  const plain = (short, full) => out.push(elementary ? short : full)

  if (MOTOR_FOCUS.test(focus)) {
    plain(
      `This task names a hand or body skill (${focus}) as the thing being learned. If that is hard for you, you may use a different way instead — one hand, a switch, voice typing, a bigger or different mouse, eye control, or an adult typing while you say the answer. Using a different way is worth full marks.`,
      `The learning target here is itself a motor act (${focus}), so response-mode substitution alone does not remove the barrier. An alternate input route must be offered and scored identically: one-handed or alternate keyboard layouts, switch access, dictation or voice input, an alternative pointing device, eye-gaze, or scribing by a supporting adult while the learner directs. Assess the underlying concept and the learner's direction of the work, never speed or dexterity.`,
    )
  }

  if (!isTech && AURAL_FOCUS.test(focus)) {
    plain(
      `This task uses sound (${focus}). You do not have to hear it to do it. You may use a written or drawn version, feel the beat by tapping or watching, or read the notes on paper instead.`,
      `This task centres an aural element (${focus}). Provide a fully equivalent non-aural route: notated, written, or graphic representation; visual or tactile pulse (a moving marker, a tapped or felt beat); and vibration or sight-reading in place of listening. Do not require the learner to hear a pitch, interval, or timbre to demonstrate understanding of it.`,
    )
  }

  if (!isTech && VISUAL_FOCUS.test(focus)) {
    plain(
      `This task uses things you look at (${focus}). You may use raised or textured materials, very large print, strong colours, or a spoken description instead.`,
      `This task centres a visual element (${focus}). Provide tactile, raised-line, or high-relief equivalents, enlarged and high-contrast print, and a verbal description route. Never make colour discrimination alone carry a criterion — pair any colour judgement with value, label, or texture.`,
    )
  }

  if (isTech) {
    plain(
      'You can do this with the keyboard only, no mouse needed. Text can be made bigger, and you may do it on paper instead of a screen.',
      'Provide a screen-reader-compatible editor, adjustable font size and contrast, and a complete keyboard-only workflow. An offline paper-and-trace route is available for every task here and is scored identically to an on-screen one.',
    )
  }

  if (!isTech && STUDIO_FOCUS.test(focus)) {
    plain(
      'You may use low-smell, low-dust materials, and you can sit or stand to work. Ask for chunkier handles or grips if that helps.',
      'Offer low-odour and low-dust material substitutes, adaptive grips and enlarged tool handles, and both seated and standing working positions at full height range. Any material a learner cannot safely handle has a stated substitute that meets the same criterion.',
    )
  }

  if (!isTech && PERFORMANCE_FOCUS.test(focus)) {
    plain(
      'You never have to perform in front of people. Showing one trusted grown-up, or just writing about it, counts the same.',
      'Where performance is the target, a private demonstration to one trusted adult carries exactly the same weight as any audience, and requires no recording. A written or notated account of the intended performance is a full substitute.',
    )
  }

  if (SUSTAINED_MODES.has(mode)) {
    plain(
      'This work takes more than one sitting. Ask for a simple checklist with dates so you know what to do next. Keeping track is not part of your grade.',
      'This work spans sessions, so supply a written milestone plan, explicit checkpoint dates, and a task breakdown. Executive-function load — sequencing, holding the plan in mind, remembering where the work stopped — must not become a silent part of what is being assessed.',
    )
  }

  if (SOURCE_MODES.has(mode)) {
    plain(
      'Anything you have to study will also come as plain text, a described version, or a version you can touch.',
      'Any model, source, or artifact under study is supplied in an accessible parallel form: text alternative or transcript, described version, and a tactile or enlarged rendering where the original is visual. The learner is never required to perceive the source in one specific channel to analyse it.',
    )
  }

  plain(
    'You can take a break, stretch, or come back to this later. That does not lower your score.',
    'Breaks, extended time, a hidden timer, reduced copying, and a low-distraction setting are available on request and never reduce the score.',
  )

  return out
}
