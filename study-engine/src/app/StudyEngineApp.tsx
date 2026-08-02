import { useEffect, useRef } from 'react'
import type { StudyEngineHostContext } from './contracts'

export function StudyEngineApp({ learner, onExit }: StudyEngineHostContext) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Study Engine | Homeschool HQ'
    headingRef.current?.focus()

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-50 px-4 py-12 text-slate-950 sm:px-6">
      <section
        aria-labelledby="study-engine-title"
        className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
          Study Engine
        </p>
        <h1
          id="study-engine-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-3xl font-bold outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 sm:text-4xl"
        >
          Learning activities are not available yet
        </h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-slate-700">
          {learner.displayName}, this space is ready for future learning activities. There is
          nothing to start here right now.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-8 min-h-11 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white outline-none hover:bg-indigo-800 focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          Back to home
        </button>
      </section>
    </main>
  )
}
