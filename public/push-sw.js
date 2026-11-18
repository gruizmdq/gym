// The push at the end of the rest (phase 8). The service worker that vite-plugin-pwa generates
// imports this file (workbox.importScripts in vite.config.ts).
//
// The server sends a declarative message: iOS 18.4+ shows it on its own. With "mutable" it also
// arrives here, as in every other browser, and the notification shown here replaces it.

self.addEventListener('push', (event) => {
  let notification = null
  try {
    notification = event.data?.json().notification ?? null
  } catch {
    // Not JSON: the generic notification below.
  }
  // iOS revokes the subscription after pushes that show nothing: something always shows.
  event.waitUntil(
    self.registration.showNotification(notification?.title ?? 'Terminó el descanso', {
      body: notification?.body,
      lang: 'es-AR',
      dir: 'ltr',
      tag: notification?.tag ?? 'rest',
      icon: '/pwa-192x192.png',
      data: { navigate: notification?.navigate ?? '/session' },
    }),
  )
})

// Back to the app where it was; if iOS already closed it, to the exercise of the rest.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      return open ? open.focus() : self.clients.openWindow(event.notification.data?.navigate)
    }),
  )
})
