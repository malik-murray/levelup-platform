/* LevelUp finance spend alerts — Web Push */
self.addEventListener('push', (event) => {
    let payload = { title: 'New transaction detected', body: '', data: {} };
    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch {
        if (event.data) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body || '',
        icon: '/brand/levelup-app-icon-192.png',
        badge: '/brand/levelup-app-icon-192.png',
        tag: payload.data?.transactionId || 'levelup-spend',
        renotify: true,
        data: payload.data || {},
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const txId = event.notification.data?.transactionId;
    const url = txId
        ? `/finance/transactions?highlight=${encodeURIComponent(txId)}`
        : '/finance/transactions';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
