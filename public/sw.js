// Homeschool HQ service worker — offline app shell + runtime static-asset cache.
// __BUILD_ID__ is stamped at build time (see vite.config.ts), so every deploy gets
// a fresh cache name and the activate step deletes the old ones (cache-bust). The
// SW is only registered in production builds (see main.tsx), never in dev.

const CACHE = 'homeschool-hq-__BUILD_ID__'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // never touch API POSTs
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // leave cross-origin (Supabase, proxy/APIs) alone
  if (url.pathname.startsWith('/api/')) return // never cache the key-injecting proxy calls
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return // never cache sync calls

  // App navigations: network-first so a fresh deploy loads when online, cached
  // shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')))
    return
  }

  // Static assets (content-hashed): cache-first, filling the cache on first fetch —
  // so after one online visit the whole app runs offline.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
        }
        return res
      })
    }),
  )
})
