import { useEffect, useMemo, useState } from 'react'
import './schedule-recovery.css'
import { ProposalReview } from './ProposalReview'
import { RecoveryAuditHistory } from './RecoveryAuditHistory'
import { RecoverySummary } from './RecoveryIndicators'
import { StudentRecoveryView } from './StudentRecoveryView'
import { formatDateTime, triggerLabels } from './presentation'
import type {
  RecoveryProposalView,
  ScheduleRecoveryHandlers,
  ScheduleRecoveryViewModel,
  StudentId,
} from './types'

export interface ScheduleRecoveryWorkspaceProps {
  model: ScheduleRecoveryViewModel
  handlers?: Partial<ScheduleRecoveryHandlers>
  initialAudience?: 'parent' | 'student'
  className?: string
}

export function ScheduleRecoveryWorkspace({
  model,
  handlers,
  initialAudience = 'parent',
  className = '',
}: ScheduleRecoveryWorkspaceProps) {
  const [audience, setAudience] = useState<'parent' | 'student'>(initialAudience)
  const [studentId, setStudentId] = useState<StudentId>(
    model.students[0]?.id ?? '',
  )
  const [proposalId, setProposalId] = useState(
    model.proposals.find(({ studentId: id }) => id === studentId)?.id ??
      model.proposals[0]?.id ??
      '',
  )
  const [announcement, setAnnouncement] = useState('')

  const student = model.students.find(({ id }) => id === studentId)
  const studentProposals = useMemo(
    () => model.proposals.filter((proposal) => proposal.studentId === studentId),
    [model.proposals, studentId],
  )
  const selectedProposal =
    studentProposals.find(({ id }) => id === proposalId) ?? studentProposals[0]

  useEffect(() => {
    if (!model.students.some(({ id }) => id === studentId)) {
      setStudentId(model.students[0]?.id ?? '')
    }
  }, [model.students, studentId])

  useEffect(() => {
    if (!studentProposals.some(({ id }) => id === proposalId)) {
      setProposalId(studentProposals[0]?.id ?? '')
    }
  }, [proposalId, studentProposals])

  const selectStudent = (nextStudentId: StudentId) => {
    setStudentId(nextStudentId)
    const firstProposal = model.proposals.find(
      ({ studentId: id }) => id === nextStudentId,
    )
    setProposalId(firstProposal?.id ?? '')
  }

  return (
    <div className={`sr-recovery ${className}`.trim()}>
      <a className="sr-skip-link" href="#sr-main-content">
        Skip to recovery details
      </a>
      <header className="sr-app-header">
        <div className="sr-brand">
          <span className="sr-brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p>Manuel Academy</p>
            <h1>Schedule recovery</h1>
          </div>
        </div>
        <div className="sr-audience-switcher" aria-label="Choose schedule view">
          <button
            type="button"
            aria-pressed={audience === 'parent'}
            onClick={() => setAudience('parent')}
          >
            Parent review
          </button>
          <button
            type="button"
            aria-pressed={audience === 'student'}
            onClick={() => setAudience('student')}
          >
            Student view
          </button>
        </div>
        <div className="sr-snapshot-meta">
          <span>Household time zone</span>
          <strong>{model.timeZone}</strong>
          <small>Updated {formatDateTime(model.generatedAt)}</small>
        </div>
      </header>

      <main id="sr-main-content" className="sr-shell">
        <section className="sr-intro">
          <div>
            <p className="sr-eyebrow">
              {audience === 'parent' ? 'Review before applying' : 'A clear plan for today'}
            </p>
            <h2>
              {audience === 'parent'
                ? 'Keep required work moving without overloading the week.'
                : 'See what changed, why it changed, and what stays protected.'}
            </h2>
            <p>
              {audience === 'parent'
                ? 'Automatic proposals stay pending until a parent approves the recommendation, chooses an override, or places the work manually.'
                : 'Schedule adjustments are meant to support a workable restart. They are never a punishment.'}
            </p>
          </div>
          <SafeguardSummary model={model} />
        </section>

        {audience === 'parent' ? (
          <RecoverySummary
            proposals={model.proposals}
            conflicts={model.conflicts}
            dueDateRisks={model.dueDateRisks}
          />
        ) : null}

        <StudentSelector
          students={model.students}
          proposals={model.proposals}
          selectedStudentId={studentId}
          onSelect={selectStudent}
        />

        {audience === 'parent' ? (
          <div className="sr-parent-workspace">
            <ProposalList
              proposals={studentProposals}
              selectedProposalId={selectedProposal?.id ?? ''}
              onSelect={setProposalId}
            />
            <div className="sr-detail-panel">
              {selectedProposal && student ? (
                <ProposalReview
                  key={selectedProposal.id}
                  proposal={selectedProposal}
                  student={student}
                  conflicts={model.conflicts.filter((conflict) =>
                    selectedProposal.conflictIds.includes(conflict.id),
                  )}
                  dueDateRisks={model.dueDateRisks.filter((risk) =>
                    selectedProposal.riskIds.includes(risk.id),
                  )}
                  handlers={handlers}
                  onAnnounce={setAnnouncement}
                />
              ) : (
                <EmptyProposalState />
              )}
            </div>
          </div>
        ) : student ? (
          <>
            {studentProposals.length > 1 ? (
              <div className="sr-student-proposal-switcher" aria-label="Schedule changes">
                {studentProposals.map((proposal) => (
                  <button
                    type="button"
                    aria-pressed={proposal.id === selectedProposal?.id}
                    key={proposal.id}
                    onClick={() => setProposalId(proposal.id)}
                  >
                    {proposal.title}
                  </button>
                ))}
              </div>
            ) : null}
            <StudentRecoveryView
              student={student}
              proposal={selectedProposal}
              calendarItems={model.calendarItems.filter(
                (item) => item.studentId === student.id,
              )}
            />
          </>
        ) : (
          <EmptyProposalState />
        )}

        {audience === 'parent' ? (
          <RecoveryAuditHistory
            entries={model.auditHistory}
            students={model.students}
            handlers={handlers}
            onAnnounce={setAnnouncement}
          />
        ) : null}
      </main>

      <p className="sr-visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  )
}

function StudentSelector({
  students,
  proposals,
  selectedStudentId,
  onSelect,
}: {
  students: ScheduleRecoveryViewModel['students']
  proposals: RecoveryProposalView[]
  selectedStudentId: StudentId
  onSelect: (studentId: StudentId) => void
}) {
  return (
    <nav className="sr-student-selector" aria-label="Students">
      {students.map((student) => {
        const studentProposals = proposals.filter(
          ({ studentId }) => studentId === student.id,
        )
        const pending = studentProposals.filter(
          ({ status }) => status === 'pending' || status === 'undone',
        ).length
        return (
          <button
            type="button"
            key={student.id}
            aria-current={selectedStudentId === student.id ? 'page' : undefined}
            onClick={() => onSelect(student.id)}
          >
            <span className={`sr-mini-avatar sr-accent-${student.accent}`}>
              {student.initials}
            </span>
            <span>
              <strong>{student.name}</strong>
              <small>{student.gradeLabel}</small>
            </span>
            <span
              className={`sr-student-count ${pending === 0 ? 'sr-count-clear' : ''}`}
              aria-label={`${pending} waiting for review`}
            >
              {pending}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function ProposalList({
  proposals,
  selectedProposalId,
  onSelect,
}: {
  proposals: RecoveryProposalView[]
  selectedProposalId: string
  onSelect: (proposalId: string) => void
}) {
  return (
    <aside className="sr-proposal-list" aria-labelledby="sr-proposal-list-title">
      <div className="sr-proposal-list-heading">
        <div>
          <span>Recovery queue</span>
          <h2 id="sr-proposal-list-title">
            {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'}
          </h2>
        </div>
      </div>
      {proposals.length === 0 ? (
        <div className="sr-list-empty">No recovery proposals for this student.</div>
      ) : (
        <div className="sr-proposal-buttons">
          {proposals.map((proposal) => (
            <button
              type="button"
              key={proposal.id}
              aria-current={selectedProposalId === proposal.id ? 'true' : undefined}
              onClick={() => onSelect(proposal.id)}
            >
              <span className={`sr-proposal-state sr-state-${proposal.status}`} />
              <span>
                <small>{triggerLabels[proposal.trigger]}</small>
                <strong>{proposal.title}</strong>
                <span>
                  {proposal.status === 'pending'
                    ? 'Needs review'
                    : proposal.status === 'undone'
                      ? 'Prior schedule restored'
                      : proposal.status}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

function SafeguardSummary({ model }: { model: ScheduleRecoveryViewModel }) {
  const safeguards = [
    ['Sleep', model.safeguards.sleepProtected],
    ['Meals', model.safeguards.mealsProtected],
    ['Locked time', model.safeguards.parentLockedTimeProtected],
    ['Daily limits', model.safeguards.followingDayOverloadBlocked],
  ] as const

  return (
    <aside className="sr-safeguard-summary" aria-label="Protected schedule rules">
      <span>Protected on every proposal</span>
      <ul>
        {safeguards.map(([label, protectedState]) => (
          <li key={label}>
            <span aria-hidden="true">{protectedState ? '✓' : '!'}</span>
            {label}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function EmptyProposalState() {
  return (
    <section className="sr-student-empty">
      <span className="sr-empty-icon" aria-hidden="true">
        ✓
      </span>
      <h2>No recovery proposal selected</h2>
      <p>The schedule has no pending recovery work in this view.</p>
    </section>
  )
}
