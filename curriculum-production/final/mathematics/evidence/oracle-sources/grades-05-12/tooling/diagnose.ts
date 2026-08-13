import { readAllLessons } from '../src/lessonSources.ts'
import { emitLesson } from '../src/emit.ts'
import { validateLesson } from '../src/validate.ts'

const byCheck = new Map<string, string[]>()
for (const lesson of readAllLessons()) {
  const out = emitLesson(lesson)
  for (const issue of validateLesson(out.package, out.answerKey, lesson)) {
    const list = byCheck.get(issue.check) ?? []
    list.push(`${issue.packageId} | ${issue.detail}`)
    byCheck.set(issue.check, list)
  }
}
for (const [check, details] of byCheck) {
  console.log(`\n=== ${check} (${details.length}) ===`)
  for (const detail of details.slice(0, 6)) console.log('  ', detail)
  if (check === 'item-standard-in-lesson') {
    const standards = new Map<string, number>()
    for (const detail of details) {
      const match = detail.match(/carries ([\w.-]+)/)
      if (match) standards.set(match[1], (standards.get(match[1]) ?? 0) + 1)
    }
    console.log('   offending standards:', [...standards].sort((a, b) => b[1] - a[1]))
    const lessons = new Set(details.map((d) => d.split(' | ')[0]))
    console.log('   distinct lessons affected:', lessons.size)
  }
}
