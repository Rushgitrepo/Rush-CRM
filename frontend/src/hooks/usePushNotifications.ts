import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function fetchVapidKey(): Promise<string> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}/push/vapid-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.publicKey;
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription }),
  });
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const setup = async () => {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();

        if (existingSub) {
          await sendSubscriptionToServer(existingSub);
          subscribedRef.current = true;
          return;
        }

        const vapidKey = await fetchVapidKey();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        await sendSubscriptionToServer(subscription);
        subscribedRef.current = true;
      } catch (err) {
        // Silently fail — push is a progressive enhancement
        console.debug('Push notification setup failed:', err);
      }
    };

    setup();
  }, [user]);
}
