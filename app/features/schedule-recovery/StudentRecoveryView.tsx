import {
  activityCategoryLabels,
  formatDate,
  formatMinutes,
  formatTime,
  recoveryChoiceMetadata,
} from './presentation'
import type {
  CalendarItemView,
  RecoveryProposalView,
  StudentSummary,
} from './types'

interface StudentRecoveryViewProps {
  student: StudentSummary
  proposal?: RecoveryProposalView
  calendarItems: CalendarItemView[]
}

export function StudentRecoveryView({
  student,
  proposal,
  calendarItems,
}: StudentRecoveryViewProps) {
  const groupedItems = groupCalendarItems(calendarItems)

  if (!proposal) {
    return (
      <section className="sr-student-empty">
        <span className={`sr-student-avatar sr-accent-${student.accent}`}>
          {student.initials}
        </span>
        <h2>{student.name}, your schedule is all set</h2>
        <p>There are no recovery changes to explain right now.</p>
      </section>
    )
  }

  const explanation = proposal.studentExplanation
  const decision =
    proposal.decidedChoice === undefined
      ? 'Waiting for parent review'
      : recoveryChoiceMetadata(proposal.decidedChoice).label

  return (
    <section className="sr-student-view">
      <header className="sr-student-hero">
        <span className={`sr-student-avatar sr-accent-${student.accent}`}>
          {student.initials}
        </span>
        <div>
          <p className="sr-eyebrow">
            {student.name} · {student.gradeLabel}
          </p>
          <h2>{explanation.headline}</h2>
          <span className="sr-student-decision">{decision}</span>
        </div>
      </header>

      <div className="sr-student-explanation">
        <ExplanationCard index="1" title="What changed">
          {explanation.changed}
        </ExplanationCard>
        <ExplanationCard index="2" title="Why">
          {explanation.why}
        </ExplanationCard>
        <ExplanationCard index="3" title="The tradeoff">
          {explanation.tradeoff}
        </ExplanationCard>
      </div>

      <div className="sr-support-note" role="note">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>You are not in trouble.</strong>
          <p>{explanation.reassurance}</p>
        </div>
      </div>

      <section className="sr-student-schedule" aria-labelledby="sr-updated-schedule">
        <div className="sr-section-heading">
          <div>
            <h3 id="sr-updated-schedule">Your updated schedule</h3>
            <p>Changed items are labeled. Locked activities stay protected.</p>
          </div>
        </div>
        <div className="sr-day-grid">
          {groupedItems.map(([date, items]) => (
            <article className="sr-day-card" key={date}>
              <header>
                <span>{formatDate(date, { weekday: 'long' })}</span>
                <small>
                  {formatMinutes(
                    items
                      .filter(({ category }) => category !== 'meal')
                      .reduce((total, item) => total + item.durationMinutes, 0),
                  )}{' '}
                  shown
                </small>
              </header>
              <ol>
                {items.map((item) => (
                  <li
                    className={`sr-schedule-item sr-schedule-${item.state}`}
                    key={item.id}
                  >
                    <time>{formatTime(item.startTime)}</time>
                    <span className="sr-schedule-marker" aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {activityCategoryLabels[item.category]} ·{' '}
                        {formatMinutes(item.durationMinutes)}
                      </span>
                      <small>
                        {item.isFixedOrLocked
                          ? 'Protected · does not move'
                          : item.state === 'unchanged'
                            ? 'Unchanged'
                            : `Plan ${item.state}`}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function ExplanationCard({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: string
}) {
  return (
    <article>
      <span className="sr-explanation-number" aria-hidden="true">
        {index}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  )
}

function groupCalendarItems(
  items: CalendarItemView[],
): [string, CalendarItemView[]][] {
  const grouped = new Map<string, CalendarItemView[]>()
  const sorted = [...items].sort((a, b) =>
    `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
  )
  for (const item of sorted) {
    const existing = grouped.get(item.date)
    if (existing) existing.push(item)
    else grouped.set(item.date, [item])
  }
  return [...grouped.entries()]
}

