export type SkillId =
  | 'mult'
  | 'div'
  | 'place'
  | 'addsub'
  | 'fracUnit'
  | 'fracComp'
  | 'time'
  | 'money'
  | 'measure'
  | 'areaPerim'
  | 'word2'

export interface SkillMeta {
  id: SkillId
  name: string
  emoji: string
  blurb: string
}

/** Michigan 3rd grade math (aligned to grade 3 standards). */
export const SKILLS: SkillMeta[] = [
  { id: 'mult', name: 'Multiplication Facts', emoji: '✖️', blurb: 'Times tables 0–10' },
  { id: 'div', name: 'Division Facts', emoji: '➗', blurb: 'Sharing and grouping' },
  { id: 'place', name: 'Place Value', emoji: '🔢', blurb: 'Numbers to 10,000' },
  { id: 'addsub', name: 'Add & Subtract', emoji: '➕', blurb: 'With regrouping' },
  { id: 'fracUnit', name: 'Fractions', emoji: '🍕', blurb: 'Parts of a whole' },
  { id: 'fracComp', name: 'Comparing Fractions', emoji: '⚖️', blurb: 'Which is bigger?' },
  { id: 'time', name: 'Telling Time', emoji: '🕒', blurb: 'To the minute' },
  { id: 'money', name: 'Money', emoji: '💰', blurb: 'Coins, bills, change' },
  { id: 'measure', name: 'Measurement', emoji: '📏', blurb: 'Length, weight, liquids' },
  { id: 'areaPerim', name: 'Area & Perimeter', emoji: '🟪', blurb: 'Rectangles and grids' },
  { id: 'word2', name: 'Word Problems', emoji: '📖', blurb: 'Two-step stories' },
]

export const SKILL_BY_ID: Record<SkillId, SkillMeta> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
) as Record<SkillId, SkillMeta>
