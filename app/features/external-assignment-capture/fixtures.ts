import type {
  CaptureAttachmentMetadata,
  CaptureViewerRole,
  DuplicateCheckResult,
  DuplicateScenario,
  EvidenceSubmissionResult,
  ExternalAssignmentProposal,
  ParentEvidenceReviewInput,
  ParentEvidenceReviewResult,
  ProposalFieldKey,
  ReviewableProposalField,
  ScheduleResult,
} from './types'

export const PROPOSAL_FIELD_ORDER: ProposalFieldKey[] = [
  'providerName',
  'providerAssignmentReference',
  'externalCourseName',
  'externalSectionName',
  'manuelCourseName',
  'assignmentTitle',
  'dueDate',
  'dueTime',
  'timeZone',
  'instructions',
  'rubric',
  'evidenceRequirement',
]

export const TIME_ZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

export const EVIDENCE_REQUIREMENT_OPTIONS = [
  { value: 'file', label: 'A file is required' },
  { value: 'link', label: 'A link is required' },
  { value: 'file-or-link', label: 'A file or link is required' },
  { value: 'none', label: 'No artifact required; parent approval is still required' },
]

function evidence(
  excerpt: string,
  attachmentId: string,
  page = 1,
): ReviewableProposalField['sourceEvidence'] {
  return [
    {
      kind: 'document-text',
      attachmentId,
      page,
      excerpt,
    },
  ]
}

function field(
  key: ProposalFieldKey,
  label: string,
  value: string,
  inputKind: ReviewableProposalField['inputKind'],
  confidence: number | null,
  sourceEvidence: ReviewableProposalField['sourceEvidence'],
  required = true,
): ReviewableProposalField {
  return {
    key,
    label,
    value,
    inputKind,
    confidence,
    sourceEvidence,
    required,
    confirmed: false,
  }
}

export function attachmentMetadataFor(file: File): CaptureAttachmentMetadata {
  return {
    id: `attachment-${file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'upload'}`,
    fileName: file.name,
    mediaType: file.type || 'application/octet-stream',
    byteSize: file.size,
    capturedAt: new Date().toISOString(),
    storageStatus: 'browser-only',
  }
}

export function makeExtractedFixture(
  file: File,
  role: CaptureViewerRole,
  timeZone: string,
): ExternalAssignmentProposal {
  const attachment = attachmentMetadataFor(file)
  const attachmentId = attachment.id

  return {
    proposalId: `proposal-demo-${Date.now()}`,
    providerId: 'romeo_virtual_academy',
    providerKind: 'provisional-adapter',
    originalProviderIdentity: 'Romeo Virtual Academy',
    createdByRole: role,
    createdAt: new Date().toISOString(),
    extractionStatus: 'proposed',
    sourceAttachments: [attachment],
    fields: [
      field(
        'providerName',
        'External school',
        'Romeo Virtual Academy',
        'text',
        0.99,
        evidence('Romeo Virtual Academy • Student Assignment', attachmentId),
      ),
      field(
        'providerAssignmentReference',
        'Original assignment reference',
        'RVA-ELA10-2048',
        'text',
        0.91,
        evidence('Assignment ID: RVA-ELA10-2048', attachmentId),
      ),
      field(
        'externalCourseName',
        'External course',
        'English Language Arts 10',
        'text',
        0.97,
        evidence('Course: English Language Arts 10', attachmentId),
      ),
      field(
        'externalSectionName',
        'External section',
        'Section B • Fall',
        'text',
        0.76,
        evidence('ELA 10 / B / Fall', attachmentId),
      ),
      field(
        'manuelCourseName',
        'Manuel Academy course mapping',
        'Grade 10 English',
        'text',
        0.68,
        [
          {
            kind: 'provider-metadata',
            excerpt: 'Suggested mapping from “English Language Arts 10” to “Grade 10 English.”',
          },
        ],
      ),
      field(
        'assignmentTitle',
        'Assignment title',
        'Argument Essay: Community Spaces',
        'text',
        0.96,
        evidence('Argument Essay — Community Spaces', attachmentId),
      ),
      field(
        'dueDate',
        'Due date',
        '2026-09-17',
        'date',
        0.88,
        evidence('Due: Sep 17, 2026 at 11:59 PM', attachmentId),
      ),
      field(
        'dueTime',
        'Due time',
        '23:59',
        'time',
        0.79,
        evidence('Due: Sep 17, 2026 at 11:59 PM', attachmentId),
      ),
      field(
        'timeZone',
        'Due-date time zone',
        timeZone,
        'timezone',
        0.42,
        [
          {
            kind: 'document-layout',
            attachmentId,
            page: 1,
            excerpt: 'No time zone was printed; the selected household time zone is proposed.',
          },
        ],
      ),
      field(
        'instructions',
        'Directions',
        'Write a 750–900 word argument essay proposing one improvement to a community space. Cite at least three credible sources.',
        'textarea',
        0.94,
        evidence(
          'Write a 750–900 word argument essay … Cite at least three credible sources.',
          attachmentId,
        ),
      ),
      field(
        'rubric',
        'Rubric',
        'Claim and organization: 30%; evidence and reasoning: 40%; conventions: 20%; citations: 10%.',
        'textarea',
        0.72,
        evidence(
          'Rubric: Claim/organization 30 • Evidence/reasoning 40 • Conventions 20 • Citations 10',
          attachmentId,
          2,
        ),
      ),
      field(
        'evidenceRequirement',
        'Completion evidence',
        'file-or-link',
        'evidence',
        0.83,
        evidence('Submit your final document or a share link in the assignment portal.', attachmentId),
      ),
    ],
  }
}

export function makeManualFixture(
  role: CaptureViewerRole,
  timeZone: string,
  provider: 'romeo' | 'other',
): ExternalAssignmentProposal {
  const providerName = provider === 'romeo' ? 'Romeo Virtual Academy' : ''
  const providerId = provider === 'romeo' ? 'romeo_virtual_academy' : 'manual-provider'
  const manualEvidence = (label: string): ReviewableProposalField['sourceEvidence'] => [
    {
      kind: 'manual-entry',
      excerpt: `${label} was entered directly by the ${role}.`,
    },
  ]

  const values: Array<
    [
      ProposalFieldKey,
      string,
      string,
      ReviewableProposalField['inputKind'],
      boolean?,
    ]
  > = [
    ['providerName', 'External school', providerName, 'text'],
    ['providerAssignmentReference', 'Original assignment reference', '', 'text'],
    ['externalCourseName', 'External course', '', 'text'],
    ['externalSectionName', 'External section', '', 'text', false],
    ['manuelCourseName', 'Manuel Academy course mapping', '', 'text'],
    ['assignmentTitle', 'Assignment title', '', 'text'],
    ['dueDate', 'Due date', '', 'date'],
    ['dueTime', 'Due time', '', 'time', false],
    ['timeZone', 'Due-date time zone', timeZone, 'timezone'],
    ['instructions', 'Directions', '', 'textarea'],
    ['rubric', 'Rubric', '', 'textarea', false],
    ['evidenceRequirement', 'Completion evidence', 'file-or-link', 'evidence'],
  ]

  return {
    proposalId: `proposal-manual-${Date.now()}`,
    providerId,
    providerKind: provider === 'romeo' ? 'provisional-adapter' : 'manual',
    originalProviderIdentity: providerName,
    fields: values.map(([key, label, value, inputKind, required = true]) =>
      field(key, label, value, inputKind, null, manualEvidence(label), required),
    ),
    sourceAttachments: [],
    extractionStatus: 'manual',
    createdByRole: role,
    createdAt: new Date().toISOString(),
  }
}

export function duplicateFixture(
  scenario: DuplicateScenario,
  proposal: ExternalAssignmentProposal,
): DuplicateCheckResult {
  const value = (key: ProposalFieldKey) =>
    proposal.fields.find((candidate) => candidate.key === key)?.value ?? ''

  if (scenario === 'exact') {
    return {
      kind: 'exact-duplicate',
      existingAssignmentId: 'ma-ext-1042',
      explanation:
        'The provider identity, original reference, course, and due date match an assignment already scheduled.',
      matchedOn: [
        'providerId',
        'providerAssignmentReference',
        'externalCourseName',
        'dueDate',
      ],
    }
  }

  if (scenario === 'provider-update') {
    return {
      kind: 'provider-update',
      existingAssignmentId: 'ma-ext-1042',
      explanation:
        'The same provider reference exists, and the proposed due date appears to be a newer provider value.',
      changedFields: [
        {
          field: 'dueDate',
          existingValue: '2026-09-15',
          proposedValue: value('dueDate') || '2026-09-17',
        },
      ],
    }
  }

  if (scenario === 'conflict') {
    return {
      kind: 'conflict',
      existingAssignmentId: 'ma-ext-1042',
      explanation:
        'A locally edited due date conflicts with the proposed provider date. A person must choose which value wins.',
      conflicts: [
        {
          field: 'dueDate',
          existingValue: '2026-09-18 (parent edit)',
          proposedValue: value('dueDate') || '2026-09-17',
        },
        {
          field: 'instructions',
          existingValue: 'Submit a 900-word essay.',
          proposedValue: value('instructions'),
        },
      ],
    }
  }

  return { kind: 'none' }
}

export function scheduleFixture(
  operation: ScheduleResult['operation'] = 'created',
  assignmentId = 'ma-ext-2086',
): ScheduleResult {
  return {
    assignmentId,
    operation,
    scheduledAt: new Date().toISOString(),
  }
}

export function evidenceFixture(): EvidenceSubmissionResult {
  return {
    evidenceId: `evidence-demo-${Date.now()}`,
    status: 'awaiting-parent',
    submittedAt: new Date().toISOString(),
  }
}

export function evidenceReviewFixture(
  input: ParentEvidenceReviewInput,
): ParentEvidenceReviewResult {
  return {
    assignmentStatus: input.result.decision === 'approve' ? 'complete' : 'evidence-returned',
    reviewedAt: new Date().toISOString(),
  }
}
