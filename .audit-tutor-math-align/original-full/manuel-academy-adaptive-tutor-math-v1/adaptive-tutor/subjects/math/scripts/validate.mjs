import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root=process.cwd()
const readJson=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const manifest=readJson('manifest.json')
const failures=[]
const passes=[]
const check=(name,condition,detail='')=>{(condition?passes:failures).push({name,detail})}

check('exactly-four-sequences',manifest.orderedLessons.length===4,`found ${manifest.orderedLessons.length}`)
check('ordered-lessons',manifest.orderedLessons.map(x=>x.order).join(',')==='01,02,03,04',manifest.orderedLessons.map(x=>x.order).join(','))
check('content-boundary',manifest.contentBoundary==='adaptive-tutor/subjects/math/**')
check('no-core-modification',manifest.coreModified===false)
check('no-external-system-modification',manifest.externalSystemsModified===false)

const seen=new Set();let allItems=0;let allMis=0;let allBoards=0
for(const entry of manifest.orderedLessons){
  const base=entry.path
  const required=['sequence.json','sequence.ts','lesson.md','diagnostic.json','misconceptions.json','guided-practice.json','mastery-check.json','visual-board.json','answer-key.md','parent-review.md','no-media-fallback.md','narration.md','narration.en.vtt']
  for(const f of required) check(`required-file:${entry.order}:${f}`,fs.existsSync(path.join(root,base,f)))
  const seq=readJson(`${base}/sequence.json`)
  for(const id of [seq.sequenceId,seq.lessonId,...seq.skillIds]){check(`unique-id:${id}`,!seen.has(id));seen.add(id)}
  check(`grade-band:${entry.order}`,seq.gradeBand.minimum===4&&seq.gradeBand.maximum===6)
  check(`grade-five:${entry.order}`,seq.gradeBand.primary.includes(5))
  const modes=['showMe','talkMeThroughIt','letsDoOneTogether','differentExample']
  check(`four-modes:${entry.order}`,modes.every(m=>seq.modes[m]))
  for(const mode of modes){
    check(`mode-steps:${entry.order}:${mode}`,seq.modes[mode].steps.length>=3)
    check(`one-prompt:${entry.order}:${mode}`,seq.modes[mode].steps.every(s=>s.onePromptOnly===true))
    check(`no-first-answer:${entry.order}:${mode}`,seq.modes[mode].steps[0].answerRevealPolicy==='never-on-first-turn')
  }
  const items=[...seq.diagnostic.items,...seq.guidedPractice.items,...seq.independentMasteryCheck.items];allItems+=items.length
  check(`assessment-count:${entry.order}`,items.length>=18,`found ${items.length}`)
  check(`answer-policy:${entry.order}`,items.every(i=>i.answerRevealPolicy==='after-attempt-and-reasoning'))
  check(`reasoning-present:${entry.order}`,items.every(i=>typeof i.reasoning==='string'&&i.reasoning.length>20))
  check(`misconception-signals:${entry.order}`,items.every(i=>i.misconceptionSignals&&typeof i.misconceptionSignals==='object'))
  allMis+=seq.misconceptions.length
  check(`misconception-depth:${entry.order}`,seq.misconceptions.length>=6)
  check(`distinguishing-evidence:${entry.order}`,seq.misconceptions.every(m=>m.likelyEvidence.length>=2&&m.distinguishingEvidence.length>=2&&m.route))
  check(`reteach:${entry.order}`,seq.reteachingBranches.length>=4)
  check(`prereq-remediation:${entry.order}`,seq.prerequisiteRemediationBranches.length>=1)
  check(`multi-session-mastery:${entry.order}`,/two sessions/i.test(seq.independentMasteryCheck.masteryRule)&&/one correct/i.test(seq.independentMasteryCheck.masteryRule))
  check(`no-media:${entry.order}`,seq.noMediaFallback.fullyFunctionalWithoutMedia===true&&seq.noMediaFallback.instructions.length>=3)
  check(`privacy:${entry.order}`,/camera/.test(seq.policy.privacyPolicy)&&/photo/.test(seq.policy.privacyPolicy))
  check(`integrity:${entry.order}`,/graded homework/.test(seq.policy.integrityPolicy))
  check(`medical-boundary:${entry.order}`,/dyscalculia/.test(seq.policy.diagnosisPolicy))
  allBoards+=seq.visualExplanationPlan.boards.length
  check(`visual-alt:${entry.order}`,seq.visualExplanationPlan.boards.every(b=>b.altText&&b.narrationCue))
  const vtt=fs.readFileSync(path.join(root,base,'narration.en.vtt'),'utf8')
  check(`webvtt-header:${entry.order}`,vtt.startsWith('WEBVTT\n'))
  check(`webvtt-cues:${entry.order}`,(vtt.match(/-->/g)||[]).length===seq.spokenExplanation.segments.length)
  const text=fs.readFileSync(path.join(root,base,'lesson.md'),'utf8').toLowerCase()
  const learnerFacing=text.replace(/never label a learner as bad at math\.?/g,'').replace(/do not label a learner as bad at math\.?/g,'')
  check(`lesson-no-shame:${entry.order}`,!learnerFacing.includes('bad at math')&&!learnerFacing.includes('stupid'))
}
check('item-total',allItems>=72,`found ${allItems}`)
check('misconception-total',allMis>=24,`found ${allMis}`)
check('visual-board-total',allBoards>=20,`found ${allBoards}`)

// Locale check: generic money must use US dollar notation only.
const allText=fs.readdirSync(root,{recursive:true}).filter(f=>typeof f==='string'&&/\.(md|json|ts|js|html)$/.test(f)&&f!=='scripts/validate.mjs'&&!f.startsWith('tests/')).map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')
check('currency-locale',!/[€£¥]/.test(allText),'no non-US generic currency symbols')
const cameraScan=allText.replace(/never require a camera/gi,'').replace(/no camera is required/gi,'').replace(/camera is not required/gi,'')
check('prohibited-required-camera',!/(?:a |the )?camera (?:is )?(?:required|mandatory)\b|camera must be (?:used|enabled|on)\b/i.test(cameraScan))

console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',passes:passes.length,failures,summary:{sequences:manifest.orderedLessons.length,assessmentItems:allItems,misconceptions:allMis,visualBoards:allBoards}},null,2))
if(failures.length) process.exit(1)
