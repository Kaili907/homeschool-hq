import { useEffect, useMemo, useState } from "react";
import type {
  SafetyCenterData,
  SafetyCenterActionResult,
  StudentRef,
  TutorPermissionSettings,
  Weekday,
} from "./contracts";
import { WEEKDAY_LABEL } from "./format";
import {
  InlineNotice,
  SectionHeading,
  StatusBadge,
  type DispatchSafetyCenterAction,
} from "./SafetyCenterCommon";

const WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function scheduleError(settings: TutorPermissionSettings): string | null {
  if (settings.schedule.allowedDays.length === 0) {
    return "Choose at least one allowed day.";
  }
  if (
    !/^\d{2}:\d{2}$/.test(settings.schedule.startsAtLocal) ||
    !/^\d{2}:\d{2}$/.test(settings.schedule.endsAtLocal)
  ) {
    return "Choose a valid start and end time.";
  }
  if (
    settings.schedule.maximumSessionMinutes < 5 ||
    settings.schedule.maximumSessionMinutes > 180
  ) {
    return "Session length must be between 5 and 180 minutes.";
  }
  if (
    settings.tutorEnabled &&
    !settings.subjects.some((subject) => subject.allowed)
  ) {
    return "Allow at least one subject while the tutor is enabled.";
  }
  return null;
}

export function ParentSafetyControls({
  studentRef,
  studentName,
  data,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly studentName: string;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [draft, setDraft] = useState<TutorPermissionSettings>(
    data.permissions,
  );
  const [dirty, setDirty] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    setDraft(data.permissions);
    setDirty(false);
    setValidationMessage("");
  }, [data.permissions]);

  const allowedSubjectCount = useMemo(
    () => draft.subjects.filter((subject) => subject.allowed).length,
    [draft.subjects],
  );

  function update(
    change: (current: TutorPermissionSettings) => TutorPermissionSettings,
  ): void {
    setDraft(change);
    setDirty(true);
    setValidationMessage("");
  }

  async function save(): Promise<void> {
    const error = scheduleError(draft);
    if (error) {
      setValidationMessage(error);
      return;
    }

    let result: SafetyCenterActionResult;
    try {
      result = await onAction({
        type: "permissions_update_requested",
        studentRef,
        expectedRevision: data.permissions.revision,
        settings: draft,
      });
    } catch {
      return;
    }
    if (result.status !== "rejected") setDirty(false);
  }

  const studentPaused = data.studentSafety.tutorPausedByStudent;

  return (
    <section aria-labelledby="parent-controls-heading">
      <SectionHeading
        id="parent-controls-heading"
        eyebrow="Parent controls"
        title="Tutor permissions"
        description={`Choose when and where ${studentName} can use the tutor. Safety reporting and required escalation stay available even when tutoring is paused.`}
        actions={
          <StatusBadge tone={draft.tutorEnabled ? "positive" : "warning"}>
            {draft.tutorEnabled ? "Tutor allowed" : "Tutor paused"}
          </StatusBadge>
        }
      />

      {studentPaused ? (
        <InlineNotice title={`${studentName} paused the tutor`} tone="warning">
          <p>
            Student pause controls work immediately. Check in before resuming
            the tutor.
          </p>
          <button
            className="masc-button masc-button-secondary"
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              void onAction({
                type: "tutor_resume_requested",
                studentRef,
                source: "parent_control",
              })
            }
          >
            Resume after check-in
          </button>
        </InlineNotice>
      ) : null}

      <form
        className="masc-controls-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className="masc-settings-card" aria-labelledby="access-heading">
          <div className="masc-settings-card-heading">
            <div>
              <p className="masc-card-number" aria-hidden="true">
                01
              </p>
              <h3 id="access-heading">Core access</h3>
            </div>
            <span className="masc-muted">
              Revision {data.permissions.revision}
            </span>
          </div>

          <div className="masc-toggle-list">
            <label className="masc-switch-row">
              <span>
                <strong>Allow AI tutor sessions</strong>
                <small>
                  Turn off to pause new sessions without deleting history.
                </small>
              </span>
              <input
                type="checkbox"
                checked={draft.tutorEnabled}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    tutorEnabled: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="masc-switch-row">
              <span>
                <strong>Allow text-to-speech playback</strong>
                <small>
                  Reads tutor text on the device. It does not play a raw
                  microphone recording.
                </small>
              </span>
              <input
                type="checkbox"
                checked={draft.voicePlaybackEnabled}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    voicePlaybackEnabled: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="masc-switch-row">
              <span>
                <strong>Allow open-ended topic exploration</strong>
                <small>
                  Subject, age, and safety policies still apply.
                </small>
              </span>
              <input
                type="checkbox"
                checked={draft.openEndedExplorationEnabled}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    openEndedExplorationEnabled: event.target.checked,
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="masc-settings-card" aria-labelledby="subjects-heading">
          <div className="masc-settings-card-heading">
            <div>
              <p className="masc-card-number" aria-hidden="true">
                02
              </p>
              <h3 id="subjects-heading">Allowed subjects</h3>
            </div>
            <span className="masc-muted">
              {allowedSubjectCount} of {draft.subjects.length} allowed
            </span>
          </div>
          <fieldset className="masc-subject-grid">
            <legend className="masc-sr-only">Choose allowed subjects</legend>
            {draft.subjects.map((subject) => (
              <label key={subject.subjectRef} className="masc-check-card">
                <input
                  type="checkbox"
                  checked={subject.allowed}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      subjects: current.subjects.map((currentSubject) =>
                        currentSubject.subjectRef === subject.subjectRef
                          ? {
                              ...currentSubject,
                              allowed: event.target.checked,
                            }
                          : currentSubject,
                      ),
                    }))
                  }
                />
                <span>{subject.label}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="masc-settings-card" aria-labelledby="schedule-heading">
          <div className="masc-settings-card-heading">
            <div>
              <p className="masc-card-number" aria-hidden="true">
                03
              </p>
              <h3 id="schedule-heading">Allowed session times</h3>
            </div>
            <span className="masc-muted">{draft.schedule.zoneId}</span>
          </div>

          <fieldset className="masc-day-picker">
            <legend>Allowed days</legend>
            <div>
              {WEEKDAYS.map((day) => {
                const selected = draft.schedule.allowedDays.includes(day);
                return (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        update((current) => {
                          const nextDays = event.target.checked
                            ? [...current.schedule.allowedDays, day]
                            : current.schedule.allowedDays.filter(
                                (currentDay) => currentDay !== day,
                              );
                          return {
                            ...current,
                            schedule: {
                              ...current.schedule,
                              allowedDays: nextDays,
                            },
                          };
                        })
                      }
                    />
                    <span>{WEEKDAY_LABEL[day]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="masc-form-grid masc-form-grid-three">
            <div className="masc-field">
              <label htmlFor="masc-session-start">Start time</label>
              <input
                id="masc-session-start"
                type="time"
                value={draft.schedule.startsAtLocal}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    schedule: {
                      ...current.schedule,
                      startsAtLocal: event.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="masc-field">
              <label htmlFor="masc-session-end">End time</label>
              <input
                id="masc-session-end"
                type="time"
                value={draft.schedule.endsAtLocal}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    schedule: {
                      ...current.schedule,
                      endsAtLocal: event.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="masc-field">
              <label htmlFor="masc-session-length">Maximum minutes</label>
              <input
                id="masc-session-length"
                type="number"
                min={5}
                max={180}
                step={5}
                value={draft.schedule.maximumSessionMinutes}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    schedule: {
                      ...current.schedule,
                      maximumSessionMinutes: Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section
          className="masc-settings-card"
          aria-labelledby="notifications-heading"
        >
          <div className="masc-settings-card-heading">
            <div>
              <p className="masc-card-number" aria-hidden="true">
                04
              </p>
              <h3 id="notifications-heading">Parent notifications</h3>
            </div>
          </div>

          <div className="masc-form-grid">
            <label className="masc-check-card">
              <input
                type="checkbox"
                checked={draft.notifications.inApp}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      inApp: event.target.checked,
                    },
                  }))
                }
              />
              <span>In-app notices</span>
            </label>
            <label className="masc-check-card">
              <input
                type="checkbox"
                checked={draft.notifications.emailOnFile}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      emailOnFile: event.target.checked,
                    },
                  }))
                }
              />
              <span>Email already on file</span>
            </label>
            <div className="masc-field">
              <label htmlFor="masc-notification-severity">
                Notify at or above
              </label>
              <select
                id="masc-notification-severity"
                value={draft.notifications.minimumSeverity}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      minimumSeverity: event.target.value as
                        | "low"
                        | "moderate"
                        | "high"
                        | "critical",
                    },
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Urgent adult check-in only</option>
              </select>
            </div>
          </div>

          <div className="masc-fixed-safeguard">
            <span>
              <strong>Transcript excerpts stay out of notifications</strong>
              <small>
                Open the authorized safety center to review an event in
                context. This safeguard cannot be turned off.
              </small>
            </span>
            <StatusBadge tone="positive">Always off</StatusBadge>
          </div>
        </section>

        <div className="masc-save-bar">
          <div>
            <strong>{dirty ? "Unsaved changes" : "Settings are up to date"}</strong>
            <p>
              Safety rules and student report controls cannot be turned off
              here.
            </p>
          </div>
          <button
            className="masc-button"
            type="submit"
            disabled={!dirty || pendingAction !== null}
          >
            {pendingAction === "permissions_update_requested"
              ? "Saving…"
              : "Save permissions"}
          </button>
        </div>
        <p
          className="masc-form-error"
          role="alert"
          aria-live="assertive"
        >
          {validationMessage}
        </p>
      </form>
    </section>
  );
}
