import { describe, expect, it } from 'vitest'
import { expectedSubjects } from './hubModel'
import { parsePlanDoc } from './parser'

const PLAN = `---
subject: Grade Five Studio
subjectId: grade-five-studio
grades: 5,7,8
---
## Week 1 - Launch
- lesson
`

describe('PLANS-GRADES', () => {
  it('accepts grades 5, 7, and 8 in plan front matter', () => {
    expect(parsePlanDoc(PLAN).grades).toEqual(['5', '7', '8'])
  })

  it('renders a valid front-matter subject without a hard-coded array edit', () => {
    const doc = parsePlanDoc(PLAN)
    expect(expectedSubjects([doc], '5')).toContainEqual({ id: 'grade-five-studio', label: 'Grade Five Studio' })
  })
})
