
self.addEventListener('push', (event) => {
  let data = {
    title: 'Burgess Family App',
    body: 'You have a new family notification.',
  }

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      }
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Burgess Family App',
      {
        body: data.body || '',
        tag: data.tag || undefined,
        data: data.data || {},
      }
    )
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow('/')
      }

      return undefined
    })
  )
})