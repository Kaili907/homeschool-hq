import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import type { CoreDayConfig, Profile, ScheduleDay } from '../types'
import {
  DEFAULT_CORE_DAY,
  FLEX_ROTATION,
  MAX_EXTENSION_LABEL,
  SCHEDULE_DAYS,
  addExtension,
  blocksForProfileDay,
  canAddExtension,
  coreDayBlocks,
  flexActivityForWeek,
  flexWeekIndex,
  removeExtension,
  writingOrSpelling,
} from './coreDay'

const TTH: CoreDayConfig = { writingDays: 'writing-tth' }

const labelAt = (day: ScheduleDay, config: CoreDayConfig, start: string) =>
  coreDayBlocks(day, config, 'Library').find((b) => b.start === start)?.label

describe('Core Day template', () => {
  it('applies identically to all five profiles', () => {
    const profiles = Object.values(defaultAppState().profiles)
    expect(profiles.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    for (const day of SCHEDULE_DAYS) {
      const shared = coreDayBlocks(day, DEFAULT_CORE_DAY, 'Library')
      for (const p of profiles) {
        expect(blocksForProfileDay(p, day, DEFAULT_CORE_DAY, 'Library')).toEqual(shared)
      }
    }
  })

  it('runs Math 9:00–9:30 daily under every config', () => {
    for (const config of [DEFAULT_CORE_DAY, TTH]) {
      for (const day of SCHEDULE_DAYS) {
        const first = coreDayBlocks(day, config, 'Art')[0]
        expect(first).toMatchObject({ start: '09:00', end: '09:30', label: 'Math' })
      }
    }
  })

  it('runs Reading, Break, and the shared read-aloud daily', () => {
    for (const day of SCHEDULE_DAYS) {
      const blocks = coreDayBlocks(day, DEFAULT_CORE_DAY, 'Art')
      expect(labelAt(day, DEFAULT_CORE_DAY, '09:30')).toBe('Reading')
      expect(labelAt(day, DEFAULT_CORE_DAY, '10:00')).toBe('Break / movement')
      expect(blocks.at(-1)).toMatchObject({
        start: '11:15',
        end: '11:30',
        label: 'Shared read-aloud',
      })
    }
  })
})

describe('Writing/Spelling alternation', () => {
  it('defaults to Writing Mon/Wed and Spelling Tue/Thu', () => {
    expect(writingOrSpelling('Mon', DEFAULT_CORE_DAY)).toBe('Writing')
    expect(writingOrSpelling('Wed', DEFAULT_CORE_DAY)).toBe('Writing')
    expect(writingOrSpelling('Tue', DEFAULT_CORE_DAY)).toBe('Spelling')
    expect(writingOrSpelling('Thu', DEFAULT_CORE_DAY)).toBe('Spelling')
    expect(labelAt('Mon', DEFAULT_CORE_DAY, '10:15')).toBe('Writing')
    expect(labelAt('Tue', DEFAULT_CORE_DAY, '10:15')).toBe('Spelling')
  })

  it('flips both subjects when Writing moves to Tue/Thu', () => {
    expect(writingOrSpelling('Mon', TTH)).toBe('Spelling')
    expect(writingOrSpelling('Tue', TTH)).toBe('Writing')
    expect(writingOrSpelling('Wed', TTH)).toBe('Spelling')
    expect(writingOrSpelling('Thu', TTH)).toBe('Writing')
    expect(labelAt('Thu', TTH, '10:15')).toBe('Writing')
  })

  it('gives Friday neither Writing nor Spelling', () => {
    expect(writingOrSpelling('Fri', DEFAULT_CORE_DAY)).toBeNull()
    const labels = coreDayBlocks('Fri', DEFAULT_CORE_DAY, 'Library').map((b) => b.label)
    expect(labels).not.toContain('Writing')
    expect(labels).not.toContain('Spelling')
  })
})

describe('Science vs Social Studies', () => {
  it('teaches Science Mon/Wed and Social Studies Tue/Thu, neither on Friday', () => {
    expect(labelAt('Mon', DEFAULT_CORE_DAY, '10:45')).toBe('Science')
    expect(labelAt('Wed', DEFAULT_CORE_DAY, '10:45')).toBe('Science')
    expect(labelAt('Tue', DEFAULT_CORE_DAY, '10:45')).toBe('Social Studies')
    expect(labelAt('Thu', DEFAULT_CORE_DAY, '10:45')).toBe('Social Studies')
    const friday = coreDayBlocks('Fri', DEFAULT_CORE_DAY, 'Library').map((b) => b.label)
    expect(friday).not.toContain('Science')
    expect(friday).not.toContain('Social Studies')
  })

  it('keeps Science/Social Studies days fixed when the alternation flips', () => {
    expect(labelAt('Mon', TTH, '10:45')).toBe('Science')
    expect(labelAt('Tue', TTH, '10:45')).toBe('Social Studies')
  })
})

describe('Friday flex block', () => {
  it('fills 10:15–11:15 with the rotating activity', () => {
    const flex = coreDayBlocks('Fri', DEFAULT_CORE_DAY, 'Nature walk').find(
      (b) => b.kind === 'flex',
    )
    expect(flex).toMatchObject({ start: '10:15', end: '11:15', label: 'Flex: Nature walk' })
  })

  it('rotates through exactly the five card-named activities and wraps', () => {
    expect([...FLEX_ROTATION]).toEqual([
      'Library',
      'Art',
      'Nature walk',
      'Field trip',
      'Catch-up',
    ])
    expect([0, 1, 2, 3, 4].map(flexActivityForWeek)).toEqual([...FLEX_ROTATION])
    expect(flexActivityForWeek(5)).toBe('Library')
    expect(flexActivityForWeek(-1)).toBe('Catch-up')
  })

  it('keeps one activity for a whole week and advances the next', () => {
    // 2026-08-03 is a Monday.
    expect(flexWeekIndex('2026-08-03')).toBe(flexWeekIndex('2026-08-07'))
    expect(flexWeekIndex('2026-08-10')).toBe(flexWeekIndex('2026-08-03') + 1)
  })
})

describe('canAddExtension form gate', () => {
  it('accepts a well-formed block', () => {
    expect(canAddExtension('Algebra practice', ['Mon', 'Wed'], '13:00', '13:30', 0)).toBe(true)
  })

  it('rejects everything the sync validator would reject', () => {
    // a stored invalid extension silently halts ALL household persistence,
    // so the form gate must be at least as strict as timeOfDay/text.
    expect(canAddExtension('Block', ['Mon'], '', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '13:00', '', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '9:00', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '1pm', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '25:00', '26:00', 0)).toBe(false)
    expect(canAddExtension('x'.repeat(MAX_EXTENSION_LABEL + 1), ['Mon'], '13:00', '13:30', 0)).toBe(false)
  })

  it('rejects empty labels, empty days, and non-positive ranges', () => {
    expect(canAddExtension('', ['Mon'], '13:00', '13:30', 0)).toBe(false)
    expect(canAddExtension('   ', ['Mon'], '13:00', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', [], '13:00', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '13:30', '13:30', 0)).toBe(false)
    expect(canAddExtension('Block', ['Mon'], '14:00', '13:30', 0)).toBe(false)
  })
})

describe('per-girl extension blocks', () => {
  const girl = (): Profile => defaultAppState().profiles.p4

  it('start empty for every profile', () => {
    for (const p of Object.values(defaultAppState().profiles)) {
      expect(p.scheduleExtensions).toBeUndefined()
    }
  })

  it('adds a block with a fresh id and leaves the rest of the profile alone', () => {
    const before = girl()
    const after = addExtension(before, {
      label: 'Algebra practice',
      days: ['Mon', 'Wed'],
      start: '13:00',
      end: '13:30',
    })
    expect(after.scheduleExtensions).toHaveLength(1)
    expect(after.scheduleExtensions?.[0]).toMatchObject({
      label: 'Algebra practice',
      days: ['Mon', 'Wed'],
    })
    expect(after.scheduleExtensions?.[0].id).toBeTruthy()
    expect(before.scheduleExtensions).toBeUndefined()
    expect(after.name).toBe(before.name)
    expect(after.skills).toEqual(before.skills)
  })

  it('gives two added blocks distinct ids', () => {
    const one = addExtension(girl(), { label: 'A', days: ['Mon'], start: '13:00', end: '13:30' })
    const two = addExtension(one, { label: 'B', days: ['Tue'], start: '13:00', end: '13:30' })
    const [a, b] = two.scheduleExtensions ?? []
    expect(a.id).not.toBe(b.id)
  })

  it('removes a block by id and ignores unknown ids', () => {
    const withBlock = addExtension(girl(), {
      label: 'Essay hour',
      days: ['Fri'],
      start: '13:00',
      end: '14:00',
    })
    const id = withBlock.scheduleExtensions?.[0].id ?? ''
    expect(removeExtension(withBlock, id).scheduleExtensions).toHaveLength(0)
    expect(removeExtension(withBlock, 'sx-nope').scheduleExtensions).toHaveLength(1)
  })

  it('merges extensions into the right days, sorted by start time', () => {
    const withBlocks = addExtension(
      addExtension(girl(), { label: 'Early reading', days: ['Mon'], start: '08:30', end: '08:50' }),
      { label: 'Algebra practice', days: ['Mon', 'Wed'], start: '13:00', end: '13:30' },
    )
    const monday = blocksForProfileDay(withBlocks, 'Mon', DEFAULT_CORE_DAY, 'Library')
    expect(monday[0]).toMatchObject({ label: 'Early reading', kind: 'extension' })
    expect(monday.at(-1)).toMatchObject({ label: 'Algebra practice', kind: 'extension' })
    const tuesday = blocksForProfileDay(withBlocks, 'Tue', DEFAULT_CORE_DAY, 'Library')
    expect(tuesday.map((b) => b.label)).not.toContain('Algebra practice')
    expect(tuesday).toEqual(coreDayBlocks('Tue', DEFAULT_CORE_DAY, 'Library'))
  })
})
