#!/usr/bin/env node
/**
 * hs912-r2 release-normalization validator.
 *
 * Design rule: a published number is checked against something outside the file that publishes
 * it. Delivered content, the release matrix, the r1 custody-derived coverage registries, git, and
 * (with --verify-source) the official standards document are the anchors. Where an anchor is not
 * reachable, the check says so instead of quietly passing.
 *
 *   node curriculum-release-normalization/hs912-r2/validation/validate-normalization.mjs
 *   node ... --format json
 *   node ... --verify-source     # re-fetches the official Michigan PDF and re-checks the custody
 *   node ... --r2 <dir>          # point at a damaged copy; used by mutation-test.py
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SELF = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = dirname(dirname(SELF));
const r2Flag = process.argv.indexOf('--r2');
const R2 = r2Flag === -1 ? SELF : process.argv[r2Flag + 1];
// --candidate <dir> lets mutation-test.py plant content in a copy of the candidate, which is the
// only way to prove that the "no such content exists" checks are actually reading the disk.
const candidateFlag = process.argv.indexOf('--candidate');
const R1 = candidateFlag === -1
  ? join(REPO, 'curriculum-release-candidates', 'hs912-r1')
  : process.argv[candidateFlag + 1];
const VERIFY_SOURCE = process.argv.includes('--verify-source');

const GRADES = [9, 10, 11, 12];
const SCIENCE_AUTHORED = {
  9: 'ma-hs9-biology',
  10: 'ma-hs10-chemistry',
  11: 'ma-hs11-physics',
  12: 'ma-hs12-earth-space-environmental',
};
const PINNED_SOURCE_SHA256 = 'dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54';

const findings = [];
const notes = [];
const add = (severity, code, message) => findings.push({ severity, code, message });
const blocking = (code, message) => add('BLOCKING', code, message);
const advisory = (code, message) => add('ADVISORY', code, message);
const note = (code, message) => notes.push({ severity: 'NOTE', code, message });

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ================================================================= discovered inputs

   Families are discovered by walking the candidate, never read from a constant in this file.
   A constant here would make every "no such content exists" check inert.                    */

const discoveredCanonicalFamilies = readdirSync(R1)
  .filter((name) => {
    const p = join(R1, name);
    return statSync(p).isDirectory() && GRADES.every((g) => existsSync(join(p, `grade-${g}`, 'units.json')));
  })
  .sort();

const canonical = new Map();
for (const family of discoveredCanonicalFamilies) {
  for (const grade of GRADES) {
    const dir = join(R1, family, `grade-${grade}`);
    const units = readJson(join(dir, 'units.json'));
    const lessons = readJsonl(join(dir, 'lessons.jsonl'));
    const assessments = readJson(join(dir, 'assessments.json'));
    const standards = new Set();
    for (const e of [...units, ...lessons, ...assessments]) for (const s of e.standards ?? []) standards.add(s);
    canonical.set(units[0].course_id, {
      grade, family, units, lessons, assessments,
      unitIds: units.map((u) => u.unit_id),
      lessonIds: lessons.map((l) => l.lesson_id),
      assessmentIds: assessments.map((a) => a.assessment_id),
      subjects: new Set([...units, ...lessons].map((e) => e.subject).filter(Boolean)),
      standards,
    });
  }
}

const aset = join(R1, 'science', 'authoring-set');
const hasScience = existsSync(join(aset, 'courses.json'));
const scienceUnits = hasScience ? readJson(join(aset, 'units.json')) : [];
const scienceAssessments = hasScience ? readJson(join(aset, 'assessments.json')) : [];
const scienceSchedules = hasScience ? readJson(join(aset, 'schedules.json')) : [];
const science = new Map();
if (hasScience) {
  for (const c of readJson(join(aset, 'courses.json'))) {
    const lessons = readJsonl(join(aset, 'lessons', `${c.course_id}.lessons.jsonl`));
    science.set(c.course_id, {
      grade: c.grade, title: c.title,
      units: scienceUnits.filter((u) => u.course_ref === c.course_id),
      assessments: scienceAssessments.filter((a) => a.course_ref === c.course_id),
      lessons,
      lessonIds: lessons.map((l) => l.lesson_id),
      subjects: new Set(lessons.map((l) => l.subject).filter(Boolean)),
    });
  }
}

const matrix = readJson(join(R1, 'release', 'course-matrix.json'));
const matrixHs = matrix.courses.filter((c) => c.origin !== 'EXISTING_GRADE_8_ANCHOR');
const matrixById = new Map(matrix.courses.map((c) => [c.course_id, c]));

const shapeOf = (id) => (canonical.has(id) ? canonical.get(id) : science.get(id));
const countsOf = (obs) => ({
  units: Array.isArray(obs.units) ? obs.units.length : obs.units,
  lessons: Array.isArray(obs.lessons) ? obs.lessons.length : obs.lessons,
  assessments: Array.isArray(obs.assessments) ? obs.assessments.length : obs.assessments,
});

/* ================================================================= registries under test */

const aliasRegistry = readJson(join(R2, 'registries', 'course-id-alias-registry.json'));
const courseRegistry = readJson(join(R2, 'registries', 'release-course-registry.json'));
const standardsRegistry = readJson(join(R2, 'registries', 'standards-evidence-registry.json'));
const coverageRegistry = readJson(join(R2, 'registries', 'coverage-requirements-registry.json'));
const scheduleRegistry = readJson(join(R2, 'registries', 'schedule-registry.json'));
const mpMap = readJson(join(R2, 'standards', 'mathematical-practice-map.json'));
const manifest = readJson(join(R2, 'MANIFEST.json'));

/* ================================================================= 1. alias registry */

function checkAliasRegistry() {
  const entries = aliasRegistry.entries;
  const slots = entries.map((e) => e.release_slot_id);
  const authored = entries.map((e) => e.authored_course_id);
  const matrixHsIds = matrixHs.map((c) => c.course_id);

  if (new Set(slots).size !== slots.length) blocking('ALIAS_SLOT_NOT_UNIQUE', 'release_slot_id is not unique');
  if (new Set(authored).size !== authored.length) blocking('ALIAS_AUTHORED_NOT_UNIQUE', 'authored_course_id is not unique');

  const missing = matrixHsIds.filter((id) => !slots.includes(id));
  const extra = slots.filter((id) => !matrixHsIds.includes(id));
  if (missing.length) blocking('ALIAS_REGISTRY_INCOMPLETE', `omits ${missing.length} matrix-allocated slot id(s): ${missing.join(', ')}`);
  if (extra.length) blocking('ALIAS_REGISTRY_OVERREACH', `invents ${extra.length} slot id(s) the matrix does not allocate: ${extra.join(', ')}`);

  const delivered = new Set([...canonical.keys(), ...science.keys()]);
  for (const e of entries) {
    if (!delivered.has(e.authored_course_id)) blocking('ALIAS_AUTHORED_ID_NOT_DELIVERED', `${e.authored_course_id} is claimed but no delivered course carries that id`);
  }
  const unmapped = [...delivered].filter((id) => !authored.includes(id));
  if (unmapped.length) blocking('ALIAS_REGISTRY_NOT_TOTAL', `${unmapped.length} delivered course(s) have no alias entry: ${unmapped.join(', ')}`);

  for (const [grade, authoredId] of Object.entries(SCIENCE_AUTHORED)) {
    const e = entries.find((x) => x.release_slot_id === `ma-g${grade}-science`);
    if (!e) { blocking('ALIAS_SCIENCE_SLOT_MISSING', `no alias entry for ma-g${grade}-science`); continue; }
    if (e.authored_course_id !== authoredId) blocking('SCIENCE_ID_RENAMED', `ma-g${grade}-science maps to ${e.authored_course_id}, not the authored ${authoredId}`);
  }

  // Relationship, child rule and schema-set labels are re-derived, not believed.
  for (const e of entries) {
    const obs = shapeOf(e.authored_course_id);
    if (!obs) continue;
    const isIdentity = e.release_slot_id === e.authored_course_id;
    const expectedRel = isIdentity ? 'IDENTITY' : 'ALIAS';
    if (e.relationship !== expectedRel) blocking('ALIAS_RELATIONSHIP_WRONG', `${e.release_slot_id} is labelled ${e.relationship}; re-derived ${expectedRel}`);
    const expectedChildRule = isIdentity ? 'IDENTITY' : 'PREFIX_SUBSTITUTION';
    if (e.child_id_rule !== expectedChildRule) blocking('CHILD_ID_RULE_LABEL_WRONG', `${e.release_slot_id} declares child_id_rule ${e.child_id_rule}; re-derived ${expectedChildRule}`);

    const cid = e.authored_course_id;
    const unitIds = obs.unitIds ?? obs.units.map((u) => u.unit_id);
    const assessmentIds = obs.assessmentIds ?? obs.assessments.map((a) => a.assessment_id);
    const ok =
      unitIds.every((i) => new RegExp(`^${cid}-u\\d{2}$`).test(i)) &&
      obs.lessonIds.every((i) => new RegExp(`^${cid}-u\\d{2}-l\\d{2}$`).test(i)) &&
      assessmentIds.every((i) => new RegExp(`^${cid}-u\\d{2}-assessment$`).test(i));
    if (ok !== e.child_id_rule_verified) blocking('CHILD_ID_RULE_CLAIM_WRONG', `${e.release_slot_id} claims child_id_rule_verified=${e.child_id_rule_verified}; re-derived ${ok}`);
    if (!ok) blocking('CHILD_ID_RULE_UNSOUND', `${cid} has child identifiers prefix substitution cannot resolve`);
  }

  // The registry's own summary block must re-derive from its own entries.
  const c = aliasRegistry.counts;
  const rederived = {
    entries: entries.length,
    identity: entries.filter((e) => e.relationship === 'IDENTITY').length,
    alias: entries.filter((e) => e.relationship === 'ALIAS').length,
    child_id_rule_verified_true: entries.filter((e) => e.child_id_rule_verified).length,
  };
  for (const [k, v] of Object.entries(rederived)) {
    if (c[k] !== v) blocking('ALIAS_COUNTS_WRONG', `alias registry counts.${k} = ${c[k]}, re-derived ${v}`);
  }

  // Identifier classes the prefix rule cannot resolve must be declared, not discovered later.
  if (hasScience) {
    const resources = readJson(join(aset, 'resources.json'));
    const resourceIds = (Array.isArray(resources) ? resources : resources.resources ?? []).map((r) => r.resource_id ?? r.id).filter(Boolean);
    const embedded = resourceIds.filter((id) => Object.values(SCIENCE_AUTHORED).some((cid) => id.includes(cid) && !id.startsWith(cid)));
    const declared = aliasRegistry.non_resolving_identifier_classes ?? [];
    const declaredIds = declared.flatMap((d) => d.examples ?? []);
    for (const id of embedded) {
      if (!declaredIds.includes(id)) {
        blocking('CHILD_ID_RULE_SCOPE_UNDECLARED', `${id} embeds a course id without being prefixed by it and is not declared as out of scope for prefix substitution`);
      }
    }
    if (embedded.length) note('CHILD_ID_RULE_SCOPED', `${embedded.length} delivered resource id(s) embed a course id without being prefixed by it; declared out of scope rather than mis-resolved`);
  }
}

/* ================================================================= 2. counts */

function checkCounts() {
  let units = 0, lessons = 0, assessments = 0;
  for (const obs of [...canonical.values(), ...science.values()]) {
    const c = countsOf(obs);
    units += c.units; lessons += c.lessons; assessments += c.assessments;
  }
  const d = courseRegistry.derived_counts;
  const expect = { high_school_courses: canonical.size + science.size, units, lessons, assessments };
  for (const [k, v] of Object.entries(expect)) {
    if (d[k] !== v) blocking('COUNT_MISMATCH', `release-course-registry ${k} = ${d[k]}, re-derived ${v}`);
  }
  if (courseRegistry.courses.length !== expect.high_school_courses) {
    blocking('COURSE_ROWS_MISSING', `release-course-registry lists ${courseRegistry.courses.length} course rows; ${expect.high_school_courses} courses are delivered`);
  }
  const rowSlots = new Set(courseRegistry.courses.map((r) => r.release_slot_id));
  for (const e of aliasRegistry.entries) {
    if (!rowSlots.has(e.release_slot_id)) blocking('COURSE_ROW_MISSING', `${e.release_slot_id} is in the alias registry but has no course-registry row`);
  }
  if (!eq(manifest.derived_counts, d)) blocking('MANIFEST_COUNTS_DRIFT', 'MANIFEST derived_counts differ from the course registry');
  if (manifest.counts_asserted !== false) blocking('COUNTS_ASSERTED', 'MANIFEST.counts_asserted must be false');

  let creditTotal = 0;
  const creditByGrade = {};
  for (const row of courseRegistry.courses) {
    const obs = shapeOf(row.authored_course_id);
    if (!obs) { blocking('COURSE_ROW_UNKNOWN', `${row.release_slot_id} names authored id ${row.authored_course_id}, which no delivered course provides`); continue; }
    const o = countsOf(obs);
    for (const k of ['units', 'lessons', 'assessments']) {
      if (row.observed[k] !== o[k]) blocking('COURSE_COUNT_MISMATCH', `${row.release_slot_id} claims ${k}=${row.observed[k]}, re-derived ${o[k]}`);
    }
    if (row.grade !== obs.grade) blocking('COURSE_GRADE_WRONG', `${row.release_slot_id} claims grade ${row.grade}, delivered content says ${obs.grade}`);

    const m = matrixById.get(row.release_slot_id);
    const rec = m?.sessions ?? null;
    const verdict = rec === null ? 'NOT_RECOMMENDED_BY_MATRIX' : o.lessons === rec ? 'ALIGNED' : 'DIVERGENT';
    if (row.session_alignment !== verdict) blocking('SESSION_ALIGNMENT_WRONG', `${row.release_slot_id} claims ${row.session_alignment}, re-derived ${verdict}`);
    if (row.recommended_sessions !== rec) blocking('RECOMMENDED_SESSIONS_DRIFT', `${row.release_slot_id} claims recommended_sessions ${row.recommended_sessions}, matrix says ${rec}`);
    if (verdict === 'DIVERGENT') advisory('SESSION_COUNT_DIVERGENCE', `${row.release_slot_id} delivers ${o.lessons} lessons against a recommended ${rec} sessions`);
    if (row.credit_recommendation !== (m?.credit_recommendation ?? null)) {
      blocking('CREDIT_DRIFT', `${row.release_slot_id} credit_recommendation ${row.credit_recommendation} differs from the matrix value ${m?.credit_recommendation}`);
    }
    creditTotal += row.credit_recommendation ?? 0;
    creditByGrade[row.grade] = (creditByGrade[row.grade] ?? 0) + (row.credit_recommendation ?? 0);
  }
  if (Math.abs(courseRegistry.credit_recommendation_total - creditTotal) > 1e-9) {
    blocking('CREDIT_TOTAL_WRONG', `credit_recommendation_total ${courseRegistry.credit_recommendation_total}, re-derived ${creditTotal}`);
  }
  for (const [g, v] of Object.entries(creditByGrade)) {
    if (Math.abs((courseRegistry.credit_recommendation_by_grade[g] ?? -1) - v) > 1e-9) {
      blocking('CREDIT_BY_GRADE_WRONG', `grade ${g} credit ${courseRegistry.credit_recommendation_by_grade[g]}, re-derived ${v}`);
    }
  }

  for (const [cid, obs] of canonical) {
    const claimed = new Set();
    for (const u of obs.units) for (const l of u.lesson_ids) {
      if (claimed.has(l)) blocking('LESSON_DOUBLE_CLAIMED', `${l} is claimed by more than one unit in ${cid}`);
      claimed.add(l);
    }
    for (const l of obs.lessonIds) if (!claimed.has(l)) blocking('LESSON_ORPHANED', `${l} is delivered in ${cid} but claimed by no unit`);
  }
  for (const [cid, obs] of science) {
    const claimed = new Set();
    for (const u of obs.units) for (const l of u.lesson_refs) {
      if (claimed.has(l)) blocking('LESSON_DOUBLE_CLAIMED', `${l} is claimed by more than one unit in ${cid}`);
      claimed.add(l);
    }
    for (const l of obs.lessonIds) if (!claimed.has(l)) blocking('LESSON_ORPHANED', `${l} is delivered in ${cid} but claimed by no unit`);
  }
}

/* ================================================================= 3. schedules */

function checkSchedules() {
  const canonicalLessonIds = new Set();
  for (const obs of canonical.values()) for (const l of obs.lessonIds) canonicalLessonIds.add(l);

  const scheduled = new Set();
  for (const grade of GRADES) {
    const lines = readFileSync(join(R1, 'schedules', `grade-${grade}`, 'daily-schedule.csv'), 'utf8')
      .split('\n').filter((l) => l.trim());
    const rows = lines.slice(1).map((l) => l.split(','));
    const ids = rows.map((r) => r[2]);
    const courses = new Set(rows.map((r) => r[1]));
    const unresolved = ids.filter((id) => !canonicalLessonIds.has(id));
    const expectedCourses = [...canonical.entries()].filter(([, o]) => o.grade === grade).length;

    const claim = scheduleRegistry.canonical_plane.find((p) => p.grade === grade);
    if (!claim) { blocking('SCHEDULE_PLANE_MISSING', `no canonical schedule entry for grade ${grade}`); continue; }

    const rederived = {
      rows: rows.length,
      distinct_lessons_scheduled: new Set(ids).size,
      duplicate_rows: ids.length - new Set(ids).size,
      unresolved_lesson_refs: unresolved.length,
      courses_scheduled: courses.size,
      courses_expected_canonical: expectedCourses,
      science_present: [...courses].some((c) => /science|^ma-hs/.test(c)),
    };
    for (const [k, v] of Object.entries(rederived)) {
      if (claim[k] !== v) blocking('SCHEDULE_CLAIM_WRONG', `grade ${grade} claims ${k}=${claim[k]}, re-derived ${v}`);
    }
    if (rederived.duplicate_rows) blocking('SCHEDULE_DUPLICATE', `grade ${grade} schedules some lesson more than once`);
    for (const id of unresolved) blocking('SCHEDULE_UNRESOLVED_REF', `grade ${grade} schedules ${id}, which no delivered lesson provides`);
    for (const id of ids) scheduled.add(id);
  }

  const unscheduled = [...canonicalLessonIds].filter((l) => !scheduled.has(l));
  if (unscheduled.length) blocking('LESSON_UNSCHEDULED', `${unscheduled.length} canonical lesson(s) appear in no schedule`);

  let scienceScheduled = 0, scienceDelivered = 0;
  for (const [grade, cid] of Object.entries(SCIENCE_AUTHORED)) {
    const obs = science.get(cid);
    if (!obs) continue;
    const scheds = scienceSchedules.filter((s) => s.grade === Number(grade));
    const refs = scheds.flatMap((s) => s.entries.flatMap((e) => e.lesson_refs));
    scienceScheduled += new Set(refs).size;
    scienceDelivered += obs.lessons.length;
    const exact = refs.length === new Set(refs).size
      && new Set(refs).size === obs.lessonIds.length
      && obs.lessonIds.every((l) => refs.includes(l));
    const claim = scheduleRegistry.science_plane.find((p) => p.authored_course_id === cid);
    if (!claim) { blocking('SCIENCE_SCHEDULE_CLAIM_MISSING', `no science plane entry for ${cid}`); continue; }
    const rederived = {
      scheduled_lesson_refs: refs.length,
      distinct_lessons_scheduled: new Set(refs).size,
      lessons_delivered: obs.lessons.length,
      covers_every_lesson_exactly_once: exact,
      schedule_ids: scheds.map((s) => s.schedule_id),
      release_slot_id: `ma-g${grade}-science`,
    };
    for (const [k, v] of Object.entries(rederived)) {
      if (!eq(claim[k], v)) blocking('SCIENCE_SCHEDULE_CLAIM_WRONG', `${cid} claims ${k}=${JSON.stringify(claim[k])}, re-derived ${JSON.stringify(v)}`);
    }
  }

  const cov = scheduleRegistry.coverage;
  const rederivedCov = {
    canonical_lessons_delivered: canonicalLessonIds.size,
    canonical_lessons_scheduled: scheduled.size,
    canonical_complete_both_directions: unscheduled.length === 0 && scheduled.size === canonicalLessonIds.size,
    science_lessons_delivered: scienceDelivered,
    science_lessons_scheduled: scienceScheduled,
    science_complete_both_directions: scheduleRegistry.science_plane.every((p) => p.covers_every_lesson_exactly_once)
      && scienceScheduled === scienceDelivered,
    high_school_lessons_delivered: canonicalLessonIds.size + scienceDelivered,
    high_school_lessons_scheduled: scheduled.size + scienceScheduled,
  };
  for (const [k, v] of Object.entries(rederivedCov)) {
    if (!eq(cov[k], v)) blocking('SCHEDULE_COVERAGE_CLAIM_WRONG', `coverage.${k} = ${JSON.stringify(cov[k])}, re-derived ${JSON.stringify(v)}`);
  }

  if (scheduleRegistry.canonical_plane.some((p) => p.science_present)) {
    blocking('SCHEDULE_PLANE_CONFUSION', 'a canonical schedule claims to carry science; the planes must stay separate until H3 import');
  }
  if (scheduleRegistry.open_gap?.code !== 'SCIENCE_NOT_IN_CANONICAL_SCHEDULE') {
    blocking('SCHEDULE_GAP_UNDECLARED', 'the schedule registry does not declare the science scheduling gap');
  } else {
    note('SCIENCE_NOT_IN_CANONICAL_SCHEDULE', 'science is scheduled completely on its native plane; a unified per-grade schedule is owed at H3 import');
  }
}

/* ================================================================= 4. standards evidence

   The class split is re-derived from the r1 per-family coverage registries, which the assembly
   built from each lane's own custody documents. That is the anchor outside this lane. Comparing
   the split only against its own sum, as an earlier cut of this validator did, let evidence
   strength be inflated or destroyed freely.                                                  */

const SECTION_CLASS = [
  ['Verbatim', 'VERBATIM'],
  ['Composite, components verified', 'COMPOSITE_VERIFIED'],
  ['Declared UNVERIFIED by the lane', 'DECLARED_UNVERIFIED'],
  ['Untraceable', 'UNTRACEABLE'],
];

function parseCoverage(family) {
  const text = readFileSync(join(R1, family, 'standards-coverage.md'), 'utf8');
  const classes = { VERBATIM: [], COMPOSITE_VERIFIED: [], DECLARED_UNVERIFIED: [], UNTRACEABLE: [] };
  let current = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) {
      current = null;
      for (const [name, cls] of SECTION_CLASS) if (h[1].startsWith(name)) current = cls;
      continue;
    }
    if (!current) continue;
    if (current === 'UNTRACEABLE') {
      const m = line.match(/^\|\s*([^|]+?)\s*\|/);
      if (m && m[1] !== 'Cited string' && !/^-+$/.test(m[1])) classes.UNTRACEABLE.push(m[1]);
    } else {
      const m = line.match(/^-\s+`(.+)`\s*$/);
      if (m) classes[current].push(m[1]);
    }
  }
  return classes;
}

function checkStandards() {
  const byFamily = new Map(standardsRegistry.families.map((f) => [f.family, f]));

  for (const family of discoveredCanonicalFamilies) {
    const f = byFamily.get(family);
    if (!f) { blocking('STANDARDS_FAMILY_MISSING', `standards registry has no entry for ${family}`); continue; }

    const cited = new Set();
    for (const grade of GRADES) for (const s of canonical.get(`ma-g${grade}-${family}`).standards) cited.add(s);
    if (f.distinct_strings_cited !== cited.size) {
      blocking('STANDARDS_CITED_MISMATCH', `${family} claims ${f.distinct_strings_cited} distinct cited strings, re-derived ${cited.size}`);
    }

    const r1Classes = parseCoverage(family);
    const mpCited = [...cited].filter((s) => /^MP\.\d+$/.test(s));
    // The only class movement this lane performs: mathematics MP.N, UNTRACEABLE -> ALIAS_RESOLVED_VERBATIM.
    const expected = {
      VERBATIM: r1Classes.VERBATIM.length,
      COMPOSITE_VERIFIED: r1Classes.COMPOSITE_VERIFIED.length,
      DECLARED_UNVERIFIED: r1Classes.DECLARED_UNVERIFIED.length,
      ALIAS_RESOLVED_VERBATIM: family === 'mathematics' ? mpCited.length : 0,
      UNTRACEABLE: r1Classes.UNTRACEABLE.length - (family === 'mathematics' ? mpCited.length : 0),
    };
    for (const [cls, n] of Object.entries(expected)) {
      if ((f.classes[cls] ?? 0) !== n) {
        blocking('STANDARDS_CLASS_DRIFT', `${family} claims ${cls}=${f.classes[cls]}; re-derived ${n} from the r1 custody-derived registry`);
      }
    }
    const classified = Object.values(f.classes).reduce((a, b) => a + (b ?? 0), 0);
    if (classified !== cited.size) {
      blocking('STANDARDS_CLASSIFICATION_INCOMPLETE', `${family} classifies ${classified} strings but delivered content cites ${cited.size}`);
    }
    if ((f.classes.UNTRACEABLE ?? 0) > 0) {
      blocking('STANDARD_UNTRACEABLE', `${family} still carries ${f.classes.UNTRACEABLE} untraceable citation(s)`);
    }
    const expectVerbatimClaim = expected.VERBATIM > 0;
    if (f.evidences_a_verbatim_state_standard !== expectVerbatimClaim) {
      blocking('ALIGNMENT_MISSTATED', `${family} claims evidences_a_verbatim_state_standard=${f.evidences_a_verbatim_state_standard}; re-derived ${expectVerbatimClaim}`);
    }
    const framework = matrix.subject_families.find((x) => x.subject === family)?.standards_framework ?? null;
    if (f.standards_framework !== framework) {
      blocking('FRAMEWORK_DRIFT', `${family} claims framework ${f.standards_framework}; the matrix says ${framework}`);
    }
  }

  const unevidenced = discoveredCanonicalFamilies.filter((fam) => (byFamily.get(fam)?.classes.VERBATIM ?? 0) === 0);
  if (unevidenced.length) {
    advisory('STANDARDS_EVIDENCE_UNEVEN', `${unevidenced.join(' and ')} evidence no verbatim state standard; lane-declared UNVERIFIED and composite labels are accepted but are not evidence of alignment`);
  }

  const sci = byFamily.get('science');
  if (!sci || Object.values(sci.classes).some((v) => v !== null)) {
    blocking('SCIENCE_STANDARDS_PRECLASSIFIED', 'science standards evidence must stay unclassified until H3 import');
  }

  checkMathematicalPractice(byFamily.get('mathematics'));
}

function checkMathematicalPractice(math) {
  const mpCited = new Set();
  for (const grade of GRADES) for (const s of canonical.get(`ma-g${grade}-mathematics`).standards) if (/^MP\.\d+$/.test(s)) mpCited.add(s);
  if (math.classes.ALIAS_RESOLVED_VERBATIM !== mpCited.size) {
    blocking('MP_COUNT_MISMATCH', `mathematics claims ${math.classes.ALIAS_RESOLVED_VERBATIM} alias-resolved citations, re-derived ${mpCited.size}`);
  }

  const mapped = new Map(mpMap.practices.map((p) => [p.alias_token, p]));
  for (const token of mpCited) {
    const p = mapped.get(token);
    if (!p) { blocking('MP_UNMAPPED', `${token} is cited by mathematics but absent from mathematical-practice-map.json`); continue; }
    if (p.cited_by_mathematics_lane !== true) blocking('MP_CENSUS_WRONG', `${token} is cited by delivered content but the map says it is not`);
  }
  for (const p of mpMap.practices) {
    if (p.cited_by_mathematics_lane && !mpCited.has(p.alias_token)) blocking('MP_CENSUS_WRONG', `${p.alias_token} is marked cited but no delivered mathematics content cites it`);
  }
  if (!eq(mpMap.citation_census.tokens_cited, [...mpCited].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3))))) {
    blocking('MP_CENSUS_WRONG', 'citation_census.tokens_cited does not re-derive from delivered content');
  }

  // The statements are frozen here so that damaging both the map and the evidence file together
  // still fires. This is a transcription of the digest-pinned document, checked by --verify-source.
  const OFFICIAL = [
    'Make sense of problems and persevere in solving them.',
    'Reason abstractly and quantitatively.',
    'Construct viable arguments and critique the reasoning of others.',
    'Model with mathematics.',
    'Use appropriate tools strategically.',
    'Attend to precision.',
    'Look for and make use of structure.',
    'Look for and express regularity in repeated reasoning.',
  ];
  if (mpMap.practices.length !== 8) blocking('MP_PRACTICE_COUNT_WRONG', `the map carries ${mpMap.practices.length} practices; the official document prints 8`);
  const evidence = readFileSync(join(R2, 'standards', 'evidence', 'mathematical-practice-verbatim.txt'), 'utf8');
  for (const [i, statement] of OFFICIAL.entries()) {
    const p = mpMap.practices.find((x) => x.official_ordinal === i + 1);
    if (!p) { blocking('MP_PRACTICE_MISSING', `practice ${i + 1} is absent from the map`); continue; }
    if (p.statement_verbatim !== statement) blocking('MP_STATEMENT_WRONG', `practice ${i + 1} statement does not match the official transcription`);
    if (!evidence.includes(statement)) blocking('MP_STATEMENT_UNEVIDENCED', `practice ${i + 1} statement is missing from the evidence file`);
    if (/\bMP\b/.test(p.official_label_as_printed)) blocking('MP_LABEL_OVERSTATED', `practice ${i + 1} claims an MP-prefixed printed label; the official document prints none`);
  }

  const src = mpMap.official_source;
  const expectedSource = {
    document_title: 'Michigan K-12 Standards Mathematics',
    publisher: 'Michigan Department of Education',
    url: 'https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf',
    sha256: PINNED_SOURCE_SHA256,
    pages_total: 94,
  };
  for (const [k, v] of Object.entries(expectedSource)) {
    if (src[k] !== v) blocking('MP_SOURCE_DRIFT', `official_source.${k} = ${JSON.stringify(src[k])}; pinned value is ${JSON.stringify(v)}`);
  }
  if (!evidence.includes(PINNED_SOURCE_SHA256)) blocking('MP_EVIDENCE_UNPINNED', 'the evidence file does not carry the pinned source digest');
  const mathCustody = readFileSync(join(R1, 'mathematics', 'source-docs', 'standards', 'standards-custody.md'), 'utf8');
  if (!mathCustody.includes(PINNED_SOURCE_SHA256)) blocking('MP_DIGEST_NOT_SHARED', 'the pinned digest does not appear in the mathematics lane custody; the two lanes did not read the same bytes');

  if (mpMap.verdict.code_form !== 'NOT_PRINTED_BY_OFFICIAL_SOURCE') blocking('MP_VERDICT_OVERSTATED', 'the map must record that the MP.N code form is not printed by the official source');
  if (mpMap.verdict.referents !== 'REAL_AND_VERBATIM_IN_OFFICIAL_SOURCE') blocking('MP_VERDICT_UNDERSTATED', 'the map must record that the referents are verbatim in the official source');
  for (const k of ['token_MP_occurrences_in_official_document', 'token_MP_dot_N_occurrences_in_official_document', 'token_MPN_occurrences_in_official_document']) {
    if (mpMap.independent_verification[k] !== 0) blocking('MP_VERDICT_INCONSISTENT', `${k} is non-zero while the code form is classified as unprinted`);
  }

  const uncited = mpMap.citation_census.tokens_not_cited;
  if (uncited.length) advisory('MP_PRACTICE_NOT_CITED', `the official document carries 8 practices; mathematics cites ${mpMap.citation_census.practices_cited}. Not cited: ${uncited.join(', ')}`);
  advisory('MP_CODE_FORM_IS_LANE_SHORTHAND', 'MP.N is a lane shorthand made traceable by this map, not an official Michigan token; adopting the printed ordinal form belongs to mac/hs912-math-r1');

  if (VERIFY_SOURCE) verifyOfficialSource(OFFICIAL);
  else note('SOURCE_NOT_REFETCHED', 'the official document was not re-fetched in this run; the transcription is checked against the frozen copy in this validator. Run with --verify-source to re-check against michigan.gov');
}

function verifyOfficialSource(OFFICIAL) {
  // Scratch stays outside the repository: this lane writes nothing beyond its own directory.
  const scratch = mkdtempSync(join(tmpdir(), 'hs912-r2-source-'));
  const tmp = join(scratch, 'source.pdf');
  try {
    execFileSync('curl', ['-sS', '-L', '-A', 'Mozilla/5.0', '-o', tmp,
      mpMap.official_source.url], { timeout: 120000 });
    const digest = createHash('sha256').update(readFileSync(tmp)).digest('hex');
    if (digest !== PINNED_SOURCE_SHA256) {
      blocking('MP_SOURCE_DIGEST_MISMATCH', `the document now at the pinned URL hashes to ${digest}, not the pinned ${PINNED_SOURCE_SHA256}`);
      return;
    }
    const text = execFileSync('python3', ['-c',
      'import sys,pypdf;print("\\n".join((p.extract_text() or "") for p in pypdf.PdfReader(sys.argv[1]).pages))',
      tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const mpHits = (text.match(/\bMP\b|\bMP\.\d\b|\bMP[1-8]\b/g) ?? []).length;
    if (mpHits !== 0) blocking('MP_TOKEN_FOUND_IN_SOURCE', `the official document contains ${mpHits} MP-prefixed token(s); the map claims zero`);
    for (const [i, statement] of OFFICIAL.entries()) {
      const normalized = text.replace(/\s+/g, ' ');
      if (!normalized.includes(statement)) blocking('MP_STATEMENT_NOT_IN_SOURCE', `practice ${i + 1} statement is not present in the re-fetched document`);
    }
    note('SOURCE_REVERIFIED', `official document re-fetched and re-checked: digest matches, ${mpHits} MP tokens, all 8 statements present`);
  } catch (err) {
    advisory('SOURCE_VERIFICATION_UNAVAILABLE', `--verify-source could not complete (${String(err.message).split('\n')[0]}); the transcription remains checked against the frozen copy only`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/* ================================================================= 5. coverage and claims */

const WORLD_LANGUAGE_HINTS = /world[-_ ]?language|spanish|french|german|latin|mandarin|chinese|japanese|asl|american sign/i;

function checkCoverage() {
  // Re-derived from what is actually on disk and inside delivered records — never from a constant
  // in this file, which would make the check inert.
  const evidenceOfWorldLanguage = [];
  for (const name of readdirSync(R1)) {
    if (statSync(join(R1, name)).isDirectory() && WORLD_LANGUAGE_HINTS.test(name)) evidenceOfWorldLanguage.push(`directory ${name}`);
  }
  for (const [cid, obs] of [...canonical, ...science]) {
    if (WORLD_LANGUAGE_HINTS.test(cid)) evidenceOfWorldLanguage.push(`course id ${cid}`);
    for (const s of obs.subjects ?? []) if (WORLD_LANGUAGE_HINTS.test(s)) evidenceOfWorldLanguage.push(`subject "${s}" in ${cid}`);
  }
  for (const c of matrixHs) {
    if (WORLD_LANGUAGE_HINTS.test(c.course_id) || WORLD_LANGUAGE_HINTS.test(c.subject ?? '')) {
      evidenceOfWorldLanguage.push(`matrix allocates ${c.course_id}`);
    }
  }

  const wl = coverageRegistry.requirements.find((r) => r.requirement === 'MMC_WORLD_LANGUAGE');
  if (!wl) blocking('WORLD_LANGUAGE_MISSING', 'MMC_WORLD_LANGUAGE is absent from the coverage registry');
  else if (wl.verdict !== 'NOT_COVERED') blocking('WORLD_LANGUAGE_OVERSTATED', `MMC_WORLD_LANGUAGE verdict is ${wl.verdict}; it must remain NOT_COVERED while no world-language content exists`);

  if (evidenceOfWorldLanguage.length) {
    blocking('WORLD_LANGUAGE_CONTENT_FOUND', `world-language content exists (${evidenceOfWorldLanguage.slice(0, 4).join('; ')}); the NOT_COVERED verdict must be revisited rather than carried forward`);
  } else {
    note('WORLD_LANGUAGE_NOT_COVERED', `no world-language directory, course id, subject field or matrix allocation exists across ${discoveredCanonicalFamilies.length + 1} discovered families; NOT_COVERED is re-derived, not copied`);
  }

  if (coverageRegistry.graduation_completeness.verdict !== 'NOT_GRADUATION_COMPLETE') {
    blocking('GRADUATION_CLAIM', 'the coverage registry does not carry the NOT_GRADUATION_COMPLETE verdict');
  }
  if (!eq(coverageRegistry.graduation_completeness.basis, matrix.graduation_completeness.basis)) {
    blocking('GRADUATION_BASIS_DRIFT', 'the graduation-completeness basis differs from the matrix');
  }

  // Field-level, not verdict-only: an irreducible remainder quietly zeroed is still an overstatement.
  for (const g of matrix.declared_coverage_gaps) {
    const r = coverageRegistry.requirements.find((x) => x.requirement === g.requirement);
    if (!r) { blocking('COVERAGE_GAP_DROPPED', `${g.requirement} is declared by the matrix but missing from this lane's registry`); continue; }
    for (const k of ['verdict', 'authority', 'credits_required', 'irreducible_remainder_credits', 'owner', 'detail']) {
      const expected = g[k] ?? null;
      const actual = r[k] ?? null;
      if (!eq(expected, actual)) blocking('COVERAGE_FIELD_CHANGED', `${g.requirement}.${k} changed from ${JSON.stringify(expected)} to ${JSON.stringify(actual)}`);
    }
    if (r.changed_by_this_lane !== false) blocking('COVERAGE_CHANGE_UNDECLARED', `${g.requirement} is marked changed_by_this_lane`);
  }
}

/* ================================================================= 6. no completeness claim */

const CLAIM_PATTERNS = [
  /graduation[- ]complete\b(?!ness)/i,
  /meets? (?:all|every) .{0,40}?(?:graduation |merit |mmc )?requirements?/i,
  /(?:fully )?satisfies the michigan[- ]merit curriculum/i,
  /all (?:mmc |merit )?requirements (?:are )?(?:covered|met|satisfied)/i,
  /diploma[- ]ready/i,
];

// Polarity matters. The negated form of the completeness claim is the honest sentence this lane
// must be able to write, so it is allowed. The negation has to be adjacent to the claim — inside
// the same clause and within a short window — so an affirmative claim carrying an earlier stray
// negation elsewhere in the sentence is still caught. hs912-r1 §5 records the release validator
// getting polarity wrong in the other direction; a loose rule here would be the same mistake
// wearing different clothes.
//
// Nothing in this file, or in mutation-test.py, contains text its own patterns match. That is
// deliberate: it lets the scan run over every file in the lane with no exemptions, and an
// exemption is a hole — the previous cut of this check had two.
const NEGATION = /\b(?:not|never|cannot|no longer|nothing|neither)\b/i;
const CLAUSE_BREAK = /[:;—]|\bbut\b|\bthough\b|\bhowever\b/i;

function claimIsNegated(sentence, matchIndex) {
  const window = sentence.slice(Math.max(0, matchIndex - 40), matchIndex);
  if (CLAUSE_BREAK.test(window)) return false;
  return NEGATION.test(window);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function checkNoCompletenessClaim() {
  let negated = 0;
  for (const file of walk(R2)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const sentence of text.split(/(?<=[.!?\n])/)) {
      for (const pattern of CLAIM_PATTERNS) {
        const m = sentence.match(pattern);
        if (!m) continue;
        if (claimIsNegated(sentence, m.index)) { negated += 1; continue; }
        blocking('GRADUATION_CLAIM', `${relative(REPO, file)} contains a graduation-completeness claim: "${m[0].trim()}"`);
      }
    }
  }
  note('NO_GRADUATION_CLAIM', `no artifact in this lane claims graduation completeness; every file was scanned with no exemptions (${negated} negated statement(s) read and allowed)`);
}

/* ================================================================= 7. scope and provenance */

function gitSha(ref) {
  try {
    return execFileSync('git', ['rev-parse', ref], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function checkScope() {
  if (manifest.scope.owns !== 'curriculum-release-normalization/hs912-r2/**') {
    blocking('SCOPE_DECLARATION_WRONG', 'the manifest does not declare this lane\'s ownership correctly');
  }
  const sci = manifest.science;
  if (sci.status !== 'PENDING_H3_IMPORT') blocking('SCIENCE_STATUS_WRONG', `science status is ${sci.status}; it must be PENDING_H3_IMPORT`);
  if (sci.successor_pinned !== false) blocking('H3_PINNED', 'the moving H3 branch must not be pinned by this lane');
  if (sci.successor_branch !== 'mac/hs912-science-h3') blocking('H3_BRANCH_WRONG', `successor_branch is ${sci.successor_branch}`);

  // Provenance is re-derived from git and from the r1 manifest, not taken on trust.
  const r1Manifest = readJson(join(R1, 'MANIFEST.json'));
  const r1Science = r1Manifest.inputs.find((i) => i.lane === 'science');
  if (sci.content_in_candidate_from_branch !== r1Science.branch) {
    blocking('SCIENCE_PROVENANCE_WRONG', `manifest says science came from ${sci.content_in_candidate_from_branch}; the candidate says ${r1Science.branch}`);
  }
  if (sci.content_in_candidate_sha !== r1Science.sha) {
    blocking('SCIENCE_PROVENANCE_WRONG', `manifest says science sha ${sci.content_in_candidate_sha}; the candidate says ${r1Science.sha}`);
  }
  const h3 = gitSha('mac/hs912-science-h3');
  if (h3 && sci.successor_sha_observed && h3 !== sci.successor_sha_observed) {
    advisory('H3_MOVED', `mac/hs912-science-h3 is now ${h3.slice(0, 8)}; the observation recorded at normalization time was ${String(sci.successor_sha_observed).slice(0, 8)}. Expected of a moving branch — the alias registry, not this SHA, is the durable artifact`);
  }
  if (h3) {
    // Read-only: does the successor still carry the stable ids the alias registry is keyed on?
    try {
      const m = JSON.parse(execFileSync('git', ['show',
        `${h3}:curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set/manifest.json`],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      const stable = Object.values(SCIENCE_AUTHORED);
      const missing = stable.filter((id) => !m.course_refs.includes(id));
      if (missing.length) advisory('H3_IDS_DIVERGED', `mac/hs912-science-h3 no longer carries ${missing.join(', ')}; the alias registry will need re-keying at import`);
      else note('H3_IDS_STABLE', 'the successor branch still carries all four stable science course ids; the alias registry survives the import as keyed');
    } catch { /* the successor may not carry that path; nothing is owed here */ }
  }

  for (const row of courseRegistry.courses.filter((c) => c.subject === 'science')) {
    if (row.status !== 'PENDING_H3_IMPORT') blocking('SCIENCE_STATUS_WRONG', `${row.release_slot_id} status is ${row.status}`);
  }
  note('SCIENCE_PENDING_H3_IMPORT', 'the four science courses are recorded PENDING_H3_IMPORT');
  note('RELEASE_VALIDATOR_HANDOFF', 'release/validate-high-school.mjs is owned by mac/hs912-release-r1 and is not edited here. It needs two changes before it can pass this candidate: read the alias registry, and fix the polarity defect in its body-assessment denylist (432 inverted findings, recorded in hs912-r1 assembly-report.md §5)');
}

/* ================================================================= run */

checkAliasRegistry();
checkCounts();
checkSchedules();
checkStandards();
checkCoverage();
checkNoCompletenessClaim();
checkScope();

const blockingFindings = findings.filter((f) => f.severity === 'BLOCKING');
const advisoryFindings = findings.filter((f) => f.severity === 'ADVISORY');
const overall = blockingFindings.length === 0 ? 'HS912_NORMALIZED_RELEASE_READY' : 'BLOCKED';

if (process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'json') {
  console.log(JSON.stringify({ overall, blocking: blockingFindings.length, advisory: advisoryFindings.length, findings, notes }, null, 2));
} else {
  console.log('Manuel Academy 9-12 release-normalization validation (hs912-r2)');
  console.log(`overall: ${overall}`);
  console.log(`blocking: ${blockingFindings.length}   advisory: ${advisoryFindings.length}   notes: ${notes.length}`);
  console.log('derived counts (observed, never asserted):');
  for (const [k, v] of Object.entries(courseRegistry.derived_counts)) console.log(`  ${k}: ${v}`);
  console.log('findings:');
  if (!findings.length) console.log('  none');
  for (const f of [...blockingFindings, ...advisoryFindings]) console.log(`  [${f.severity}] ${f.code} — ${f.message}`);
  for (const n of notes) console.log(`  [NOTE] ${n.code} — ${n.message}`);
}

process.exit(blockingFindings.length === 0 ? 0 : 1);
