import {
  ACADEMY_SUBJECTS,
  type AcademyGrade,
  type AcademySubject,
  type Grade,
  type Profile,
} from '../../types'
import { ACADEMY_SUBJECT_LABELS } from '../../academy/contentTypes'
import { isAcademyGradeEnabledFromHost } from '../../academy/featureFlag'
import { setWorkingLevel, workingLevelFor } from '../../academy/workingLevel'

/**
 * ACADEMY-LEVEL-DECOUPLE — where a parent sets a girl's WORKING LEVEL, per
 * subject. Lives inside the Parent Hub, so it is already behind the parent PIN;
 * no student surface renders this component or any other control that writes
 * Profile.workingLevels.
 *
 * Deliberately a plain selector, not a wizard: the parent knows where her girl
 * places, and the app has no placement data that would justify guessing.
 * Choosing "Default" clears the override and the subject rides her nominal
 * grade again — which is exactly how every profile starts.
 */

interface Props {
  profiles: Profile[]
  onPatchProfile: (id: string, update: (prev: Profile) => Profile) => void
}

/** Levels the curriculum release actually publishes content for. */
const ACADEMY_LEVELS: AcademyGrade[] = ['5', '7', '8']

export function AcademyLevelsPanel({ profiles, onPatchProfile }: Props) {
  return (
    <section
      aria-labelledby="academy-levels"
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 id="academy-levels" className="text-lg font-bold text-slate-900">
        Working levels
      </h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        The level each girl <em>works at</em>, per subject. This never changes her grade — grade
        stays her grade on every report. A subject left on “Default” follows her grade.
      </p>
      <div className="mt-4 space-y-4">
        {profiles.map((p) => (
          <LearnerLevels key={p.id} profile={p} onPatchProfile={onPatchProfile} />
        ))}
      </div>
    </section>
  )
}

function LearnerLevels({
  profile,
  onPatchProfile,
}: {
  profile: Profile
  onPatchProfile: Props['onPatchProfile']
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h3 className="font-bold text-slate-900">
        {profile.name}{' '}
        <span className="text-sm font-semibold text-slate-400">
          · Grade {profile.grade} (her grade — unchanged)
        </span>
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ACADEMY_SUBJECTS.map((subject) => (
          <SubjectLevel
            key={subject}
            profile={profile}
            subject={subject}
            onPatchProfile={onPatchProfile}
          />
        ))}
      </div>
    </div>
  )
}

function SubjectLevel({
  profile,
  subject,
  onPatchProfile,
}: {
  profile: Profile
  subject: AcademySubject
  onPatchProfile: Props['onPatchProfile']
}) {
  const label = ACADEMY_SUBJECT_LABELS[subject] ?? subject
  const explicit = profile.workingLevels?.[subject]
  const resolved = workingLevelFor(profile, subject)
  const reachable = ACADEMY_LEVELS.includes(resolved as AcademyGrade)
    ? isAcademyGradeEnabledFromHost(resolved as AcademyGrade)
    : false
  const selectId = `level-${profile.id}-${subject}`

  return (
    <label htmlFor={selectId} className="block text-sm font-bold text-slate-700">
      {label}
      <select
        id={selectId}
        value={explicit ?? ''}
        onChange={(e) =>
          onPatchProfile(profile.id, (prev) =>
            setWorkingLevel(prev, subject, (e.target.value || null) as Grade | null),
          )
        }
        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold"
      >
        <option value="">Default — Grade {profile.grade}</option>
        {ACADEMY_LEVELS.map((level) => (
          <option key={level} value={level}>
            Grade {level}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-semibold text-slate-500">
        {reachable
          ? `Working at Grade ${resolved}.`
          : `Working at Grade ${resolved} — no Academy content is enabled for that level, so she sees none.`}
      </span>
    </label>
  )
}
