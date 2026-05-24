/* LevelUp finance spend alerts — v2 quick category actions */
const SW_VERSION = 'spend-push-v2';

function categorizeUrl(transactionId) {
    return `/finance/categorize/${encodeURIComponent(transactionId)}`;
}

function parseQuickCategories(data) {
    try {
        const raw = data?.quickCategories;
        if (!raw) return [];
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function buildActions(quickCategories) {
    const actions = quickCategories.slice(0, 3).map(c => ({
        action: `cat-${c.id}`,
        title: c.name.length > 20 ? `${c.name.slice(0, 19)}…` : c.name,
    }));
    actions.push({ action: 'more', title: 'More categories' });
    return actions;
}

function quickCategorize(transactionId, categoryId, token) {
    return fetch('/api/push/quick-categorize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, categoryId, token }),
    }).then(res => res.json());
}

function showDoneNotification(categoryName) {
    return self.registration.showNotification('Categorized', {
        body: categoryName ? `Saved as ${categoryName}` : 'Category saved',
        icon: '/brand/levelup-app-icon-192.png',
        tag: 'levelup-cat-done',
    });
}

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
    let payload = { title: 'New spend', body: 'Tap to categorize', data: {} };
    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch {
        if (event.data) {
            payload.body = event.data.text();
        }
    }

    const data = payload.data || {};
    const txId = data.transactionId;
    const quickCategories = parseQuickCategories(data);

    const body =
        payload.body ||
        (quickCategories.length > 0
            ? 'Expand for quick categories, or tap to see all'
            : 'Tap to pick a category');

    const options = {
        body,
        icon: '/brand/levelup-app-icon-192.png',
        badge: '/brand/levelup-app-icon-192.png',
        tag: txId || 'levelup-spend',
        renotify: true,
        requireInteraction: false,
        data: {
            ...data,
            swVersion: SW_VERSION,
            url: txId ? categorizeUrl(txId) : '/finance/transactions',
        },
        actions: txId && quickCategories.length > 0 ? buildActions(quickCategories) : [],
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
});

function openUrl(url) {
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

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    const url = data.url || (data.transactionId ? categorizeUrl(data.transactionId) : '/finance/transactions');
    event.waitUntil(openUrl(url));
});

self.addEventListener('notificationactionclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    const txId = data.transactionId;
    const token = data.actionToken;

    if (event.action === 'more' || event.action === 'categorize') {
        const url = txId ? categorizeUrl(txId) : '/finance/transactions';
        event.waitUntil(openUrl(url));
        return;
    }

    if (event.action && event.action.startsWith('cat-') && txId && token) {
        const categoryId = event.action.slice(4);
        event.waitUntil(
            quickCategorize(txId, categoryId, token).then(result => {
                if (result?.ok) {
                    return showDoneNotification(result.categoryName);
                }
                return self.registration.showNotification('Could not save', {
                    body: result?.error || 'Open the app to categorize',
                    tag: 'levelup-cat-error',
                });
            })
        );
        return;
    }

    if (txId) {
        event.waitUntil(openUrl(categorizeUrl(txId)));
    }
});
