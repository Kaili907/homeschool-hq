import { formatDateTime } from './presentation'
import type {
  RecoveryAuditEntryView,
  ScheduleRecoveryHandlers,
  StudentSummary,
} from './types'

interface RecoveryAuditHistoryProps {
  entries: RecoveryAuditEntryView[]
  students: StudentSummary[]
  handlers?: Partial<ScheduleRecoveryHandlers>
  onAnnounce?: (message: string) => void
}

const actionLabels: Record<RecoveryAuditEntryView['action'], string> = {
  approved: 'Approved',
  overridden: 'Parent override',
  'manually-placed': 'Manual placement',
  undone: 'Undone',
}

export function RecoveryAuditHistory({
  entries,
  students,
  handlers,
  onAnnounce,
}: RecoveryAuditHistoryProps) {
  const studentNames = new Map(students.map(({ id, name }) => [id, name]))

  return (
    <section className="sr-audit-panel" aria-labelledby="sr-audit-title">
      <div className="sr-section-heading">
        <div>
          <h2 id="sr-audit-title">Recovery history</h2>
          <p>Every approval, override, and undo stays explainable.</p>
        </div>
        <span className="sr-inline-status">{entries.length} records</span>
      </div>
      {entries.length === 0 ? (
        <div className="sr-empty-note">
          <strong>No decisions recorded yet</strong>
          <span>Approved changes will appear here with an undo action.</span>
        </div>
      ) : (
        <ol className="sr-audit-list">
          {entries.map((entry) => {
            const studentName = studentNames.get(entry.studentId) ?? 'Student'
            return (
              <li key={entry.id}>
                <span className={`sr-audit-dot sr-audit-${entry.action}`} />
                <article>
                  <header>
                    <div>
                      <span>{actionLabels[entry.action]}</span>
                      <strong>{studentName}</strong>
                    </div>
                    <time>{formatDateTime(entry.occurredAt)}</time>
                  </header>
                  <p>{entry.summary}</p>
                  {entry.reason ? <small>Reason: {entry.reason}</small> : null}
                  {entry.reversible ? (
                    <button
                      className="sr-button sr-button-undo"
                      type="button"
                      disabled={handlers?.onUndo === undefined}
                      onClick={() => {
                        handlers?.onUndo?.({
                          proposalId: entry.proposalId,
                          auditEntryId: entry.id,
                        })
                        onAnnounce?.(
                          `${studentName}'s prior schedule was restored.`,
                        )
                      }}
                    >
                      Undo this change
                    </button>
                  ) : (
                    <span className="sr-audit-final">Prior state retained in history</span>
                  )}
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

