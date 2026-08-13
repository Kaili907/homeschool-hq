import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toLessonProductionInput, evaluateCorpus } from './src/gateProjection.ts';
import { findDuplicates } from './src/duplicateCheck.ts';
import { validateEntry } from './src/validate.ts';

const ROOT = '.';
const ids = ['swk-rfl-g4-u03-l01','swk-rfl-g4-u03-l02','swk-rfl-g4-u03-l03','swk-rfl-g4-u03-l04','swk-rfl-g4-u03-l05','swk-rfl-g4-u03-l06'];
const entries = ids.map(id => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', id + '.package.json'), 'utf8'));
  const scoring = JSON.parse(readFileSync(join(ROOT, 'scoring', id + '.scoring.json'), 'utf8'));
  return { pkg, scoring, packagePath: id, scoringPath: id, origin: 'batch' };
});

const result = evaluateCorpus(entries);
for (const r of result.lessonResults) {
  console.log(r.lessonId, r.status, r.codes.join(','), r.notes.join(' | '));
}

console.log('--- duplicates among these 6 ---');
console.log(findDuplicates(entries));

console.log('--- validateEntry (attestation/photo/purchase/access/answer-leak) ---');
for (const e of entries) {
  const issues = validateEntry(e);
  console.log(e.pkg.packageId, issues.length === 0 ? 'OK' : JSON.stringify(issues));
}
