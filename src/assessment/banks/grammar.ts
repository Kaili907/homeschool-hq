import type { FixedTest } from '../types'

// Transcribed VERBATIM from HS-English-Reading-Placement.md, Part 2 (15 items).
// "Choose" items are auto-scored (choice + key); "fix/rewrite" items are
// human-graded with the source key in keyNote.

export const HS_GRAMMAR: FixedTest = {
  id: 'hs-grammar',
  title: 'Grammar, Usage & Mechanics',
  forGrades: ['10', '12'],
  intro:
    'Fix, choose, or identify as directed. Rewrites must be written out. If you genuinely ' +
    "don't know, press SKIP — it can't be failed.",
  sections: [
    {
      name: 'Grammar, Usage & Mechanics',
      items: [
        { id: 'g1', kind: 'text', prompt: 'Identify the problem and fix it: "Because the storm knocked out the power for three days."', keyNote: 'Fragment — attach it: "Because the storm knocked out the power for three days, we ate by candlelight" (any complete fix).' },
        { id: 'g2', kind: 'text', prompt: 'Fix this sentence: "The trail was muddy we hiked it anyway."', keyNote: 'Run-on — "The trail was muddy, but we hiked it anyway" (or semicolon/period).' },
        { id: 'g3', kind: 'choice', prompt: 'Choose: "The box of old photographs (was / were) in the attic."', choices: ['was', 'were'], key: 'was' },
        { id: 'g4', kind: 'choice', prompt: 'Choose: "Neither of the sisters (want / wants) to go first."', choices: ['want', 'wants'], key: 'wants' },
        { id: 'g5', kind: 'choice', prompt: 'Choose: "The coaches gave the trophy to Marcus and (I / me)."', choices: ['I', 'me'], key: 'me' },
        { id: 'g6', kind: 'text', prompt: 'This sentence is unclear — rewrite it so the meaning is certain: "When Dana talked to her sister, she was upset."', keyNote: 'Any rewrite that fixes the ambiguous she: "Dana was upset when she talked to her sister" / "Dana\'s sister was upset when they talked."' },
        { id: 'g7', kind: 'choice', prompt: 'Choose (the room belongs to many girls): "The (girls / girl\'s / girls\') locker room was crowded."', choices: ['girls', "girl's", "girls'"], key: "girls'" },
        { id: 'g8', kind: 'choice', prompt: 'Choose: "The team lost (its / it\'s) first game."', choices: ['its', "it's"], key: 'its' },
        { id: 'g9', kind: 'choice', prompt: 'Choose: "The new rule will (affect / effect) everyone."', choices: ['affect', 'effect'], key: 'affect' },
        { id: 'g10', kind: 'text', prompt: 'Choose: "(There / Their / They\'re) going to regret leaving (there / their / they\'re) jackets over (there / their / they\'re)."', keyNote: "They're / their / there." },
        { id: 'g11', kind: 'text', prompt: 'Add the missing punctuation: "After we finished dinner we walked to the park."', keyNote: 'Comma after "dinner."' },
        { id: 'g12', kind: 'text', prompt: 'Fix the faulty parallelism: "She likes swimming, hiking, and to ride bikes."', keyNote: '"...swimming, hiking, and riding bikes."' },
        { id: 'g13', kind: 'text', prompt: 'Fix the tense problem: "He opened the door and sees the mess."', keyNote: '"...and saw the mess."' },
        { id: 'g14', kind: 'text', prompt: 'Fix the modifier problem: "Running to catch the bus, my backpack fell open."', keyNote: 'Any fix giving the runner a subject: "Running to catch the bus, I let my backpack fall open" / "As I ran to catch the bus, my backpack fell open."' },
        { id: 'g15', kind: 'text', prompt: 'Fix the capitalization: "We visited lake Michigan last summer."', keyNote: 'Lake Michigan.' },
      ],
    },
  ],
}
