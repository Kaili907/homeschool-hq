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

  it('labels credit values as CONTRACTED (not "recommended" or "actual served")', () => {
    const html = render()
    expect(html).toContain('CONTRACTED / RECOMMENDED')
    expect(html).toContain('CONTRACTED credits G9-G12')
    // The old blanket footer must not survive: check the corrected wording.
    expect(html).toContain('Subject-branch title')
    expect(html).toContain('Programme/planning contract embedded from')
  })

  it('displays the source ref @ SHA in the header', () => {
    const html = render()
    expect(html).toContain(`${HIGH_SCHOOL_PROGRAM_SNAPSHOT.sourceRef} @ ${HIGH_SCHOOL_PROGRAM_SNAPSHOT.sourceSha}`)
  })

  it('renders the source evidence catalog with each cataloged ref and its role badge', () => {
    const html = render()
    expect(html).toContain('Source evidence catalog')
    for (const source of HIGH_SCHOOL_PROGRAM_SNAPSHOT.sources) {
      expect(html).toContain(source.ref)
      expect(html).toContain(source.sha)
    }
    expect(html).toContain('PLANNING CONTRACT')
    expect(html).toContain('AUTHORED EVIDENCE')
    expect(html).toContain('SUPERSEDED')
  })

  it('renders the reconciliation table with divergence badges', () => {
    const html = render()
    expect(html).toContain('Contract ↔ subject-branch reconciliation')
    expect(html).toContain('DIVERGES · id scheme')
    expect(html).toContain('DIVERGES · title + sessions')
    expect(html).toContain('DIVERGES · title')
    // Every reconciliation must show a subject SHA
    for (const r of HIGH_SCHOOL_PROGRAM_SNAPSHOT.reconciliations) {
      if (r.subjectSha) expect(html).toContain(r.subjectSha)
    }
  })

  it('surfaces the science id-scheme divergence explicitly', () => {
    const html = render()
    expect(html).toContain('ma-hs9-biology')
    expect(html).toContain('ma-hs10-chemistry')
    expect(html).toContain('ma-hs11-physics')
    expect(html).toContain('ma-hs12-earth-space-environmental')
  })

  it('renders the delivery / integration section with a NOT_COVERED verdict', () => {
    const html = render()
    expect(html).toContain('Delivery / integration status')
    expect(html).toContain('NOT SERVED')
    expect(html).toContain('scripts/build-curriculum.mjs')
  })

  it('flips delivery status to COVERED when every fact is marked served', () => {
    const clean = {
      ...HIGH_SCHOOL_PROGRAM_SNAPSHOT,
      delivery: HIGH_SCHOOL_PROGRAM_SNAPSHOT.delivery.map((d) => ({ ...d, servedInRelease: true })),
    }
    const html = render(clean)
    expect(html).toContain('Every recorded delivery fact reports the programme as served')
    expect(html).toContain('SERVED')
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
