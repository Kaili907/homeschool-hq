import { describe, expect, it } from 'vitest'
import type { AutoKind, MissionDay, MissionItem } from '../../../types'
import {
  buildLegacyMissionData,
  resolveLegacyMissionAutoKind,
} from './legacyMissionData'

function day(...items: MissionItem[]): MissionDay {
  return { items }
}

describe('legacy mission dashboard presentation data', () => {
  it('keeps manual mission authority by reference and exposes its toggle action', () => {
    const manual: MissionItem = { id: 'writing', label: 'Writing', done: false }
    const data = buildLegacyMissionData(day(manual))

    expect(data.items[0]).toMatchObject({
      autoKind: null,
      action: 'toggle',
      upNextEligible: true,
    })
    expect(data.items[0].item).toBe(manual)
    expect(data.upNext).toBe(data.items[0])
    expect(data).toMatchObject({ completedCount: 0, allComplete: false })
  })

  it('keeps completed manual work toggleable but excludes all completed work from Up Next', () => {
    const completedManual: MissionItem = { id: 'planner', label: 'Plan tomorrow', done: true }
    const completedAuto: MissionItem = {
      id: 'typing',
      label: 'Typing',
      done: true,
      auto: true,
      autoKind: 'typing',
    }
    const data = buildLegacyMissionData(day(completedManual, completedAuto), ['typing'])

    expect(data.items[0]).toMatchObject({ action: 'toggle', upNextEligible: false })
    expect(data.items[1]).toMatchObject({ action: 'launch', upNextEligible: false })
    expect(data.upNext).toBeNull()
    expect(data).toMatchObject({ completedCount: 2, allComplete: true })
  })

  it('resolves a bare auto item to the legacy math capability', () => {
    const math: MissionItem = {
      id: 'math-practice',
      label: 'Math practice',
      done: false,
      auto: true,
    }

    expect(resolveLegacyMissionAutoKind(math)).toBe('math')
    expect(buildLegacyMissionData(day(math), new Set<AutoKind>(['math'])).items[0]).toMatchObject({
      autoKind: 'math',
      action: 'launch',
      upNextEligible: true,
    })
  })

  it.each<AutoKind>(['typing', 'reading', 'mindset'])(
    'makes an incomplete %s auto item launchable only through its matching capability',
    (kind) => {
      const item: MissionItem = {
        id: `${kind}-item`,
        label: `${kind} work`,
        done: false,
        auto: true,
        autoKind: kind,
      }

      const available = buildLegacyMissionData(day(item), new Set<AutoKind>([kind]))
      expect(available.items[0]).toMatchObject({
        autoKind: kind,
        action: 'launch',
        upNextEligible: true,
      })

      const unavailable = buildLegacyMissionData(day(item), [])
      expect(unavailable.items[0]).toMatchObject({
        autoKind: kind,
        action: 'none',
        upNextEligible: false,
      })
      expect(unavailable.upNext).toBeNull()
    },
  )

  it('keeps unavailable auto-managed work visible without inventing an action', () => {
    const typing: MissionItem = {
      id: 'typing',
      label: 'Typing',
      done: false,
      auto: true,
      autoKind: 'typing',
    }
    const data = buildLegacyMissionData(day(typing), ['reading'])

    expect(data.items).toHaveLength(1)
    expect(data.items[0].item).toBe(typing)
    expect(data.items[0]).toMatchObject({
      autoKind: 'typing',
      action: 'none',
      upNextEligible: false,
    })
    expect(data).toMatchObject({ completedCount: 0, allComplete: false, upNext: null })
  })

  it('chooses the first incomplete actionable mission in source order', () => {
    const data = buildLegacyMissionData(
      day(
        { id: 'done', label: 'Already done', done: true },
        { id: 'blocked-auto', label: 'Unavailable auto work', done: false, auto: true, autoKind: 'reading' },
        { id: 'first-manual', label: 'First manual work', done: false },
        { id: 'launchable', label: 'Typing', done: false, auto: true, autoKind: 'typing' },
      ),
      ['typing'],
    )

    expect(data.items.map((displayItem) => displayItem.item.id)).toEqual([
      'done',
      'blocked-auto',
      'first-manual',
      'launchable',
    ])
    expect(data.upNext?.item.id).toBe('first-manual')
    expect(data).toMatchObject({ completedCount: 1, allComplete: false })
  })

  it('reports an absent or empty mission day as incomplete with zero work', () => {
    expect(buildLegacyMissionData(undefined)).toMatchObject({
      items: [],
      completedCount: 0,
      allComplete: false,
      upNext: null,
    })
    expect(buildLegacyMissionData(day())).toMatchObject({
      completedCount: 0,
      allComplete: false,
      upNext: null,
    })
  })
})
