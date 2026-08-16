import { useEffect, useState } from 'react'
import type { FamilyPilotLessonPlayerProps } from './types'
import './lesson-player.css'

export function FamilyPilotLessonPlayer({
  status,
  snapshot,
  renderModel,
  errorMessage,
  onContinue,
  onPause,
  onExit,
}: FamilyPilotLessonPlayerProps) {
  const [pageIndex, setPageIndex] = useState(0)
  useEffect(() => { setPageIndex(0) }, [renderModel?.lessonRef])

  if (status === 'loading') return <main className="family-pilot-lesson-player" aria-busy="true"><p role="status">Preparing lesson…</p></main>
  if (status === 'blocked' || !renderModel) {
    return <main className="family-pilot-lesson-player"><h1>Lesson unavailable</h1><p role="alert">{errorMessage ?? 'This lesson cannot be opened right now.'}</p>{onExit && <button onClick={onExit}>Back</button>}</main>
  }
  const page = renderModel.pages[Math.min(pageIndex, renderModel.pages.length - 1)]!
  const finalPage = page.position === page.total
  return (
    <main className="family-pilot-lesson-player" data-subject={renderModel.subject.subject}>
      <header>
        <p className="lesson-subject">{renderModel.subject.label}</p>
        <h1>{renderModel.title}</h1>
        <p>Step {page.position} of {page.total}</p>
      </header>
      <article aria-labelledby="family-pilot-current-section">
        <h2 id="family-pilot-current-section">{page.title}</h2>
        {page.body && <p>{page.body}</p>}
        {page.directions && <p className="lesson-directions">{page.directions}</p>}
        {page.details.length > 0 && <ul>{page.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
      </article>
      <nav aria-label="Lesson steps">
        <button disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}>Previous</button>
        {!finalPage && <button onClick={() => setPageIndex((value) => Math.min(renderModel.pages.length - 1, value + 1))}>Next</button>}
        {finalPage && status !== 'completed' && onContinue && <button onClick={onContinue}>Complete this step</button>}
        {status === 'ready' && onPause && <button onClick={onPause}>Pause</button>}
        {onExit && <button onClick={onExit}>{status === 'completed' ? 'Done' : 'Exit lesson'}</button>}
      </nav>
      {snapshot && <p className="lesson-progress" aria-live="polite">{snapshot.requiredWorkCompletionPercent}% complete</p>}
    </main>
  )
}
