import type { StudyParentControlPorts } from './ports'
import type {
  StudyAdultAuthorization,
  StudyLearnerScope,
  StudyParentCommand,
  StudyParentControlResult,
} from './types'
import { placementForInstant } from './calendarAdapter'

export class StudyParentController {
  readonly #now: () => Date

  constructor(
    private readonly ports: StudyParentControlPorts,
    options: { readonly now?: () => Date } = {},
  ) {
    this.#now = options.now ?? (() => new Date())
  }

  async execute(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    command: StudyParentCommand,
  ): Promise<StudyParentControlResult> {
    if (!authorization.adultAuthorized || authorization.householdRef !== scope.householdRef) {
      throw new Error('Verified adult authorization is required.')
    }
    if (command.type === 'add-adult-private-note') {
      const result = await this.ports.adultPrivate.commit(scope, authorization, {
        noteRef: command.noteRef,
        category: command.category,
        body: command.body,
      })
      return { status: result.status, revision: (await this.ports.parentSettings.read(scope)).revision }
    }

    const settings = await this.ports.parentSettings.read(scope)
    if (command.type === 'accept-recommendation' || command.type === 'reject-recommendation') {
      const reviews = await this.ports.reviewQueue.list(scope)
      if (!reviews.some((review) => review.recommendationRef === command.recommendationRef)) {
        throw new Error('Unknown learner-scoped recommendation.')
      }
    }
    if (command.type === 'reschedule-incomplete-work') {
      const block = (await this.ports.calendar.list(scope)).find((entry) => entry.blockRef === command.blockRef)
      if (!block || block.state !== 'paused' || block.requiredWorkCompletionPercent <= 0 || block.requiredWorkCompletionPercent >= 100) {
        throw new Error('Only partially completed paused work can be continued.')
      }
      const placement = placementForInstant(new Date(command.replacementStart), block.householdTimeZone)
      const suffix = command.replacementStart.replace(/[^0-9]/g, '').slice(0, 12)
      const continuationAt = new Date(
        Math.max(this.#now().getTime(), Date.parse(block.resumePoint?.capturedAt ?? '') + 1),
      ).toISOString()
      await this.ports.calendar.createContinuation(
        scope,
        block.blockRef,
        `${block.blockRef}:continuation:${suffix}`,
        `parent:${suffix}`,
        placement.scheduledLocalStart,
        placement.scheduledStart,
        placement.intendedLocalDate,
        continuationAt,
      )
    }
    const result = await this.ports.parentSettings.apply(scope, authorization, command, settings.revision)

    if (command.type === 'accept-recommendation' || command.type === 'reject-recommendation') {
      await this.ports.reviewQueue.decide(
        scope,
        command.recommendationRef,
        command.type === 'accept-recommendation' ? 'accepted' : 'rejected',
      )
    }
    if (command.type === 'mark-interruption') {
      const block = (await this.ports.calendar.list(scope)).find((entry) => entry.blockRef === command.blockRef)
      if (block?.state === 'active') {
        await this.ports.calendar.pause(
          scope,
          command.blockRef,
          command.occurredAt,
          command.kind === 'outside' ? 'outside_interruption' : 'technical_interruption',
        )
      }
    }
    if (command.type === 'request-adult-review') {
      await this.ports.outbox.propose(scope, {
        proposalRef: command.requestRef,
        route: 'adult-review',
        evidenceRefs: command.evidenceRefs,
        status: 'proposed-not-delivered',
      })
    }
    return result
  }
}
