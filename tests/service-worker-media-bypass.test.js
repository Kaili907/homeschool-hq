import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const workerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const origin = 'https://academy.example'

function request(pathname, { destination = '', headers = {}, method = 'GET', mode = 'cors' } = {}) {
  return {
    destination,
    headers: new Headers(headers),
    method,
    mode,
    url: `${origin}${pathname}`,
  }
}

function createHarness({ responseStatus = 200 } = {}) {
  const listeners = new Map()
  const cache = {
    addAll: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  }
  const caches = {
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => []),
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => cache),
  }
  const response = {
    clone: vi.fn(() => ({ status: responseStatus })),
    ok: responseStatus >= 200 && responseStatus < 300,
    status: responseStatus,
  }
  const fetch = vi.fn(async () => response)
  const self = {
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin },
    skipWaiting: vi.fn(async () => undefined),
  }

  vm.runInNewContext(workerSource, { Headers, Promise, URL, caches, fetch, self }, { filename: 'public/sw.js' })

  async function dispatchFetch(workerRequest) {
    let responsePromise
    const event = {
      request: workerRequest,
      respondWith: vi.fn((value) => {
        responsePromise = Promise.resolve(value)
      }),
    }
    listeners.get('fetch')(event)
    if (responsePromise) await responsePromise
    await new Promise((resolve) => setTimeout(resolve, 0))
    return event
  }

  async function dispatchInstall() {
    let installPromise
    const event = {
      waitUntil: vi.fn((value) => {
        installPromise = Promise.resolve(value)
      }),
    }
    listeners.get('install')(event)
    await installPromise
    return event
  }

  return { cache, caches, dispatchFetch, dispatchInstall, fetch, self }
}

describe('service-worker video delivery bypass', () => {
  it('leaves any Range request entirely outside the runtime cache path', async () => {
    const harness = createHarness({ responseStatus: 206 })
    const event = await harness.dispatchFetch(
      request('/assets/range-probe.bin', { headers: { Range: 'bytes=0-1023' } }),
    )

    expect(event.respondWith).not.toHaveBeenCalled()
    expect(harness.fetch).not.toHaveBeenCalled()
    expect(harness.caches.match).not.toHaveBeenCalled()
    expect(harness.caches.open).not.toHaveBeenCalled()
    expect(harness.cache.put).not.toHaveBeenCalled()
  })

  it('bypasses the actual Manuel Academy MP4 even without a Range header', async () => {
    const harness = createHarness()
    const event = await harness.dispatchFetch(request('/media/manuel-academy-entry-space-loop.mp4'))

    expect(event.respondWith).not.toHaveBeenCalled()
    expect(harness.caches.match).not.toHaveBeenCalled()
    expect(harness.cache.put).not.toHaveBeenCalled()
  })

  it('bypasses a browser-classified video request without relying on its extension', async () => {
    const harness = createHarness()
    const event = await harness.dispatchFetch(request('/stream/entry-background', { destination: 'video' }))

    expect(event.respondWith).not.toHaveBeenCalled()
    expect(harness.caches.match).not.toHaveBeenCalled()
    expect(harness.cache.put).not.toHaveBeenCalled()
  })

  it('retains the existing cache-first behavior for a normal same-origin GET', async () => {
    const harness = createHarness()
    const workerRequest = request('/assets/app-content-hash.js')
    const event = await harness.dispatchFetch(workerRequest)

    expect(event.respondWith).toHaveBeenCalledOnce()
    expect(harness.caches.match).toHaveBeenCalledWith(workerRequest)
    expect(harness.fetch).toHaveBeenCalledWith(workerRequest)
    expect(harness.caches.open).toHaveBeenCalledWith('homeschool-hq-__BUILD_ID__')
    expect(harness.cache.put).toHaveBeenCalledOnce()
  })

  it('keeps the WebP poster eligible for ordinary runtime caching', async () => {
    const harness = createHarness()
    const workerRequest = request('/media/manuel-academy-entry-space-poster.webp')
    const event = await harness.dispatchFetch(workerRequest)

    expect(event.respondWith).toHaveBeenCalledOnce()
    expect(harness.caches.match).toHaveBeenCalledWith(workerRequest)
    expect(harness.cache.put).toHaveBeenCalledOnce()
  })

  it('preserves the existing shell precache list', async () => {
    const harness = createHarness()
    const event = await harness.dispatchInstall()

    expect(event.waitUntil).toHaveBeenCalledOnce()
    expect(harness.caches.open).toHaveBeenCalledWith('homeschool-hq-__BUILD_ID__')
    expect(harness.cache.addAll).toHaveBeenCalledWith([
      '/',
      '/index.html',
      '/manifest.webmanifest',
      '/icon.svg',
    ])
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce()
  })

  it('never lets a 206 Manuel Academy video response reach Cache.put', async () => {
    const harness = createHarness({ responseStatus: 206 })
    const event = await harness.dispatchFetch(
      request('/media/manuel-academy-entry-space-loop-720p.mp4', {
        destination: 'video',
        headers: { Range: 'bytes=0-1023' },
      }),
    )

    expect(event.respondWith).not.toHaveBeenCalled()
    expect(harness.fetch).not.toHaveBeenCalled()
    expect(harness.caches.match).not.toHaveBeenCalled()
    expect(harness.cache.put).not.toHaveBeenCalled()
  })
})
