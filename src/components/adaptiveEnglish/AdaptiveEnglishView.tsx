import { useEffect, useMemo, useRef } from 'react'
import type { TutorResponse, VisualBoardCommand } from '../../../adaptive-tutor/core/index.js'
import type { EnglishModulePackage } from '../../../adaptive-tutor/subjects/english/src/index.js'
import {
  adaptiveEnglishClassification,
  adaptiveEnglishModules,
  boardCommandText,
  chooseEnglishOption,
  continueEnglishSession,
  createEnglishAdultReview,
  ENGLISH_MODE_LABELS,
  moduleById,
  openEnglishModule,
  requestEnglishAlternate,
  requestEnglishSupport,
  returnToEnglishLesson,
  saveLearnerWriting,
  submitEnglishChoice,
  updateActiveEnglishSession,
  visibleEnglishResponse,
  type EnglishAdultReview,
  type EnglishTutorSession,
  type EnglishWorkspaceState,
} from '../../adaptiveEnglish/hostAdapter'

interface Props {
  profileId: string
  profileName: string
  workspace: EnglishWorkspaceState
  onWorkspaceChange: (update: (previous: EnglishWorkspaceState) => EnglishWorkspaceState) => void
  onSaveAdultReview: (review: EnglishAdultReview) => void
  onHome: () => void
}

const focusClass =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

export function AdaptiveEnglishView({
  profileId,
  profileName,
  workspace,
  onWorkspaceChange,
  onSaveAdultReview,
  onHome,
}: Props) {
  const activeModule = workspace.activeLessonId ? moduleById(workspace.activeLessonId) : null
  const activeSession = activeModule ? workspace.sessions[activeModule.lessonId] : null

  if (!activeModule || !activeSession) {
    return (
      <EnglishModuleLibrary
        profileName={profileName}
        workspace={workspace}
        onOpen={(lessonId) => onWorkspaceChange((previous) => openEnglishModule(previous, lessonId))}
        onHome={onHome}
      />
    )
  }

  return (
    <EnglishLesson
      profileId={profileId}
      module={activeModule}
      session={activeSession}
      onSessionChange={(update) =>
        onWorkspaceChange((previous) => updateActiveEnglishSession(previous, update))
      }
      onSaveAdultReview={onSaveAdultReview}
      onModules={() =>
        onWorkspaceChange((previous) => ({ ...previous, activeLessonId: null }))
      }
      onHome={onHome}
    />
  )
}

function EnglishModuleLibrary({
  profileName,
  workspace,
  onOpen,
  onHome,
}: {
  profileName: string
  workspace: EnglishWorkspaceState
  onOpen: (lessonId: string) => void
  onHome: () => void
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">
              Adaptive English
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Choose a lesson, {profileName}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Four local-only reading and writing lessons. Your answers guide the teaching path,
              but one response never becomes a label or a placement decision.
            </p>
          </div>
          <button
            type="button"
            onClick={onHome}
            className={`min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 ${focusClass}`}
          >
            Home
          </button>
        </header>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {adaptiveEnglishModules.map((module, index) => {
            const resumed = Boolean(workspace.sessions[module.lessonId])
            return (
              <button
                type="button"
                key={module.lessonId}
                onClick={() => onOpen(module.lessonId)}
                className={`min-h-44 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md ${focusClass}`}
              >
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                  {index + 1} · {module.category} · {module.coreProgram.gradeBand.label}
                </span>
                <span className="mt-2 block text-xl font-black text-slate-900">
                  {module.completedModuleName}
                </span>
                <span className="mt-3 block break-all font-mono text-xs text-slate-500">
                  {module.lessonId}
                </span>
                <span className="mt-4 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
                  {resumed ? 'Resume lesson' : 'Start lesson'}
                </span>
              </button>
            )
          })}
        </div>

        <aside className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <strong>Frozen contract loaded:</strong>{' '}
          {adaptiveEnglishClassification.PASS_DIRECT_CORE_V0_2} direct Core mappings and{' '}
          {adaptiveEnglishClassification.PASS_PROVISIONAL_ADAPTER} subject-owned adapter mappings;
          no blocked Core changes.
        </aside>
      </div>
    </main>
  )
}

function EnglishLesson({
  profileId,
  module,
  session,
  onSessionChange,
  onSaveAdultReview,
  onModules,
  onHome,
}: {
  profileId: string
  module: EnglishModulePackage
  session: EnglishTutorSession
  onSessionChange: (
    update: (current: EnglishTutorSession, module: EnglishModulePackage) => EnglishTutorSession,
  ) => void
  onSaveAdultReview: (review: EnglishAdultReview) => void
  onModules: () => void
  onHome: () => void
}) {
  const response = visibleEnglishResponse(session, module)
  const snapshot = session.engine.getSnapshot()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const boardTitle = useMemo(
    () =>
      [...response.boardCommands]
        .reverse()
        .find((command) => command.kind === 'set-title')?.text ?? 'Teaching board',
    [response.boardCommands],
  )
  const selectedProbe = module.coreV02Extension.distinguishingProbes.find(
    (probe) => probe.misconceptionId === snapshot.selectedMisconceptionId,
  )
  const showRemediation =
    snapshot.selectedMisconceptionId !== null ||
    response.phase === 'identify-missing-concept' ||
    response.phase === 'reteach'

  useEffect(() => {
    headingRef.current?.focus()
  }, [response.id, session.supportMode])

  const speak = () => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      onSessionChange((current) => ({
        ...current,
        audioFallback: module.coreProgram.mediaFallback.missingAudioText,
      }))
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(response.spokenTurn.text)
      utterance.onerror = () =>
        onSessionChange((current) => ({
          ...current,
          audioFallback: module.coreProgram.mediaFallback.missingAudioText,
        }))
      window.speechSynthesis.speak(utterance)
      onSessionChange((current) => ({
        ...current,
        audioFallback: 'Browser narration requested. Captions and the transcript remain available.',
      }))
    } catch {
      onSessionChange((current) => ({
        ...current,
        audioFallback: module.coreProgram.mediaFallback.missingAudioText,
      }))
    }
  }

  const saveReview = () => {
    onSaveAdultReview(createEnglishAdultReview(profileId, module, session))
    onSessionChange((current) => ({
      ...current,
      answerFeedback: 'A session-only evidence summary is ready in the parent-PIN-gated English tab.',
    }))
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onModules}
              className={`min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-100 ${focusClass}`}
            >
              All lessons
            </button>
            <button
              type="button"
              onClick={onHome}
              className={`min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-100 ${focusClass}`}
            >
              Home
            </button>
          </div>
          <span className="max-w-full break-all rounded-full bg-white px-3 py-1 font-mono text-xs text-slate-500 shadow-sm">
            {module.lessonId}
          </span>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <section className="min-w-0 space-y-5">
            <div className="rounded-3xl bg-indigo-950 p-5 text-white shadow-lg sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-200">
                <span>{module.category}</span>
                <span aria-hidden="true">·</span>
                <span>{module.coreProgram.gradeBand.label}</span>
                <span aria-hidden="true">·</span>
                <span>{response.phase.replaceAll('-', ' ')}</span>
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-2xl font-black tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-3xl"
              >
                {module.completedModuleName}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-indigo-50" aria-live="polite">
                {response.learnerMessage}
              </p>
              <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-indigo-100">
                {response.uncertaintyStatement}
              </p>
            </div>

            <SupportModes
              activeMode={session.supportMode}
              onMode={(mode) => onSessionChange((current) => requestEnglishSupport(current, mode))}
            />

            <TeachingBoard title={boardTitle} response={response} fallback={module.coreProgram.mediaFallback.missingVisualText} />

            {response.assessmentItem && (
              <AssessmentCard
                response={response}
                selectedOptionId={session.selectedOptionId}
                feedback={session.answerFeedback}
                reasoning={session.reasoningReveal}
                onSelect={(optionId) =>
                  onSessionChange((current) => chooseEnglishOption(current, optionId))
                }
                onSubmit={() =>
                  onSessionChange((current, currentModule) =>
                    submitEnglishChoice(current, currentModule),
                  )
                }
              />
            )}

            {!response.assessmentItem && session.answerFeedback && (
              <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 font-semibold text-indigo-950" role="status">
                {session.answerFeedback}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {session.supportMode && (
                <button
                  type="button"
                  onClick={() => onSessionChange((current) => returnToEnglishLesson(current))}
                  className={`min-h-11 rounded-xl bg-indigo-700 px-5 py-3 font-black text-white hover:bg-indigo-800 ${focusClass}`}
                >
                  Return to lesson
                </button>
              )}
              {!session.supportMode && response.expectedInput === 'continue' && (
                <button
                  type="button"
                  onClick={() => onSessionChange((current) => continueEnglishSession(current))}
                  className={`min-h-11 rounded-xl bg-indigo-700 px-5 py-3 font-black text-white hover:bg-indigo-800 ${focusClass}`}
                >
                  Continue
                </button>
              )}
              {!session.supportMode && response.alternateExplanationAvailable && (
                <button
                  type="button"
                  onClick={() => onSessionChange((current) => requestEnglishAlternate(current))}
                  className={`min-h-11 rounded-xl border border-indigo-300 bg-white px-5 py-3 font-black text-indigo-800 hover:bg-indigo-50 ${focusClass}`}
                >
                  Try a different explanation
                </button>
              )}
              <button
                type="button"
                onClick={saveReview}
                className={`min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-100 ${focusClass}`}
              >
                Save notes for Grown-Ups
              </button>
            </div>

            {module.category === 'writing' && (
              <WritingStudio module={module} session={session} onSessionChange={onSessionChange} />
            )}

            {selectedProbe && (
              <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <h2 className="font-black">Why this support path?</h2>
                <p className="mt-1 text-sm">{selectedProbe.interpretation}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-800">
                  Distinguishing probe · {selectedProbe.assessmentItemIds.join(', ')}
                </p>
              </aside>
            )}

            {showRemediation && (
              <PrerequisiteSupport module={module} />
            )}
          </section>

          <aside className="min-w-0 space-y-4">
            <MediaPanel
              response={response}
              module={module}
              session={session}
              onSpeak={speak}
              onToggleTranscript={() =>
                onSessionChange((current) => ({
                  ...current,
                  transcriptOpen: !current.transcriptOpen,
                }))
              }
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-black text-slate-900">Session evidence</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Phase</dt>
                  <dd className="font-bold capitalize">{snapshot.phase.replaceAll('-', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Responses</dt>
                  <dd className="font-bold">{snapshot.observations.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Teaching cycles</dt>
                  <dd className="font-bold">{snapshot.cycleCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Core</dt>
                  <dd className="font-bold">v{module.coreProgram.version}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function SupportModes({
  activeMode,
  onMode,
}: {
  activeMode: EnglishTutorSession['supportMode']
  onMode: (mode: NonNullable<EnglishTutorSession['supportMode']>) => void
}) {
  return (
    <section aria-labelledby="support-mode-heading">
      <h2 id="support-mode-heading" className="text-sm font-black uppercase tracking-wider text-slate-600">
        Choose how I explain it
      </h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ENGLISH_MODE_LABELS.map((mode) => (
          <button
            type="button"
            key={mode.id}
            aria-pressed={activeMode === mode.id}
            onClick={() => onMode(mode.id)}
            className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-black ${focusClass} ${
              activeMode === mode.id
                ? 'border-indigo-700 bg-indigo-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function TeachingBoard({
  title,
  response,
  fallback,
}: {
  title: string
  response: TutorResponse
  fallback: string
}) {
  const cards = response.boardCommands
    .map((command) => ({ command, text: boardCommandText(command) }))
    .filter((entry): entry is { command: VisualBoardCommand; text: string } => Boolean(entry.text))
  return (
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5" aria-labelledby="english-board-title">
      <h2 id="english-board-title" className="text-lg font-black text-cyan-950">
        {title}
      </h2>
      {cards.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {cards.map(({ command, text }) => (
            <div key={command.id} className="min-w-0 rounded-xl bg-white p-4 font-semibold leading-relaxed text-slate-800 shadow-sm">
              {text}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-cyan-900">{fallback}</p>
      )}
    </section>
  )
}

function AssessmentCard({
  response,
  selectedOptionId,
  feedback,
  reasoning,
  onSelect,
  onSubmit,
}: {
  response: TutorResponse
  selectedOptionId: string
  feedback: string
  reasoning: EnglishTutorSession['reasoningReveal']
  onSelect: (optionId: string) => void
  onSubmit: () => void
}) {
  const item = response.assessmentItem
  if (!item || item.kind !== 'multiple-choice') return null
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`prompt-${item.id}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-indigo-700">
          {item.purpose.replaceAll('-', ' ')}
        </p>
        <span className="break-all font-mono text-xs text-slate-400">{item.id}</span>
      </div>
      <h2 id={`prompt-${item.id}`} className="mt-2 text-xl font-black leading-snug">
        {item.prompt}
      </h2>
      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Choose one response</legend>
        {item.options.map((option) => (
          <label
            key={option.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 font-semibold ${
              selectedOptionId === option.id
                ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                : 'border-slate-200 hover:border-indigo-300'
            }`}
          >
            <input
              type="radio"
              name={`english-option-${response.id}`}
              value={option.id}
              checked={selectedOptionId === option.id}
              onChange={() => onSelect(option.id)}
              className={`h-5 w-5 shrink-0 accent-indigo-700 ${focusClass}`}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        onClick={onSubmit}
        className={`mt-4 min-h-11 rounded-xl bg-indigo-700 px-5 py-3 font-black text-white hover:bg-indigo-800 ${focusClass}`}
      >
        Check my response
      </button>
      {feedback && (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 font-bold text-slate-800" role="status">
          {feedback}
        </p>
      )}
      {reasoning && reasoning.itemId === item.id && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
          <strong>{reasoning.correct ? 'Reasoning after your attempt:' : 'Check the reasoning after your attempt:'}</strong>{' '}
          {reasoning.reasoning}
        </div>
      )}
      {reasoning && reasoning.itemId !== item.id && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
          <strong>Reasoning for the response you just tried:</strong> {reasoning.reasoning}
        </div>
      )}
    </section>
  )
}

function WritingStudio({
  module,
  session,
  onSessionChange,
}: {
  module: EnglishModulePackage
  session: EnglishTutorSession
  onSessionChange: (
    update: (current: EnglishTutorSession, module: EnglishModulePackage) => EnglishTutorSession,
  ) => void
}) {
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5" aria-labelledby="writing-studio-title">
      <h2 id="writing-studio-title" className="text-lg font-black text-violet-950">
        Your writing studio
      </h2>
      <p className="mt-1 text-sm text-violet-900">{module.coreV02Extension.learnerAuthorshipPrompt}</p>
      <textarea
        value={session.writingDraft}
        onChange={(event) =>
          onSessionChange((current) => ({
            ...current,
            writingDraft: event.target.value,
            writingFeedback: '',
          }))
        }
        rows={6}
        maxLength={2000}
        aria-label="Your own English revision"
        className={`mt-3 w-full resize-y rounded-xl border border-violet-300 bg-white p-3 text-base leading-relaxed text-slate-900 ${focusClass}`}
        placeholder="Write or revise in your own words…"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-violet-800">{session.writingDraft.length}/2000 · session-only</span>
        <button
          type="button"
          onClick={() => onSessionChange((current) => saveLearnerWriting(current))}
          className={`min-h-11 rounded-xl bg-violet-700 px-5 py-3 font-black text-white hover:bg-violet-800 ${focusClass}`}
        >
          Keep my revision
        </button>
      </div>
      {session.writingFeedback && (
        <p className="mt-3 rounded-xl bg-white p-3 font-bold text-violet-950" role="status">
          {session.writingFeedback}
        </p>
      )}
      <p className="mt-3 text-xs text-violet-800">{module.coreV02Extension.gradedAssignmentBoundary}</p>
    </section>
  )
}

function PrerequisiteSupport({ module }: { module: EnglishModulePackage }) {
  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5" aria-labelledby="prerequisite-title">
      <h2 id="prerequisite-title" className="font-black text-orange-950">Prerequisite support</h2>
      <p className="mt-1 text-sm text-orange-900">
        These smaller steps return to the target skill; they do not replace the lesson.
      </p>
      <div className="mt-3 space-y-2">
        {module.coreV02Extension.prerequisiteRemediation.map((remediation) => (
          <details key={remediation.prerequisiteSkillId} className="rounded-xl bg-white p-3">
            <summary className={`cursor-pointer font-bold text-orange-950 ${focusClass}`}>
              {remediation.learnerPrompt}
            </summary>
            <p className="mt-2 text-sm text-slate-700">{remediation.trigger}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {remediation.completionEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}

function MediaPanel({
  response,
  module,
  session,
  onSpeak,
  onToggleTranscript,
}: {
  response: TutorResponse
  module: EnglishModulePackage
  session: EnglishTutorSession
  onSpeak: () => void
  onToggleTranscript: () => void
}) {
  const engineTranscript = session.engine.getSnapshot().transcript
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="media-title">
      <h2 id="media-title" className="font-black">Captions &amp; transcript</h2>
      <div className="mt-3 rounded-xl bg-slate-900 p-3 text-sm leading-relaxed text-white" aria-label="Always-visible caption">
        <span className="mr-2 font-black uppercase tracking-wider text-cyan-300">Caption</span>
        {response.spokenTurn.fallbackText}
      </div>
      <button
        type="button"
        onClick={onSpeak}
        className={`mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold hover:bg-slate-100 ${focusClass}`}
      >
        Play optional browser narration
      </button>
      <p className="mt-2 text-sm text-slate-600" role="status">{session.audioFallback}</p>
      <button
        type="button"
        aria-expanded={session.transcriptOpen}
        onClick={onToggleTranscript}
        className={`mt-3 min-h-11 w-full rounded-xl bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-900 ${focusClass}`}
      >
        {session.transcriptOpen ? 'Hide transcript' : 'Open transcript'}
      </button>
      {session.transcriptOpen && (
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-200 p-3" tabIndex={0}>
          <h3 className="font-black">Lesson transcript</h3>
          <ol className="mt-2 space-y-2 text-sm text-slate-700">
            {module.coreV02Extension.narration.transcript.map((turn) => (
              <li key={turn.id}>{turn.text}</li>
            ))}
          </ol>
          {engineTranscript.length > 0 && (
            <>
              <h3 className="mt-4 font-black">This session</h3>
              <ol className="mt-2 space-y-2 text-sm text-slate-700">
                {engineTranscript.map((turn, index) => (
                  <li key={`${turn.speaker}-${index}`}>
                    <strong className="capitalize">{turn.speaker}:</strong> {turn.text}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  )
}
