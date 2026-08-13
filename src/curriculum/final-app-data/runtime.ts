import { createFinalCurriculumRuntime, type FinalCourseLessonLoader } from '../final-runtime'
import type {
  FinalBrowserCoursePayload,
  FinalBrowserManifestDocument,
  FinalFamilyPilotCatalog,
  FinalLearnerProductionMaterial,
} from './types'

export const FINAL_FAMILY_PILOT_DATA_ROOT = 'family-pilot-final/2.0.0' as const

export interface FinalFamilyPilotCatalogOptions {
  readonly fetch?: typeof fetch
  readonly baseUrl?: string
}

function browserBaseUrl(): string {
  const viteBase = import.meta.env.BASE_URL || '/'
  return viteBase.endsWith('/') ? viteBase : `${viteBase}/`
}

async function json<T>(fetcher: typeof fetch, url: string): Promise<T> {
  const response = await fetcher(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Final Family Pilot data unavailable (${response.status}).`)
  return response.json() as Promise<T>
}

/**
 * Opens the admitted browser catalog without importing any Node loader or
 * lesson body. The eager fetch is one manifest; course rows and learner-safe
 * production materials arrive together only when that course is requested.
 */
export async function loadFinalFamilyPilotCatalog(
  options: FinalFamilyPilotCatalogOptions = {},
): Promise<FinalFamilyPilotCatalog> {
  const fetcher = options.fetch ?? globalThis.fetch
  if (!fetcher) throw new Error('This browser cannot load the final curriculum.')
  const base = options.baseUrl ?? browserBaseUrl()
  const root = `${base}${FINAL_FAMILY_PILOT_DATA_ROOT}`
  const manifest = await json<FinalBrowserManifestDocument>(fetcher, `${root}/manifest.json`)
  if (
    manifest.admissionStatus !== 'ADMITTED' ||
    manifest.classification !== 'ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1' ||
    manifest.counts.lessons !== 8292 ||
    manifest.productionBindings !== 8292
  ) throw new Error('The final Family Pilot release manifest failed its admission identity check.')

  const payloads = new Map<string, Promise<FinalBrowserCoursePayload>>()
  const loadCoursePayload = (courseRef: string): Promise<FinalBrowserCoursePayload> => {
    const course = manifest.runtime.courses.find((item) => item.courseRef === courseRef)
    if (!course) return Promise.reject(new Error(`Unknown final course: ${courseRef}`))
    const cached = payloads.get(courseRef)
    if (cached) return cached
    const pending = json<FinalBrowserCoursePayload>(fetcher, `${root}/courses/${encodeURIComponent(courseRef)}.json`)
      .then((payload) => {
        if (
          payload.courseRef !== courseRef ||
          payload.lessons.length !== course.lessonCount ||
          Object.keys(payload.bindings).length !== course.lessonCount ||
          Object.keys(payload.materials).length !== course.lessonCount
        ) throw new Error(`Final course payload is incomplete: ${courseRef}`)
        return payload
      })
      .catch((error: unknown) => {
        payloads.delete(courseRef)
        throw error
      })
    payloads.set(courseRef, pending)
    return pending
  }

  const lessonLoaders: Record<string, FinalCourseLessonLoader> = {}
  for (const course of manifest.runtime.courses) {
    lessonLoaders[course.courseRef] = async () => ({
      default: (await loadCoursePayload(course.courseRef)).lessons,
    })
  }

  const runtime = createFinalCurriculumRuntime<FinalLearnerProductionMaterial>({
    manifest: manifest.runtime,
    lessonLoaders,
    productionMaterialResolver: {
      async resolve(request) {
        if (request.kind !== 'student-work') {
          return { status: 'not-found', reason: 'Only student-facing production material is available in this browser.' }
        }
        if (request.sourceReadiness.state === 'dynamic') {
          return { status: 'dynamic-source', sourceReadiness: request.sourceReadiness }
        }
        const payload = await loadCoursePayload(request.courseRef)
        const material = payload.materials[request.lessonRef]
        return material
          ? { status: 'ready', material, sourceReadiness: request.sourceReadiness }
          : { status: 'not-found', reason: `No admitted learner package for ${request.lessonRef}.` }
      },
    },
  })

  const getBinding = async (lessonRef: string) => {
    const lesson = await runtime.getLesson(lessonRef)
    if (!lesson) return null
    return (await loadCoursePayload(lesson.courseRef)).bindings[lessonRef] ?? null
  }
  const getMaterial = async (lessonRef: string) => {
    const lesson = await runtime.getLesson(lessonRef)
    if (!lesson) return null
    return (await loadCoursePayload(lesson.courseRef)).materials[lessonRef] ?? null
  }

  return Object.freeze({ manifest, runtime, loadCoursePayload, getBinding, getMaterial })
}
