import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const workerSource = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
)

function createHarness() {
  const listeners = new Map()
  const caches = {
    delete: vi.fn(async () => true),
    keys: vi.fn(async () => [
      'homeschool-hq-old-build',
      'homeschool-hq-__BUILD_ID__',
      'unrelated-runtime-cache',
    ]),
    match: vi.fn(),
    open: vi.fn(),
  }
  const self = {
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin: 'https://academy.example' },
    skipWaiting: vi.fn(async () => undefined),
  }
  vm.runInNewContext(
    workerSource,
    { Headers, Promise, URL, caches, fetch: vi.fn(), self },
    { filename: 'public/sw.js' },
  )

  async function dispatch(type, fields = {}) {
    let completion
    const event = {
      ...fields,
      waitUntil: vi.fn((value) => {
        completion = Promise.resolve(value)
      }),
    }
    listeners.get(type)(event)
    if (completion) await completion
    return event
  }

  return { caches, dispatch, self }
}

describe('service-worker update lifecycle', () => {
  it('keeps build-versioned cleanup and clients.claim on activate', async () => {
    const { caches, dispatch, self } = createHarness()

    const event = await dispatch('activate')

    expect(event.waitUntil).toHaveBeenCalledOnce()
    expect(caches.delete).toHaveBeenCalledTimes(2)
    expect(caches.delete).toHaveBeenCalledWith('homeschool-hq-old-build')
    expect(caches.delete).toHaveBeenCalledWith('unrelated-runtime-cache')
    expect(caches.delete).not.toHaveBeenCalledWith(
      'homeschool-hq-__BUILD_ID__',
    )
    expect(self.clients.claim).toHaveBeenCalledOnce()
  })

  it('accepts only the explicit user-approved activation message', async () => {
    const { dispatch, self } = createHarness()

    const ignored = await dispatch('message', { data: { type: 'OTHER' } })
    expect(ignored.waitUntil).not.toHaveBeenCalled()
    expect(self.skipWaiting).not.toHaveBeenCalled()

    const accepted = await dispatch('message', {
      data: { type: 'ACADEMY_ACTIVATE_SERVICE_WORKER' },
    })
    expect(accepted.waitUntil).toHaveBeenCalledOnce()
    expect(self.skipWaiting).toHaveBeenCalledOnce()
  })
})
