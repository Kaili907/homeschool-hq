import type { FixedTest } from '../types'

// Transcribed VERBATIM from HS-English-Reading-Placement.md, Part 3.
// hs-essay: main timed prompt (both girls), 45:00 hard lock with grace.
// hs-essay-senior-b: Part 3B, senior only, 30:00 SOFT timer (warns, never locks),
// flagged ungraded.

export const HS_ESSAY: FixedTest = {
  id: 'hs-essay',
  title: 'Timed Essay',
  forGrades: ['10', '12'],
  timerSec: 45 * 60,
  intro:
    'You have 45 minutes. Planning on scratch paper is encouraged; handwritten or typed, no ' +
    'help, no looking things up. Turn in the planning page too — it\'s diagnostic gold. When the ' +
    'time runs out you\'ll get a 60-second warning, then the editor locks.',
  sections: [
    {
      name: 'Timed Essay',
      items: [
        {
          id: 'e1',
          kind: 'longtext',
          prompt:
            'Should high schools require every student to learn a practical trade skill — like ' +
            'welding, coding, cooking, or auto repair — before graduating? Take a position and ' +
            'argue it. Use specific reasons and examples.',
          keyNote:
            'Score 1–4 each: clear arguable thesis · organization (intro, body paragraphs that ' +
            'each do one job, conclusion) · development (specific reasons and examples, not ' +
            'repeated assertions) · sentence control and variety · conventions. Sophomore ' +
            'on-track = solid five-ish paragraph structure, real examples, mostly clean ' +
            'mechanics. Senior on-track = that plus acknowledging and answering the other side, ' +
            'and some deliberate style.',
        },
      ],
    },
  ],
}

export const HS_ESSAY_SENIOR_B: FixedTest = {
  id: 'hs-essay-senior-b',
  title: 'Part 3B — College-Essay Diagnostic',
  forGrades: ['12'],
  timerSec: 30 * 60,
  softTimer: true,
  ungraded: true,
  intro:
    "This one is ungraded — write like yourself. There's a soft 30-minute timer that will let " +
    "you know when time is up, but it won't lock you out. It shows me your narrative voice, not " +
    'your five-paragraph training.',
  sections: [
    {
      name: 'Part 3B',
      items: [
        {
          id: 'eb1',
          kind: 'longtext',
          prompt:
            'Describe a time you failed at something that mattered to you, and what you did after.',
          keyNote:
            'Ungraded college-application-essay diagnostic — read for narrative voice, not ' +
            'structure.',
        },
      ],
    },
  ],
}
