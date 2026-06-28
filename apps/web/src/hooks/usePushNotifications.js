import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const SKIP_ROLES = new Set(['systempos']);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function canRegisterPush(user) {
  if (!user?._id) return false;
  if (window.konoPosShell) return false;
  if (SKIP_ROLES.has(user.role?.role_key)) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  return true;
}

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !canRegisterPush(user)) return undefined;

    let cancelled = false;

    async function registerPush() {
      try {
        const { data } = await client.get('/push/vapid-public-key');
        const publicKey = data?.data?.publicKey;
        if (!publicKey || cancelled) return;

        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted' || cancelled) return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled) return;
        await client.post('/push/subscribe', { subscription: subscription.toJSON() });
      } catch (err) {
        console.warn('[push] registration failed', err);
      }
    }

    registerPush();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?._id, user?.role?.role_key]);
}
