export type CurriculumWorkflowView = 'published' | 'studio' | 'validation' | 'preview'

const WORKFLOW_DESTINATIONS: readonly {
  readonly id: CurriculumWorkflowView
  readonly label: string
  readonly path: string
}[] = [
  { id: 'published', label: 'Published', path: '/academy/admin/curriculum' },
  { id: 'studio', label: 'Studio', path: '/academy/admin/curriculum/studio' },
  { id: 'validation', label: 'Validation', path: '/academy/admin/curriculum/validation' },
  { id: 'preview', label: 'Preview / Diff', path: '/academy/admin/curriculum/preview' },
]

export function CurriculumWorkflowNav({
  current,
  onNavigate,
}: {
  readonly current: CurriculumWorkflowView
  readonly onNavigate?: (view: CurriculumWorkflowView) => void
}) {
  return (
    <nav className="curriculum-workflow-nav" aria-label="Curriculum workflow">
      <p>Curriculum workspace</p>
      <ul>
        {WORKFLOW_DESTINATIONS.map((destination) => (
          <li key={destination.id}>
            <a
              href={destination.path}
              aria-current={current === destination.id ? 'page' : undefined}
              onClick={onNavigate ? (event) => {
                event.preventDefault()
                onNavigate(destination.id)
              } : undefined}
            >
              {destination.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
