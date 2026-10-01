// Hand-written service worker (no next-pwa/workbox) — Next 16's default Turbopack
// doesn't run the webpack hooks those plugins need to generate a worker at build time.
//
// Scope: make the installed PWA resilient to flaky/offline connections, not a full
// offline-first app. API calls and Firebase/Firestore traffic always hit the network.

const SHELL_CACHE = 'buddy-shell-v1'
const RUNTIME_CACHE = 'buddy-runtime-v1'

// Stable URLs only — hashed Next.js build chunks change every deploy and can't be
// known ahead of time, so we don't try to precache them. They get picked up
// opportunistically by the runtime cache below as the user browses online.
const SHELL_URLS = ['/', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

function shouldBypass(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openalex.org')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (shouldBypass(url)) return

  // Navigation requests (the document itself): network-first, fall back to the
  // cached shell so an installed app opens to *something* when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(request)))
    )
    return
  }

  if (url.origin !== self.location.origin) return

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || fetchPromise
    })
  )
})
