import type { Profile } from '../../types'
import type { EnglishAdultReview } from '../../adaptiveEnglish/hostAdapter'

export function EnglishReviewPanel({
  profiles,
  reviews,
}: {
  profiles: Profile[]
  reviews: EnglishAdultReview[]
}) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        No Adaptive English session notes have been saved in this open app session.
      </div>
    )
  }

  const nameFor = (profileId: string) =>
    profiles.find((profile) => profile.id === profileId)?.name ?? 'Learner'

  return (
    <section aria-labelledby="english-review-heading" className="space-y-4">
      <div>
        <h2 id="english-review-heading" className="text-xl font-bold text-slate-900">
          Adaptive English evidence
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Parent/teacher observation notes only. These are session-local, are not grades,
          and do not make placement or diagnostic claims.
        </p>
      </div>
      {reviews.map((review) => (
        <article
          key={`${review.profileId}-${review.lessonId}`}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {nameFor(review.profileId)} · {review.category}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{review.moduleName}</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">{review.lessonId}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              Evidence: {review.coreReview.confidence.band}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ReviewList title="Look for" items={review.subjectNotes.lookFor} />
            <ReviewList title="Supportive language" items={review.subjectNotes.supportiveLanguage} />
            <ReviewList title="Avoid" items={review.subjectNotes.avoid} />
            <ReviewList title="Suggested next steps" items={review.coreReview.suggestedNextSteps} />
          </div>

          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {review.subjectNotes.masteryReminder}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {review.coreReview.uncertaintyStatement} Diagnostic claim:{' '}
            {String(review.coreReview.diagnosticClaimMade)} · High-stakes placement decision:{' '}
            {String(review.coreReview.highStakesPlacementDecisionMade)}
          </p>
        </article>
      ))}
    </section>
  )
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-bold text-slate-800">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None recorded.</p>
      )}
    </div>
  )
}
