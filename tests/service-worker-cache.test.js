import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const ORIGIN = 'https://academy.example'
let workerSource = ''

beforeAll(async () => {
  workerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
})

function absolute(input) {
  if (typeof input === 'string') return new URL(input, ORIGIN).href
  return input.url
}

class MemoryCache {
  constructor() {
    this.entries = new Map()
  }

  async addAll(paths) {
    for (const path of paths) {
      this.entries.set(absolute(path), new Response(`shell:${path}`, {
        headers: { 'cache-control': 'public, max-age=60' },
      }))
    }
  }

  async match(input) {
    return this.entries.get(absolute(input))?.clone()
  }

  async put(input, response) {
    this.entries.set(absolute(input), response.clone())
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url))
  }
}

class MemoryCacheStorage {
  constructor() {
    this.stores = new Map()
  }

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

function request(path, { mode = 'same-origin', headers = {} } = {}) {
  return {
    url: new URL(path, ORIGIN).href,
    method: 'GET',
    mode,
    headers: new Headers(headers),
  }
}

function createHarness(fetchImpl = async (input) => new Response(`network:${absolute(input)}`, {
  headers: { 'cache-control': 'public, max-age=60' },
})) {
  const listeners = new Map()
  const caches = new MemoryCacheStorage()
  const skipWaiting = vi.fn()
  const claim = vi.fn(async () => {})
  const network = vi.fn(fetchImpl)
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    skipWaiting,
    clients: { claim },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
  }
  vm.runInNewContext(workerSource, {
    URL,
    Promise,
    console,
    caches,
    fetch: network,
    self,
  }, { filename: 'public/sw.js' })

  return {
    caches,
    claim,
    network,
    skipWaiting,
    async dispatchLifecycle(type) {
      let completion
      listeners.get(type)({ waitUntil(value) { completion = Promise.resolve(value) } })
      await completion
    },
    dispatchFetch(target) {
      let response
      listeners.get('fetch')({
        request: target,
        respondWith(value) { response = Promise.resolve(value) },
      })
      return response
    },
  }
}

describe('production service-worker cache boundaries', () => {
  it('installs the public shell without forcing an incompatible active build to yield', async () => {
    const harness = createHarness()
    await harness.dispatchLifecycle('install')

    expect(harness.skipWaiting).not.toHaveBeenCalled()
    expect(await harness.caches.keys()).toEqual(['homeschool-hq-app-__BUILD_ID__'])
    const cache = await harness.caches.open('homeschool-hq-app-__BUILD_ID__')
    await expect((await cache.match('/index.html')).text()).resolves.toBe('shell:/index.html')
  })

  it.each([
    '/academy/admin/costs',
    '/api/admin/v1/costs',
    '/.netlify/functions/admin-costs',
    '/rest/v1/private-table',
    '/auth/v1/token',
  ])('keeps %s network-only and bypasses the browser HTTP cache', async (path) => {
    const harness = createHarness()
    const response = harness.dispatchFetch(request(path, { mode: 'navigate' }))

    await expect((await response).text()).resolves.toContain('network:')
    expect(harness.network).toHaveBeenCalledTimes(1)
    expect(harness.network.mock.calls[0][1]).toEqual({ cache: 'no-store' })
    expect(await harness.caches.keys()).toEqual([])
  })

  it('uses only the public shell for offline Admin navigation while APIs remain unavailable', async () => {
    const harness = createHarness(async () => { throw new TypeError('offline') })
    await harness.dispatchLifecycle('install')

    await expect((await harness.dispatchFetch(request('/academy/admin/learners', { mode: 'navigate' }))).text())
      .resolves.toBe('shell:/index.html')
    await expect(harness.dispatchFetch(request('/api/admin/v1/learners'))).rejects.toThrow('offline')
    await expect((await harness.dispatchFetch(request('/academy', { mode: 'navigate' }))).text())
      .resolves.toBe('shell:/index.html')
  })

  it('isolates immutable Curriculum chunks from build-scoped application assets', async () => {
    const harness = createHarness()
    const curriculumRequest = request('/curriculum/1.0.0/release.json')
    const assetRequest = request('/assets/app-123.js')

    await harness.dispatchFetch(curriculumRequest)
    await harness.dispatchFetch(assetRequest)
    await harness.dispatchFetch(curriculumRequest)
    await harness.dispatchFetch(assetRequest)

    expect(harness.network).toHaveBeenCalledTimes(2)
    const curriculum = await harness.caches.open('homeschool-hq-curriculum-v1')
    const app = await harness.caches.open('homeschool-hq-app-__BUILD_ID__')
    expect(await curriculum.match(curriculumRequest)).toBeDefined()
    expect(await curriculum.match(assetRequest)).toBeUndefined()
    expect(await app.match(assetRequest)).toBeDefined()
    expect(await app.match(curriculumRequest)).toBeUndefined()
  })

  it('never persists authorized, private, or arbitrary same-origin responses', async () => {
    const harness = createHarness(async (input) => new Response('sensitive', {
      headers: {
        'cache-control': absolute(input).includes('private') ? 'private, no-store' : 'public, max-age=60',
      },
    }))
    const authorizedAsset = request('/assets/authorized.js', {
      headers: { authorization: 'Bearer secret' },
    })
    const privateAsset = request('/assets/private.js')

    await harness.dispatchFetch(authorizedAsset)
    await harness.dispatchFetch(privateAsset)
    expect(harness.dispatchFetch(request('/reports/admin-export.json'))).toBeUndefined()
    await harness.dispatchFetch(authorizedAsset)
    await harness.dispatchFetch(privateAsset)

    expect(harness.network).toHaveBeenCalledTimes(4)
    const app = await harness.caches.open('homeschool-hq-app-__BUILD_ID__')
    expect(await app.match(authorizedAsset)).toBeUndefined()
    expect(await app.match(privateAsset)).toBeUndefined()
  })

  it('migrates legacy public Curriculum entries, retires only owned app caches, and preserves unrelated caches', async () => {
    const harness = createHarness()
    await harness.dispatchLifecycle('install')
    const legacy = await harness.caches.open('homeschool-hq-old-build')
    const curriculumRequest = request('/curriculum/1.0.0/release.json')
    await legacy.put(curriculumRequest, new Response('legacy-curriculum', {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    }))
    await legacy.put(request('/academy/admin/audit-log'), new Response('legacy-admin'))
    const unrelated = await harness.caches.open('third-party-cache')
    await unrelated.put(request('/other'), new Response('unrelated'))

    expect(await harness.caches.keys()).toContain('homeschool-hq-old-build')
    await harness.dispatchLifecycle('activate')

    expect(harness.claim).toHaveBeenCalledTimes(1)
    expect(await harness.caches.keys()).toEqual(expect.arrayContaining([
      'homeschool-hq-app-__BUILD_ID__',
      'homeschool-hq-curriculum-v1',
      'third-party-cache',
    ]))
    expect(await harness.caches.keys()).not.toContain('homeschool-hq-old-build')
    const curriculum = await harness.caches.open('homeschool-hq-curriculum-v1')
    await expect((await curriculum.match(curriculumRequest)).text()).resolves.toBe('legacy-curriculum')
    expect(await curriculum.match(request('/academy/admin/audit-log'))).toBeUndefined()
    expect(await unrelated.match(request('/other'))).toBeDefined()
  })
})
