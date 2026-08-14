import lesson from '../../../../curriculum-production/final/health-physical-education/packages/physical-education/grade-12/ma-g12-physical-education-u08-l07.json'
import './physicalEducationDirectorPreview.css'

const SECTIONS = [
  ['goal', 'Goal & setup'],
  ['model', 'Decision model'],
  ['guided', 'Guided practice'],
  ['progression', 'Progression'],
  ['independent', 'Independent activity'],
  ['adaptations', 'Adaptations'],
  ['safety', 'Safety authority'],
  ['evidence', 'Evidence & retry'],
] as const

const ADAPTATION_LABELS: Readonly<Record<keyof typeof lesson.adaptationRoutes, string>> = {
  seated: 'Seated',
  supported: 'Supported',
  reducedRange: 'Reduced range',
  reducedPaceOrDemand: 'Reduced pace / demand',
  mobilityAidCompatible: 'Mobility-aid compatible',
  solo: 'Solo',
  lowSpace: 'Low space',
  noEquipment: 'No equipment',
  describedOrDecisionRoute: 'Described / decision route',
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="pe-review__section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  )
}

export function PhysicalEducationDirectorPreview() {
  return (
    <main className="pe-review">
      <header className="pe-review__topbar">
        <a className="pe-review__brand" href="#goal" aria-label="Manuel Academy Physical Education Director sample">
          <span aria-hidden="true">MA</span>
          <div><strong>Manuel Academy</strong><small>Physical Education · Director sample R1</small></div>
        </a>
        <div className="pe-review__dev-badge"><span>Development preview</span><small>Real lesson data · no deployment</small></div>
      </header>

      <div className="pe-review__shell">
        <aside className="pe-review__rail">
          <div className="pe-review__identity">
            <span>Representative lesson</span>
            <strong>{lesson.lessonId}</strong>
            <small>Grade {lesson.grade} · Unit {lesson.unitNumber}</small>
          </div>
          <nav aria-label="Lesson review sections">
            {SECTIONS.map(([id, label], index) => <a key={id} href={`#${id}`}><span>{index + 1}</span>{label}</a>)}
          </nav>
          <div className="pe-review__rail-note">
            <strong>Primary type</strong>
            <span>{lesson.primaryLessonType.replaceAll('_', ' ')}</span>
            <p>Decision teaching replaces the baseline locomotor shell.</p>
          </div>
        </aside>

        <article className="pe-review__lesson">
          <section className="pe-review__hero" aria-labelledby="lesson-title">
            <div className="pe-review__hero-kicker"><span>Grade {lesson.grade}</span><span>{lesson.estimatedMinutes}</span><span>No movement required</span></div>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p className="pe-review__essential">{lesson.essentialQuestion}</p>
            <div className="pe-review__goal-card">
              <span>Your goal</span>
              <p>{lesson.goal}</p>
            </div>
            <details className="pe-review__standards">
              <summary>Standards and canonical source title</summary>
              <p><strong>Source title:</strong> {lesson.sourceTitle}</p>
              <ul>{lesson.standards.map((standard) => <li key={standard}>{standard}</li>)}</ul>
            </details>
          </section>

          <section id="goal" className="pe-review__section" aria-labelledby="goal-heading">
            <SectionHeading eyebrow="1 · Get ready" title="A complete lesson from one safe place" copy="The assessed task is fictional decision work. No exercise, symptom, injury, equipment failure, or real stop event is needed." />
            <div className="pe-review__readiness">
              {lesson.readinessCheck.map((item, index) => <article key={item}><span>{index + 1}</span><p>{item}</p></article>)}
            </div>
            <div className="pe-review__two-column">
              <div className="pe-review__panel"><h3>Space</h3><p>{lesson.spaceSetup}</p></div>
              <div className="pe-review__panel"><h3>Materials</h3><ul>{lesson.materials.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <div className="pe-review__na"><strong>Warm-up and cool-down: not applicable</strong><p>{lesson.warmUpAndFinishPolicy.rationale}</p></div>
          </section>

          <section id="model" className="pe-review__section" aria-labelledby="model-heading">
            <SectionHeading eyebrow="2 · Learn the rule" title="Three lanes. Four cues." copy="Each lane names the starting condition, next action, common error, and correction." />
            <div className="pe-review__cue-strip" aria-label="NOTICE PAUSE ACT HOLD">
              {lesson.movementCues.map((cue) => {
                const [lead, rest] = cue.split(' — ')
                return <div key={cue}><strong>{lead}</strong><span>{rest}</span></div>
              })}
            </div>
            <div className="pe-review__lane-grid">
              {lesson.decisionLanes.map((lane) => (
                <article key={lane.id} className={`pe-review__lane pe-review__lane--${lane.id}`}>
                  <div className="pe-review__lane-title"><span aria-hidden="true" /><h3>{lane.label}</h3></div>
                  <dl>
                    <div><dt>Start here when</dt><dd>{lane.startingPosition}</dd></div>
                    <div><dt>Action</dt><dd>{lane.action}</dd></div>
                    <div><dt>Key cue</dt><dd><strong>{lane.keyCue}</strong></dd></div>
                    <div><dt>Common error</dt><dd>{lane.commonError}</dd></div>
                    <div><dt>Correction</dt><dd>{lane.correction}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <article className="pe-review__worked-model">
              <span>Worked decision model</span><h3>{lesson.decisionModel.title}</h3><p className="pe-review__scenario">{lesson.decisionModel.scenario}</p>
              <ol>
                <li><strong>Starting position</strong><p>{lesson.decisionModel.startingPosition}</p></li>
                <li><strong>Notice</strong><p>{lesson.decisionModel.notice}</p></li>
                <li><strong>Decide</strong><p>{lesson.decisionModel.decision}</p></li>
                <li><strong>Act</strong><p>{lesson.decisionModel.action}</p></li>
              </ol>
              <div className="pe-review__model-check"><strong>Notice this</strong><p>{lesson.decisionModel.whatToNotice}</p><small>{lesson.decisionModel.safetyBoundary}</small></div>
            </article>
          </section>

          <section id="guided" className="pe-review__section" aria-labelledby="guided-heading">
            <SectionHeading eyebrow="3 · Try with support" title="Guided first decisions" copy="The support question narrows attention to supplied facts; the feedback explains the lane before coaching fades." />
            <div className="pe-review__guided-list">
              {lesson.guidedPractice.map((attempt, index) => (
                <article key={attempt.id}>
                  <div><span>{String(index + 1).padStart(2, '0')}</span><h3>{attempt.prompt}</h3></div>
                  <p className="pe-review__scenario">{attempt.scenario}</p>
                  <details><summary>Open coaching support</summary><p><strong>Focus question:</strong> {attempt.support}</p><p><strong>Feedback:</strong> {attempt.feedback}</p></details>
                </article>
              ))}
            </div>
          </section>

          <section id="progression" className="pe-review__section" aria-labelledby="progression-heading">
            <SectionHeading eyebrow="4 · Build control" title="One variable changes at a time" copy="The learner may remain, repeat, rest, or change response mode at every round." />
            <div className="pe-review__progression">
              {lesson.practiceProgression.map((round) => (
                <article key={round.round}><span>{round.round}</span><div><h3>{round.name}</h3><p>{round.task}</p><dl><div><dt>What changes</dt><dd>{round.changedVariable}</dd></div><div><dt>Success check</dt><dd>{round.successCheck}</dd></div><div><dt>Your control</dt><dd>{round.learnerChoice}</dd></div></dl></div></article>
              ))}
            </div>
          </section>

          <section id="independent" className="pe-review__section" aria-labelledby="independent-heading">
            <SectionHeading eyebrow="5 · Apply independently" title={lesson.independentActivity.title} copy="These fresh cards do not repeat the worked scenarios. The coaching boundary stays visible." />
            <ol className="pe-review__directions">{lesson.independentActivity.directions.map((direction) => <li key={direction}>{direction}</li>)}</ol>
            <div className="pe-review__scenario-grid">
              {lesson.independentActivity.scenarios.map((scenario, index) => <article key={scenario.id}><span>Fresh {String(index + 1).padStart(2, '0')}</span><p>{scenario.text}</p><div aria-label="Learner response fields preview"><small>Lane</small><small>Controlling fact</small><small>Next action</small><small>Return authority</small></div></article>)}
            </div>
            <div className="pe-review__protocol"><strong>Finish with your adult-habit protocol</strong><p>{lesson.independentActivity.protocolPrompt}</p></div>
            <p className="pe-review__boundary"><strong>Independent means:</strong> {lesson.independentActivity.independenceBoundary}</p>
          </section>

          <section id="adaptations" className="pe-review__section" aria-labelledby="adaptations-heading">
            <SectionHeading eyebrow="6 · Choose your route" title="Equal credit is built in" copy="Choose or change a route without explaining why. Body position, range, pace, and equipment are not scored." />
            <p className="pe-review__lead">{lesson.accessibleAdaptation}</p>
            <div className="pe-review__adaptation-grid">
              {(Object.entries(lesson.adaptationRoutes) as [keyof typeof lesson.adaptationRoutes, string][]).map(([key, value]) => <article key={key}><h3>{ADAPTATION_LABELS[key]}</h3><p>{value}</p></article>)}
            </div>
          </section>

          <section id="safety" className="pe-review__section" aria-labelledby="safety-heading">
            <SectionHeading eyebrow="7 · Use the right authority" title="Rest is a choice. Stop is a boundary." copy="The three rules are intentionally separate at the point of decision." />
            <div className="pe-review__safety-stack">
              {lesson.stoppingRules.map((rule, index) => {
                const [lead, rest] = rule.split(': ')
                return <article key={rule} data-rule={index}><strong>{lead}</strong><p>{rest}</p></article>
              })}
            </div>
            <div className="pe-review__guardian">
              <span>{lesson.guardianAuthority.level.replaceAll('_', ' ')}</span><h3>Guardian authority is preserved</h3><p>{lesson.guardianAuthority.requiredAction}</p><p><strong>Confirmation boundary:</strong> {lesson.guardianAuthority.confirmationBoundary}</p><p><strong>When unavailable:</strong> {lesson.guardianAuthority.equalCreditAlternative}</p>
            </div>
          </section>

          <section id="evidence" className="pe-review__section" aria-labelledby="evidence-heading">
            <SectionHeading eyebrow="8 · Show learning and retry" title="Small evidence. Honest authority." copy="A human reviews decision quality. No physical completion is claimed." />
            <div className="pe-review__two-column">
              <div className="pe-review__panel"><h3>Evidence expected</h3><ul>{lesson.evidenceExpectations.learnerEvidence.map((item) => <li key={item}>{item}</li>)}</ul><p><strong>Physical completion:</strong> {lesson.evidenceExpectations.physicalCompletion.replaceAll('_', ' ')}</p></div>
              <div className="pe-review__panel"><h3>Do not collect</h3><ul>{lesson.evidenceExpectations.doNotCollect.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <article className="pe-review__retry">
              <span>Different teaching, then a fresh retry</span><h3>Retry path</h3>
              <ol><li><strong>Notice the gap</strong><p>{lesson.retryPlan.trigger}</p></li><li><strong>Simplify</strong><p>{lesson.retryPlan.simplerSetup}</p></li><li><strong>Change the cue</strong><p>{lesson.retryPlan.differentCue}</p></li><li><strong>Contrast</strong><p>{lesson.retryPlan.alternateModel}</p></li><li><strong>Fresh retry</strong><p>{lesson.retryPlan.freshRetry}</p></li><li><strong>Exit</strong><p>{lesson.retryPlan.exitCriterion}</p></li></ol>
            </article>
            <div className="pe-review__tutor"><div aria-hidden="true">J</div><div><span>Future Tutor · curriculum metadata only</span><h3>Coach the presentation, never claim the event</h3><p><strong>May:</strong> {lesson.tutorMetadata.may.join('; ')}.</p><p><strong>Must not:</strong> {lesson.tutorMetadata.mustNot.join('; ')}.</p></div></div>
          </section>
        </article>
      </div>
    </main>
  )
}
