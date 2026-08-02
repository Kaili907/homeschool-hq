import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  EVIDENCE_REQUIREMENT_OPTIONS,
  TIME_ZONE_OPTIONS,
  attachmentMetadataFor,
  duplicateFixture,
  evidenceFixture,
  evidenceReviewFixture,
  makeExtractedFixture,
  makeManualFixture,
  scheduleFixture,
} from './fixtures'
import type {
  CaptureStep,
  CaptureViewerRole,
  CompletionEvidenceInput,
  DuplicateCheckResult,
  DuplicateResolution,
  DuplicateScenario,
  EvidenceRequirement,
  EvidenceSubmissionResult,
  ExternalAssignmentCaptureProps,
  ExternalAssignmentProposal,
  ExtractionFailureCode,
  ParentEvidenceDecision,
  ParentEvidenceReviewResult,
  ProposalFieldKey,
  ProviderSyncStatus,
  ReviewableProposalField,
  ScheduleResult,
} from './types'
import './ExternalAssignmentCapture.css'

const MAX_SOURCE_BYTES = 15 * 1024 * 1024

const STEP_LABELS: Array<{ id: CaptureStep; label: string; shortLabel: string }> = [
  { id: 'capture', label: 'Capture assignment', shortLabel: 'Capture' },
  { id: 'review', label: 'Confirm proposal', shortLabel: 'Confirm' },
  { id: 'schedule', label: 'Schedule', shortLabel: 'Schedule' },
  { id: 'evidence', label: 'Completion evidence', shortLabel: 'Evidence' },
  { id: 'approval', label: 'Parent review', shortLabel: 'Approval' },
]

const FAILURE_COPY: Record<ExtractionFailureCode, { title: string; detail: string }> = {
  'missing-file': {
    title: 'Choose a file first',
    detail: 'Nothing was sent for extraction. Select a screenshot, worksheet, or directions file.',
  },
  'unsupported-file': {
    title: 'This file type is not supported',
    detail: 'Use a PNG, JPG, WEBP, PDF, DOC, or DOCX file, up to 15 MB.',
  },
  'empty-file': {
    title: 'The selected file is empty',
    detail: 'Choose the original file again or enter the assignment manually.',
  },
  'unreadable-image': {
    title: 'We could not read this image',
    detail:
      'The image may be blurry, cropped, or too dark. Try a clearer image or enter the assignment manually.',
  },
  'encrypted-document': {
    title: 'This document is locked',
    detail:
      'The extractor cannot open password-protected documents. Do not enter a school password; use an accessible copy or manual entry.',
  },
  'extractor-unavailable': {
    title: 'Extraction is temporarily unavailable',
    detail: 'Your file was not scheduled. You can continue with manual entry without waiting.',
  },
}

interface ExtractionFailureState {
  code: ExtractionFailureCode
  title: string
  detail: string
  fileName?: string
}

interface EvidenceDraft {
  note: string
  link: string
  file: File | null
}

function valueFor(proposal: ExternalAssignmentProposal | null, key: ProposalFieldKey): string {
  return proposal?.fields.find((field) => field.key === key)?.value ?? ''
}

function confidenceDetails(confidence: number | null): {
  label: string
  className: string
  explanation: string
} {
  if (confidence === null) {
    return {
      label: 'Manual entry',
      className: 'eac-confidence--manual',
      explanation: 'Entered by a person; no extraction confidence applies.',
    }
  }
  const percentage = Math.round(confidence * 100)
  if (confidence >= 0.9) {
    return {
      label: `${percentage}% high`,
      className: 'eac-confidence--high',
      explanation: 'The extractor found strong source support. You still need to confirm it.',
    }
  }
  if (confidence >= 0.7) {
    return {
      label: `${percentage}% medium`,
      className: 'eac-confidence--medium',
      explanation: 'Review this carefully against the source.',
    }
  }
  return {
    label: `${percentage}% low`,
    className: 'eac-confidence--low',
    explanation: 'The extractor is uncertain. Correct this proposal before confirming.',
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isSupportedSource(file: File): boolean {
  const acceptedTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  const extensionAccepted = /\.(png|jpe?g|webp|pdf|docx?)$/i.test(file.name)
  return file.type.startsWith('image/') || acceptedTypes.has(file.type) || extensionAccepted
}

function makeFailure(
  code: ExtractionFailureCode,
  fileName?: string,
  overrideDetail?: string,
): ExtractionFailureState {
  return {
    code,
    title: FAILURE_COPY[code].title,
    detail: overrideDetail ?? FAILURE_COPY[code].detail,
    fileName,
  }
}

function roleLabel(role: CaptureViewerRole): string {
  return role === 'parent' ? 'Parent workspace' : 'Student workspace'
}

function defaultSyncStatus(providerId: string): ProviderSyncStatus {
  if (providerId === 'romeo_virtual_academy') {
    return {
      providerId,
      connection: 'not-authorized',
      state: 'idle',
      label: 'Provisional adapter · manual only',
      detail:
        'No authorized Romeo connection is configured. Capture uses files or manual entry and does not sign in to Romeo.',
    }
  }
  return {
    providerId,
    connection: 'manual-only',
    state: 'idle',
    label: 'Manual provider',
    detail:
      'This provider is recorded by identity and reference. Future authorized adapters can be connected without changing this assignment.',
  }
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warning' | 'danger' | 'success'
  title: string
  children: ReactNode
}) {
  return (
    <section className={`eac-banner eac-banner--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="eac-banner__mark" aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'danger' ? '!' : tone === 'warning' ? '!' : 'i'}
      </span>
      <div>
        <strong>{title}</strong>
        <div className="eac-banner__copy">{children}</div>
      </div>
    </section>
  )
}

function FieldControl({
  field,
  onChange,
}: {
  field: ReviewableProposalField
  onChange: (value: string) => void
}) {
  const common = {
    id: `eac-field-${field.key}`,
    value: field.value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.currentTarget.value),
    'aria-describedby': `eac-source-${field.key}`,
  }

  if (field.inputKind === 'textarea') {
    return <textarea {...common} rows={field.key === 'instructions' ? 5 : 3} />
  }

  if (field.inputKind === 'timezone') {
    return (
      <select {...common}>
        {TIME_ZONE_OPTIONS.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
    )
  }

  if (field.inputKind === 'evidence') {
    return (
      <select {...common}>
        {EVIDENCE_REQUIREMENT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return <input {...common} type={field.inputKind} />
}

function ProposalFieldCard({
  field,
  onValueChange,
  onConfirmedChange,
}: {
  field: ReviewableProposalField
  onValueChange: (value: string) => void
  onConfirmedChange: (confirmed: boolean) => void
}) {
  const confidence = confidenceDetails(field.confidence)
  const missingRequiredValue = field.required && field.value.trim().length === 0

  return (
    <article
      className={`eac-field-card${field.confirmed ? ' eac-field-card--confirmed' : ''}`}
      data-field-key={field.key}
    >
      <div className="eac-field-card__head">
        <div>
          <label htmlFor={`eac-field-${field.key}`}>
            {field.label}
            {field.required ? <span aria-label="required"> *</span> : <span> (optional)</span>}
          </label>
        </div>
        <span
          className={`eac-confidence ${confidence.className}`}
          title={confidence.explanation}
          aria-label={`Confidence: ${confidence.label}. ${confidence.explanation}`}
        >
          {confidence.label}
        </span>
      </div>

      <FieldControl field={field} onChange={onValueChange} />

      <div className="eac-source" id={`eac-source-${field.key}`}>
        <span className="eac-source__label">Source evidence</span>
        {field.sourceEvidence.map((source, index) => (
          <blockquote key={`${field.key}-${index}`}>
            “{source.excerpt}”
            {(source.page || source.region) && (
              <cite>
                {source.page ? `Page ${source.page}` : ''}
                {source.page && source.region ? ' · ' : ''}
                {source.region ?? ''}
              </cite>
            )}
          </blockquote>
        ))}
      </div>

      {missingRequiredValue && (
        <p className="eac-field-error">Add a value before confirming this required field.</p>
      )}

      <label className="eac-confirm-check">
        <input
          type="checkbox"
          checked={field.confirmed}
          disabled={missingRequiredValue}
          onChange={(event) => onConfirmedChange(event.currentTarget.checked)}
        />
        <span>
          I reviewed this field against its source
          {field.confirmed && <small>Confirmed</small>}
        </span>
      </label>
    </article>
  )
}

export function ExternalAssignmentCapture({
  controller,
  initialRole = 'parent',
  initialTimeZone = 'America/New_York',
  studentDisplayName = 'Student',
  onClose,
}: ExternalAssignmentCaptureProps) {
  const [role, setRole] = useState<CaptureViewerRole>(initialRole)
  const [step, setStep] = useState<CaptureStep>('capture')
  const [intakeMode, setIntakeMode] = useState<'manual' | 'document'>('document')
  const [providerChoice, setProviderChoice] = useState<'romeo' | 'other'>('romeo')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [proposal, setProposal] = useState<ExternalAssignmentProposal | null>(null)
  const [failure, setFailure] = useState<ExtractionFailureState | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [duplicateScenario, setDuplicateScenario] = useState<DuplicateScenario>('none')
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null)
  const [duplicateResolution, setDuplicateResolution] = useState<DuplicateResolution | null>(null)
  const [separateReason, setSeparateReason] = useState('')
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>({
    note: '',
    link: '',
    file: null,
  })
  const [evidenceResult, setEvidenceResult] = useState<EvidenceSubmissionResult | null>(null)
  const [parentDecision, setParentDecision] = useState<'approve' | 'return' | null>(null)
  const [parentNote, setParentNote] = useState('')
  const [parentReviewResult, setParentReviewResult] =
    useState<ParentEvidenceReviewResult | null>(null)
  const [syncStatus, setSyncStatus] = useState<ProviderSyncStatus>(
    defaultSyncStatus('romeo_virtual_academy'),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const evidenceFileRef = useRef<HTMLInputElement>(null)

  const confirmedCount = proposal?.fields.filter((field) => field.confirmed).length ?? 0
  const fieldCount = proposal?.fields.length ?? 0
  const allFieldsConfirmed =
    proposal !== null &&
    proposal.fields.every(
      (field) => field.confirmed && (!field.required || field.value.trim().length > 0),
    )

  const evidenceRequirement = (valueFor(proposal, 'evidenceRequirement') ||
    'file-or-link') as EvidenceRequirement

  const evidenceReady = useMemo(() => {
    const hasFile = evidenceDraft.file !== null
    const hasLink = /^https?:\/\/\S+$/i.test(evidenceDraft.link.trim())
    if (evidenceRequirement === 'file') return hasFile
    if (evidenceRequirement === 'link') return hasLink
    if (evidenceRequirement === 'file-or-link') return hasFile || hasLink
    return true
  }, [evidenceDraft.file, evidenceDraft.link, evidenceRequirement])

  const dueSummary = `${valueFor(proposal, 'dueDate') || 'No date'}${
    valueFor(proposal, 'dueTime') ? ` at ${valueFor(proposal, 'dueTime')}` : ''
  } (${valueFor(proposal, 'timeZone') || 'time zone required'})`

  const scheduleResolutionReady = useMemo(() => {
    if (!duplicateResult || !duplicateResolution) return false
    if (duplicateResult.kind === 'none') return duplicateResolution.kind === 'not-needed'
    if (duplicateResolution.kind === 'create-separate') return separateReason.trim().length >= 8
    return duplicateResolution.kind !== 'not-needed'
  }, [duplicateResolution, duplicateResult, separateReason])

  const canVisitStep = (candidate: CaptureStep): boolean => {
    if (candidate === 'capture') return true
    if (candidate === 'review') return proposal !== null
    if (candidate === 'schedule') return scheduleResult !== null
    if (candidate === 'evidence') return scheduleResult !== null
    return evidenceResult !== null || parentReviewResult !== null
  }

  const resetAfterProposalEdit = () => {
    setDuplicateResult(null)
    setDuplicateResolution(null)
    setSeparateReason('')
    setScheduleResult(null)
    setEvidenceResult(null)
    setParentReviewResult(null)
    setParentDecision(null)
    setStatusMessage('')
  }

  const updateProposalField = (key: ProposalFieldKey, value: string) => {
    setProposal((current) => {
      if (!current) return current
      return {
        ...current,
        originalProviderIdentity:
          key === 'providerName' && current.extractionStatus === 'manual'
            ? value
            : current.originalProviderIdentity,
        fields: current.fields.map((field) =>
          field.key === key ? { ...field, value, confirmed: false } : field,
        ),
      }
    })
    resetAfterProposalEdit()
  }

  const updateFieldConfirmation = (key: ProposalFieldKey, confirmed: boolean) => {
    setProposal((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.key === key ? { ...field, confirmed } : field,
            ),
          }
        : current,
    )
    setDuplicateResult(null)
    setDuplicateResolution(null)
    setSeparateReason('')
    setStatusMessage('')
  }

  const startManualEntry = () => {
    const nextProposal = makeManualFixture(role, initialTimeZone, providerChoice)
    setProposal(nextProposal)
    setFailure(null)
    setWarnings([])
    setDuplicateResult(null)
    setDuplicateResolution(null)
    setScheduleResult(null)
    setEvidenceResult(null)
    setParentReviewResult(null)
    setSyncStatus(defaultSyncStatus(nextProposal.providerId))
    setStatusMessage(
      'Manual proposal started. Fill in the fields, then confirm each one before scheduling.',
    )
    setStep('review')
  }

  const setExtractionFailure = (
    code: ExtractionFailureCode,
    fileName?: string,
    overrideDetail?: string,
  ) => {
    setFailure(makeFailure(code, fileName, overrideDetail))
    setProposal(null)
    setWarnings([])
    setStatusMessage('')
  }

  const extractSelectedFile = async (fileOverride?: File) => {
    const file = fileOverride ?? selectedFile
    if (!file) {
      setExtractionFailure('missing-file')
      return
    }
    setSelectedFile(file)
    if (file.size === 0) {
      setExtractionFailure('empty-file', file.name)
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setExtractionFailure(
        'unsupported-file',
        file.name,
        `“${file.name}” is ${formatBytes(file.size)}. The prototype accepts files up to 15 MB.`,
      )
      return
    }
    if (!isSupportedSource(file)) {
      setExtractionFailure('unsupported-file', file.name)
      return
    }
    if (/unreadable|blurry|blank/i.test(file.name)) {
      setExtractionFailure('unreadable-image', file.name)
      return
    }
    if (/encrypted|locked/i.test(file.name)) {
      setExtractionFailure('encrypted-document', file.name)
      return
    }

    setBusyAction('extract')
    setFailure(null)
    setStatusMessage('Reading the selected file…')
    try {
      const outcome = controller?.extractDocument
        ? await controller.extractDocument({
            file,
            providerId:
              providerChoice === 'romeo' ? 'romeo_virtual_academy' : 'manual-provider',
            providerDisplayName:
              providerChoice === 'romeo' ? 'Romeo Virtual Academy' : 'Another external school',
            viewerRole: role,
            timeZone: initialTimeZone,
          })
        : {
            ok: true as const,
            proposal: makeExtractedFixture(file, role, initialTimeZone),
            warnings: [
              'The time zone was not printed in the source and was proposed from household settings.',
            ],
          }

      if (!outcome.ok) {
        setExtractionFailure(outcome.code, outcome.attachment?.fileName, outcome.message)
        return
      }

      setProposal(outcome.proposal)
      setWarnings(outcome.warnings)
      setDuplicateResult(null)
      setDuplicateResolution(null)
      setScheduleResult(null)
      setEvidenceResult(null)
      setParentReviewResult(null)
      setSyncStatus(defaultSyncStatus(outcome.proposal.providerId))
      setStatusMessage(
        'Extraction created proposals only. Review and confirm every field before scheduling.',
      )
      setStep('review')
    } catch {
      setExtractionFailure('extractor-unavailable', file.name)
    } finally {
      setBusyAction(null)
    }
  }

  const loadReadableDemo = () => {
    const file = new File(['Manuel Academy external assignment demo'], 'romeo-essay-directions.pdf', {
      type: 'application/pdf',
    })
    void extractSelectedFile(file)
  }

  const loadUnreadableDemo = () => {
    const file = new File(['not enough image data'], 'unreadable-scan.png', {
      type: 'image/png',
    })
    void extractSelectedFile(file)
  }

  const checkDuplicates = async () => {
    if (!proposal || !allFieldsConfirmed) return
    setBusyAction('duplicate')
    setStatusMessage('Checking provider identity, original reference, course, and due date…')
    try {
      const result = controller?.checkForDuplicate
        ? await controller.checkForDuplicate(proposal, duplicateScenario)
        : duplicateFixture(duplicateScenario, proposal)
      setDuplicateResult(result)
      setDuplicateResolution(result.kind === 'none' ? { kind: 'not-needed' } : null)
      setStatusMessage(
        result.kind === 'none'
          ? 'No likely duplicate was found.'
          : 'A possible existing assignment needs a decision before scheduling.',
      )
    } catch {
      setStatusMessage(
        'Duplicate checking did not finish. The assignment cannot be scheduled until it succeeds.',
      )
      setDuplicateResult(null)
      setDuplicateResolution(null)
    } finally {
      setBusyAction(null)
    }
  }

  const scheduleAssignment = async () => {
    if (!proposal || !allFieldsConfirmed || !duplicateResult || !duplicateResolution) return
    if (!scheduleResolutionReady) return

    const resolution =
      duplicateResolution.kind === 'create-separate'
        ? ({ kind: 'create-separate', reason: separateReason.trim() } as const)
        : duplicateResolution

    const confirmedValues = Object.fromEntries(
      proposal.fields.map((field) => [field.key, field.value]),
    ) as Record<ProposalFieldKey, string>

    setBusyAction('schedule')
    setStatusMessage('Adding the confirmed assignment to the Manuel Academy schedule…')
    try {
      let result: ScheduleResult
      if (controller?.scheduleAssignment) {
        result = await controller.scheduleAssignment({
          proposal,
          confirmedValues,
          duplicateCheck: duplicateResult,
          duplicateResolution: resolution,
          requestedByRole: role,
        })
      } else if (
        resolution.kind === 'use-existing' ||
        resolution.kind === 'keep-existing'
      ) {
        result = scheduleFixture(
          'reused-existing',
          duplicateResult.kind === 'none' ? 'ma-ext-2086' : duplicateResult.existingAssignmentId,
        )
      } else if (resolution.kind === 'apply-provider-update') {
        result = scheduleFixture(
          'updated',
          duplicateResult.kind === 'none' ? 'ma-ext-2086' : duplicateResult.existingAssignmentId,
        )
      } else {
        result = scheduleFixture('created')
      }

      setScheduleResult(result)
      setStatusMessage(
        result.operation === 'created'
          ? 'The confirmed assignment is now scheduled.'
          : result.operation === 'updated'
            ? 'The existing assignment was updated with the confirmed provider proposal.'
            : 'The existing scheduled assignment was retained; no duplicate was created.',
      )
      setStep('schedule')
    } catch {
      setStatusMessage('Scheduling failed. No completion was recorded; try again or use manual intake.')
    } finally {
      setBusyAction(null)
    }
  }

  const submitEvidence = async () => {
    if (!scheduleResult || role !== 'student' || !evidenceReady) return
    const fileMetadata = evidenceDraft.file
      ? attachmentMetadataFor(evidenceDraft.file)
      : undefined
    const input: CompletionEvidenceInput = {
      assignmentId: scheduleResult.assignmentId,
      submittedByRole: 'student',
      note: evidenceDraft.note.trim(),
      link: evidenceDraft.link.trim() || undefined,
      file: evidenceDraft.file ?? undefined,
      fileMetadata,
      submittedAt: new Date().toISOString(),
    }

    setBusyAction('evidence')
    setStatusMessage('Submitting evidence for parent review…')
    try {
      const result = controller?.submitEvidence
        ? await controller.submitEvidence(input)
        : evidenceFixture()
      setEvidenceResult(result)
      setParentDecision(null)
      setParentReviewResult(null)
      setStatusMessage(
        'Evidence is awaiting a parent decision. The assignment is not complete yet.',
      )
      setStep('approval')
    } catch {
      setStatusMessage('Evidence was not accepted. The assignment remains scheduled and incomplete.')
    } finally {
      setBusyAction(null)
    }
  }

  const reviewEvidence = async () => {
    if (!scheduleResult || !evidenceResult || role !== 'parent' || !parentDecision) return
    if (parentDecision === 'return' && parentNote.trim().length < 3) return

    const result: ParentEvidenceDecision =
      parentDecision === 'approve'
        ? { decision: 'approve', note: parentNote.trim() || undefined }
        : { decision: 'return', reason: parentNote.trim() }
    const input = {
      assignmentId: scheduleResult.assignmentId,
      evidenceId: evidenceResult.evidenceId,
      reviewerRole: 'parent' as const,
      reviewedAt: new Date().toISOString(),
      result,
    }

    setBusyAction('review-evidence')
    setStatusMessage('Saving the parent decision…')
    try {
      const review = controller?.reviewEvidence
        ? await controller.reviewEvidence(input)
        : evidenceReviewFixture(input)
      setParentReviewResult(review)
      setStatusMessage(
        review.assignmentStatus === 'complete'
          ? 'Parent approved the evidence. The external assignment is complete.'
          : 'Evidence was returned. The assignment remains incomplete.',
      )
    } catch {
      setStatusMessage('The decision was not saved. The assignment remains incomplete.')
    } finally {
      setBusyAction(null)
    }
  }

  const refreshSyncStatus = async () => {
    const providerId = proposal?.providerId ?? 'romeo_virtual_academy'
    if (!controller?.getProviderSyncStatus) {
      setSyncStatus(defaultSyncStatus(providerId))
      setStatusMessage('No authorized provider connection is configured; manual capture remains available.')
      return
    }
    setBusyAction('sync')
    try {
      setSyncStatus(await controller.getProviderSyncStatus(providerId))
      setStatusMessage('Provider connection status refreshed.')
    } catch {
      setSyncStatus({
        ...defaultSyncStatus(providerId),
        state: 'attention-needed',
        detail:
          'Connection status could not be refreshed. No provider access was attempted by this prototype.',
      })
      setStatusMessage('Provider status is unavailable. Manual capture remains available.')
    } finally {
      setBusyAction(null)
    }
  }

  const restart = () => {
    setStep('capture')
    setSelectedFile(null)
    setProposal(null)
    setFailure(null)
    setWarnings([])
    setBusyAction(null)
    setStatusMessage('')
    setDuplicateResult(null)
    setDuplicateResolution(null)
    setSeparateReason('')
    setScheduleResult(null)
    setEvidenceDraft({ note: '', link: '', file: null })
    setEvidenceResult(null)
    setParentDecision(null)
    setParentNote('')
    setParentReviewResult(null)
    setSyncStatus(defaultSyncStatus('romeo_virtual_academy'))
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (evidenceFileRef.current) evidenceFileRef.current.value = ''
  }

  const renderCapture = () => (
    <div className="eac-stage">
      <div className="eac-stage__intro">
        <span className="eac-eyebrow">Step 1 · Assignment intake</span>
        <h2>Bring in work from any external school</h2>
        <p>
          Start from a file or type the details yourself. The provider name and original assignment
          reference stay attached to the Manuel Academy record.
        </p>
      </div>

      <fieldset className="eac-choice-grid" aria-label="Intake method">
        <legend className="eac-sr-only">Choose an intake method</legend>
        <label className={`eac-choice-card${intakeMode === 'document' ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="intake-mode"
            value="document"
            checked={intakeMode === 'document'}
            onChange={() => setIntakeMode('document')}
          />
          <span className="eac-choice-card__icon" aria-hidden="true">
            DOC
          </span>
          <strong>Upload directions</strong>
          <small>Screenshot, worksheet, PDF, DOC, or DOCX</small>
        </label>
        <label className={`eac-choice-card${intakeMode === 'manual' ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="intake-mode"
            value="manual"
            checked={intakeMode === 'manual'}
            onChange={() => setIntakeMode('manual')}
          />
          <span className="eac-choice-card__icon" aria-hidden="true">
            TYPE
          </span>
          <strong>Enter it manually</strong>
          <small>Always available; no extraction needed</small>
        </label>
      </fieldset>

      <div className="eac-panel">
        <div className="eac-form-row">
          <label htmlFor="eac-provider-choice">
            Source provider
            <select
              id="eac-provider-choice"
              value={providerChoice}
              onChange={(event) => {
                const next = event.currentTarget.value as 'romeo' | 'other'
                setProviderChoice(next)
                setSyncStatus(
                  defaultSyncStatus(
                    next === 'romeo' ? 'romeo_virtual_academy' : 'manual-provider',
                  ),
                )
              }}
            >
              <option value="romeo">Romeo Virtual Academy (provisional/manual)</option>
              <option value="other">Another external school (manual provider)</option>
            </select>
          </label>
        </div>

        {intakeMode === 'document' ? (
          <>
            <label className="eac-upload" htmlFor="eac-source-file">
              <span className="eac-upload__glyph" aria-hidden="true">
                ↑
              </span>
              <strong>{selectedFile ? selectedFile.name : 'Choose a source file'}</strong>
              <small>
                {selectedFile
                  ? `${selectedFile.type || 'Unknown type'} · ${formatBytes(selectedFile.size)}`
                  : 'PNG, JPG, WEBP, PDF, DOC, or DOCX · 15 MB maximum'}
              </small>
              <input
                ref={fileInputRef}
                id="eac-source-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx"
                onChange={(event) => {
                  setSelectedFile(event.currentTarget.files?.[0] ?? null)
                  setFailure(null)
                }}
              />
            </label>
            <div className="eac-action-row">
              <button
                className="eac-button eac-button--primary"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void extractSelectedFile()}
              >
                {busyAction === 'extract' ? 'Creating proposals…' : 'Extract proposed details'}
              </button>
              <button className="eac-button eac-button--quiet" type="button" onClick={loadReadableDemo}>
                Load readable demo
              </button>
              <button
                className="eac-button eac-button--quiet"
                type="button"
                onClick={loadUnreadableDemo}
              >
                Demo unreadable input
              </button>
            </div>
            <p className="eac-fine-print">
              A file is processed only after you choose “Extract proposed details.” This prototype
              does not save file bytes to browser storage.
            </p>
          </>
        ) : (
          <>
            <p className="eac-panel__lead">
              Manual entry creates the same review checklist as document extraction. Required fields
              must still be confirmed.
            </p>
            <button
              className="eac-button eac-button--primary"
              type="button"
              onClick={startManualEntry}
            >
              Start manual assignment
            </button>
          </>
        )}
      </div>

      {failure && (
        <Banner tone="danger" title={failure.title}>
          <p>{failure.detail}</p>
          {failure.fileName && <p className="eac-mono">File: {failure.fileName}</p>}
          <div className="eac-action-row">
            <button className="eac-button eac-button--danger" type="button" onClick={startManualEntry}>
              Continue with manual entry
            </button>
            <button
              className="eac-button eac-button--quiet"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose another file
            </button>
          </div>
        </Banner>
      )}
    </div>
  )

  const renderReview = () => {
    if (!proposal) return renderCapture()

    return (
      <div className="eac-stage">
        <div className="eac-stage__intro">
          <span className="eac-eyebrow">Step 2 · Mandatory confirmation</span>
          <h2>Review every proposed field</h2>
          <p>
            Extraction is a suggestion, not a fact. Editing any value clears its confirmation and
            requires another review.
          </p>
        </div>

        <section className="eac-provenance" aria-label="Source provider identity">
          <div>
            <span>Original provider identity</span>
            <strong>{proposal.originalProviderIdentity || 'Enter provider name below'}</strong>
          </div>
          <div>
            <span>Adapter mode</span>
            <strong>
              {proposal.providerKind === 'provisional-adapter'
                ? 'Provisional · no direct sync'
                : proposal.providerKind === 'authorized-adapter'
                  ? 'Authorized adapter'
                  : 'Generic manual provider'}
            </strong>
          </div>
          <div>
            <span>Source attachment</span>
            <strong>
              {proposal.sourceAttachments[0]?.fileName ?? 'Manual entry · no source file'}
            </strong>
          </div>
        </section>

        {warnings.map((warning) => (
          <Banner key={warning} tone="warning" title="Extraction needs attention">
            {warning}
          </Banner>
        ))}

        <div className="eac-review-progress">
          <div>
            <strong>
              {confirmedCount} of {fieldCount} fields confirmed
            </strong>
            <span>Each checkbox must be reviewed individually.</span>
          </div>
          <div
            className="eac-review-progress__track"
            role="progressbar"
            aria-valuenow={confirmedCount}
            aria-valuemin={0}
            aria-valuemax={fieldCount}
            aria-label={`${confirmedCount} of ${fieldCount} fields confirmed`}
          >
            <span style={{ width: fieldCount ? `${(confirmedCount / fieldCount) * 100}%` : '0%' }} />
          </div>
        </div>

        <div className="eac-field-list">
          {proposal.fields.map((field) => (
            <ProposalFieldCard
              key={field.key}
              field={field}
              onValueChange={(value) => updateProposalField(field.key, value)}
              onConfirmedChange={(confirmed) =>
                updateFieldConfirmation(field.key, confirmed)
              }
            />
          ))}
        </div>

        <section className="eac-due-card">
          <span className="eac-due-card__calendar" aria-hidden="true">
            17
          </span>
          <div>
            <span>Schedule preview</span>
            <strong>{dueSummary}</strong>
            <small>
              Date and time stay paired with the confirmed IANA time zone. This interface does not
              silently infer or convert an unknown zone.
            </small>
          </div>
        </section>

        <section className="eac-duplicate">
          <div className="eac-section-heading">
            <div>
              <span className="eac-eyebrow">Required safety check</span>
              <h3>Duplicate and update handling</h3>
            </div>
            <label className="eac-demo-control">
              Demo outcome
              <select
                value={duplicateScenario}
                onChange={(event) => {
                  setDuplicateScenario(event.currentTarget.value as DuplicateScenario)
                  setDuplicateResult(null)
                  setDuplicateResolution(null)
                  setSeparateReason('')
                }}
              >
                <option value="none">No match</option>
                <option value="exact">Exact duplicate</option>
                <option value="provider-update">Provider update</option>
                <option value="conflict">Local/provider conflict</option>
              </select>
            </label>
          </div>
          <p>
            The check compares provider identity, original reference, mapped course, title, and due
            date. It runs only after all fields are confirmed.
          </p>
          <button
            className="eac-button eac-button--secondary"
            type="button"
            disabled={!allFieldsConfirmed || busyAction !== null}
            onClick={() => void checkDuplicates()}
          >
            {busyAction === 'duplicate' ? 'Checking…' : 'Check before scheduling'}
          </button>

          {!allFieldsConfirmed && (
            <p className="eac-inline-lock">
              Confirm all {fieldCount} fields to unlock duplicate checking.
            </p>
          )}

          {duplicateResult && (
            <DuplicateResolutionPanel
              result={duplicateResult}
              resolution={duplicateResolution}
              separateReason={separateReason}
              onResolutionChange={setDuplicateResolution}
              onSeparateReasonChange={setSeparateReason}
            />
          )}
        </section>

        <div className="eac-sticky-action">
          <div>
            <strong>
              {allFieldsConfirmed
                ? duplicateResult
                  ? scheduleResolutionReady
                    ? 'Ready to schedule'
                    : 'Resolve the duplicate check'
                  : 'Run the duplicate check'
                : `${fieldCount - confirmedCount} confirmations remaining`}
            </strong>
            <small>
              {valueFor(proposal, 'providerName') || 'External provider'} ·{' '}
              {valueFor(proposal, 'providerAssignmentReference') || 'Reference required'}
            </small>
          </div>
          <button
            className="eac-button eac-button--primary"
            type="button"
            disabled={
              !allFieldsConfirmed ||
              !duplicateResult ||
              !scheduleResolutionReady ||
              busyAction !== null
            }
            onClick={() => void scheduleAssignment()}
          >
            {busyAction === 'schedule' ? 'Scheduling…' : 'Add confirmed assignment'}
          </button>
        </div>
      </div>
    )
  }

  const renderSchedule = () => {
    if (!proposal || !scheduleResult) return renderReview()
    return (
      <div className="eac-stage">
        <div className="eac-stage__intro">
          <span className="eac-eyebrow">Step 3 · Manuel Academy schedule</span>
          <h2>
            {scheduleResult.operation === 'created'
              ? 'Assignment scheduled'
              : scheduleResult.operation === 'updated'
                ? 'Scheduled assignment updated'
                : 'Existing assignment retained'}
          </h2>
          <p>
            The confirmed due date uses the displayed time zone. Source identity and the original
            provider reference remain attached.
          </p>
        </div>

        <section className="eac-receipt">
          <span className="eac-receipt__status">Scheduled</span>
          <h3>{valueFor(proposal, 'assignmentTitle')}</h3>
          <dl>
            <div>
              <dt>External school</dt>
              <dd>{valueFor(proposal, 'providerName')}</dd>
            </div>
            <div>
              <dt>Original reference</dt>
              <dd>{valueFor(proposal, 'providerAssignmentReference')}</dd>
            </div>
            <div>
              <dt>Course mapping</dt>
              <dd>
                {valueFor(proposal, 'externalCourseName')} →{' '}
                {valueFor(proposal, 'manuelCourseName')}
              </dd>
            </div>
            <div>
              <dt>External section</dt>
              <dd>{valueFor(proposal, 'externalSectionName') || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{dueSummary}</dd>
            </div>
            <div>
              <dt>Manuel assignment ID</dt>
              <dd className="eac-mono">{scheduleResult.assignmentId}</dd>
            </div>
          </dl>
        </section>

        <div className="eac-detail-grid">
          <section className="eac-detail-card">
            <span>Directions</span>
            <p>{valueFor(proposal, 'instructions') || 'No directions provided.'}</p>
          </section>
          <section className="eac-detail-card">
            <span>Rubric</span>
            <p>{valueFor(proposal, 'rubric') || 'No rubric provided.'}</p>
          </section>
          <section className="eac-detail-card">
            <span>Source attachments</span>
            {proposal.sourceAttachments.length ? (
              <ul className="eac-file-list">
                {proposal.sourceAttachments.map((attachment) => (
                  <li key={attachment.id}>
                    <strong>{attachment.fileName}</strong>
                    <small>
                      {attachment.mediaType} · {formatBytes(attachment.byteSize)} ·{' '}
                      {attachment.storageStatus === 'browser-only'
                        ? 'browser-only demo'
                        : 'accepted by host'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Manual assignment · no source file</p>
            )}
          </section>
          <section className="eac-detail-card">
            <span>Completion rule</span>
            <p>
              {EVIDENCE_REQUIREMENT_OPTIONS.find(
                (option) => option.value === evidenceRequirement,
              )?.label ?? evidenceRequirement}
              . The assignment remains incomplete until a parent approves.
            </p>
          </section>
        </div>

        <div className="eac-next-action">
          <div>
            <strong>Next: {studentDisplayName} adds completion evidence</strong>
            <p>
              Parent approval is a separate step. Scheduling never marks the assignment complete.
            </p>
          </div>
          <button
            className="eac-button eac-button--primary"
            type="button"
            onClick={() => setStep('evidence')}
          >
            Continue to evidence
          </button>
        </div>
      </div>
    )
  }

  const renderEvidence = () => {
    if (!proposal || !scheduleResult) return renderSchedule()
    const needsFile = evidenceRequirement === 'file'
    const needsLink = evidenceRequirement === 'link'
    const needsEither = evidenceRequirement === 'file-or-link'

    return (
      <div className="eac-stage">
        <div className="eac-stage__intro">
          <span className="eac-eyebrow">Step 4 · Student evidence</span>
          <h2>Add proof of completed work</h2>
          <p>
            Evidence is submitted for parent review. Uploading a file does not, by itself, mark the
            assignment complete.
          </p>
        </div>

        {role !== 'student' ? (
          <Banner tone="info" title="Student action required">
            <p>
              Only the student workspace can submit completion evidence in this prototype. Parent
              controls remain available for the later approval decision.
            </p>
            <button
              className="eac-button eac-button--secondary"
              type="button"
              onClick={() => setRole('student')}
            >
              Preview student workspace
            </button>
          </Banner>
        ) : (
          <>
            <section className="eac-assignment-strip">
              <div>
                <span>Assignment</span>
                <strong>{valueFor(proposal, 'assignmentTitle')}</strong>
              </div>
              <div>
                <span>Evidence required</span>
                <strong>
                  {needsFile
                    ? 'File'
                    : needsLink
                      ? 'Link'
                      : needsEither
                        ? 'File or link'
                        : 'Parent review only'}
                </strong>
              </div>
              <div>
                <span>Current status</span>
                <strong>Scheduled · incomplete</strong>
              </div>
            </section>

            <div className="eac-panel eac-evidence-form">
              {(needsFile || needsEither) && (
                <label className="eac-upload eac-upload--compact" htmlFor="eac-evidence-file">
                  <span className="eac-upload__glyph" aria-hidden="true">
                    +
                  </span>
                  <strong>{evidenceDraft.file?.name ?? 'Choose evidence file'}</strong>
                  <small>
                    {evidenceDraft.file
                      ? `${evidenceDraft.file.type || 'Unknown type'} · ${formatBytes(
                          evidenceDraft.file.size,
                        )}`
                      : 'Final document, photo, or export'}
                  </small>
                  <input
                    ref={evidenceFileRef}
                    id="eac-evidence-file"
                    type="file"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null
                      setEvidenceDraft((current) => ({
                        ...current,
                        file,
                      }))
                    }}
                  />
                </label>
              )}

              {(needsLink || needsEither) && (
                <label>
                  Evidence link{needsEither ? ' (instead of a file)' : ''}
                  <input
                    type="url"
                    placeholder="https://…"
                    value={evidenceDraft.link}
                    onChange={(event) => {
                      const link = event.currentTarget.value
                      setEvidenceDraft((current) => ({
                        ...current,
                        link,
                      }))
                    }}
                  />
                  {evidenceDraft.link && !/^https?:\/\/\S+$/i.test(evidenceDraft.link.trim()) && (
                    <small className="eac-field-error">
                      Enter a full link beginning with http:// or https://.
                    </small>
                  )}
                </label>
              )}

              <label>
                Student note (optional)
                <textarea
                  rows={4}
                  placeholder="Tell your parent what you completed or where to look."
                  value={evidenceDraft.note}
                  onChange={(event) => {
                    const note = event.currentTarget.value
                    setEvidenceDraft((current) => ({
                      ...current,
                      note,
                    }))
                  }}
                />
              </label>

              <div className="eac-action-row eac-action-row--between">
                <span className={evidenceReady ? 'eac-ready' : 'eac-inline-lock'}>
                  {evidenceReady
                    ? 'Evidence requirement satisfied'
                    : `Add the required ${needsFile ? 'file' : needsLink ? 'link' : 'file or link'}.`}
                </span>
                <button
                  className="eac-button eac-button--primary"
                  type="button"
                  disabled={!evidenceReady || busyAction !== null}
                  onClick={() => void submitEvidence()}
                >
                  {busyAction === 'evidence' ? 'Submitting…' : 'Send to parent'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderApproval = () => {
    if (!proposal || !scheduleResult || !evidenceResult) return renderEvidence()
    const isComplete = parentReviewResult?.assignmentStatus === 'complete'
    const wasReturned = parentReviewResult?.assignmentStatus === 'evidence-returned'

    return (
      <div className="eac-stage">
        <div className="eac-stage__intro">
          <span className="eac-eyebrow">Step 5 · Parent approval</span>
          <h2>{isComplete ? 'Evidence approved' : wasReturned ? 'Evidence returned' : 'Review completion evidence'}</h2>
          <p>
            Only a parent decision can move this external assignment to complete. Returned work stays
            incomplete until the student resubmits and a parent approves it.
          </p>
        </div>

        {role !== 'parent' ? (
          <Banner tone="warning" title="Waiting for a parent">
            <p>
              Evidence was submitted, but {valueFor(proposal, 'assignmentTitle')} is still
              incomplete. Students cannot approve their own evidence.
            </p>
            <button
              className="eac-button eac-button--secondary"
              type="button"
              onClick={() => setRole('parent')}
            >
              Preview parent workspace
            </button>
          </Banner>
        ) : (
          <>
            <section className="eac-evidence-review">
              <div className="eac-evidence-review__head">
                <div>
                  <span>Submitted by {studentDisplayName}</span>
                  <h3>{valueFor(proposal, 'assignmentTitle')}</h3>
                </div>
                <span
                  className={`eac-status-pill${
                    isComplete
                      ? ' eac-status-pill--complete'
                      : wasReturned
                        ? ' eac-status-pill--returned'
                        : ''
                  }`}
                >
                  {isComplete ? 'Complete' : wasReturned ? 'Returned' : 'Awaiting parent'}
                </span>
              </div>
              <dl>
                {evidenceDraft.file && (
                  <div>
                    <dt>File</dt>
                    <dd>
                      {evidenceDraft.file.name} · {formatBytes(evidenceDraft.file.size)}
                    </dd>
                  </div>
                )}
                {evidenceDraft.link && (
                  <div>
                    <dt>Link</dt>
                    <dd>
                      <a href={evidenceDraft.link} target="_blank" rel="noreferrer">
                        {evidenceDraft.link}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Student note</dt>
                  <dd>{evidenceDraft.note || 'No note provided.'}</dd>
                </div>
                <div>
                  <dt>Evidence ID</dt>
                  <dd className="eac-mono">{evidenceResult.evidenceId}</dd>
                </div>
              </dl>
            </section>

            {!parentReviewResult && (
              <section className="eac-decision-panel">
                <fieldset>
                  <legend>Parent decision</legend>
                  <label className={parentDecision === 'approve' ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="parent-decision"
                      checked={parentDecision === 'approve'}
                      onChange={() => setParentDecision('approve')}
                    />
                    <span>
                      <strong>Approve evidence</strong>
                      <small>Mark the assignment complete.</small>
                    </span>
                  </label>
                  <label className={parentDecision === 'return' ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="parent-decision"
                      checked={parentDecision === 'return'}
                      onChange={() => setParentDecision('return')}
                    />
                    <span>
                      <strong>Return to student</strong>
                      <small>Keep it incomplete and request another submission.</small>
                    </span>
                  </label>
                </fieldset>

                <label>
                  {parentDecision === 'return' ? 'What should the student fix? *' : 'Parent note (optional)'}
                  <textarea
                    rows={4}
                    value={parentNote}
                    onChange={(event) => setParentNote(event.currentTarget.value)}
                    placeholder={
                      parentDecision === 'return'
                        ? 'Give a specific reason before returning the evidence.'
                        : 'Add a note about the completed work.'
                    }
                  />
                </label>

                <button
                  className={`eac-button ${
                    parentDecision === 'return' ? 'eac-button--danger' : 'eac-button--primary'
                  }`}
                  type="button"
                  disabled={
                    !parentDecision ||
                    (parentDecision === 'return' && parentNote.trim().length < 3) ||
                    busyAction !== null
                  }
                  onClick={() => void reviewEvidence()}
                >
                  {busyAction === 'review-evidence'
                    ? 'Saving decision…'
                    : parentDecision === 'return'
                      ? 'Return with feedback'
                      : 'Approve and mark complete'}
                </button>
              </section>
            )}

            {isComplete && (
              <Banner tone="success" title="Assignment complete">
                Parent approval was recorded after the configured evidence requirement was satisfied.
              </Banner>
            )}

            {wasReturned && (
              <Banner tone="danger" title="Still incomplete">
                <p>Parent feedback: {parentNote}</p>
                <button
                  className="eac-button eac-button--danger"
                  type="button"
                  onClick={() => {
                    setRole('student')
                    setEvidenceResult(null)
                    setParentReviewResult(null)
                    setParentDecision(null)
                    setEvidenceDraft({ note: '', link: '', file: null })
                    setStep('evidence')
                  }}
                >
                  Start a new evidence submission
                </button>
              </Banner>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="eac-shell">
      <header className="eac-header">
        <div className="eac-brand">
          <span className="eac-brand__mark" aria-hidden="true">
            MA
          </span>
          <div>
            <strong>Manuel Academy</strong>
            <span>External learning desk</span>
          </div>
        </div>
        <div className="eac-header__actions">
          <label className="eac-role-switch">
            <span className="eac-sr-only">Preview workspace role</span>
            <select value={role} onChange={(event) => setRole(event.currentTarget.value as CaptureViewerRole)}>
              <option value="parent">Parent workspace</option>
              <option value="student">Student workspace</option>
            </select>
          </label>
          {onClose && (
            <button className="eac-button eac-button--quiet" type="button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </header>

      <div className="eac-layout">
        <aside className="eac-sidebar">
          <div className="eac-sidebar__role">
            <span>{roleLabel(role)}</span>
            <strong>{role === 'student' ? studentDisplayName : 'Grown-ups'}</strong>
          </div>

          <nav aria-label="External assignment workflow">
            <ol className="eac-steps">
              {STEP_LABELS.map((candidate, index) => {
                const enabled = canVisitStep(candidate.id)
                const active = step === candidate.id
                return (
                  <li key={candidate.id} className={active ? 'is-active' : ''}>
                    <button
                      type="button"
                      disabled={!enabled}
                      aria-current={active ? 'step' : undefined}
                      onClick={() => enabled && setStep(candidate.id)}
                    >
                      <span>{index + 1}</span>
                      <strong>{candidate.shortLabel}</strong>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <section className="eac-sync-card" aria-label="Provider synchronization status">
            <div className="eac-sync-card__top">
              <span>Provider sync</span>
              <i className={`eac-sync-dot eac-sync-dot--${syncStatus.state}`} />
            </div>
            <strong>{syncStatus.label}</strong>
            <p>{syncStatus.detail}</p>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void refreshSyncStatus()}
            >
              {busyAction === 'sync' ? 'Checking…' : 'Refresh status'}
            </button>
          </section>

          <button className="eac-restart" type="button" onClick={restart}>
            Start over
          </button>
        </aside>

        <main className="eac-main">
          <Banner tone="info" title="Passwords stay with your school">
            Manuel Academy will never ask for or store a student’s external-school password. This
            capture flow does not bypass school access controls and does not claim direct Romeo
            synchronization.
          </Banner>

          <div className="eac-mobile-steps" aria-label="Current workflow step">
            <span>
              Step {STEP_LABELS.findIndex((candidate) => candidate.id === step) + 1} of{' '}
              {STEP_LABELS.length}
            </span>
            <strong>{STEP_LABELS.find((candidate) => candidate.id === step)?.label}</strong>
          </div>

          {step === 'capture' && renderCapture()}
          {step === 'review' && renderReview()}
          {step === 'schedule' && renderSchedule()}
          {step === 'evidence' && renderEvidence()}
          {step === 'approval' && renderApproval()}

          <div className="eac-status-region" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </div>
        </main>
      </div>
    </div>
  )
}

function DuplicateResolutionPanel({
  result,
  resolution,
  separateReason,
  onResolutionChange,
  onSeparateReasonChange,
}: {
  result: DuplicateCheckResult
  resolution: DuplicateResolution | null
  separateReason: string
  onResolutionChange: (value: DuplicateResolution) => void
  onSeparateReasonChange: (value: string) => void
}) {
  if (result.kind === 'none') {
    return (
      <Banner tone="success" title="No likely duplicate found">
        The proposal can be scheduled as a new external assignment.
      </Banner>
    )
  }

  const changes =
    result.kind === 'provider-update'
      ? result.changedFields
      : result.kind === 'conflict'
        ? result.conflicts
        : []

  return (
    <div className="eac-resolution">
      <Banner
        tone={result.kind === 'exact-duplicate' ? 'danger' : 'warning'}
        title={
          result.kind === 'exact-duplicate'
            ? 'Likely exact duplicate'
            : result.kind === 'provider-update'
              ? 'Possible provider update'
              : 'Local and provider values conflict'
        }
      >
        <p>{result.explanation}</p>
        <p className="eac-mono">Existing: {result.existingAssignmentId}</p>
      </Banner>

      {result.kind === 'exact-duplicate' && (
        <p className="eac-match-list">
          Matched on: {result.matchedOn.join(', ')}
        </p>
      )}

      {changes.length > 0 && (
        <div className="eac-change-table" role="table" aria-label="Existing and proposed values">
          <div role="row" className="eac-change-table__head">
            <span role="columnheader">Field</span>
            <span role="columnheader">Existing</span>
            <span role="columnheader">Proposed</span>
          </div>
          {changes.map((change) => (
            <div role="row" key={change.field}>
              <strong role="cell">{change.field}</strong>
              <span role="cell">{change.existingValue}</span>
              <span role="cell">{change.proposedValue}</span>
            </div>
          ))}
        </div>
      )}

      <fieldset className="eac-resolution-options">
        <legend>Choose a resolution</legend>
        {result.kind === 'exact-duplicate' && (
          <label className={resolution?.kind === 'use-existing' ? 'is-selected' : ''}>
            <input
              type="radio"
              name="duplicate-resolution"
              checked={resolution?.kind === 'use-existing'}
              onChange={() => onResolutionChange({ kind: 'use-existing' })}
            />
            <span>
              <strong>Use the existing assignment</strong>
              <small>Do not create another schedule item.</small>
            </span>
          </label>
        )}
        {result.kind === 'provider-update' && (
          <>
            <label className={resolution?.kind === 'apply-provider-update' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="duplicate-resolution"
                checked={resolution?.kind === 'apply-provider-update'}
                onChange={() => onResolutionChange({ kind: 'apply-provider-update' })}
              />
              <span>
                <strong>Apply confirmed provider update</strong>
                <small>Update the existing schedule item with the reviewed value.</small>
              </span>
            </label>
            <label className={resolution?.kind === 'keep-existing' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="duplicate-resolution"
                checked={resolution?.kind === 'keep-existing'}
                onChange={() => onResolutionChange({ kind: 'keep-existing' })}
              />
              <span>
                <strong>Keep the existing assignment</strong>
                <small>Ignore this proposed update.</small>
              </span>
            </label>
          </>
        )}
        {result.kind === 'conflict' && (
          <>
            <label className={resolution?.kind === 'apply-provider-update' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="duplicate-resolution"
                checked={resolution?.kind === 'apply-provider-update'}
                onChange={() => onResolutionChange({ kind: 'apply-provider-update' })}
              />
              <span>
                <strong>Use the confirmed provider values</strong>
                <small>Replace the listed local values only.</small>
              </span>
            </label>
            <label className={resolution?.kind === 'keep-existing' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="duplicate-resolution"
                checked={resolution?.kind === 'keep-existing'}
                onChange={() => onResolutionChange({ kind: 'keep-existing' })}
              />
              <span>
                <strong>Keep the local values</strong>
                <small>Retain the current schedule item unchanged.</small>
              </span>
            </label>
          </>
        )}
        <label className={resolution?.kind === 'create-separate' ? 'is-selected' : ''}>
          <input
            type="radio"
            name="duplicate-resolution"
            checked={resolution?.kind === 'create-separate'}
            onChange={() =>
              onResolutionChange({ kind: 'create-separate', reason: separateReason })
            }
          />
          <span>
            <strong>Create a separate assignment</strong>
            <small>Requires a reason so an accidental duplicate is not silently created.</small>
          </span>
        </label>
      </fieldset>

      {resolution?.kind === 'create-separate' && (
        <label className="eac-separate-reason">
          Why is this a different assignment? *
          <textarea
            rows={3}
            value={separateReason}
            onChange={(event) => {
              onSeparateReasonChange(event.currentTarget.value)
              onResolutionChange({
                kind: 'create-separate',
                reason: event.currentTarget.value,
              })
            }}
            placeholder="Example: same worksheet assigned to a different section."
          />
          <small>Enter at least 8 characters.</small>
        </label>
      )}
    </div>
  )
}
