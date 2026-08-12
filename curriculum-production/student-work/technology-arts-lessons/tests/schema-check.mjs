#!/usr/bin/env node
/**
 * Validates every generated file against schema/*.schema.json.
 *
 * The repo has no JSON Schema library and this corpus does not justify adding
 * a dependency, so this implements exactly the draft-07 subset the two schemas
 * use — type, required, properties, additionalProperties, enum, const,
 * minLength, minItems, pattern, items, oneOf, allOf, if/then, not/required.
 * Anything outside that subset throws rather than silently passing, so the
 * schemas cannot quietly outgrow their own checker.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from '../src/courses.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const SUPPORTED = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'required', 'properties',
  'additionalProperties', 'enum', 'const', 'minLength', 'minItems', 'minimum',
  'pattern', 'items', 'oneOf', 'allOf', 'if', 'then', 'not',
])

function typeOf(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function validate(schema, value, path, errors) {
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED.has(keyword)) throw new Error(`schema-check does not implement keyword "${keyword}" (at ${path})`)
  }

  if (schema.type) {
    const actual = typeOf(value)
    const ok =
      schema.type === 'integer' ? actual === 'number' && Number.isInteger(value) : actual === schema.type
    if (!ok) {
      errors.push(`${path}: expected type ${schema.type}, got ${actual}`)
      return
    }
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`)
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum`)
  }
  if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(`${path}: length ${value.length} < minLength ${schema.minLength}`)
  }
  if (schema.pattern !== undefined && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${path}: "${value}" does not match ${schema.pattern}`)
  }
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${path}: ${value} < minimum ${schema.minimum}`)
  }
  if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) {
    errors.push(`${path}: ${value.length} items < minItems ${schema.minItems}`)
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors))
  }
  if (schema.required && typeOf(value) === 'object') {
    for (const key of schema.required) {
      if (value[key] === undefined || value[key] === null) errors.push(`${path}: missing required "${key}"`)
    }
  }
  if (schema.properties && typeOf(value) === 'object') {
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (value[key] !== undefined) validate(sub, value[key], `${path}.${key}`, errors)
    }
  }
  if (schema.additionalProperties === false && schema.properties && typeOf(value) === 'object') {
    for (const key of Object.keys(value)) {
      if (!(key in schema.properties)) errors.push(`${path}: unexpected property "${key}"`)
    }
  }
  if (schema.not && typeOf(value) === 'object') {
    const sub = []
    validate(schema.not, value, path, sub)
    if (sub.length === 0) errors.push(`${path}: matched a forbidden ("not") schema`)
  }
  if (schema.oneOf) {
    const passing = schema.oneOf.filter((sub) => {
      const local = []
      validate(sub, value, path, local)
      return local.length === 0
    })
    if (passing.length !== 1) errors.push(`${path}: matched ${passing.length} oneOf branches, expected exactly 1`)
  }
  if (schema.allOf) {
    for (const sub of schema.allOf) validate(sub, value, path, errors)
  }
  if (schema.if) {
    const probe = []
    validate(schema.if, value, path, probe)
    if (probe.length === 0 && schema.then) validate(schema.then, value, path, errors)
  }
}

const packageSchema = readJson(resolve(ROOT, 'schema/lesson-task-package.schema.json'))
const guideSchema = readJson(resolve(ROOT, 'schema/lesson-scoring-guide.schema.json'))

const errors = []
let checked = 0

for (const course of COURSES) {
  const pkgDir = resolve(ROOT, 'packages', course.subjectKey, course.gradeDir)
  const guideDir = resolve(ROOT, 'scoring-guides', course.subjectKey, course.gradeDir)
  for (const file of readdirSync(pkgDir).filter((f) => f.endsWith('.task-package.json'))) {
    const id = file.replace('.task-package.json', '')
    validate(packageSchema, readJson(resolve(pkgDir, file)), id, errors)
    validate(guideSchema, readJson(resolve(guideDir, `${id}.scoring-guide.json`)), `${id}(guide)`, errors)
    checked += 2
  }
}

console.log(`Schema-checked ${checked} files against 2 schemas.`)
if (errors.length > 0) {
  console.error(`SCHEMA FAILURES (${errors.length}):`)
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`)
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`)
  process.exitCode = 1
} else {
  console.log('SCHEMA CHECK: PASS')
}
