import type { Profile } from '../types'

/** Fields that are device-private and must never enter household cloud rows. */
export function sanitizeProfileForSync(profile: Profile): Profile {
  const { tutorChats: _tutorChats, ...rest } = profile
  const sanitized: Profile = { ...rest, pin: '' }
  if (profile.assistant) {
    sanitized.assistant = { ...profile.assistant, sessions: [] }
  }
  return sanitized
}

/** Reattaches only this device's private fields after applying a cloud copy. */
export function mergeDevicePrivateProfile(
  remote: Profile,
  local?: Profile,
): Profile {
  const merged: Profile = { ...sanitizeProfileForSync(remote), pin: local?.pin ?? '' }
  if (local?.tutorChats) merged.tutorChats = local.tutorChats
  const sessions = local?.assistant?.sessions
  if (merged.assistant) {
    merged.assistant = { ...merged.assistant, sessions: sessions ?? [] }
  } else if (sessions && sessions.length > 0) {
    merged.assistant = { calls: [], sessions }
  }
  return merged
}
