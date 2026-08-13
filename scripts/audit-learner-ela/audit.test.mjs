import assert from 'node:assert/strict'
import test from 'node:test'
import {
  crossGradeCopiedTaskIds,
  projectJsonMaterial,
} from './audit.mjs'

test('browser projection exposes the source/prompt loss negative control', () => {
  const pkg = {
    lessonRef: { title: 'Synthetic source loss' },
    sourceReference: {
      present: true,
      refs: [{ textId: 'missing-text', title: 'Missing text', rightsCategory: 'original' }],
    },
    independentEvidenceTask: {
      present: true,
      text: 'Read the assigned passage, answer both questions, and write one supported paragraph.',
    },
  }
  const material = projectJsonMaterial(
    pkg,
    { lessonRef: 'synthetic-source-loss', subject: 'english-language-arts' },
    'Synthetic source loss',
  )
  assert.equal(material.sections.some((section) => section.title === 'Source or reading'), false)
  assert.equal(material.sections.reduce((count, section) => count + section.prompts.length, 0), 0)
  assert.match(material.sections.find((section) => section.title === 'Independent evidence').body, /answer both questions/)
})

test('copied cross-grade task negative control identifies both lessons', () => {
  const copied = crossGradeCopiedTaskIds([
    { grade: 5, lessonId: 'g5-copy', pkg: { independentEvidenceTask: { text: 'Copy me exactly.' } } },
    { grade: 7, lessonId: 'g7-copy', pkg: { independentEvidenceTask: { text: 'Copy me exactly.' } } },
    { grade: 8, lessonId: 'g8-distinct', pkg: { independentEvidenceTask: { text: 'A progressed task.' } } },
  ])
  assert.deepEqual([...copied.ids].sort(), ['g5-copy', 'g7-copy'])
  assert.equal(copied.evidence.length, 1)
})
