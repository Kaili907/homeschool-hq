import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { audit } from './audit.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'web-sensitive-provenance-'))
  for (const [name, contents] of Object.entries(files)) {
    const file = join(root, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
  }
  return root
}

test('reproduces R2 file-rule and occurrence semantics', async (context) => {
  const root = fixture({
    'assets/a.js': 'answerIndex correctAnswer PIN tutorTranscript serviceRole http://localhost:9999',
    'assets/b.js': 'answerIndex PIN transcript_x_tutor SUPABASE_SERVICE_ROLE_KEY 127.0.0.1',
    'ignored.bin': 'answerIndex',
  })
  context.after(() => rmSync(root, { recursive: true, force: true }))

  const report = await audit({ root })

  assert.equal(report.filesScanned, 2)
  assert.deepEqual(report.r2.terms.answer_index, {
    occurrences: 2,
    fileCount: 2,
    files: [
      { path: 'assets/a.js', count: 1 },
      { path: 'assets/b.js', count: 1 },
    ],
  })
  assert.equal(report.r2.terms.tutor_transcript.occurrences, 2)
  assert.equal(report.r2.terms.service_role.occurrences, 2)
  assert.equal(report.r2.terms.localhost_production_dependency.occurrences, 2)
})

test('expanded inventory counts plural pinDigests and keeps exact service variants distinct', async (context) => {
  const root = fixture({
    'bundle.js': 'pinDigest pinDigests serviceRole service_role service-role Tutor transcript expectedAnswer',
  })
  context.after(() => rmSync(root, { recursive: true, force: true }))

  const report = await audit({ root })

  assert.equal(report.expanded.terms.pinDigest.occurrences, 2)
  assert.equal(report.expanded.terms.service_role.occurrences, 1)
  assert.equal(report.expanded.terms['service-role'].occurrences, 1)
  assert.equal(report.expanded.terms.Tutor.occurrences, 1)
  assert.equal(report.expanded.terms.transcript.occurrences, 1)
  assert.equal(report.expanded.terms.expectedAnswer.occurrences, 1)
})

test('fails closed when the requested build output does not exist', async () => {
  await assert.rejects(
    audit({ root: join(tmpdir(), 'web-sensitive-provenance-does-not-exist') }),
    /Build output is missing/,
  )
})
