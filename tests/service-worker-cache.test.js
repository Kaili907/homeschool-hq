import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const ROOT = resolve(__dirname, '..')
const SW_SOURCE = readFileSync(resolve(ROOT, 'public/sw.js'), 'utf8')
const ORIGIN = 'https://academy.test'
const APP_CACHE = 'homeschool-hq-app-shell-__BUILD_ID__'
const CURRICULUM_PREFIX = 'homeschool-hq-curriculum-release-'

const requestKey = (request) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href

class MemoryCache {
  entries = new Map()

  async addAll(paths) {
    for (const path of paths) this.entries.set(requestKey(path), new Response(`precache:${path}`))
  }

  async match(request) {
    const response = this.entries.get(requestKey(request))
    return response?.clone()
  }

  async put(request, response) {
    this.entries.set(requestKey(request), response.clone())
  }
}

class MemoryCacheStorage {
  stores = new Map()

  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache())
    return this.stores.get(name)
  }

  async keys() {
    return [...this.stores.keys()]
  }

  async delete(name) {
    return this.stores.delete(name)
  }
}

const makeRequest = (path, mode = 'same-origin') => ({
  method: 'GET',
  mode,
  url: new URL(path, ORIGIN).href,
})

function createHarness(fetchImpl = vi.fn(async (request) => new Response(`network:${request.url}`))) {
  const listeners = new Map()
  const caches = new MemoryCacheStorage()
  const skipWaiting = vi.fn(async () => {})
  const claim = vi.fn(async () => {})
  const self = {
    location: { origin: ORIGIN },
    clients: { claim },
    skipWaiting,
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
  }

  vm.runInNewContext(SW_SOURCE, { self, caches, fetch: fetchImpl, URL, Response })

  const lifecycle = async (type) => {
    let pending
    listeners.get(type)({ waitUntil(value) { pending = value } })
    await pending
  }

  const fetchEvent = async (path, mode = 'same-origin') => {
    let response
    listeners.get('fetch')({
      request: makeRequest(path, mode),
      respondWith(value) { response = value },
    })
    return response ? await response : undefined
  }

  return { caches, claim, fetchEvent, fetchImpl, lifecycle, skipWaiting }
}

describe('version-aware service-worker curriculum caches', () => {
  it('app-shell activation preserves all curriculum releases while cleaning old non-curriculum caches', async () => {
    const harness = createHarness()
    await harness.caches.open('homeschool-hq-old-build')
    await harness.caches.open('unrelated-runtime-cache')
    await harness.caches.open(`${CURRICULUM_PREFIX}1.0.0`)
    await harness.caches.open(`${CURRICULUM_PREFIX}simulated-B`)
    await harness.caches.open(APP_CACHE)

    await harness.lifecycle('activate')

    expect(await harness.caches.keys()).toEqual([
      `${CURRICULUM_PREFIX}1.0.0`,
      `${CURRICULUM_PREFIX}simulated-B`,
      APP_CACHE,
    ])
    expect(harness.claim).toHaveBeenCalledOnce()
  })

  it('gives release 1.0.0 an independent curriculum cache identity', async () => {
    const harness = createHarness()
    await harness.fetchEvent('/curriculum/1.0.0/release.json')

    expect(await harness.caches.keys()).toContain(`${CURRICULUM_PREFIX}1.0.0`)
    expect(await (await harness.caches.open(`${CURRICULUM_PREFIX}1.0.0`)).match('/curriculum/1.0.0/release.json')).toBeDefined()
  })

  it('allows simulated release A and B caches to coexist without cross-serving content', async () => {
    const fetchImpl = vi.fn(async (request) => {
      const version = new URL(request.url).pathname.split('/')[2]
      return new Response(`content:${version}`)
    })
    const harness = createHarness(fetchImpl)

    expect(await (await harness.fetchEvent('/curriculum/release-A/courses/math/unit-01.json')).text()).toBe('content:release-A')
    expect(await (await harness.fetchEvent('/curriculum/release-B/courses/math/unit-01.json')).text()).toBe('content:release-B')

    fetchImpl.mockRejectedValue(new Error('offline'))
    expect(await (await harness.fetchEvent('/curriculum/release-A/courses/math/unit-01.json')).text()).toBe('content:release-A')
    expect(await (await harness.fetchEvent('/curriculum/release-B/courses/math/unit-01.json')).text()).toBe('content:release-B')
    expect(await harness.caches.keys()).toEqual([
      `${CURRICULUM_PREFIX}release-A`,
      `${CURRICULUM_PREFIX}release-B`,
    ])
  })

  it('serves cached pinned 1.0.0 content offline', async () => {
    const harness = createHarness()
    const path = '/curriculum/1.0.0/grade-5/catalog.json'
    await harness.fetchEvent(path)
    harness.fetchImpl.mockRejectedValue(new Error('offline'))

    expect(await (await harness.fetchEvent(path)).text()).toBe(`network:${ORIGIN}${path}`)
    expect(harness.fetchImpl).toHaveBeenCalledOnce()
  })

  it('fails a missing pinned offline request clearly without substituting another release', async () => {
    const harness = createHarness()
    await harness.fetchEvent('/curriculum/release-B/release.json')
    harness.fetchImpl.mockRejectedValue(new Error('offline'))

    const response = await harness.fetchEvent('/curriculum/release-A/release.json')
    expect(response.status).toBe(504)
    expect(await response.text()).toBe('Pinned curriculum release release-A is unavailable offline.')
  })

  it.each([
    '/curriculum/1.0.0/admin/answers.json',
    '/curriculum/1.0.0/private/notes.json',
    '/curriculum/1.0.0/protected/unit-01.json',
    '/curriculum/admin/release.json',
    '/admin/curriculum/1.0.0.json',
    '/private/student.json',
    '/protected/tutor.json',
  ])('keeps protected route %s out of public caches', async (path) => {
    const harness = createHarness()
    expect(await harness.fetchEvent(path)).toBeUndefined()
    expect(await harness.caches.keys()).toEqual([])
    expect(harness.fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    '/curriculum/active.json',
    '/curriculum/active/release.json',
    '/curriculum/latest/release.json',
    '/curriculum/current/release.json',
  ])('keeps mutable release pointer %s network-only', async (path) => {
    const harness = createHarness()
    expect(await harness.fetchEvent(path)).toBeUndefined()
    expect(await harness.caches.keys()).toEqual([])
  })

  it('does not cache private or no-store responses in the app-shell namespace', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret', {
      headers: { 'cache-control': 'private, no-store' },
    }))
    const harness = createHarness(fetchImpl)
    await harness.fetchEvent('/assets/runtime-data.json')

    expect(await (await harness.caches.open(APP_CACHE)).match('/assets/runtime-data.json')).toBeUndefined()
  })

  it('retains normal service-worker update behavior', async () => {
    const harness = createHarness()
    await harness.lifecycle('install')
    await harness.lifecycle('activate')

    expect(harness.skipWaiting).toHaveBeenCalledOnce()
    expect(harness.claim).toHaveBeenCalledOnce()
    expect(await (await harness.caches.open(APP_CACHE)).match('/index.html')).toBeDefined()
  })
})
