import { readFileSync } from 'node:fs'

export const APPROVED_TECHNOLOGY_ANCHOR_ID = 'ma-g10-technology-u02-l05'

const TASK_SOURCE = new URL(
  './approved-anchors/ma-g10-technology-u02-l05.task-package.source.json',
  import.meta.url,
)
const GUIDE_SOURCE = new URL(
  './approved-anchors/ma-g10-technology-u02-l05.scoring-guide.source.json',
  import.meta.url,
)

const approvedTaskPackage = JSON.parse(readFileSync(TASK_SOURCE, 'utf8'))
const approvedScoringGuide = JSON.parse(readFileSync(GUIDE_SOURCE, 'utf8'))

const clone = (value) => JSON.parse(JSON.stringify(value))

export function approvedTechnologyAnchorMaterials(lessonId) {
  if (lessonId !== APPROVED_TECHNOLOGY_ANCHOR_ID) return null
  return {
    taskPackage: clone(approvedTaskPackage),
    scoringGuide: clone(approvedScoringGuide),
  }
}
