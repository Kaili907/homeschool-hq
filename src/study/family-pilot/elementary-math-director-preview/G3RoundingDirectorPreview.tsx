import { useEffect, useMemo, useState } from 'react'
import { loadFinalFamilyPilotCatalog, type FinalLearnerProductionMaterial } from '../../../curriculum/final-app-data'
import {
  ElementaryMathSamplePlayer,
  G3_ROUNDING_CANONICAL_TITLE,
  G3_ROUNDING_CHILD_TITLE,
  G3_ROUNDING_PRODUCTION_LESSON_REF,
} from '../elementary-math-sample-player'
import { LearnerResponseRuntime, MemoryLearnerResponseStore } from '../final-app/learner-response'

export function G3RoundingDirectorPreview() {
  const [material, setMaterial] = useState<FinalLearnerProductionMaterial | null>(null)
  const [error, setError] = useState('')
  const store = useMemo(() => new MemoryLearnerResponseStore(), [])

  useEffect(() => {
    let live = true
    void loadFinalFamilyPilotCatalog()
      .then((catalog) => catalog.getMaterial(G3_ROUNDING_PRODUCTION_LESSON_REF))
      .then((loaded) => {
        if (!live) return
        if (!loaded || loaded.lessonRef !== G3_ROUNDING_PRODUCTION_LESSON_REF) {
          throw new Error('The Grade 3 rounding lesson is unavailable.')
        }
        if (loaded.title !== G3_ROUNDING_CANONICAL_TITLE) {
          throw new Error('The Grade 3 rounding lesson provenance did not match this review.')
        }
        setMaterial(loaded)
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : 'The lesson could not be opened.')
      })
    return () => { live = false }
  }, [])

  if (error) return <main><h1>Preview unavailable</h1><p role="alert">{error}</p></main>
  if (!material) return <main aria-busy="true"><p role="status">Opening the Grade 3 rounding lesson…</p></main>

  const runtime = new LearnerResponseRuntime(material, {
    lessonRef: G3_ROUNDING_PRODUCTION_LESSON_REF,
    studentRef: 'director-review',
    assignmentRef: 'director-review:g3-rounding',
    attemptRef: 'director-review:g3-rounding',
  }, store)

  return (
    <ElementaryMathSamplePlayer
      runtime={runtime}
      material={material}
      displayTitle={G3_ROUNDING_CHILD_TITLE}
      onNeedHelp={() => { /* Future Jarvis callback placeholder. */ }}
    />
  )
}
