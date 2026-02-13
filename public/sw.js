// Service Worker for PWA Notifications
// Derivatives Trading Dashboard Mobile App

const CACHE_NAME = "derivatives-dashboard-v1"
const STATIC_ASSETS = [
  "/",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/badge-72x72.png",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...")
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static assets")
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[Service Worker] Cache addAll failed:", err)
      })
    })
  )

  // Skip waiting to activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...")

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[Service Worker] Deleting old cache:", name)
            return caches.delete(name)
          })
      )
    })
  )

  // Claim clients immediately
  self.clients.claim()
})

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push received")

  let notificationData = {}
  
  try {
    if (event.data) {
      notificationData = event.data.json()
    }
  } catch (e) {
    console.log("[Service Worker] Push data parse error:", e)
    notificationData = {
      title: "Derivatives Notification",
      body: event.data ? event.data.text() : "You have a new notification",
    }
  }

  const title = notificationData.title || "Derivatives Dashboard"
  const options = {
    body: notificationData.body || "You have a new notification",
    icon: notificationData.icon || "/icon-192x192.png",
    badge: notificationData.badge || "/badge-72x72.png",
    tag: notificationData.tag || "default",
    requireInteraction: notificationData.requireInteraction ?? false,
    silent: notificationData.silent ?? false,
    data: notificationData.data || {},
    actions: notificationData.actions || [
      { action: "view", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
    // Notification visuals
    dir: "auto",
    lang: "en",
    renotify: false,
    // iOS-specific options
    vibrate: [100, 50, 100],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Notification click event - handle user interaction
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked:", event.action)

  event.notification.close()

  // Get notification data
  const notificationData = event.notification.data || {}
  let url = notificationData.url || "/"

  // Handle different actions
  switch (event.action) {
    case "view":
      // Focus on app if already open, else open new window
      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clientList) => {
            // Check if there's already an open client
            for (const client of clientList) {
              if (client.url === url && "focus" in client) {
                return client.focus()
              }
            }
            // Otherwise open new window
            if (self.clients.openWindow) {
              return self.clients.openWindow(url)
            }
          })
      )
      break

    case "dismiss":
      // Just close the notification
      break

    case "settings":
      event.waitUntil(
        self.clients.openWindow("/settings/notifications")
      )
      break

    default:
      // Default: open the app
      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clientList) => {
            if (clientList.length > 0) {
              const client = clientList[0]
              if ("focus" in client) {
                return client.focus()
              }
            }
            if (self.clients.openWindow) {
              return self.clients.openWindow(url)
            }
          })
      )
  }
})

// Background sync - for offline functionality
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background sync:", event.tag)
  
  if (event.tag === "sync-alerts") {
    event.waitUntil(syncAlerts())
  }
})

async function syncAlerts() {
  // Sync pending alerts from IndexedDB or cache
  // This would be implemented with a real sync mechanism
  console.log("[Service Worker] Syncing alerts...")
}

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== "GET") return
  if (event.request.url.includes("/api/")) return

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return (
        response ||
        fetch(event.request).then((fetchResponse) => {
          // Don't cache if not successful
          if (!fetchResponse || fetchResponse.status !== 200) {
            return fetchResponse
          }

          // Clone and cache the response
          const responseToCache = fetchResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return fetchResponse
        })
      )
    })
  )
})

// Message event - communicate with the main app
self.addEventListener("message", (event) => {
  console.log("[Service Worker] Message received:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME })
  }
})

// Periodic background sync (if supported)
if ("periodicSync" in self.registration) {
  self.addEventListener("periodicsync", (event) => {
    console.log("[Service Worker] Periodic sync:", event.tag)
    
    if (event.tag === "check-portfolio") {
      event.waitUntil(
        fetch("/api/positions")
          .then((response) => response.json())
          .then((positions) => {
            // Check for significant changes and notify
            console.log("[Service Worker] Portfolio check completed")
          })
          .catch((err) => {
            console.error("[Service Worker] Portfolio check failed:", err)
          })
      )
    }
  })
}
