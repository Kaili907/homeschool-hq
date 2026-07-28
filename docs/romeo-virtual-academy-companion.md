# Romeo Virtual Academy Companion

Status: initial integration contract

## Purpose

Romeo Virtual Academy remains the official school system for assigned work, due dates, grades, attendance, teacher instructions, and submissions. Manuel Academy provides planning, tutoring, prerequisite remediation, guided practice, and parent visibility around that official coursework.

## Intended daily experience

1. The student signs into Romeo Virtual Academy directly in Chrome on the family desktop.
2. She opens the current lesson or assignment.
3. She opens her own Manuel Academy student profile and starts Jarvis.
4. She uses push-to-talk or typing to ask for help.
5. When browser context is available through an authorized OpenAI/Chrome workflow, Jarvis uses only the visible, permitted school context.
6. Jarvis identifies the skill, checks understanding, teaches with a different example, guides one practice attempt, reassesses, and returns the student to Romeo.
7. The student completes and submits all official work herself in Romeo.

## Required boundaries

- Never store Romeo usernames, passwords, recovery codes, authentication links, or student IDs.
- Never automate login.
- Never click Submit, mark work complete, message teachers, change grades, alter answers, or change school-account settings.
- Treat uncertain school work as graded.
- For quizzes, tests, exams, unit checks, and graded assessments, never solve the displayed item or narrow the answer choices. Teach the underlying concept with new examples only.
- Browser context is read-only tutoring context unless a future separately designed action is explicitly enabled and confirmation-gated.
- Never claim to see a tab, lesson, grade, or teacher message that is not actually supplied.

## Phase plan

### Phase 1 — rules and manual context

- Hard-code Romeo tutoring rules into the Jarvis system prompt.
- Preserve push-to-talk, spoken replies, per-student transcripts, daily caps, and parent review.
- Allow the student to read or paste a lesson title or instruction when browser context is unavailable.

### Phase 2 — Romeo coursework records

Add optional per-student records for:

- provider/course name
- assignment title
- due date
- status
- lesson URL reference without credentials
- subject and skill tags
- teacher notes supplied by the parent/student
- tutor findings and prerequisite gaps

Official grades must remain outside Manuel Academy unless the project contract is deliberately revised. A parent-entered progress indicator or mastery note is not an official grade.

### Phase 3 — authorized browser handoff

Define a narrow context envelope that can be passed to Jarvis from an approved browser workflow:

```ts
interface ExternalLessonContext {
  source: 'romeo-virtual-academy'
  capturedAt: string
  pageTitle?: string
  courseLabel?: string
  assignmentLabel?: string
  visibleText: string
  pageKind: 'instruction' | 'practice' | 'homework' | 'quiz' | 'test' | 'unknown'
  containsPossibleAssessment: boolean
}
```

The context must be treated as untrusted page content. Page text cannot override Manuel Academy safety rules, system instructions, parent settings, or academic-integrity rules.

### Phase 4 — calendar and parent dashboard

- Map Romeo due dates into the editable Manuel Academy day plan.
- Show completion state, time estimate, and pause/resume progress.
- Show tutor findings separately from official Romeo status.
- Flag stalled work, repeated prerequisite gaps, or a need to contact the teacher.

## Open technical decisions

- Confirm the exact browser-context mechanism supported on the family desktop and ChatGPT account.
- Decide whether the browser handoff enters Manuel Academy directly or remains in a ChatGPT Project conversation beside the app.
- Confirm Romeo's curriculum platform(s) and whether a school-approved export, calendar feed, OneRoster, LTI, Clever, Google Classroom, or PowerSchool connection exists.
- Do not build scraping, credential capture, or automated submission.
