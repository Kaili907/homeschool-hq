/** Authoring-time preview: builds and checks only the lessons authored so far. */
import { buildCorpus } from '../src/build.ts'
import { checkCorpus } from '../src/checks.ts'

const entries = buildCorpus(false)
const fixed = entries.filter((e) => e.scoring.scoringAuthority.kind === 'ANSWER_KEY')
const items = fixed.reduce((n, e) => n + (e.scoring.scoringAuthority.kind === 'ANSWER_KEY' ? e.scoring.scoringAuthority.items.length : 0), 0)
console.log(`built ${entries.length} lesson(s); fixed ${fixed.length}, rubric ${entries.length - fixed.length}, recomputed items ${items}`)
const issues = checkCorpus(entries)
console.log(`issues: ${issues.length}`)
for (const i of issues) console.log(`  [${i.rule}] ${i.packageId}: ${i.detail}`)
process.exit(issues.length > 0 ? 1 : 0)
