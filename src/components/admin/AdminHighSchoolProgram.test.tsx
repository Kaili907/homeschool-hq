import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HIGH_SCHOOL_PROGRAM_SNAPSHOT, type HighSchoolProgramSnapshot } from '../../admin/high-school-program'
import { AdminHighSchoolProgram } from './AdminHighSchoolProgram'

function render(snapshot?: HighSchoolProgramSnapshot) {
  return renderToStaticMarkup(<AdminHighSchoolProgram snapshot={snapshot} />)
}

describe('AdminHighSchoolProgram — independent render', () => {
  it('renders without props, using the frozen snapshot', () => {
    const html = renderToStaticMarkup(<AdminHighSchoolProgram />)
    expect(html).toContain('Manuel Academy Grades 8')
    expect(html).toContain(HIGH_SCHOOL_PROGRAM_SNAPSHOT.contractId)
    expect(html).toContain(HIGH_SCHOOL_PROGRAM_SNAPSHOT.sourceRef)
  })

  it('renders each Grade 9 → 12 column', () => {
    const html = render()
    for (const label of ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']) {
      expect(html).toContain(label)
    }
  })

  it('names every high-school course from the snapshot', () => {
    const html = render()
    for (const course of HIGH_SCHOOL_PROGRAM_SNAPSHOT.courses) {
      if (course.grade === 8) continue
      expect(html).toContain(course.courseName)
    }
  })

  it('never claims graduation-complete against the released contract', () => {
    const html = render()
    expect(html).toContain('NOT graduation-complete against MMC')
    expect(html).not.toContain('Graduation-complete against MMC (per source)')
  })

  it('shows an em-dash for grade-8 anchor credits (source records null)', () => {
    const html = render()
    // The family progression table renders every Grade 8 anchor with "— cr".
    expect(html).toMatch(/—\s*cr/)
  })

  it('badges the World Language gap as NOT COVERED and lists the irreducible remainder', () => {
    const html = render()
    expect(html).toContain('NOT COVERED')
    expect(html).toContain('World Language (MMC)')
    expect(html).toContain('irreducible')
  })

  it('renders every seam row including World Language', () => {
    const html = render()
    for (const s of HIGH_SCHOOL_PROGRAM_SNAPSHOT.seam) {
      expect(html).toContain(s.familyLabel)
    }
  })

  it('honours a snapshot override for tests (independent mountability)', () => {
    const customSnapshot: HighSchoolProgramSnapshot = {
      ...HIGH_SCHOOL_PROGRAM_SNAPSHOT,
      contractStatus: 'CUSTOM_TEST_STATUS',
    }
    const html = render(customSnapshot)
    expect(html).toContain('CUSTOM_TEST_STATUS')
  })

  it('flips the banner to graduation-complete only when the source ruling AND the gap list agree', () => {
    const cleanSnapshot: HighSchoolProgramSnapshot = {
      ...HIGH_SCHOOL_PROGRAM_SNAPSHOT,
      gaps: HIGH_SCHOOL_PROGRAM_SNAPSHOT.gaps.filter((g) => g.rawVerdict === 'COVERED' || g.rawVerdict === 'PARTIALLY_COVERED'),
      graduationRuling: {
        ...HIGH_SCHOOL_PROGRAM_SNAPSHOT.graduationRuling,
        verdict: 'GRADUATION_COMPLETE',
        basis: 'test fixture: no blocking gaps and source ruling is GRADUATION_COMPLETE',
        note: 'test fixture',
      },
    }
    const html = render(cleanSnapshot)
    expect(html).toContain('Graduation-complete against MMC (per source)')
  })
})
