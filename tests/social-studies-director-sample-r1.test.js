import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PREVIEW_SOURCES,
  PREVIEW_STAGES,
  RESPONSE_PROMPTS,
  SOCIAL_STUDIES_SAMPLE_CANONICAL_TITLE,
  SOCIAL_STUDIES_SAMPLE_LESSON_REF,
} from '../src/study/family-pilot/social-studies-director-preview/content'
import {
  SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH,
  isSocialStudiesDirectorPreviewPath,
} from '../src/study/family-pilot/social-studies-director-preview/route'

const packagePath = new URL('../docs/curriculum-quality/social-studies/sample-r1/ma-g5-social-studies-u08-l03.package.json', import.meta.url)
const packageRecord = JSON.parse(readFileSync(packagePath, 'utf8'))

describe('Social Studies Director sample R1', () => {
  it('preserves the exact lesson identity, phase, and standards custody', () => {
    expect(SOCIAL_STUDIES_SAMPLE_LESSON_REF).toBe('ma-g5-social-studies-u08-l03')
    expect(SOCIAL_STUDIES_SAMPLE_CANONICAL_TITLE).toBe('Guided practice A: protest and loyalism')
    expect(packageRecord.lesson_id).toBe(SOCIAL_STUDIES_SAMPLE_LESSON_REF)
    expect(packageRecord.authored_phase).toBe('Guided practice A')
    expect(packageRecord.standard_refs.map((entry) => entry.legacy_label)).toEqual([
      'Michigan Grade 5 U3.1',
      'U3.2',
    ])
    expect(packageRecord.standard_refs.every((entry) => entry.mapping_status === 'unverified')).toBe(true)
  })

  it('uses exactly the five canonical unit anchors without inventing source identities', () => {
    expect(Object.values(PREVIEW_SOURCES).map((source) => source.sourceRef).sort()).toEqual([
      'avalon-stamp_act',
      'loc-2008661777',
      'nara-declaration-of-independence',
      'nara-lee-resolution',
      'nara-treaty-of-paris',
    ])
    expect(PREVIEW_SOURCES.revere.url).toBe('https://www.loc.gov/item/2008661777/')
    expect(PREVIEW_SOURCES.revere.imageUrl).toMatch(/^https:\/\/tile\.loc\.gov\//)
    expect(PREVIEW_SOURCES.revere.imageAlt).toContain('uniformed soldiers')
  })

  it('provides modeled thinking, faded guidance, independent work, fresh mastery, and a different repair path', () => {
    expect(packageRecord.model_analyses).toHaveLength(2)
    expect(packageRecord.task_collections.guided_task_refs).toHaveLength(2)
    expect(packageRecord.task_collections.independent_task_refs).toHaveLength(1)
    expect(packageRecord.mastery_evidence).toHaveLength(2)
    expect(packageRecord.remediation_paths[0].repeats_failed_task_only).toBe(false)
    expect(packageRecord.remediation_paths[0].fresh_retry_task_refs).toEqual(['task:fresh-retry-declaration-boundary'])
    expect(RESPONSE_PROMPTS.independent.prompt).toContain('missing Loyalist-colonist evidence')
  })

  it('keeps protected adult authority out of the learner preview content', () => {
    const learnerPreview = JSON.stringify({ PREVIEW_SOURCES, PREVIEW_STAGES, RESPONSE_PROMPTS })
    expect(learnerPreview).not.toMatch(/acceptable_evidence|scoring_guidance|correctAnswer|answerKey|answerIndex/i)
    const scoredTasks = packageRecord.tasks.filter((task) => task.scored).map((task) => task.task_id).sort()
    const authorityTasks = packageRecord.protected_content.adult_authority.map((entry) => entry.task_ref).sort()
    expect(scoredTasks).toEqual(authorityTasks)
  })

  it('keeps the Director shortcut exact-path and development-only', () => {
    expect(SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH).toBe('/__review/g5-social-studies-protest-loyalism')
    expect(isSocialStudiesDirectorPreviewPath(SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH, true)).toBe(true)
    expect(isSocialStudiesDirectorPreviewPath(`${SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH}/`, true)).toBe(true)
    expect(isSocialStudiesDirectorPreviewPath(SOCIAL_STUDIES_DIRECTOR_PREVIEW_PATH, false)).toBe(false)
    expect(isSocialStudiesDirectorPreviewPath('/family-pilot', true)).toBe(false)
  })
})
