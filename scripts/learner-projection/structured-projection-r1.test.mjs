import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import test from 'node:test'
import {
  STRUCTURED_PROJECTION_VERSION,
  assertLearnerSafeMaterial,
  isLearnerSafeResourceRef,
  projectJsonLearnerMaterial,
  projectMarkdownLearnerMaterial,
} from './structured-projection-r1.mjs'

const ROOT = new URL('../../', import.meta.url)
const ADMITTED = new URL('curriculum-release-admitted/family-pilot-r1/', ROOT)
const OUTPUT = new URL('public/family-pilot-final/2.0.0/', ROOT)
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))

test('instructional examples may expose worked solutions but graded items may not', () => {
  const binding = { lessonRef: 'lesson-1', subject: 'mathematics' }
  const value = {
    title: 'Safety boundary',
    sections: [
      {
        sectionId: 'ex',
        kind: 'instructional-example',
        items: [{
          ref: 'lesson-1#ex-1',
          kind: 'worked-example',
          itemType: 'addition',
          prompt: 'What is 1 + 1?',
          workedSolution: { steps: ['Add the ones.'], answer: '2' },
        }],
      },
      {
        sectionId: 'mastery',
        kind: 'mastery-check',
        items: [{
          ref: 'lesson-1#mastery-1',
          kind: 'constructed-response',
          itemType: 'addition',
          prompt: 'What is 2 + 2?',
          workedSolution: { steps: ['Add the ones.'], answer: '4' },
        }],
      },
    ],
  }
  const { material, stats } = projectJsonLearnerMaterial(value, binding, 'Fallback')
  assert.deepEqual(material.sections[0].items[0].workedSolution, { steps: ['Add the ones.'], answer: '2' })
  assert.equal(material.sections[1].items[0].workedSolution, undefined)
  assert.equal(stats.instructionalWorkedSolutions, 1)
  assert.equal(stats.adultFieldsRemoved, 1)
})

test('choices and response semantics remain structured and never flatten into prompt text', () => {
  const binding = { lessonRef: 'lesson-2', subject: 'financial-literacy' }
  const value = {
    title: 'Structured choice',
    scoringRef: 'scoring/lesson-2.json',
    responseScoring: {
      mode: 'MIXED',
      items: [{ ref: 't1-p1', responseMode: 'FIXED', promptText: 'Adult duplicate prompt' }],
    },
    tasks: [{
      taskId: 't1',
      kind: 'independent',
      directions: 'Choose one.',
      prompts: [{ ref: 't1-p1', promptType: 'fixed-choice', text: 'Which?', choices: ['A', 'B'] }],
    }],
  }
  const { material } = projectJsonLearnerMaterial(value, binding, 'Fallback')
  const item = material.sections[0].items[0]
  assert.equal(item.itemRef, 'lesson-2#t1-p1')
  assert.deepEqual(item.choices, ['A', 'B'])
  assert.equal(item.responseType, 'FIXED')
  assert.equal(material.scoringMode, 'MIXED')
  assert.equal(material.sections[0].prompts[0], 'Which?')
  assert.doesNotMatch(JSON.stringify(material), /scoring\/lesson-2|Adult duplicate prompt|Choices:/)
})

test('ELA source objects are allowlisted without copying a source body', () => {
  const binding = { lessonRef: 'ela-1', subject: 'english-language-arts' }
  const { material } = projectJsonLearnerMaterial({
    title: 'ELA source',
    sourceReference: {
      present: true,
      refs: [{
        textId: 'text-1',
        title: 'A title',
        author: 'An author',
        form: 'essay',
        rightsCategory: 'licensed',
        obtainNote: 'Obtain through the library.',
        text: 'UNAUTHORIZED SOURCE BODY',
      }],
    },
  }, binding, 'Fallback')
  assert.deepEqual(material.sourceMetadata.sources[0], {
    sourceRef: 'text-1',
    title: 'A title',
    author: 'An author',
    sourceKind: 'essay',
    rightsCategory: 'licensed',
    obtainNote: 'Obtain through the library.',
  })
  assert.doesNotMatch(JSON.stringify(material), /UNAUTHORIZED SOURCE BODY/)
})

test('markdown projection removes adult-only sections while preserving learner rubric and source structure', () => {
  const markdown = `# Lesson\n\n**Essential question:** Why?\n\n## 1. Source / evidence task\n\nUse a real source.\n\n## 5. Rubric\n\n| Level | Evidence |\n| --- | --- |\n| Meets | Cites a source |\n\n**Lesson-specific success criteria:**\n- Cite the source.\n\n## 6. Acceptable-answer criteria\n\nAdult oracle.\n\n## 7. Remediation\n\nAdult remediation.\n\n## 8. Extension\n\nCompare sources.\n\n**Tutor/scoring boundary:** Adult guide.`
  const binding = {
    lessonRef: 'social-1',
    subject: 'social-studies',
    sourceReadinessKind: 'DYNAMIC_SOURCE_REQUIRED',
    sourceRuntimeState: 'PENDING_SOURCE_ATTACHMENT',
    sourceMetadataProvenance: {
      state: 'AWAITING_RUNTIME_METADATA',
      attachmentRecorded: false,
      inventedMetadataPermitted: false,
      quotedSourceTextStored: false,
    },
    sourceReadinessContract: {
      contractId: 'DYNAMIC_SOURCE_REQUIREMENT',
      contractVersion: 1,
      requiredAttachmentFields: ['sourceTitle'],
      becomesRunnableWhen: 'ATTACHED_SATISFIED',
    },
  }
  const { material } = projectMarkdownLearnerMaterial(markdown, binding, 'Fallback')
  assert.match(material.markdown, /Source \/ evidence task/)
  assert.match(material.markdown, /Cites a source/)
  assert.match(material.markdown, /Compare sources/)
  assert.doesNotMatch(material.markdown, /Adult oracle|Adult remediation|Tutor\/scoring boundary/)
  assert.equal(material.sourceMetadata.dynamic.attachmentState, 'not-attached')
})

test('all 8,292 production packages build into the audited lazy structured projection', async () => {
  execFileSync(process.execPath, ['scripts/build-final-family-pilot-data.mjs'], {
    cwd: ROOT.pathname,
    stdio: 'pipe',
  })
  const manifest = await readJson(new URL('manifest.json', OUTPUT))
  const courseFiles = (await readdir(new URL('courses/', OUTPUT))).filter((file) => file.endsWith('.json')).sort()
  assert.equal(courseFiles.length, 90)
  assert.deepEqual(manifest.structuredProjection, {
    projectionVersion: STRUCTURED_PROJECTION_VERSION,
    lessonsProjected: 8292,
    itemsProjected: 36328,
    choiceItemsProjected: 13516,
    choicesPreserved: 53606,
    sourceMetadataPreserved: 5412,
    dynamicSourceContractsPreserved: 12,
    taskGroupsProjected: 3023,
    taskStepsProjected: 8100,
    instructionalWorkedSolutions: 1574,
    adultFieldsRemoved: 25848,
    adultResourceLocatorsRemoved: 7320,
  })
  assert.doesNotMatch(JSON.stringify(manifest), /ma-g12-financial-literacy-u07-l72|Which group takes more/)

  const bindings = (await readFile(new URL('production-bindings.jsonl', ADMITTED), 'utf8'))
    .trim().split('\n').map((line) => JSON.parse(line))
  const bindingByLesson = new Map(bindings.map((binding) => [binding.lessonRef, binding]))
  const projectedItemRefs = new Set()
  let lessons = 0
  let items = 0
  let choices = 0
  let elaSources = 0
  let socialSources = 0
  let dynamicContracts = 0
  let finLitLocators = 0
  let adultLeaks = 0

  for (const file of courseFiles) {
    const payload = await readJson(new URL(`courses/${file}`, OUTPUT))
    const serialized = JSON.stringify(payload)
    if (/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|\/answer[-_]keys?\/|\/scoring\/|scoring[-_]guides?|teacher[-_]guides?/i.test(serialized)) adultLeaks += 1
    for (const row of payload.lessons) {
      assert.ok(row.resourceRefs.every(isLearnerSafeResourceRef), `${row.lessonRef} retained an adult resource locator`)
    }
    for (const material of Object.values(payload.materials)) {
      lessons += 1
      assert.equal(material.dtoVersion, STRUCTURED_PROJECTION_VERSION)
      assertLearnerSafeMaterial(material)
      const binding = bindingByLesson.get(material.lessonRef)
      assert.ok(binding)
      const packageRelative = binding.productionPackageRef.slice(binding.productionPackageRef.indexOf(':') + 1)
      const packageRaw = await readFile(new URL(packageRelative, ROOT), 'utf8')
      if (extname(packageRelative) === '.json') {
        const source = JSON.parse(packageRaw)
        const projectedItems = (material.sections || []).flatMap((section) => section.items || [])
        if (Array.isArray(source.sections)) {
          const sourceItems = source.sections.flatMap((section) => section.items || [])
          assert.equal(projectedItems.length, sourceItems.length, `${material.lessonRef} lost a math item`)
          for (const sourceItem of sourceItems) {
            const item = projectedItems.find((candidate) => candidate.itemRef === sourceItem.ref)
            assert.ok(item, `${material.lessonRef} lost item ${sourceItem.ref}`)
            assert.equal(item.prompt, sourceItem.prompt)
            assert.equal(item.itemKind, sourceItem.kind)
            assert.equal(item.itemType, sourceItem.itemType)
            assert.deepEqual(item.choices || [], sourceItem.choices || [])
          }
        }
        if (Array.isArray(source.tasks)) {
          const sourceItems = source.tasks.flatMap((task) => task.prompts || [])
          assert.equal(projectedItems.length, sourceItems.length, `${material.lessonRef} lost a task item`)
          for (const sourceItem of sourceItems) {
            const expectedRef = sourceItem.ref.startsWith(`${material.lessonRef}#`)
              ? sourceItem.ref
              : `${material.lessonRef}#${sourceItem.ref}`
            const item = projectedItems.find((candidate) => candidate.itemRef === expectedRef)
            assert.ok(item, `${material.lessonRef} lost task item ${sourceItem.ref}`)
            assert.equal(item.prompt, sourceItem.text)
            assert.equal(item.itemType, sourceItem.promptType)
            assert.equal(item.unit, sourceItem.unit)
            assert.deepEqual(item.choices || [], sourceItem.choices || [])
          }
        }
        const sourceMaterials = Array.isArray(source.materials) ? source.materials : []
        if (sourceMaterials.length) assert.deepEqual(material.materials, sourceMaterials)
        const sourceEssentialQuestion = source.essentialQuestion || source.essential_question || source.unit_context?.essential_question
        if (sourceEssentialQuestion) assert.equal(material.essentialQuestion, sourceEssentialQuestion)
        if (Array.isArray(source.task_steps)) {
          assert.deepEqual(material.taskSteps.map((step) => step.text), source.task_steps)
          assert.equal(new Set(material.taskSteps.map((step) => step.stepRef)).size, source.task_steps.length)
        }
        if (material.subject === 'english-language-arts') {
          const sourceRefs = source.sourceReference?.refs || []
          assert.deepEqual(
            (material.sourceMetadata?.sources || []).map((item) => item.sourceRef),
            sourceRefs.map((item) => item.textId),
          )
        }
      }
      if (material.subject === 'financial-literacy' && /\/scoring\//i.test(JSON.stringify(material))) finLitLocators += 1
      if (material.subject === 'english-language-arts') elaSources += material.sourceMetadata?.sources?.length || 0
      if (material.subject === 'social-studies') {
        socialSources += material.sourceMetadata?.sources?.length || 0
        if (material.sourceMetadata?.dynamic) dynamicContracts += 1
      }
      for (const section of material.sections || []) {
        assert.equal(typeof section.sectionRef, 'string')
        for (const item of section.items || []) {
          items += 1
          assert.equal(typeof item.itemRef, 'string')
          assert.equal(projectedItemRefs.has(item.itemRef), false, `duplicate itemRef ${item.itemRef}`)
          projectedItemRefs.add(item.itemRef)
          choices += item.choices?.length || 0
          assert.doesNotMatch(item.prompt || '', /\nChoices:/)
          if (item.workedSolution) {
            assert.equal(section.sectionKind, 'instructional-example')
            assert.equal(item.itemKind, 'worked-example')
          }
        }
      }
    }
  }
  assert.equal(lessons, 8292)
  assert.equal(items, 36328)
  assert.equal(projectedItemRefs.size, 36328)
  assert.equal(choices, 53606)
  assert.equal(elaSources, 1620)
  assert.equal(socialSources, 3792)
  assert.equal(dynamicContracts, 12)
  assert.equal(finLitLocators, 0)
  assert.equal(adultLeaks, 0)

  // The admitted source formats remain completely covered; no subject package
  // is silently skipped just because it uses markdown rather than JSON.
  const extensionCounts = {}
  for (const binding of bindings) {
    const relative = binding.productionPackageRef.slice(binding.productionPackageRef.indexOf(':') + 1)
    extensionCounts[extname(relative)] = (extensionCounts[extname(relative)] || 0) + 1
  }
  assert.deepEqual(extensionCounts, { '.json': 6348, '.md': 1944 })
})
