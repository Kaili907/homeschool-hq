// Homeschool HQ service worker — offline app shell + immutable curriculum releases.
// __BUILD_ID__ is stamped after each production build (see scripts/stamp-sw.mjs).

const APP_SHELL_CACHE_PREFIX = 'homeschool-hq-app-shell-'
const APP_SHELL_CACHE = `${APP_SHELL_CACHE_PREFIX}__BUILD_ID__`
const CURRICULUM_CACHE_PREFIX = 'homeschool-hq-curriculum-release-'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

// Curriculum caches are deliberately retained across app-shell deployments. Until
// the server can identify releases still pinned by learners/sessions, deleting a
// versioned release cache here would make those pins unsafe offline.
const isCurriculumCache = (name) => name.startsWith(CURRICULUM_CACHE_PREFIX)

// These routes may carry authenticated, adult-only, or otherwise protected data.
// They must stay network-only and must never enter either public cache namespace.
const isProtectedPath = (pathname) =>
  pathname.startsWith('/api/') ||
  pathname.startsWith('/rest/') ||
  pathname.startsWith('/auth/') ||
  pathname.startsWith('/.netlify/functions/') ||
  /(?:^|\/)(?:admin|private|protected)(?:\/|$)/i.test(pathname)

// Only immutable, explicitly versioned public curriculum URLs qualify. Mutable
// pointers such as active/latest/current remain network-only and never become a
// permanent source of release authority.
const curriculumVersion = (pathname) => {
  const match = /^\/curriculum\/([A-Za-z0-9][A-Za-z0-9._+-]*)\/.+/.exec(pathname)
  if (!match || /^(?:active|latest|current)$/i.test(match[1])) return null
  return match[1]
}

const curriculumCacheName = (version) => `${CURRICULUM_CACHE_PREFIX}${version}`

const isPublicCacheableResponse = (response) => {
  if (!response || !response.ok) return false
  const cacheControl = response.headers.get('cache-control') || ''
  return !/(?:^|,)\s*(?:private|no-store)\b/i.test(cacheControl)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((name) => name !== APP_SHELL_CACHE && !isCurriculumCache(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const serveCurriculum = async (request, version) => {
  // Match only inside the requested version's cache. A global caches.match here
  // could allow an identically named Version A asset to satisfy Version B.
  const cache = await caches.open(curriculumCacheName(version))
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (isPublicCacheableResponse(response)) await cache.put(request, response.clone())
    return response
  } catch {
    // Never substitute another release. A clear 504 lets the content client fail
    // safely when this pinned release was not downloaded before going offline.
    return new Response(`Pinned curriculum release ${version} is unavailable offline.`, {
      status: 504,
      statusText: 'Pinned curriculum unavailable offline',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isProtectedPath(url.pathname)) return

  if (url.pathname.startsWith('/curriculum/')) {
    const version = curriculumVersion(url.pathname)
    if (!version) return // mutable pointers and malformed/unversioned paths are network-only
    event.respondWith(serveCurriculum(request, version))
    return
  }

  // App navigations are network-first so a fresh deploy loads when online, with
  // only the public app shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE)
        return cache.match('/index.html')
      }),
    )
    return
  }

  // Runtime app assets are cache-first inside the current app-shell namespace.
  event.respondWith(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (isPublicCacheableResponse(response)) await cache.put(request, response.clone())
      return response
    }),
  )
})
