import type { StudyStudentCapability } from './session'

/**
 * The browser client's own copy of the operation -> capability allow-list.
 *
 * One of three independent literals — this one, the Netlify gateway's, and
 * academy_private.study_runtime_operation_contract() in the database — kept as
 * separate lists on purpose, so a stale client cannot silently agree with the
 * server it no longer matches. supabase/academy-study-learner-runtime-operations.db.test.ts
 * executes the SQL authority and requires all three to be identical.
 *
 * This pure contract module is shared by the identity transport and the
 * verified runtime adapter so the adapter does not pull that transport into the
 * production learner surface's value import closure.
 *
 * preferences:write is absent by design: adult preferences are an adult/parent
 * authority operation and never ride a learner-session grant.
 */
export const STUDY_ACADEMIC_OPERATIONS = Object.freeze({
  'dashboard:read': 'student:progress:read',
  'calendar:read': 'student:assignments:read',
  'calendar:transition': 'student:attempts:create',
  'session:begin': 'student:attempts:create',
  'session:transition': 'student:attempts:create',
  'checkpoint:read': 'student:progress:read',
  'checkpoint:compare-and-swap': 'student:attempts:create',
  'event:append': 'student:attempts:create',
}) satisfies Readonly<Record<string, StudyStudentCapability>>

export type StudyAcademicOperation = keyof typeof STUDY_ACADEMIC_OPERATIONS
