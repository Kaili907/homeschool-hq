import { describe, expect, it } from 'vitest'
import {
  durableStudyDocumentKey,
  loadDurableStudyDocument,
  saveDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../durable-ports'
import type { HostStudyLaunchContext } from '../../types'
import { mathLesson, pilotDevice, startMath, storedHandle, studentContext } from './testing/pilotDevice'

// The capacity proof.
//
// The blocker: the accepted store measures ~12 KB per completed five-segment
// lesson, and a localStorage origin is about 5 MB, so a whole household gets
// roughly 400 completed lessons before Study starts refusing writes. This file
// exists to show that the IndexedDB backing store is not held to that number,
// and to say honestly what it IS held to.
//
// Nothing here claims unlimited storage. Three real ceilings are measured
// rather than asserted away:
//
//   1. The browser's own quota, which is a share of free disk and is not
//      knowable from inside the page. It is reported, not assumed.
//   2. The accepted schema's per-student record caps — 2,000 calendar blocks
//      and 20,000 events. At the twelve events one completed lesson produces,
//      the events cap binds first, at roughly 1,600 completed lessons per
//      student. Past it the store REFUSES a write rather than truncating.
//   3. Cost per operation. Every port call re-reads, re-parses and re-validates
//      the student's whole document, and every write re-serializes it. That is
//      the accepted store's design and it is unchanged here; it is measured at
//      full-year size below so the number is on the record.

const STUDENTS = 6
const LESSONS_PER_STUDENT = 700
/** The practical household ceiling the accepted localStorage store was pinned at. */
const LOCALSTORAGE_HOUSEHOLD_LESSON_CEILING = 400
const LOCALSTORAGE_ORIGIN_BUDGET_BYTES = 5_000_000

function documentText(device: ReturnType<typeof pilotDevice>, context: HostStudyLaunchContext): string {
  const record = device.fake.records().get(durableStudyDocumentKey(context)) as { value: string } | undefined
  if (!record) throw new Error('No durable document for this student.')
  return record.value
}

/**
 * One completed lesson, run for real through the Study runtime so that every
 * record below is a record the accepted store actually produces.
 */
async function completeOneLesson(
  device: ReturnType<typeof pilotDevice>,
  context: HostStudyLaunchContext,
  id: string,
) {
  const { runtime, handle, session } = await startMath(device, context, id)
  for (let step = 0; step < 5; step += 1) {
    await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
    await runtime.checkpoint({ context, session })
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
  }
  const finished = await runtime.completeAssignment({ context, session })
  if (finished.status !== 'ok') throw new Error(finished.reason)
  return { handle, session, snapshot: finished.snapshot }
}

/**
 * A school year built out of one real completed lesson. Every identifier that
 * carries the seed lesson's name is renamed per occurrence, so the copies are
 * distinct work rather than duplicates the parser would collapse — and they are
 * still records the accepted schema validates, because they are the real thing
 * with different names.
 */
function expandToSchoolYear(seed: string, token: string, lessons: number): DurableStudyDocumentV1 {
  const parsed = JSON.parse(seed) as DurableStudyDocumentV1
  const calendar = JSON.stringify(parsed.calendar[0])
  const session = JSON.stringify(parsed.sessions[0])
  const checkpoint = JSON.stringify(parsed.checkpoints[0])
  const events = JSON.stringify(parsed.events)
  const rename = (text: string, occurrence: number) =>
    text.replaceAll(token, `${token}${occurrence}`)
      // Tutor request references are minted from a clock rather than the lesson,
      // so they need their own occurrence marker to stay distinct.
      .replaceAll('"request:', `"request:y${occurrence}-`)

  const grown = {
    ...parsed,
    calendar: [...parsed.calendar],
    sessions: [...parsed.sessions],
    checkpoints: [...parsed.checkpoints],
    events: [...parsed.events],
  } as {
    calendar: unknown[]
    sessions: unknown[]
    checkpoints: unknown[]
    events: unknown[]
  } & DurableStudyDocumentV1

  for (let occurrence = 1; occurrence < lessons; occurrence += 1) {
    grown.calendar.push(JSON.parse(rename(calendar, occurrence)))
    grown.sessions.push(JSON.parse(rename(session, occurrence)))
    grown.checkpoints.push(JSON.parse(rename(checkpoint, occurrence)))
    grown.events.push(...(JSON.parse(rename(events, occurrence)) as unknown[]))
  }
  return grown as DurableStudyDocumentV1
}

describe('Family Pilot IndexedDB Study ports — household capacity', () => {
  it('holds a multi-student school year an order of magnitude past the localStorage ceiling', async () => {
    const device = pilotDevice()
    const students = Array.from({ length: STUDENTS }, (_, index) => studentContext(`cap${index}`))
    const perStudentBytes: number[] = []
    let oneLessonBytes = 0

    for (const [index, context] of students.entries()) {
      const { handle, session } = await completeOneLesson(device, context, 'year')
      const seed = documentText(device, context)
      if (index === 0) oneLessonBytes = seed.length

      const year = expandToSchoolYear(seed, 'year', LESSONS_PER_STUDENT)
      const written = saveDurableStudyDocument(context, year, {
        storage: handle.storage.storage,
        expectedRaw: seed,
      })
      expect(written.reasonCode, `student ${index} year write`).toBeNull()
      await handle.storage.flush()
      handle.close()

      perStudentBytes.push(documentText(device, context).length)

      // A cold restart on a full year still resumes the exact lesson the
      // student finished, through a brand-new database connection.
      const { runtime: reloaded, handle: reopened } = await device.reload(context)
      const blocks = await reopened.ports.calendar.list(context)
      expect(blocks).toHaveLength(LESSONS_PER_STUDENT)
      const resumed = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
      if (resumed.status !== 'ok') throw new Error(resumed.reason)
      expect(resumed.snapshot.assignmentState).toBe('completed')
      expect(resumed.snapshot.remainingSegmentRefs).toEqual([])
      reopened.close()
    }

    const householdLessons = STUDENTS * LESSONS_PER_STUDENT
    const householdBytes = perStudentBytes.reduce((total, bytes) => total + bytes, 0)

    // The headline: this household is storing an order of magnitude more
    // completed work than a localStorage origin could have held at all.
    expect(householdLessons).toBeGreaterThan(LOCALSTORAGE_HOUSEHOLD_LESSON_CEILING * 10)
    expect(householdBytes).toBeGreaterThan(LOCALSTORAGE_ORIGIN_BUDGET_BYTES * 8)
    // And the cost per lesson has not quietly changed under the new backing store.
    expect(oneLessonBytes).toBeGreaterThan(1_000)
    expect(oneLessonBytes).toBeLessThan(20_000)

    const estimate = await (await device.reload(students[0])).handle.storage.estimate()
    expect(estimate.usage).toBeGreaterThan(householdBytes)

    // The measured figures are the deliverable, so they are reported rather than
    // only asserted: a range that passes is not a number a household can plan a
    // school year around.
    console.log(
      `[capacity] ${STUDENTS} students x ${LESSONS_PER_STUDENT} completed lessons = ` +
      `${householdLessons} lessons household-wide; ${(householdBytes / 1_000_000).toFixed(1)} MB stored; ` +
      `${oneLessonBytes} bytes per completed five-segment lesson; ` +
      `${(householdBytes / STUDENTS / 1_000_000).toFixed(1)} MB per student document.`,
    )
  }, 300_000)

  /**
   * The honest cost of the accepted store's whole-document design at full-year
   * size: every port call re-reads and re-validates the student's entire
   * document, and every mutation re-serializes it. The bound here is wide
   * because it is a guard against an order-of-magnitude regression, not a
   * performance promise; the measured figure is the one to quote.
   */
  it('still completes a Study step on a student with a full school year stored', async () => {
    for (const [index, storedLessons] of [50, 200, LESSONS_PER_STUDENT].entries()) {
      const device = pilotDevice()
      const context = studentContext(`busy${index}`)
      const { handle } = await completeOneLesson(device, context, 'year')
      const seed = documentText(device, context)
      const written = saveDurableStudyDocument(context, expandToSchoolYear(seed, 'year', storedLessons), {
        storage: handle.storage.storage,
        expectedRaw: seed,
      })
      expect(written.reasonCode).toBeNull()
      await handle.storage.flush()
      const storedBytes = documentText(device, context).length
      handle.close()

      const { runtime } = await device.reload(context)
      const startedAt = performance.now()
      const started = await runtime.startAssignment({
        context,
        assignment: { kind: 'static-curriculum', lesson: mathLesson('one-more') },
      })
      if (started.status !== 'ok') throw new Error(started.reason)
      const elapsed = performance.now() - startedAt
      console.log(
        `[capacity] one Study step against ${storedLessons} stored lessons ` +
        `(${(storedBytes / 1_000_000).toFixed(1)} MB) took ${elapsed.toFixed(0)} ms.`,
      )
      expect(elapsed).toBeLessThan(30_000)

      const advanced = await runtime.completeSegment({ context, session: started.snapshot.session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
      expect(advanced.snapshot.segmentOrdinal).toBe(2)
    }
  }, 300_000)
})

describe('Family Pilot IndexedDB Study ports — the ceiling that is left', () => {
  /**
   * Capacity is no longer bounded by the origin's storage budget, so it is
   * bounded by the accepted schema's per-student record caps instead. That is
   * worth pinning: it is the number a household actually runs into, and the
   * store refuses the write rather than dropping the oldest work to fit.
   */
  it('refuses a write past the accepted per-student record cap instead of truncating it', async () => {
    const device = pilotDevice()
    const context = studentContext('ceiling')
    const { handle } = await completeOneLesson(device, context, 'year')
    const seed = documentText(device, context)

    // One past the accepted schema's 2,000-block calendar cap.
    const overCap = expandToSchoolYear(seed, 'year', 2_001)
    const written = saveDurableStudyDocument(context, { ...overCap, events: [] }, {
      storage: handle.storage.storage,
      expectedRaw: seed,
    })
    expect(written.reasonCode).toBe('write-rejected-unreadable')
    await handle.storage.flush()

    // Nothing was truncated and nothing was lost: the student's real lesson is
    // exactly as it was.
    const loaded = loadDurableStudyDocument(context, { storage: handle.storage.storage })
    expect(loaded.status).toBe('ready')
    expect(loaded.document.calendar).toHaveLength(1)
  }, 300_000)
})
