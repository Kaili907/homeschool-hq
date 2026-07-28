# Romeo Virtual Academy Companion

Status: Phase 1 implemented on `feature/romeo-virtual-academy-companion`; not merged

## Purpose

Romeo Virtual Academy remains the official school system for assigned work, due dates, grades, attendance, teacher instructions, and submissions. Manuel Academy provides planning, tutoring, prerequisite remediation, guided practice, and parent visibility around that official coursework.

## Intended daily experience

1. The student signs into Romeo Virtual Academy directly in Chrome on the family desktop.
2. She opens the current lesson or assignment.
3. She opens her own Manuel Academy student profile and starts Jarvis.
4. She attaches the relevant Romeo lesson title or directions in the session-only **Romeo lesson context** panel.
5. She uses push-to-talk or typing to ask for help.
6. Jarvis identifies the skill, checks understanding, teaches with a different example, guides one practice attempt, reassesses, and returns the student to Romeo.
7. The student completes and submits all official work herself in Romeo.

When the family uses ChatGPT Work with the official Chrome extension, that is a separate side-by-side tutoring path. Its project-specific rules are stored in `docs/chatgpt-project-instructions-manuel-academy.md`. The current Manuel Academy web app uses its existing Anthropic-backed Jarvis path; it does not silently inherit a ChatGPT Project or Chrome tab.

## Phase 1 implementation

Implemented:

- Romeo-specific academic-integrity and school-account rules are hard-coded into the Jarvis system prompt.
- A typed `ExternalLessonContext` contract carries only course/assignment labels, page classification, visible text, and capture time.
- The context is rendered inside explicit `BEGIN/END UNTRUSTED EXTERNAL LESSON CONTEXT` boundaries beneath the fixed safety rules.
- Unknown, quiz, and test pages are marked as possible graded assessments.
- Visible lesson text is capped at 8,000 characters before it reaches the model.
- The teen Jarvis card now has a collapsible **Romeo lesson context** panel.
- Context stays in React session state only. It is not written to `Profile`, localStorage, parent transcripts, grades, or progress records.
- Existing push-to-talk, spoken replies, transcripts, daily caps, concerning-content handling, and confirm-gated actions remain in place.
- Pure contract and prompt-path regression tests were added.

Not implemented:

- Automatic reading of Chrome tabs by the Manuel Academy app.
- A custom Manuel Academy Chrome extension or local native bridge.
- Login automation, scraping, assignment submission, grade synchronization, teacher messaging, or school-account changes.
- Direct transfer of ChatGPT Project memory into the in-app Anthropic Jarvis assistant.

## Required boundaries

- Never store Romeo usernames, passwords, recovery codes, authentication links, or student IDs.
- Never automate login.
- Never click Submit, mark work complete, message teachers, change grades, alter answers, or change school-account settings.
- Treat uncertain school work as graded.
- For quizzes, tests, exams, unit checks, and graded assessments, never solve the displayed item or narrow the answer choices. Teach the underlying concept with new examples only.
- Browser or pasted page context is read-only tutoring context unless a future separately designed action is explicitly enabled and confirmation-gated.
- Never claim to see a tab, lesson, grade, or teacher message that is not actually supplied.

## Phase plan

### Phase 1 — rules and manual context — implemented

- Hard-code Romeo tutoring rules into the Jarvis system prompt.
- Preserve push-to-talk, spoken replies, per-student transcripts, daily caps, and parent review.
- Provide a session-only manual context panel for lesson titles and relevant directions.
- Keep school context out of the persisted student profile and transcripts.

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

Use the same narrow context envelope for a future approved browser workflow:

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

A direct browser handoff requires a deliberately reviewed mechanism, such as a custom extension or local bridge. It must use explicit site permission, visible student initiation, a preview of captured text, and a no-submit/read-only action policy. Do not assume the official ChatGPT Chrome extension exposes its tab context to this separate web application.

### Phase 4 — calendar and parent dashboard

- Map Romeo due dates into the editable Manuel Academy day plan.
- Show completion state, time estimate, and pause/resume progress.
- Show tutor findings separately from official Romeo status.
- Flag stalled work, repeated prerequisite gaps, or a need to contact the teacher.

## Open technical decisions

- Decide whether Phase 3 should remain a ChatGPT Project conversation beside Manuel Academy or use a separately built Manuel Academy browser extension/local bridge.
- Confirm Romeo's curriculum platform(s) and whether a school-approved export, calendar feed, OneRoster, LTI, Clever, Google Classroom, or PowerSchool connection exists.
- Define parent-visible retention for optional Phase 2 assignment metadata before storing any school-derived data.
- Do not build scraping, credential capture, automated submission, or unofficial grade synchronization.
