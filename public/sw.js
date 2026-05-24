/* LevelUp finance spend alerts — Web Push */

function categorizeUrl(transactionId) {
    return `/finance/categorize/${encodeURIComponent(transactionId)}`;
}

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

    const txId = payload.data?.transactionId;
    const options = {
        body: payload.body || '',
        icon: '/brand/levelup-app-icon-192.png',
        badge: '/brand/levelup-app-icon-192.png',
        tag: txId || 'levelup-spend',
        renotify: true,
        data: {
            ...payload.data,
            url: txId ? categorizeUrl(txId) : '/finance/transactions',
        },
        actions: txId
            ? [
                  { action: 'categorize', title: 'Categorize' },
                  { action: 'open', title: 'View' },
              ]
            : [],
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
});

function openCategorizeFromNotification(notification) {
    const txId = notification.data?.transactionId;
    const url = notification.data?.url || (txId ? categorizeUrl(txId) : '/finance/transactions');
    return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
            if ('navigate' in client && typeof client.navigate === 'function') {
                return client.navigate(url).then(() => client.focus());
            }
            if ('focus' in client) {
                return client.focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow(url);
        }
    });
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(openCategorizeFromNotification(event.notification));
});

self.addEventListener('notificationactionclick', (event) => {
    event.notification.close();
    if (event.action === 'open') {
        const txId = event.notification.data?.transactionId;
        const url = txId
            ? `/finance/transactions?highlight=${encodeURIComponent(txId)}`
            : '/finance/transactions';
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                for (const client of clientList) {
                    if ('navigate' in client && typeof client.navigate === 'function') {
                        return client.navigate(url).then(() => client.focus());
                    }
                }
                if (clients.openWindow) return clients.openWindow(url);
            })
        );
        return;
    }
    event.waitUntil(openCategorizeFromNotification(event.notification));
});
