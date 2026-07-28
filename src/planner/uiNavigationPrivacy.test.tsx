import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultSchoolYear } from '../curriculum/pacing'
import { parsePlanDoc } from '../curriculum/parser'
import { emptyProfile } from '../migration'
import { HighSchoolHome } from '../components/HighSchoolHome'
import {
  createManualPlannerBlock,
  PLANNER_VERSION,
} from './defaults'
import {
  curriculumPlanForDay,
} from './adapters/curriculumAdapter'
import { DailyTimeline } from './components/DailyTimeline'
import { PlannerBlockEditor } from './components/PlannerBlockEditor'
import { StudentMyDay } from './components/StudentMyDay'
import {
  highSchoolCourseIdForSubject,
  resolvePlannerNavigation,
} from './resume'
import { toStudentDailyPlan } from './selectors'
import { millisecondsUntilNextLocalDate } from './useLocalDate'
import type {
  DailyPlan,
  DailyPlanBlock,
  PlannerBlock,
  PlannerCurriculumItemRef,
  PlannerNavigationResolution,
} from './types'

const DATE = '2026-08-31'
const NOW = '2026-08-31T14:00:00.000Z'

const manualBlock = (): PlannerBlock =>
  createManualPlannerBlock(
    {
      title: 'Private-note test',
      studentInstructions: 'Student-visible instructions',
      parentNotes: 'PARENT PRIVATE SECRET',
      category: 'custom',
      assignedProfileIds: ['p1'],
      weekdays: [1],
      startTime: '09:00',
      expectedMinutes: 30,
      scheduleBehavior: 'flexible',
    },
    NOW,
    'manual:test',
  )

const curriculumBlock = (
  subjectId: string,
  subjectLabel: string,
  items: PlannerCurriculumItemRef[] = [
    { id: 'item-1', text: 'Open the work', dadTaught: false },
  ],
): PlannerBlock => ({
  id: `curriculum:${subjectId}:week-1`,
  title: `Manuel Academy · ${subjectLabel}`,
  studentInstructions: 'Read the assigned curriculum instructions.',
  category: 'manuel-academy',
  source: {
    kind: 'curriculum',
    subjectId,
    subjectLabel,
    week: 1,
    items,
  },
  assignedProfileIds: ['p1'],
  assignToAll: false,
  weekdays: [1],
  startTime: '10:00',
  expectedMinutes: 30,
  scheduleBehavior: 'flexible',
  linkedActivity: {
    adapter: 'curriculum',
    activityId: subjectId,
    safeEntryData: { profileId: 'p1', subjectId },
  },
  requiresParentHelp: false,
  active: true,
  createdAt: `${DATE}T00:00:00.000`,
  updatedAt: `${DATE}T00:00:00.000`,
})

const rowFor = (
  block: PlannerBlock,
  over: Partial<DailyPlanBlock> = {},
): DailyPlanBlock => ({
  profileId: 'p1',
  date: DATE,
  instanceId: `planner:p1:${DATE}:${encodeURIComponent(block.id)}`,
  block,
  scheduledStartTime: block.startTime,
  preferredStartMinute: 9 * 60,
  placement: {
    kind: 'scheduled',
    startMinute: 9 * 60,
    endMinute: 9 * 60 + block.expectedMinutes,
    startTime: '09:00',
  },
  effectiveStartTime: '09:00',
  progress: {
    profileId: 'p1',
    date: DATE,
    blockInstanceId: `planner:p1:${DATE}:${encodeURIComponent(block.id)}`,
    blockId: block.id,
    status: 'not-started',
    activeElapsedSeconds: 0,
    updatedAt: NOW,
  },
  canManuallyComplete: true,
  canSetDisposition: true,
  canStart: true,
  generated: block.source.kind === 'curriculum',
  ...over,
})

const planFor = (row: DailyPlanBlock): DailyPlan => ({
  profileId: row.profileId,
  date: row.date,
  blocks: [row],
  notices: [],
  compatibility: { kind: 'supported', version: PLANNER_VERSION },
  summary: {
    plannedMinutes: row.block.expectedMinutes,
    plannedMinutesRemaining: row.block.expectedMinutes,
    activeMinutes: 0,
    completedCount: 0,
    remainingCount: 1,
    eligibleCount: 1,
    completionPercentage: 0,
  },
})

describe('planner privacy and ordinary manual editing', () => {
  it('structurally removes parent notes before rendering Student My Day', () => {
    const fullPlan = planFor(
      rowFor(manualBlock(), {
        navigation: {
          destination: { kind: 'manual-activity' },
          source: 'safe-fallback',
          granularity: 'activity',
        },
      }),
    )
    const studentPlan = toStudentDailyPlan(fullPlan)
    expect('parentNotes' in studentPlan.blocks[0].block).toBe(false)
    expect(JSON.stringify(studentPlan)).not.toContain('PARENT PRIVATE SECRET')

    const studentMarkup = renderToStaticMarkup(
      <StudentMyDay plan={studentPlan} onAction={() => undefined} />,
    )
    expect(studentMarkup).toContain('Student-visible instructions')
    expect(studentMarkup).not.toContain('PARENT PRIVATE SECRET')

    const parentMarkup = renderToStaticMarkup(
      <DailyTimeline plan={fullPlan} parentControls />,
    )
    expect(parentMarkup).toContain('Parent note:')
    expect(parentMarkup).toContain('PARENT PRIVATE SECRET')
  })

  it('deeply allowlists student source, placement, and progress data', () => {
    const base = manualBlock()
    const block = {
      ...base,
      source: {
        kind: 'manual',
        parentNotes: 'NESTED SOURCE SECRET',
      },
      linkedActivity: {
        adapter: 'route',
        activityId: 'manual',
        safeEntryData: { parentNotes: 'LINK SECRET' },
      },
    } as unknown as PlannerBlock
    const row = rowFor(block, {
      placement: {
        kind: 'scheduled',
        startMinute: 540,
        endMinute: 570,
        startTime: '09:00',
        parentNotes: 'PLACEMENT SECRET',
      } as unknown as DailyPlanBlock['placement'],
      progress: {
        ...rowFor(block).progress,
        resumePointer: {
          adapter: 'route',
          blockId: block.id,
          adapterData: { parentNotes: 'POINTER SECRET' },
          updatedAt: NOW,
        },
      },
      navigation: {
        destination: { kind: 'manual-activity' },
        source: 'safe-fallback',
        granularity: 'activity',
      },
    })

    const projected = toStudentDailyPlan(planFor(row))
    const serialized = JSON.stringify(projected)
    expect(projected.blocks[0].block.source).toEqual({ kind: 'manual' })
    expect('linkedActivity' in projected.blocks[0].block).toBe(false)
    expect('resumePointer' in projected.blocks[0].progress).toBe(false)
    expect(serialized).not.toContain('SECRET')
  })

  it('offers only ordinary manual categories and clearly labels both note audiences', () => {
    const profile = emptyProfile('p1', 'Student', '6')
    const markup = renderToStaticMarkup(
      <PlannerBlockEditor
        profiles={[profile]}
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(markup).toContain('Student instructions')
    expect(markup).toContain('Parent-private notes')
    expect(markup).toContain('value="wrestling"')
    expect(markup).toContain('value="romeo-online"')
    expect(markup).not.toContain('value="manuel-academy"')
    expect(markup).not.toContain('value="existing-mission"')
  })

  it('does not render a working-looking Start action for unavailable curriculum', () => {
    const block = curriculumBlock('unknown-subject', 'Unknown Subject', [])
    const unavailableNavigation: PlannerNavigationResolution = {
      destination: {
        kind: 'unavailable',
        code: 'no-safe-entry',
        message: 'No dependable destination.',
      },
      source: 'safe-fallback',
      granularity: 'none',
    }
    const plan = toStudentDailyPlan(
      planFor(
        rowFor(block, {
          canStart: false,
          canManuallyComplete: false,
          navigation: unavailableNavigation,
          unavailableReason: 'No dependable destination.',
        }),
      ),
    )
    const markup = renderToStaticMarkup(
      <StudentMyDay plan={plan} onAction={() => undefined} />,
    )
    expect(markup).toContain('Open unavailable')
    expect(markup).not.toContain('Start and open')
  })

  it('does not call an unavailable-only plan finished for the day', () => {
    const block = curriculumBlock('unknown-subject', 'Unknown Subject', [])
    const unavailable = planFor(
      rowFor(block, {
        canStart: false,
        canManuallyComplete: false,
        placement: {
          kind: 'unavailable',
          reason: 'missing-source',
          message: 'No dependable destination.',
        },
        unavailableReason: 'No dependable destination.',
      }),
    )
    unavailable.summary = {
      plannedMinutes: 0,
      plannedMinutesRemaining: 0,
      activeMinutes: 0,
      completedCount: 0,
      remainingCount: 0,
      eligibleCount: 0,
      completionPercentage: 100,
    }
    const markup = renderToStaticMarkup(
      <StudentMyDay
        plan={toStudentDailyPlan(unavailable)}
        onAction={() => undefined}
      />,
    )
    expect(markup).not.toContain('Finished for the day')
    expect(markup).toContain('No remaining activity can be opened right now')
  })

  it('labels overflow explicitly and disables a pending row command', () => {
    const block = manualBlock()
    const fullPlan = planFor(
      rowFor(block, {
        placement: {
          kind: 'overflow',
          order: 2,
          earliestStartMinute: 1515,
          durationMinutes: 30,
          reason: 'past-day-boundary',
        },
        effectiveStartTime: undefined,
        navigation: {
          destination: { kind: 'manual-activity' },
          source: 'safe-fallback',
          granularity: 'activity',
        },
      }),
    )
    const markup = renderToStaticMarkup(
      <DailyTimeline
        plan={fullPlan}
        parentControls
        pendingInstanceId={fullPlan.blocks[0].instanceId}
        onAction={() => undefined}
      />,
    )
    expect(markup).toContain('Overflow')
    expect(markup).toContain('unscheduled')
    expect(markup).toContain('day +1 at 01:15')
    expect(markup).toContain('disabled=""')
  })

  it('shows only the explicit reopen command for a terminal manual row', () => {
    const block = manualBlock()
    const completed = rowFor(block, {
      progress: {
        ...rowFor(block).progress,
        status: 'completed',
        completedAt: NOW,
        terminalAt: NOW,
      },
      navigation: {
        destination: { kind: 'manual-activity' },
        source: 'safe-fallback',
        granularity: 'activity',
      },
    })
    const markup = renderToStaticMarkup(
      <DailyTimeline
        plan={planFor(completed)}
        parentControls
        onAction={() => undefined}
      />,
    )
    expect(markup).toContain('Reopen activity')
    expect(markup).not.toContain('>Excuse</button>')
    expect(markup).not.toContain('>Move</button>')
    expect(markup).not.toContain('>Complete</button>')
  })

  it('keeps orphaned historical rows visible without unusable edit or reopen controls', () => {
    const block = manualBlock()
    const historical = rowFor(block, {
      progress: {
        ...rowFor(block).progress,
        status: 'completed',
        completedAt: NOW,
        terminalAt: NOW,
      },
      canStart: false,
      canSetDisposition: false,
      unavailableReason: 'The original schedule source is no longer active.',
    })
    const markup = renderToStaticMarkup(
      <DailyTimeline
        plan={planFor(historical)}
        parentControls
        onAction={() => undefined}
        onEdit={() => undefined}
      />,
    )
    expect(markup).toContain('Private-note test')
    expect(markup).not.toContain('Reopen activity')
    expect(markup).not.toContain('Edit schedule')
  })
})

describe('local planner date rollover', () => {
  it('schedules refresh just after the next local midnight', () => {
    const now = new Date(2026, 6, 28, 23, 59, 59, 900)
    expect(millisecondsUntilNextLocalDate(now)).toBe(125)
  })
})

describe('adapter-owned planner navigation', () => {
  it('uses a valid stored pointer before linked metadata', () => {
    const profile = emptyProfile('p1', 'Student', '6')
    const block = curriculumBlock('mindset', "Competitor's Mind")
    const row = rowFor(block, {
      progress: {
        ...rowFor(block).progress,
        status: 'paused',
        resumePointer: {
          adapter: 'curriculum',
          blockId: block.id,
          route: 'mindset',
          activityId: 'mindset',
          adapterData: { profileId: 'p1', subjectId: 'mindset' },
          updatedAt: NOW,
        },
      },
    })
    expect(resolvePlannerNavigation(row, profile)).toMatchObject({
      destination: { kind: 'mindset' },
      source: 'resume-pointer',
    })
  })

  it('rejects mismatched pointer data and falls back to linked activity', () => {
    const profile = emptyProfile('p1', 'Student', '6')
    const block = curriculumBlock('mindset', "Competitor's Mind")
    const row = rowFor(block, {
      progress: {
        ...rowFor(block).progress,
        status: 'paused',
        resumePointer: {
          adapter: 'curriculum',
          blockId: 'another-block',
          route: 'reading',
          activityId: 'reading',
          adapterData: { profileId: 'p2', subjectId: 'reading' },
          updatedAt: NOW,
        },
      },
    })
    expect(resolvePlannerNavigation(row, profile)).toMatchObject({
      destination: { kind: 'mindset' },
      source: 'linked-activity',
    })
  })

  it.each([
    ['math', 'Math', '3', 'math-practice'],
    ['reading', 'Reading', '6', 'reading'],
    ['mindset', "Competitor's Mind", '10', 'mindset'],
  ] as const)(
    'resolves %s to its dependable destination',
    (subjectId, label, grade, expected) => {
      const profile = emptyProfile('p1', 'Student', grade)
      const block = curriculumBlock(subjectId, label)
      const resolution = resolvePlannerNavigation(rowFor(block), profile)
      expect(resolution.destination.kind).toBe(expected)
    },
  )

  it('resolves typing mission work to the typing activity', () => {
    const profile = emptyProfile('p1', 'Student', '4')
    const manual = manualBlock()
    const block: PlannerBlock = {
      ...manual,
      id: 'mission:typing',
      title: 'Typing',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: 'typing',
        autoOnly: true,
        autoKind: 'typing',
      },
      linkedActivity: {
        adapter: 'mission',
        activityId: 'typing',
      },
    }
    expect(resolvePlannerNavigation(rowFor(block), profile).destination.kind).toBe(
      'typing',
    )
  })

  it('opens a matching high-school course and otherwise uses curriculum instructions', () => {
    const profile = emptyProfile('p1', 'Teen', '10')
    expect(highSchoolCourseIdForSubject(profile, 'english', 'English')).toBe(
      'english10',
    )
    expect(
      resolvePlannerNavigation(
        rowFor(curriculumBlock('english', 'English')),
        profile,
      ).destination,
    ).toEqual({ kind: 'high-school-course', courseId: 'english10' })
    expect(
      resolvePlannerNavigation(
        rowFor(curriculumBlock('personal-finance', 'Personal Finance')),
        profile,
      ).destination,
    ).toEqual({
      kind: 'curriculum-instructions',
      instanceId: rowFor(
        curriculumBlock('personal-finance', 'Personal Finance'),
      ).instanceId,
    })
  })

  it('rejects cross-profile navigation and exposes no source-less fallback', () => {
    const profile = emptyProfile('p2', 'Sibling', '6')
    const mismatch = resolvePlannerNavigation(
      rowFor(curriculumBlock('mindset', "Competitor's Mind")),
      profile,
    )
    expect(mismatch.destination).toMatchObject({
      kind: 'unavailable',
      code: 'profile-mismatch',
    })

    const ownProfile = emptyProfile('p1', 'Student', '6')
    const unsupported = resolvePlannerNavigation(
      rowFor(curriculumBlock('unsupported', 'Unsupported', [])),
      ownProfile,
    )
    expect(unsupported.destination).toMatchObject({
      kind: 'unavailable',
      code: 'no-safe-entry',
    })
  })

  it('does not let a forged manual resume pointer choose an app route', () => {
    const profile = emptyProfile('p1', 'Student', '6')
    const block = manualBlock()
    const forged = rowFor(block, {
      progress: {
        ...rowFor(block).progress,
        status: 'paused',
        resumePointer: {
          adapter: 'route',
          blockId: block.id,
          route: 'reading',
          activityId: 'reading',
          adapterData: { profileId: 'p1' },
          updatedAt: NOW,
        },
      },
    })
    expect(resolvePlannerNavigation(forged, profile)).toMatchObject({
      destination: { kind: 'manual-activity' },
      source: 'safe-fallback',
    })
  })

  it('opens the controlled high-school course details', () => {
    const profile = emptyProfile('p1', 'Teen', '10')
    const markup = renderToStaticMarkup(
      <HighSchoolHome
        profile={profile}
        onProfileChange={() => undefined}
        onSignOut={() => undefined}
        onToggleItem={() => undefined}
        muted
        assessmentCards={[]}
        onOpenAssessment={() => undefined}
        onOpenMindset={() => undefined}
        mindsetStartDate={DATE}
        openCourseId="english10"
      />,
    )
    expect(markup).toContain('id="hs-course-units-english10"')
    expect(markup).toContain('aria-expanded="true"')
  })
})

describe('curriculum availability notices', () => {
  const schoolYear = defaultSchoolYear(DATE)

  it('distinguishes missing placement from a missing plan', () => {
    const unplaced = emptyProfile('p1', 'Student', '6')
    const placement = curriculumPlanForDay(unplaced, [], schoolYear, DATE)
    expect(placement.notices.some((notice) => notice.reason === 'missing-placement')).toBe(
      true,
    )

    const placed = { ...unplaced, placementDone: true }
    const missingPlan = curriculumPlanForDay(placed, [], schoolYear, DATE)
    expect(missingPlan.notices.some((notice) => notice.reason === 'missing-plan')).toBe(
      true,
    )
  })

  it('does not mislabel a defined no-item weekday as unavailable', () => {
    const profile = {
      ...emptyProfile('p1', 'Student', '6'),
      placementDone: true,
    }
    const docs = [
      parsePlanDoc(`---
subject: Competitor's Mind
subjectId: mindset
grades: all
---
## Week 1
- (Tue) Tuesday-only reflection
`),
    ]
    const result = curriculumPlanForDay(profile, docs, schoolYear, DATE)
    expect(result.blocks.some((block) => block.source.kind === 'curriculum')).toBe(
      false,
    )
    expect(
      result.notices.some((notice) => notice.id.includes(':mindset:')),
    ).toBe(false)
  })

  it('reports a missing source week and suppresses notices during travel weeks', () => {
    const profile = {
      ...emptyProfile('p1', 'Student', '6'),
      placementDone: true,
    }
    const docs = [
      parsePlanDoc(`---
subject: Competitor's Mind
subjectId: mindset
grades: all
---
## Week 2
- Reflection
`),
    ]
    const normal = curriculumPlanForDay(profile, docs, schoolYear, DATE)
    expect(
      normal.notices.some(
        (notice) =>
          notice.reason === 'missing-source' &&
          notice.id.includes(':mindset:'),
      ),
    ).toBe(true)

    const travel = curriculumPlanForDay(
      profile,
      docs,
      { ...schoolYear, offWeeks: [DATE] },
      DATE,
    )
    expect(travel).toEqual({ blocks: [], notices: [] })
  })
})
