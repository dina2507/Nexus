importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDEyf1yinjeWhsCUhBsbssmpeSXwKIoQyA',
  projectId: 'prompt-wars-492706',
  messagingSenderId: '289948820157',
  appId: '1:289948820157:web:ec04a83d687f6c46798dd4'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'NEXUS Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New stadium update available',
    icon: '/nexus-icon.png',
    badge: '/nexus-badge.png',
    data: payload.data,
    vibrate: [200, 100, 200],
    tag: 'nexus-notification',
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('/fan'));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
