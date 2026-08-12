import { describe, expect, it } from 'vitest'
import { getTechCsAssignments } from '../catalog/catalog'
import { loadTechCsCatalog } from '../catalog/source.node'
import type { TechCsLessonRef } from '../catalog/types'
import {
  accessibilityNotesFor,
  containsCredentialLikeContent,
  safetyAndPrivacyNotesFor,
  textContainsCredentialLikeContent,
} from './metadata'

function fixtureLesson(overrides: Partial<TechCsLessonRef> = {}): TechCsLessonRef {
  return {
    lessonId: 'ma-g5-technology-u01-l01',
    courseId: 'ma-g5-technology',
    grade: '5',
    unitId: 'u01',
    unitNumber: 1,
    dayInUnit: 1,
    courseDay: 1,
    title: 'Launch and diagnostic: personal information',
    focus: 'personal information',
    dayPhase: 'launch-diagnostic',
    standards: ['Michigan Computer Science: Impacts of Computing'],
    accessibilityAndAccommodations: ['Provide readable text plus optional audio or read-aloud support.'],
    safetyAndPrivacy: ['Never require a real password, private message, precise location, account credential, or identifiable image.'],
    ...overrides,
  }
}

describe('FF-M7 Technology / CS accessibility and privacy metadata', () => {
  it('accessibility path: exposes the lesson accessibility notes', () => {
    const lesson = fixtureLesson()
    expect(accessibilityNotesFor(lesson)).toEqual(lesson.accessibilityAndAccommodations)
  })

  it('accessibility path: exposes the lesson safety/privacy notes', () => {
    const lesson = fixtureLesson()
    expect(safetyAndPrivacyNotesFor(lesson)).toEqual(lesson.safetyAndPrivacy)
  })

  it('no credentials/secrets: a clean lesson has no credential-like content', () => {
    expect(containsCredentialLikeContent(fixtureLesson())).toBe(false)
  })

  it('no credentials/secrets: flags a real-looking password assignment', () => {
    expect(textContainsCredentialLikeContent(['password: hunter2'])).toBe(true)
  })

  it('no credentials/secrets: flags a real-looking API key', () => {
    expect(textContainsCredentialLikeContent(['api_key=sk_live_abcdef1234567890'])).toBe(true)
  })

  it('no credentials/secrets: flags a PEM private key block', () => {
    expect(textContainsCredentialLikeContent(['-----BEGIN RSA PRIVATE KEY-----'])).toBe(true)
  })

  it('no credentials/secrets: does not flag ordinary curriculum language mentioning the word "password"', () => {
    expect(textContainsCredentialLikeContent(['Use a strong passphrase and never share a real password with anyone.'])).toBe(false)
  })

  it('accessibility path: every real lesson has non-empty accessibility notes for every grade', () => {
    const catalog = loadTechCsCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getTechCsAssignments(catalog, grade)) {
        expect(accessibilityNotesFor(lesson).length).toBeGreaterThan(0)
      }
    }
  })

  it('no credentials/secrets: no real lesson in the catalog contains credential-like content', () => {
    const catalog = loadTechCsCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getTechCsAssignments(catalog, grade)) {
        expect(containsCredentialLikeContent(lesson)).toBe(false)
      }
    }
  })
})
