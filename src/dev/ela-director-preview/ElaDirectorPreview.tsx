import { useEffect } from 'react'
import preview from './samplePreviewData.generated.json'
import './ela-director-preview.css'

type TextRecord = typeof preview.model.text
type GuidedTask = (typeof preview.guidedPractice.tasks)[number]

function Passage({ text }: { readonly text: TextRecord }) {
  return (
    <article className="ela-preview-passage" aria-label={text.title}>
      <header>
        <div>
          <p className="ela-preview-eyebrow">{text.role} text · {text.form.replaceAll('_', ' ')}</p>
          <h3>{text.title}</h3>
          <p>by {text.creator}</p>
        </div>
        <span>{text.complexity_review.quantitative.word_count} words</span>
      </header>
      <div className="ela-preview-prose">
        {text.body_or_source_ref.split('\n\n').map((paragraph) => <p key={paragraph.slice(0, 20)}>{paragraph}</p>)}
      </div>
      <footer>
        <span>{text.access.location_markers}</span>
        <span>{text.complexity_review.grade_level_judgment.replaceAll('_', ' ')}</span>
      </footer>
    </article>
  )
}

function TaskCard({ task, label }: { readonly task: GuidedTask | typeof preview.independentPractice.task; readonly label: string }) {
  return (
    <article className="ela-preview-task">
      <p className="ela-preview-eyebrow">{label}</p>
      <h3>{task.task_ref.split('.').slice(-2).join(' · ').replaceAll('-', ' ')}</h3>
      <p className="ela-preview-prompt">{task.prompt}</p>
      {'fade_level' in task ? (
        <div className="ela-preview-support-grid">
          <div><strong>Before the attempt</strong>{task.support_before_attempt.map((item) => <p key={item}>{item}</p>)}</div>
          <div><strong>After the attempt</strong>{task.support_after_attempt.map((item) => <p key={item}>{item}</p>)}</div>
        </div>
      ) : (
        <div className="ela-preview-boundary"><strong>Independent authorship boundary</strong><p>{task.independence_boundary}</p></div>
      )}
    </article>
  )
}

function SectionHeading({ number, eyebrow, title, copy }: {
  readonly number: string
  readonly eyebrow: string
  readonly title: string
  readonly copy: string
}) {
  return (
    <header className="ela-preview-section-heading">
      <span>{number}</span>
      <div><p className="ela-preview-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>
    </header>
  )
}

export default function ElaDirectorPreview() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'ELA Director Sample R1 · Manuel Academy'
    return () => { document.title = previousTitle }
  }, [])

  return (
    <div className="ela-preview-shell" data-ela-director-preview={preview.previewContract}>
      <header className="ela-preview-hero">
        <nav aria-label="Preview context">
          <a href="#overview" className="ela-preview-brand"><span>MA</span> Manuel Academy</a>
          <div><span>Director sample</span><span className="ela-preview-status">Pending review</span></div>
        </nav>
        <div className="ela-preview-hero-grid" id="overview">
          <div>
            <p className="ela-preview-kicker">Grade {preview.lesson.grade} · Unit 5 · Lesson 3</p>
            <h1>Reasoning is the bridge.</h1>
            <p className="ela-preview-deck">A complete informational-text lesson on claims, evidence, and warrants—with grade-level reading, protected independent authorship, a fresh transfer check, and diagnosis-specific reteach.</p>
            <div className="ela-preview-chips">
              <span>{preview.lesson.estimatedMinutes} min</span>
              <span>{preview.lesson.profile.replaceAll('_', ' ')}</span>
              <span>{preview.lesson.standards.join(' · ')}</span>
            </div>
          </div>
          <aside>
            <p className="ela-preview-eyebrow">Today’s goal</p>
            <blockquote>{preview.lesson.learningGoal}</blockquote>
            <p>Say it plainly: a fact does not carry an argument by itself. Readers must test the connection.</p>
          </aside>
        </div>
      </header>

      <div className="ela-preview-layout">
        <aside className="ela-preview-rail">
          <p className="ela-preview-eyebrow">Lesson map</p>
          <a href="#launch"><span>01</span> Launch & language</a>
          <a href="#model"><span>02</span> Model the process</a>
          <a href="#guided"><span>03</span> Guided practice</a>
          <a href="#independent"><span>04</span> Independent response</a>
          <a href="#mastery"><span>05</span> Fresh mastery</a>
          <a href="#reteach"><span>06</span> Reteach route</a>
          <a href="#evidence"><span>07</span> Director evidence</a>
        </aside>

        <main className="ela-preview-content">
          <section id="launch">
            <SectionHeading number="01" eyebrow="Launch & language" title="Make the invisible reasoning visible" copy="Background and precise vocabulary lower access burden without rewriting the source or answering the learner’s work." />
            <div className="ela-preview-direction-list">
              {preview.directions.map((direction, index) => <p key={direction}><span>{index + 1}</span>{direction}</p>)}
            </div>
            <div className="ela-preview-teaching-grid">
              {preview.contextAndTeaching.map((block) => (
                <article key={block.teaching_block_ref}>
                  <p className="ela-preview-eyebrow">Explicit teaching</p>
                  <h3>{block.title}</h3>
                  <p>{block.explanation}</p>
                  <div><strong>Watch the confusion</strong><p>{block.confusion_contrast}</p></div>
                  <blockquote>{block.learner_decision}</blockquote>
                </article>
              ))}
            </div>
            <div className="ela-preview-vocabulary">
              {preview.vocabulary.map((entry) => (
                <article key={entry.vocabulary_ref}>
                  <h3>{entry.term}</h3>
                  <p>{entry.learner_support}</p>
                  <span>{entry.support_types.map((item) => item.replaceAll('_', ' ')).join(' · ')}</span>
                </article>
              ))}
            </div>
          </section>

          <section id="model">
            <SectionHeading number="02" eyebrow="Modeled reading" title="Notice, consider, decide, explain" copy="The complete model is safe to reveal because it uses a separate source and a separate question." />
            <Passage text={preview.model.text} />
            <div className="ela-preview-model">
              <p className="ela-preview-prompt">{preview.model.prompt}</p>
              <ol>
                {preview.model.thinkAloudSteps.map((step, index) => (
                  <li key={step.notice}>
                    <span>{index + 1}</span>
                    <div><strong>I notice</strong><p>{step.notice}</p><strong>I consider</strong><p>{step.possibilities}</p><strong>I decide—and why</strong><p>{step.decision} {step.reason}</p></div>
                  </li>
                ))}
              </ol>
              <article><p className="ela-preview-eyebrow">Completed model response · not the protected prompt</p><p>{preview.model.completedModelResponse}</p></article>
            </div>
          </section>

          <section id="guided">
            <SectionHeading number="03" eyebrow="Guided comprehension" title="Support the attempt, then fade" copy="The learner still chooses a location, evidence, warrant, and response to the counterpoint." />
            <Passage text={preview.guidedPractice.text} />
            <aside className="ela-preview-check"><strong>Comprehension check</strong><p>{preview.guidedPractice.comprehensionCheck.prompt}</p><span>{preview.guidedPractice.comprehensionCheck.feedback_move}</span></aside>
            <div className="ela-preview-task-stack">
              {preview.guidedPractice.tasks.map((task, index) => <TaskCard key={task.task_ref} task={task} label={`Guided attempt ${index + 1} · ${task.fade_level} support`} />)}
            </div>
          </section>

          <section id="independent">
            <SectionHeading number="04" eyebrow="Independent comprehension & writing" title="Read a sustained argument. Make your own case." copy="The source keeps its qualifications and competing priorities. Navigation support remains; content decisions belong to the learner." />
            <Passage text={preview.independentPractice.text} />
            <aside className="ela-preview-check"><strong>Mid-read navigation check</strong><p>{preview.independentPractice.navigationCheck.prompt}</p><span>{preview.independentPractice.navigationCheck.answer_protection}</span></aside>
            <TaskCard task={preview.independentPractice.task} label="Protected independent response" />
            <div className="ela-preview-scaffolds">
              {preview.independentPractice.scaffolds.map((scaffold) => (
                <article key={scaffold.scaffold_ref}>
                  <p className="ela-preview-eyebrow">{scaffold.stage} scaffold</p>
                  <h3>{scaffold.genre_or_task}</h3>
                  <p>{scaffold.support}</p>
                  <small>{scaffold.authorship_boundary}</small>
                </article>
              ))}
            </div>
            <article className="ela-preview-revision">
              <p className="ela-preview-eyebrow">Meaning-level revision</p>
              <h3>Keep the before and after</h3>
              <p>{preview.independentPractice.revision.prompt}</p>
              <div>{preview.independentPractice.revision.revision_lenses.map((lens) => <span key={lens}>{lens}</span>)}</div>
            </article>
          </section>

          <section id="mastery">
            <SectionHeading number="05" eyebrow="Fresh mastery evidence" title="New setting. Same reasoning demand." copy="No model, selected evidence, response frame, rubric coaching, or correctness feedback appears before submission." />
            <Passage text={preview.freshMastery.text} />
            <TaskCard task={preview.freshMastery.task} label="Fresh independent transfer" />
            <div className="ela-preview-independence-line">
              <span>Condition: {preview.freshMastery.evidenceDefinition.condition}</span>
              <span>Fresh transfer: {String(preview.freshMastery.evidenceDefinition.fresh_transfer)}</span>
              <span>Occasion: {preview.freshMastery.evidenceDefinition.occasion_id}</span>
            </div>
          </section>

          <section id="reteach">
            <SectionHeading number="06" eyebrow="Remediation & reteach" title="Isolate the missing bridge—then return" copy="This route activates for an observable pattern, teaches differently, checks independently, and returns to grade-level transfer." />
            <aside className="ela-preview-trigger"><strong>Route trigger</strong><p>{preview.remediation.trigger}</p></aside>
            <div className="ela-preview-teaching-grid single">
              <article><p className="ela-preview-eyebrow">Different instruction</p><h3>{preview.remediation.teaching.title}</h3><p>{preview.remediation.teaching.explanation}</p><blockquote>{preview.remediation.teaching.learner_decision}</blockquote></article>
            </div>
            <Passage text={preview.remediation.modelText} />
            <TaskCard task={preview.remediation.guidedTask} label="Reteach guided attempt" />
            <Passage text={preview.remediation.recheckText} />
            <TaskCard task={preview.remediation.recheckTask} label="Fresh independent recheck" />
            <p className="ela-preview-return">Recheck success is prerequisite evidence only. Return to <strong>{preview.remediation.returnTaskRef}</strong> before claiming grade-level success.</p>
          </section>

          <section id="evidence">
            <SectionHeading number="07" eyebrow="Director evidence" title="Curriculum supply, not Tutor runtime" copy="The sample declares content and evidence relationships only. It creates no Tutor V2 behavior, mastery state, provider prompt, or scoring runtime." />
            <div className="ela-preview-evidence-grid">
              {Object.entries(preview.tutorReadiness.contentInventory).map(([label, value]) => <article key={label}><strong>{value}</strong><span>{label.replace(/([A-Z])/g, ' $1')}</span></article>)}
            </div>
            <div className="ela-preview-review-note">
              <div><p className="ela-preview-eyebrow">Browser boundary</p><h3>Protected authority stays out.</h3><p>{preview.review.protectedAuthorityNote}</p></div>
              <dl>
                <div><dt>Canonical sample</dt><dd>{preview.review.canonicalSample}</dd></div>
                <div><dt>Contract schema</dt><dd>{preview.review.contractSchema}</dd></div>
                <div><dt>Human review</dt><dd>{preview.review.humanReviewRef}</dd></div>
                <div><dt>Tutor manifest</dt><dd>{preview.tutorReadiness.dataOnly ? 'Data-only · no runtime' : 'Review required'}</dd></div>
              </dl>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
