import { DIRECTOR_LESSON_SAMPLES, DIRECTOR_REVIEW_PROMPTS } from './registry'
import './directorLessonSampleReview.css'

export function DirectorLessonSampleReviewHome() {
  return (
    <main className="director-review-home">
      <header className="director-review-hero">
        <p className="director-review-eyebrow">Development review build</p>
        <h1>Director lesson samples</h1>
        <p className="director-review-intro">
          Open each completed subject sample from one server. These are real lesson review routes backed by their subject data; the Director makes the decision.
        </p>
      </header>

      <section className="director-review-prompts" aria-labelledby="director-review-prompts-title">
        <h2 id="director-review-prompts-title">Questions to keep in mind</h2>
        <ul>
          {DIRECTOR_REVIEW_PROMPTS.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>

      <section aria-labelledby="director-review-available-title">
        <div className="director-review-section-heading">
          <div>
            <p className="director-review-eyebrow">Available now</p>
            <h2 id="director-review-available-title">Completed subject samples</h2>
          </div>
          <p className="director-review-count" aria-label={`${DIRECTOR_LESSON_SAMPLES.length} samples available`}>
            {DIRECTOR_LESSON_SAMPLES.length} samples
          </p>
        </div>

        <div className="director-review-grid">
          {DIRECTOR_LESSON_SAMPLES.map((sample) => (
            <article className="director-review-card" key={sample.id}>
              <div className="director-review-card-heading">
                <p className="director-review-grade">Grade {sample.grade}</p>
                <h3>{sample.subject}</h3>
              </div>
              <dl>
                <div>
                  <dt>Lesson</dt>
                  <dd>{sample.lessonTitle}</dd>
                </div>
                <div>
                  <dt>Lesson ref</dt>
                  <dd><code>{sample.lessonRef}</code></dd>
                </div>
                <div>
                  <dt>What this sample demonstrates</dt>
                  <dd>{sample.demonstrates}</dd>
                </div>
              </dl>
              <a className="director-review-open" href={sample.route} aria-label={`Open ${sample.subject} sample: ${sample.lessonTitle}`}>
                Open sample <span aria-hidden="true">→</span>
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
