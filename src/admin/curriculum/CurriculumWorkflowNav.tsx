export type CurriculumWorkflowView = 'published' | 'integrity' | 'studio' | 'validation' | 'preview' | 'activation'

const WORKFLOW_DESTINATIONS: readonly {
  readonly id: CurriculumWorkflowView
  readonly label: string
  readonly path: string
}[] = [
  { id: 'published', label: 'Published', path: '/academy/admin/curriculum' },
  { id: 'integrity', label: 'Release integrity', path: '/academy/admin/curriculum/integrity' },
  { id: 'studio', label: 'Studio', path: '/academy/admin/curriculum/studio' },
  { id: 'validation', label: 'Validation', path: '/academy/admin/curriculum/validation' },
  { id: 'preview', label: 'Preview / Diff', path: '/academy/admin/curriculum/preview' },
  { id: 'activation', label: 'Activation / Rollback', path: '/academy/admin/curriculum/activation' },
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

export function CurriculumPreviewUnavailable() {
  return (
    <section className="curriculum-preview-state" aria-labelledby="curriculum-preview-heading">
      <p className="curriculum-studio-eyebrow">Preview / Diff</p>
      <h2 id="curriculum-preview-heading">No draft is available to compare</h2>
      <p>
        Preview and semantic diff remain separate from the Studio shell. They will become available
        after the draft-authoring service supplies an authorized draft selection.
      </p>
      <div role="status">
        No draft was loaded, no comparison was generated, and no published curriculum was changed.
      </div>
    </section>
  )
}
