import type {
  AuthorizationDecision,
  SafetyCenterRole,
  SafetyPermission,
  SafetyPrincipal,
  StudentTutorBlock,
  TutorAccessDecision,
  TutorAccessRequest,
  TutorPermissions,
  Weekday,
} from './contracts.ts'

export function authorizeStudentAccess(
  principal: SafetyPrincipal,
  studentId: string,
  allowedRoles: readonly SafetyCenterRole[],
  requiredPermission?: SafetyPermission,
): AuthorizationDecision {
  if (!principal.authenticated) return { allowed: false, reason: 'unauthenticated' }
  if (!allowedRoles.includes(principal.role)) {
    return { allowed: false, reason: 'role-not-allowed' }
  }
  const related =
    principal.role === 'student'
      ? principal.studentId === studentId
      : principal.authorizedStudentIds.includes(studentId)
  if (!related) return { allowed: false, reason: 'student-not-authorized' }
  if (requiredPermission && !principal.permissions.includes(requiredPermission)) {
    return { allowed: false, reason: 'permission-missing' }
  }
  return { allowed: true }
}

const weekdayOrder: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const parseMinutes = (localTime: string): number => {
  const [hour, minute] = localTime.split(':').map(Number)
  return hour * 60 + minute
}

interface LocalClock {
  readonly weekday: Weekday
  readonly minutes: number
}

function localClockAt(at: string, timeZone: string): LocalClock | undefined {
  const instant = new Date(at)
  if (Number.isNaN(instant.valueOf())) return undefined
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant)
    const weekday = parts
      .find((part) => part.type === 'weekday')
      ?.value.toLowerCase() as Weekday | undefined
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)
    if (
      !weekday ||
      !weekdayOrder.includes(weekday) ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute)
    ) {
      return undefined
    }
    return { weekday, minutes: hour * 60 + minute }
  } catch {
    return undefined
  }
}

const previousWeekday = (weekday: Weekday): Weekday => {
  const index = weekdayOrder.indexOf(weekday)
  return weekdayOrder[(index + weekdayOrder.length - 1) % weekdayOrder.length]
}

function isInsideAllowedWindow(
  at: string,
  window: TutorPermissions['allowedSessionWindows'][number],
): boolean {
  const clock = localClockAt(at, window.timeZone)
  if (!clock) return false
  const start = parseMinutes(window.startLocalTime)
  const end = parseMinutes(window.endLocalTime)
  if (start === end) return window.days.includes(clock.weekday)
  if (start < end) {
    return (
      window.days.includes(clock.weekday) &&
      clock.minutes >= start &&
      clock.minutes < end
    )
  }
  // Overnight windows use each configured day as the starting day.
  return (
    (window.days.includes(clock.weekday) && clock.minutes >= start) ||
    (window.days.includes(previousWeekday(clock.weekday)) && clock.minutes < end)
  )
}

function matchingBlock(
  blocks: readonly StudentTutorBlock[],
  request: TutorAccessRequest,
): StudentTutorBlock | undefined {
  return blocks.find((block) => {
    if (!block.active || block.studentId !== request.studentId) return false
    if (block.scope === 'all-tutor') return true
    if (block.scope === 'session') return block.sessionId === request.sessionId
    return block.subjectId === request.subjectId
  })
}

/**
 * Evaluates parent-configured tutor access without weakening fixed safeguards.
 * Empty subject/window lists deny access. Student blocks take priority over
 * parent settings and never affect another student's access.
 */
export function evaluateTutorAccess(
  permissions: TutorPermissions,
  request: TutorAccessRequest,
): TutorAccessDecision {
  if (
    !Number.isFinite(request.activeSessionMinutes) ||
    request.activeSessionMinutes < 0 ||
    !Number.isInteger(request.sessionsStartedOnLocalDate) ||
    request.sessionsStartedOnLocalDate < 0 ||
    !Number.isInteger(permissions.dailySessionLimit) ||
    permissions.dailySessionLimit < 0 ||
    !Number.isFinite(permissions.maximumSessionMinutes) ||
    permissions.maximumSessionMinutes <= 0
  ) {
    return {
      allowed: false,
      reason: 'permission-disabled',
      explanation: 'Tutor session controls are unavailable, so access is paused.',
    }
  }
  if (permissions.studentId !== request.studentId) {
    return {
      allowed: false,
      reason: 'permission-disabled',
      explanation: 'Tutor settings for this student are not available.',
    }
  }
  if (matchingBlock(request.activeBlocks, request)) {
    return {
      allowed: false,
      reason: 'student-blocked',
      explanation: 'You blocked the tutor. A trusted grown-up can help you review this setting.',
    }
  }
  if (!permissions.enabled || !permissions.capabilities.textTutoring) {
    return {
      allowed: false,
      reason: 'permission-disabled',
      explanation: 'The tutor is turned off in your learning settings.',
    }
  }
  if (!permissions.allowedSubjectIds.includes(request.subjectId)) {
    return {
      allowed: false,
      reason: 'restricted-subject',
      explanation: 'The tutor is not available for this subject.',
    }
  }
  if (request.channel === 'voice' && !permissions.capabilities.voiceInput) {
    return {
      allowed: false,
      reason: 'voice-input-disabled',
      explanation: 'Voice input is turned off. You can still use text if tutoring is available.',
    }
  }
  if (request.sessionsStartedOnLocalDate >= permissions.dailySessionLimit) {
    return {
      allowed: false,
      reason: 'daily-session-limit',
      explanation: 'You have reached today’s tutor-session limit.',
    }
  }
  if (request.activeSessionMinutes >= permissions.maximumSessionMinutes) {
    return {
      allowed: false,
      reason: 'session-time-limit',
      explanation: 'This tutor session has reached its time limit.',
    }
  }
  if (
    permissions.allowedSessionWindows.length === 0 ||
    !permissions.allowedSessionWindows.some((window) =>
      isInsideAllowedWindow(request.at, window),
    )
  ) {
    return {
      allowed: false,
      reason: 'outside-allowed-time',
      explanation: 'The tutor is not available at this time.',
    }
  }
  return { allowed: true }
}
