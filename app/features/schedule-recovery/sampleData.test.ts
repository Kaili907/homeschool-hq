import { describe, expect, it } from 'vitest'
import { RECOVERY_CHOICES } from './presentation'
import {
  applyDemoRecoveryAction,
  createDemoScheduleRecoveryModel,
} from './sampleData'

describe('schedule recovery browser model', () => {
  it('offers every required recovery choice for every sample proposal', () => {
    const model = createDemoScheduleRecoveryModel()
    const requiredChoices = RECOVERY_CHOICES.map(({ id }) => id)

    for (const proposal of model.proposals) {
      expect(proposal.options.map(({ choice }) => choice)).toEqual(requiredChoices)
    }
  })

  it('never presents an overloaded day as an approvable sample proposal', () => {
    const model = createDemoScheduleRecoveryModel()

    for (const proposal of model.proposals) {
      for (const day of proposal.workloadPreview) {
        expect(day.proposedMinutes).toBeLessThanOrEqual(day.limitMinutes)
      }
    }
  })

  it('does not move a fixed or parent-locked change', () => {
    const model = createDemoScheduleRecoveryModel()

    for (const proposal of model.proposals) {
      expect(
        proposal.changes.some(
          ({ isFixedOrLocked, kind }) => isFixedOrLocked && kind !== 'unchanged',
        ),
      ).toBe(false)
    }
  })

  it('records an approval and undo restores the proposal to a reviewable state', () => {
    const original = createDemoScheduleRecoveryModel()
    const proposal = original.proposals[0]
    expect(proposal).toBeDefined()
    if (!proposal) return

    const approved = applyDemoRecoveryAction(original, {
      type: 'approve',
      input: {
        proposalId: proposal.id,
        choice: proposal.recommendedChoice,
      },
    })
    const auditEntry = approved.auditHistory[0]
    expect(approved.proposals[0]?.status).toBe('approved')
    expect(auditEntry?.reversible).toBe(true)
    if (!auditEntry) return

    const undone = applyDemoRecoveryAction(approved, {
      type: 'undo',
      input: {
        proposalId: proposal.id,
        auditEntryId: auditEntry.id,
      },
    })
    expect(undone.proposals[0]?.status).toBe('undone')
    expect(undone.proposals[0]?.decidedChoice).toBeUndefined()
    expect(undone.auditHistory[0]?.action).toBe('undone')
    expect(
      undone.auditHistory.find(({ id }) => id === auditEntry.id)?.reversible,
    ).toBe(false)
  })

  it('captures a reason and placement for a parent manual decision', () => {
    const original = createDemoScheduleRecoveryModel()
    const proposal = original.proposals[1]
    expect(proposal).toBeDefined()
    if (!proposal) return

    const next = applyDemoRecoveryAction(original, {
      type: 'manual',
      input: {
        proposalId: proposal.id,
        date: '2026-07-30',
        startTime: '13:10',
        durationMinutes: 35,
        reason: 'This time has parent-supervised catch-up capacity.',
      },
    })
    const updated = next.proposals.find(({ id }) => id === proposal.id)

    expect(updated?.status).toBe('overridden')
    expect(updated?.decidedChoice).toBe('parent-manual')
    expect(updated?.changes[0]?.after[0]).toMatchObject({
      date: '2026-07-30',
      startTime: '13:10',
      durationMinutes: 35,
    })
    expect(next.auditHistory[0]?.reason).toContain('parent-supervised')
  })
})
