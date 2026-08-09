import type { AutoKind, MissionDay } from '../../../types'
import {
  buildLegacyMissionData,
  type LegacyMissionDisplayItem,
} from './legacyMissionData'

export interface LegacyMissionPanelProps {
  day: MissionDay | undefined
  launchableKinds: readonly AutoKind[]
  onToggle: (itemId: string, done: boolean) => void
  onLaunch: (kind: AutoKind) => void
}

export function legacyMissionActionCopy(item: LegacyMissionDisplayItem): string {
  if (item.item.id === 'academy-lessons') {
    return item.item.done
      ? 'Complete · Separate mission checklist; Academy progress is unchanged'
      : 'Separate mission checklist; does not update Academy lesson progress'
  }
  if (item.item.done) return 'Complete'
  if (item.action === 'launch') return 'Completes in its learning activity'
  if (item.action === 'toggle') return 'Manual checklist item'
  return 'Auto-managed'
}

function MissionStatus({ item }: { item: LegacyMissionDisplayItem }) {
  return (
    <span className={`legacy-mission-item__status${item.item.done ? ' legacy-mission-item__status--complete' : ''}`}>
      <span aria-hidden="true">{item.item.done ? '✓' : item.item.auto ? '↻' : '○'}</span>
      {legacyMissionActionCopy(item)}
    </span>
  )
}

export function LegacyMissionPanel({
  day,
  launchableKinds,
  onToggle,
  onLaunch,
}: LegacyMissionPanelProps) {
  const data = buildLegacyMissionData(day, launchableKinds)

  return (
    <section className="legacy-mission-panel panel-glass" aria-labelledby="other-work-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Other work</p>
          <h2 id="other-work-heading">Today&apos;s Mission</h2>
        </div>
        <span className="section-heading__count">
          {data.completedCount} of {data.items.length} complete
        </span>
      </div>

      {!day ? (
        <p className="legacy-mission-panel__empty" role="status">
          Preparing today&apos;s mission…
        </p>
      ) : data.items.length === 0 ? (
        <p className="legacy-mission-panel__empty" role="status">
          There are no mission items scheduled today.
        </p>
      ) : (
        <ul className="legacy-mission-list">
          {data.items.map((displayItem) => {
            const { item } = displayItem
            const content = (
              <>
                <span
                  className={`legacy-mission-item__mark${item.done ? ' legacy-mission-item__mark--complete' : ''}`}
                  aria-hidden="true"
                >
                  {item.done ? '✓' : ''}
                </span>
                <span className="legacy-mission-item__copy">
                  <strong>{item.label}</strong>
                  <MissionStatus item={displayItem} />
                </span>
              </>
            )

            return (
              <li key={item.id} className={item.done ? 'legacy-mission-item legacy-mission-item--complete' : 'legacy-mission-item'}>
                {displayItem.action === 'toggle' ? (
                  <button
                    type="button"
                    onClick={() => onToggle(item.id, !item.done)}
                    aria-label={`${item.done ? 'Mark incomplete' : 'Mark complete'}: ${item.label}${
                      item.id === 'academy-lessons'
                        ? `. ${legacyMissionActionCopy(displayItem)}`
                        : ''
                    }`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="legacy-mission-item__row">
                    {content}
                    {displayItem.action === 'launch' && displayItem.autoKind && !item.done && (
                      <button
                        type="button"
                        className="legacy-mission-item__launch"
                        onClick={() => onLaunch(displayItem.autoKind!)}
                        aria-label={`Start activity: ${item.label}`}
                      >
                        Start<span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {data.allComplete && (
        <p className="legacy-mission-panel__complete" role="status">
          Today&apos;s Mission is complete.
        </p>
      )}
    </section>
  )
}
