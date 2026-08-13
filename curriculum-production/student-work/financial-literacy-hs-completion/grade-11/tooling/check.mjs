// Fast authoring loop: oracle + validation + progression over the current registry.
import { verifyLesson } from '../src/oracle.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { checkAntiTemplate, checkNoPlaceholders, checkParameterVisibility, checkSafety, checkStructure } from '../src/validate.ts'
import { checkCorpusProgression, checkLessonProgression, checkNotReskinnedFromGrade9, metricsFor } from '../src/progression.ts'

const only = process.argv[2]
const specs = only ? ALL_SPECS.filter((s) => s.lessonId.includes(only)) : ALL_SPECS
let bad = 0
const say = (tag, fs) => { for (const f of fs) { bad += 1; console.log(`${tag} ${f.lessonId} ${f.where ?? f.ref ?? ''}: ${f.message}`) } }
for (const s of specs) {
  say('ORACLE ', verifyLesson(s).findings)
  say('VISIBLE', checkParameterVisibility(s))
  say('SAFETY ', checkSafety(s))
  say('PLACEHD', checkNoPlaceholders(s))
  say('STRUCT ', checkStructure(s))
  say('PROGRES', checkLessonProgression(s))
}
say('TEMPLATE', checkAntiTemplate(specs))
say('RESKIN  ', checkNotReskinnedFromGrade9(specs))
const p = checkCorpusProgression(specs)
console.log(`\n${specs.length} lessons | items ${p.meanItems} fixed ${p.meanFixed} judgment ${p.meanJudgment} | depth mean ${p.meanMaxDepth} d2=${p.lessonsAtDepth2} d3=${p.lessonsAtDepth3} pow=${p.multiPeriodLessons}`)
console.log(`findings: ${bad}`)
process.exit(bad ? 1 : 0)
