import { describe, expect, it } from 'vitest'
import {
  parsePendingDestinationDescriptor,
  pathForPendingDestination,
  pendingDestinationFromPath,
  serializePendingDestination,
  type PendingDestination,
} from './pendingDestination'

describe('pending destination allowlist', () => {
  it.each<PendingDestination>([
    { kind: 'root-dashboard' },
    { kind: 'academy', route: { kind: 'home' } },
    { kind: 'academy', route: { kind: 'schedule' } },
    { kind: 'academy', route: { kind: 'course', courseId: 'ma-g5-mathematics' } },
    { kind: 'academy', route: { kind: 'unit', courseId: 'ma-g7-science', unitNumber: 3 } },
    { kind: 'academy', route: { kind: 'assessment', courseId: 'ma-g8-financial-literacy', unitNumber: 2 } },
    {
      kind: 'academy',
      route: {
        kind: 'lesson',
        courseId: 'ma-g5-mathematics',
        unitNumber: 2,
        lessonId: 'ma-g5-mathematics-u02-l01',
      },
    },
    { kind: 'study' },
    { kind: 'grade-5-practice' },
  ])('round-trips the known descriptor $kind', (destination) => {
    expect(parsePendingDestinationDescriptor(serializePendingDestination(destination))).toEqual(destination)
    expect(pendingDestinationFromPath(pathForPendingDestination(destination))).toEqual(destination)
  })

  it('rejects arbitrary URLs, paths, malformed Academy routes, and extended descriptors', () => {
    expect(parsePendingDestinationDescriptor('"https://example.com/steal-session"')).toBeNull()
    expect(parsePendingDestinationDescriptor(JSON.stringify({
      kind: 'study',
      url: 'https://example.com/steal-session',
    }))).toBeNull()
    expect(parsePendingDestinationDescriptor(JSON.stringify({
      kind: 'academy',
      route: {
        kind: 'lesson',
        courseId: 'ma-g5-mathematics',
        unitNumber: 3,
        lessonId: 'ma-g5-mathematics-u02-l01',
      },
    }))).toBeNull()
    expect(pendingDestinationFromPath('https://example.com/steal-session')).toBeNull()
    expect(pendingDestinationFromPath('//example.com/steal-session')).toBeNull()
    expect(pendingDestinationFromPath('/academy/not-a-real-route')).toBeNull()
    expect(pendingDestinationFromPath('/study-engine?next=https://example.com')).toBeNull()
  })
})
