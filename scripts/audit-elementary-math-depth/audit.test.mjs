#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = resolve(ROOT, 'docs/curriculum-quality/elementary-math/audit-r1')

const readJson = async (name) => JSON.parse(await readFile(resolve(OUT, name), 'utf8'))
const summary = await readJson('grade-summary.json')
const families = await readJson('generator-families.json')
const readability = await readJson('readability-findings.json')
const repair = await readJson('bulk-repair-plan.json')
const jsonl = (await readFile(resolve(OUT, 'lesson-findings.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
const report = await readFile(resolve(OUT, 'ELEMENTARY_MATH_DEPTH_AUDIT_R1.md'), 'utf8')

assert.equal(summary.authoritativeBase, '56dd8a45fee1ca03dd5f83e1466c9f081824d6b9')
assert.equal(summary.lessonsAudited, 540)
assert.equal(jsonl.length, 540)
assert.equal(new Set(jsonl.map((row) => row.lessonId)).size, 540)
assert.deepEqual(Object.fromEntries([3, 4, 5].map((grade) => [grade, summary.byGrade[grade].lessons])), { 3: 180, 4: 180, 5: 180 })
assert.ok([3, 4, 5].every((grade) => summary.byGrade[grade].inventory.reconciled))
assert.equal(summary.inventoryReconciled, true)
assert.equal(summary.finalClassification, 'ELEMENTARY_MATH_DEPTH_AUDIT_COMPLETE')
assert.equal(families.compositionFamilies.length, 2)
assert.equal(families.itemBankFamilies.length, 30)
assert.ok(families.itemBankFamilies.every((family) => family.lessons === 18))
assert.equal(repair.stages[1].builders.length, 30)
assert.equal(new Set(repair.stages[1].builders.flatMap((builder) => builder.lessonIds)).size, 540)
assert.equal(readability.lessonMachineReadability.length, 540)
assert.ok(readability.findings.length > 0)
assert.ok(jsonl.every((row) => row.counts && row.targets && row.depthClassification && row.lessonType))
assert.ok(jsonl.every((row) => row.answerLeakage.forbiddenAnswerFields.length === 0))
assert.equal(summary.answerLeakage.adultAnswerLeakLessons.length, 0)
assert.match(report, /ELEMENTARY_MATH_DEPTH_AUDIT_COMPLETE/)

process.stdout.write(`PASS: validated ${jsonl.length} lesson findings, 30 non-overlapping unit builders, and all required audit artifacts.\n`)
