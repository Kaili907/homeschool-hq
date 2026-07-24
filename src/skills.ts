import type { Grade } from './types'
import { SKILLS5 } from './skills5'

export type SkillId =
  // grade 3
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
  // grade 4
  | 'mult4'
  | 'div4'
  | 'factors4'
  | 'place4'
  | 'fracEquiv4'
  | 'fracAddSub4'
  | 'fracMult4'
  | 'dec4'
  | 'convert4'
  | 'angles4'
  | 'word4'
  // grade 5
  | 'mult5'
  | 'div5'
  | 'fracAdd5'
  | 'fracSub5'
  | 'fracMult5'
  | 'fracDiv5'
  | 'decOps5'
  | 'placePow5'
  | 'volume5'
  | 'coord5'
  | 'orderOps5'
  // grade 6
  | 'ratio6'
  | 'percent6'
  | 'fracDiv6'
  | 'decOps6'
  | 'int6'
  | 'coord6'
  | 'expr6'
  | 'eq6'
  | 'geo6'
  | 'vol6'
  | 'stats6'

export interface SkillMeta {
  id: SkillId
  name: string
  emoji: string
  blurb: string
}

/** Grade 3 (Michigan / CCSS grade 3). */
export const SKILLS3: SkillMeta[] = [
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

/** Grade 4 (CCSS). */
export const SKILLS4: SkillMeta[] = [
  { id: 'mult4', name: 'Big Multiplication', emoji: '✖️', blurb: 'Multi-digit products' },
  { id: 'div4', name: 'Long Division', emoji: '➗', blurb: 'With remainders' },
  { id: 'factors4', name: 'Factors & Primes', emoji: '🧩', blurb: 'Factors, multiples, primes' },
  { id: 'place4', name: 'Place Value', emoji: '🔢', blurb: 'To 1,000,000 & rounding' },
  { id: 'fracEquiv4', name: 'Equivalent Fractions', emoji: '🍰', blurb: 'Equivalence & comparing' },
  { id: 'fracAddSub4', name: 'Fraction Add & Subtract', emoji: '➕', blurb: 'Like denominators' },
  { id: 'fracMult4', name: 'Fraction × Whole', emoji: '✳️', blurb: 'Fractions times numbers' },
  { id: 'dec4', name: 'Decimals', emoji: '🔟', blurb: 'Tenths & hundredths' },
  { id: 'convert4', name: 'Unit Conversion', emoji: '📐', blurb: 'Larger to smaller units' },
  { id: 'angles4', name: 'Angles & Lines', emoji: '📶', blurb: 'Acute, right, obtuse' },
  { id: 'word4', name: 'Word Problems', emoji: '📖', blurb: 'Multi-step stories' },
]

/** Grade 6 (CCSS). */
export const SKILLS6: SkillMeta[] = [
  { id: 'ratio6', name: 'Ratios & Rates', emoji: '⚖️', blurb: 'Ratios and unit rates' },
  { id: 'percent6', name: 'Percents', emoji: '💯', blurb: 'Percent of a quantity' },
  { id: 'fracDiv6', name: 'Fraction Division', emoji: '➗', blurb: 'Fraction ÷ fraction' },
  { id: 'decOps6', name: 'Decimal Operations', emoji: '🔢', blurb: 'All four operations' },
  { id: 'int6', name: 'Integers', emoji: '🌡️', blurb: 'Negatives & absolute value' },
  { id: 'coord6', name: 'Coordinate Plane', emoji: '📍', blurb: 'All four quadrants' },
  { id: 'expr6', name: 'Expressions', emoji: '🔤', blurb: 'Evaluate & write' },
  { id: 'eq6', name: 'One-Step Equations', emoji: '🟰', blurb: 'Solve for x' },
  { id: 'geo6', name: 'Area', emoji: '📐', blurb: 'Triangles & composite shapes' },
  { id: 'vol6', name: 'Volume & Surface Area', emoji: '📦', blurb: 'Prisms inside and out' },
  { id: 'stats6', name: 'Data & Statistics', emoji: '📊', blurb: 'Mean, median, mode' },
]

export function skillsForGrade(grade: Grade): SkillMeta[] {
  switch (grade) {
    case '3':
      return SKILLS3
    case '4':
      return SKILLS4
    case '5':
      return SKILLS5
    case '6':
      return SKILLS6
    default:
      return []
  }
}

const ALL_SKILLS = [...SKILLS3, ...SKILLS4, ...SKILLS5, ...SKILLS6]

export const SKILL_BY_ID: Record<SkillId, SkillMeta> = Object.fromEntries(
  ALL_SKILLS.map((s) => [s.id, s]),
) as Record<SkillId, SkillMeta>
