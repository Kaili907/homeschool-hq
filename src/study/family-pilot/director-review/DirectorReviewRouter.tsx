import { lazy, Suspense } from 'react'
import { DirectorLessonSampleReviewHome } from './DirectorLessonSampleReviewHome'
import {
  DIRECTOR_LESSON_SAMPLES,
  DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH,
  findDirectorLessonSample,
  isExactDirectorReviewPath,
} from './registry'

const lazySampleComponents = new Map(
  DIRECTOR_LESSON_SAMPLES.map((sample) => [sample.id, lazy(sample.load)] as const),
)

type DirectorReviewRouterProps = Readonly<{ pathname?: string }>

export function DirectorReviewRouter({ pathname }: DirectorReviewRouterProps) {
  const currentPath = pathname ?? window.location.pathname

  if (isExactDirectorReviewPath(currentPath, DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH)) {
    return <DirectorLessonSampleReviewHome />
  }

  const sample = findDirectorLessonSample(currentPath)
  if (sample) {
    const SampleComponent = lazySampleComponents.get(sample.id)
    if (!SampleComponent) throw new Error(`The ${sample.subject} Director sample component is unavailable.`)
    return (
      <Suspense fallback={<main aria-busy="true">Opening the {sample.subject} lesson sample.</main>}>
        <SampleComponent />
      </Suspense>
    )
  }

  return (
    <main className="director-review-home director-review-not-found">
      <p className="director-review-eyebrow">Development review build</p>
      <h1>Review route not found</h1>
      <p>This address is not a registered Director lesson sample.</p>
      <a className="director-review-open" href={DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH}>Return to lesson samples</a>
    </main>
  )
}
