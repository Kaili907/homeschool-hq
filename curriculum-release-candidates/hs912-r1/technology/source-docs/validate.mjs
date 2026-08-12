#!/usr/bin/env node
// Grade 9-12 authoring validator. One identical copy is deployed into each owned
// subject directory; it detects its own subject from its location and validates
// only that subject. Run: node validate.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUBJECT_DIR = basename(HERE)

const CONFIG = {
  'technology-computer-science': {
    subject: 'technology',
    courseIds: ['ma-g9-technology', 'ma-g10-technology', 'ma-g11-technology', 'ma-g12-technology'],
    handoffFrom: 'ma-g8-technology',
    requiredStrands: [
      'Algorithms and Programming', 'Computing Systems', 'Data and Analysis',
      'Networks and the Internet', 'Impacts of Computing',
      'Networks and the Internet — Cybersecurity',
    ],
    requiredSafetyPhrases: [
      'clearly fictional placeholder values only',
      'never scan, probe, exploit, or attempt access against real systems',
      'never silently completes graded project work',
    ],
  },
  'arts-music': {
    subject: 'arts-and-music',
    courseIds: ['ma-g9-arts-and-music', 'ma-g10-arts-and-music', 'ma-g11-arts-and-music', 'ma-g12-arts-and-music'],
    handoffFrom: 'ma-g8-arts-and-music',
    // Dance is deliberately NOT listed: this sequence teaches no choreography or
    // movement vocabulary, so claiming Dance coverage would be false. See
    // standards-coverage.md, "Disciplines out of scope".
    requiredStrands: [
      'Visual Arts', 'Music', 'Theatre', 'Media Arts',
      'Creating', 'Performing', 'Presenting', 'Producing', 'Responding', 'Connecting',
    ],
    requiredSafetyPhrases: [
      'Public performance is never required',
      'no photograph, and no video is ever required',
      'Do not reproduce full copyrighted lyrics, sheet music',
    ],
  },
}

const cfg = CONFIG[SUBJECT_DIR]
if (!cfg) {
  console.error(`validate: unknown subject directory "${SUBJECT_DIR}"`)
  process.exit(2)
}

const failures = []
const notes = []
const fail = (msg) => failures.push(msg)

// Secrets that must never appear as literal assigned values anywhere in the tree.
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS-style access key id'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'secret-key-style token'],
  [/\bghp_[A-Za-z0-9]{20,}\b/, 'GitHub-style token'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/, 'bearer token literal'],
  [/\b(password|passwd|api[_-]?key|access[_-]?token|secret[_-]?key|client[_-]?secret)\s*[:=]\s*["'][^"']{6,}["']/i, 'assigned credential literal'],
]
// Directives that would push work onto real, non-consenting systems.
const EXPLOIT_PATTERNS = [
  [/\bexploit\b[^.]{0,40}\b(live|real|production|third[- ]party|public)\b/i, 'live exploitation directive'],
  [/\b(scan|probe|attack|penetrat\w*|brute[- ]?force)\b[^.]{0,40}\b(live|real|production|the internet|public website)\b/i, 'live probing directive'],
  [/\bbypass\b[^.]{0,30}\b(filter|access control|authentication|paywall)\b(?![^.]{0,40}do not)/i, 'bypass directive'],
]
// Language that would make media capture or public performance mandatory.
const FORCED_MEDIA_PATTERNS = [
  [/\b(must|required to|shall|have to)\s+(record|photograph|film|video)\b/i, 'mandatory capture'],
  [/\b(record|photograph|film|video)\w*\s+(is|are)\s+required\b/i, 'mandatory capture'],
  [/\bmust\s+perform\s+(publicly|in public|for an audience)\b/i, 'mandatory public performance'],
  [/\bpublic performance is required\b/i, 'mandatory public performance'],
]

const gradeDirs = ['grade-09', 'grade-10', 'grade-11', 'grade-12']
const seenLessonIds = new Set()
const seenUnitIds = new Set()
const strandText = []
let totalLessons = 0
let totalUnits = 0

// ---------- per-course structural + content checks ----------
for (const [i, gd] of gradeDirs.entries()) {
  const dir = join(HERE, gd)
  const expectedCourseId = cfg.courseIds[i]
  if (!existsSync(dir)) { fail(`${gd}: missing grade directory`); continue }

  for (const f of ['units.json', 'lessons.jsonl', 'assessments.json', 'course-guide.md', 'lesson-sequence.md']) {
    if (!existsSync(join(dir, f))) fail(`${gd}: missing ${f}`)
  }
  if (failures.length) { /* keep going; report all */ }

  let units, assessments, lessons
  try {
    units = JSON.parse(readFileSync(join(dir, 'units.json'), 'utf8'))
    assessments = JSON.parse(readFileSync(join(dir, 'assessments.json'), 'utf8'))
    lessons = readFileSync(join(dir, 'lessons.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l, n) => {
      try { return JSON.parse(l) } catch (e) { fail(`${gd}: lessons.jsonl line ${n + 1} is not valid JSON`); return null }
    }).filter(Boolean)
  } catch (e) { fail(`${gd}: unreadable course package — ${e.message}`); continue }

  if (units.length !== 6) fail(`${gd}: expected 6 units, found ${units.length}`)
  if (assessments.length !== 6) fail(`${gd}: expected 6 assessments, found ${assessments.length}`)
  const expectedLessons = units.reduce((a, u) => a + u.days, 0)
  if (lessons.length !== expectedLessons) fail(`${gd}: units.json declares ${expectedLessons} days, found ${lessons.length} lessons`)
  totalUnits += units.length
  totalLessons += lessons.length

  // stable refs
  for (const u of units) {
    if (u.course_id !== expectedCourseId) fail(`${u.unit_id}: course_id ${u.course_id} != ${expectedCourseId}`)
    if (seenUnitIds.has(u.unit_id)) fail(`duplicate unit_id ${u.unit_id}`)
    seenUnitIds.add(u.unit_id)
    if (!/^ma-g\d{1,2}-[a-z-]+-u\d{2}$/.test(u.unit_id)) fail(`${u.unit_id}: unit_id does not match stable ref format`)
    if (!Array.isArray(u.standards) || !u.standards.length) fail(`${u.unit_id}: no standards`)
    strandText.push(...(u.standards || []))
    if (u.lesson_ids.length !== u.days) fail(`${u.unit_id}: ${u.lesson_ids.length} lesson_ids but days=${u.days}`)
    if (![6, 12].includes(u.days)) fail(`${u.unit_id}: days must be 6 or 12, found ${u.days}`)
    if (!Array.isArray(u.topics) || u.topics.length !== 6) fail(`${u.unit_id}: expected 6 topics`)
    if (!u.essential_question || /^how can understanding /i.test(u.essential_question)) fail(`${u.unit_id}: essential_question missing or still templated`)
    if (!assessments.some((a) => a.assessment_id === u.assessment_id)) fail(`${u.unit_id}: assessment_id ${u.assessment_id} not found`)
  }

  const REQUIRED_FIELDS = ['schema_version', 'lesson_id', 'course_id', 'grade', 'subject', 'course_day', 'unit_number',
    'title', 'phase', 'focus', 'standards', 'learning_objectives', 'lesson_flow', 'formative_check', 'mastery_rule',
    'accessibility_and_accommodations', 'safety_and_privacy']

  const daysSeen = []
  for (const l of lessons) {
    for (const f of REQUIRED_FIELDS) {
      if (l[f] === undefined || l[f] === null || (Array.isArray(l[f]) && !l[f].length)) fail(`${l.lesson_id}: missing required field ${f}`)
    }
    if (seenLessonIds.has(l.lesson_id)) fail(`duplicate lesson_id ${l.lesson_id}`)
    seenLessonIds.add(l.lesson_id)
    if (!/^ma-g\d{1,2}-[a-z-]+-u\d{2}-l\d{2}$/.test(l.lesson_id)) fail(`${l.lesson_id}: lesson_id does not match stable ref format`)
    if (l.course_id !== expectedCourseId) fail(`${l.lesson_id}: wrong course_id`)
    if (l.subject !== cfg.subject) fail(`${l.lesson_id}: subject ${l.subject} != ${cfg.subject}`)
    if (!units.some((u) => u.lesson_ids.includes(l.lesson_id))) fail(`${l.lesson_id}: not referenced by any unit`)
    daysSeen.push(l.course_day)

    // forced-media guard
    if (l.media?.required !== false) fail(`${l.lesson_id}: media.required must be false`)
    if (!l.media?.fallback) fail(`${l.lesson_id}: media.fallback missing`)

    // accessible / private route
    if ((l.accessibility_and_accommodations || []).length < 5) fail(`${l.lesson_id}: accessibility list too thin`)

    // study-compatible segmentation
    const si = l.study_integration
    if (!si || si.resumable_by_segment !== true) fail(`${l.lesson_id}: study_integration.resumable_by_segment must be true`)
    if (!si || si.segment_count !== (l.lesson_flow || []).length) fail(`${l.lesson_id}: study_integration.segment_count != lesson_flow length`)
    if (!si || !/safe reference and metadata only/i.test(si.artifact_persistence || '')) fail(`${l.lesson_id}: artifact_persistence must be ref/metadata-only`)
    if (si && /\braw learner artifacts\b/.test(si.artifact_persistence) === false) fail(`${l.lesson_id}: artifact_persistence must exclude raw artifacts`)

    // subject-specific safety clauses
    const safetyBlob = (l.safety_and_privacy || []).join(' ')
    for (const phrase of cfg.requiredSafetyPhrases) {
      if (!safetyBlob.includes(phrase)) fail(`${l.lesson_id}: safety block missing required clause "${phrase}"`)
    }
  }
  // Every topic must get an instructional lesson before any assessing lesson.
  // This is the defect the Grade 8 source has and this release does not inherit.
  const ASSESSING = new Set(['Mastery check', 'Unit assessment', 'Correction and reflection'])
  for (const u of units) {
    const unitLessons = lessons.filter((l) => l.unit_number === u.unit_number)
    const taught = new Set()
    for (const l of unitLessons) {
      if (ASSESSING.has(l.phase)) continue
      for (const t of l.topics_covered || []) taught.add(t)
    }
    for (const t of u.topics) {
      if (!taught.has(t)) fail(`${u.unit_id}: topic "${t}" is never taught in an instructional lesson`)
    }
    for (const l of unitLessons) {
      if (!Array.isArray(l.topics_covered) || !l.topics_covered.length) { fail(`${l.lesson_id}: topics_covered missing`); continue }
      if (ASSESSING.has(l.phase) && l.covers_whole_unit !== true) {
        fail(`${l.lesson_id}: phase "${l.phase}" must cover the whole unit, not a single topic`)
      }
      for (const t of l.topics_covered) {
        if (!u.topics.includes(t)) fail(`${l.lesson_id}: topics_covered entry "${t}" is not a unit topic`)
      }
    }
  }

  // Arts: any performance task implying a showing must name a private route in
  // the task statement itself, since assessments.json quotes it verbatim.
  if (cfg.subject === 'arts-and-music') {
    const showing = /perform|present|exhibit|defen|recital|showcase/i
    const private_ = /privat|paper-only|written|dossier|low-audience/i
    for (const u of units) {
      if (showing.test(u.performance_task) && !private_.test(u.performance_task)) {
        fail(`${u.unit_id}: performance task implies a showing but names no private route`)
      }
    }
  }

  const sortedDays = [...daysSeen].sort((a, b) => a - b)
  const contiguous = sortedDays.every((d, n) => d === n + 1)
  if (!contiguous) fail(`${gd}: course_day values are not contiguous 1..${lessons.length}`)
}

// ---------- whole-tree text scans ----------
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])
const textFiles = walk(HERE).filter((p) => /\.(md|json|jsonl)$/.test(p))

// A prohibition ("never probe real systems") legitimately contains the same words
// as a directive. Only flag a match that is NOT inside a negated clause.
const NEGATED_BEFORE = /\b(never|not|no|non|avoid|avoids|prohibit\w*|forbid\w*|without|instead of)\b[^.!?]{0,80}$/i

const scan = (body, rel, patterns, { allowNegated }) => {
  for (const [re, label] of patterns) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    for (const m of body.matchAll(g)) {
      if (allowNegated) {
        const before = body.slice(Math.max(0, m.index - 120), m.index)
        if (NEGATED_BEFORE.test(before)) continue
      }
      fail(`${rel}: possible ${label} — ${JSON.stringify(m[0].slice(0, 60))}`)
    }
  }
}

for (const p of textFiles) {
  const body = readFileSync(p, 'utf8')
  const rel = p.slice(HERE.length + 1)
  // A real credential literal is unacceptable regardless of surrounding prose.
  scan(body, rel, SECRET_PATTERNS, { allowNegated: false })
  scan(body, rel, EXPLOIT_PATTERNS, { allowNegated: true })
  scan(body, rel, FORCED_MEDIA_PATTERNS, { allowNegated: true })
}

// ---------- standards coverage ----------
const strandBlob = strandText.join(' | ')
for (const s of cfg.requiredStrands) {
  if (!strandBlob.includes(s)) fail(`standards coverage: no unit anchors strand "${s}"`)
}

// ---------- grade 8 -> 9 handoff ----------
const handoff = join(HERE, 'grade-8-to-9-handoff.md')
if (!existsSync(handoff)) fail('missing grade-8-to-9-handoff.md')
else {
  const h = readFileSync(handoff, 'utf8')
  if (!h.includes(cfg.handoffFrom)) fail(`grade-8-to-9-handoff.md does not reference ${cfg.handoffFrom}`)
  if (!h.includes(cfg.courseIds[0])) fail(`grade-8-to-9-handoff.md does not reference ${cfg.courseIds[0]}`)
}

// ---------- report ----------
notes.push(`subject: ${SUBJECT_DIR} (${cfg.subject})`)
notes.push(`courses: ${cfg.courseIds.length}`)
notes.push(`units: ${totalUnits}`)
notes.push(`lessons: ${totalLessons} (all ids unique: ${seenLessonIds.size === totalLessons})`)
notes.push(`standards strands anchored: ${cfg.requiredStrands.length} (Dance intentionally out of scope for arts)`)

console.log(notes.map((n) => `  ${n}`).join('\n'))
if (failures.length) {
  console.error(`\nvalidate: FAIL — ${failures.length} problem(s)`)
  for (const f of failures.slice(0, 60)) console.error(`  - ${f}`)
  if (failures.length > 60) console.error(`  ... and ${failures.length - 60} more`)
  process.exit(1)
}
console.log('\nvalidate: PASS')
