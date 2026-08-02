import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'))
const sequence=(entry)=>JSON.parse(fs.readFileSync(path.join(root,entry.path,'sequence.json'),'utf8'))

test('manifest owns exactly four ordered math sequences',()=>{
  assert.equal(manifest.subjectId,'math')
  assert.deepEqual(manifest.orderedLessons.map(x=>x.order),['01','02','03','04'])
  assert.equal(manifest.coreModified,false)
})

test('every sequence has stable lesson and skill IDs',()=>{
  const ids=[]
  for(const entry of manifest.orderedLessons){const s=sequence(entry);ids.push(s.sequenceId,s.lessonId,...s.skillIds);assert.match(s.sequenceId,/^math-seq-/);assert.match(s.lessonId,/^math-lesson-\d{2}-/);assert.ok(s.skillIds.every(x=>/^math-skill-/.test(x)))}
  assert.equal(new Set(ids).size,ids.length)
})

test('adaptive modes enforce one prompt and no immediate answer',()=>{
  for(const entry of manifest.orderedLessons){const s=sequence(entry);for(const mode of Object.values(s.modes)){assert.ok(mode.steps.length>=3);assert.ok(mode.steps.every(st=>st.onePromptOnly));assert.equal(mode.steps[0].answerRevealPolicy,'never-on-first-turn')}}
})

test('incorrect responses have misconception evidence routes',()=>{
  for(const entry of manifest.orderedLessons){const s=sequence(entry);const misIds=new Set(s.misconceptions.map(m=>m.id));for(const item of s.diagnostic.items.filter(i=>i.type==='multiple-choice')){for(const [choice,signals] of Object.entries(item.misconceptionSignals)){assert.notEqual(choice,item.correctChoiceId);assert.ok(signals.every(id=>misIds.has(id)),`${item.id} has unknown signal`)}}}
})

test('mastery requires repeated evidence',()=>{
  for(const entry of manifest.orderedLessons){const rule=sequence(entry).independentMasteryCheck.masteryRule;assert.match(rule,/two sessions/i);assert.match(rule,/one correct/i)}
})

test('every assessment includes reasoning and delayed reveal',()=>{
  for(const entry of manifest.orderedLessons){const s=sequence(entry);const items=[...s.diagnostic.items,...s.guidedPractice.items,...s.independentMasteryCheck.items];for(const item of items){assert.ok(item.reasoning.length>20);assert.equal(item.answerRevealPolicy,'after-attempt-and-reasoning')}}
})

test('visuals have text alternatives and no-media fallback',()=>{
  for(const entry of manifest.orderedLessons){const s=sequence(entry);assert.ok(s.visualExplanationPlan.boards.every(b=>b.altText.length>20));assert.equal(s.noMediaFallback.fullyFunctionalWithoutMedia,true);assert.ok(s.noMediaFallback.instructions.length>=3)}
})

test('money examples use en-US dollars consistently',()=>{
  const wp=sequence(manifest.orderedLessons[3]);const text=JSON.stringify(wp);assert.match(text,/\$12/);assert.doesNotMatch(text,/[€£¥]/)
})

test('standalone demo is self-contained and ungraded',()=>{
  const html=fs.readFileSync(path.join(root,'standalone-demo/index.html'),'utf8');const js=fs.readFileSync(path.join(root,'standalone-demo/demo.js'),'utf8');assert.match(html,/ungraded demo/i);assert.match(js,/It is not mastery yet/i);assert.doesNotMatch(html,/https?:\/\//)
})
