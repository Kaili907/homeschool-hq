// Homeschool HQ service worker — offline public app shell + static-asset caches.
// __BUILD_ID__ is stamped at build time (see scripts/stamp-sw.mjs). Each deploy
// gets a fresh app cache while immutable, versioned public Curriculum chunks use
// an isolated cache that survives application-shell updates.

const APP_CACHE_PREFIX = 'homeschool-hq-app-'
const LEGACY_CACHE_PREFIX = 'homeschool-hq-'
const APP_CACHE = `${APP_CACHE_PREFIX}__BUILD_ID__`
const CURRICULUM_CACHE = 'homeschool-hq-curriculum-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

function pathWithin(pathname, root) {
  return pathname === root || pathname.startsWith(`${root}/`)
}

function isProtectedPath(pathname) {
  return pathWithin(pathname, '/academy/admin')
    || pathWithin(pathname, '/api')
    || pathWithin(pathname, '/.netlify/functions')
    || pathWithin(pathname, '/rest')
    || pathWithin(pathname, '/auth')
}

function isCurriculumPath(pathname) {
  return pathWithin(pathname, '/curriculum')
}

function isAppAssetPath(pathname) {
  return pathWithin(pathname, '/assets')
    || pathname === '/manifest.webmanifest'
    || pathname === '/icon.svg'
}

function responseMayBeCached(request, response) {
  if (!response?.ok || response.type === 'opaque') return false
  if (request.headers?.has?.('authorization')) return false
  const cacheControl = response.headers?.get?.('cache-control')?.toLowerCase() ?? ''
  return !cacheControl.includes('no-store') && !cacheControl.includes('private')
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (responseMayBeCached(request, response)) await cache.put(request, response.clone())
  return response
}

function isStaleOwnedCache(cacheName) {
  if (cacheName === APP_CACHE || cacheName === CURRICULUM_CACHE) return false
  return cacheName.startsWith(APP_CACHE_PREFIX) || cacheName.startsWith(LEGACY_CACHE_PREFIX)
}

async function migrateCurriculumAndDeleteStaleAppCaches() {
  const staleCaches = (await caches.keys()).filter(isStaleOwnedCache)
  if (staleCaches.length === 0) return

  const curriculumCache = await caches.open(CURRICULUM_CACHE)
  for (const cacheName of staleCaches) {
    const staleCache = await caches.open(cacheName)
    for (const request of await staleCache.keys()) {
      const url = new URL(request.url)
      if (url.origin !== self.location.origin || !isCurriculumPath(url.pathname)) continue
      const response = await staleCache.match(request)
      if (responseMayBeCached(request, response)) {
        await curriculumCache.put(request, response.clone())
      }
    }
  }

  await Promise.all(staleCaches.map((cacheName) => caches.delete(cacheName)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((c) => c.addAll(SHELL))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    migrateCurriculumAndDeleteStaleAppCaches()
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // never touch API POSTs
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // leave cross-origin (Supabase, proxy/APIs) alone

  // Admin navigations may use only the public shell while offline; authorization
  // and every protected projection still have to be re-established over the
  // network. Online Admin HTML always bypasses the browser HTTP cache.
  if (pathWithin(url.pathname, '/academy/admin') && req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(
      async () => (await caches.open(APP_CACHE)).match('/index.html'),
    ))
    return
  }

  // Admin subresource fetches, APIs, direct function URLs, and auth/sync
  // endpoints are explicitly network-only. This also bypasses the browser HTTP
  // cache if an intermediary ever drops the server's no-store response.
  if (isProtectedPath(url.pathname)) {
    event.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }

  // App navigations: network-first so a fresh deploy loads when online, cached
  // shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.open(APP_CACHE)).match('/index.html')))
    return
  }

  // Immutable public Curriculum content is versioned in its URL and remains
  // isolated from application-shell churn.
  if (isCurriculumPath(url.pathname)) {
    event.respondWith(cacheFirst(req, CURRICULUM_CACHE))
    return
  }

  // Only known application assets enter the app cache. Arbitrary same-origin
  // GETs are left to the network and can never become protected runtime data.
  if (isAppAssetPath(url.pathname)) event.respondWith(cacheFirst(req, APP_CACHE))
})
