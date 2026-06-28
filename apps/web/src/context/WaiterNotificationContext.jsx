import React, {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useSocketEvent } from './SocketContext';
import { playNotificationSound } from '../utils/notificationSound';

const MAX_NOTIFICATIONS = 50;

const WaiterNotificationContext = createContext(null);

function isWaiterUser(user) {
  return user?.role?.role_key === 'waiter';
}

export function WaiterNotificationProvider({ children }) {
  const { user } = useAuth();
  const isWaiter = isWaiterUser(user);
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((payload) => {
    if (!payload?.body && !payload?.title) return;

    const id = payload.itemId || payload.tag || `n-${Date.now()}`;

    setNotifications((prev) => {
      if (prev.some((n) => n.id === id)) return prev;

      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        queueMicrotask(() => playNotificationSound());
      }

      const entry = {
        id,
        title: payload.title || 'Article prêt à servir',
        body: payload.body,
        url: payload.url || '/service',
        orderId: payload.orderId,
        itemId: payload.itemId,
        read: false,
        at: Date.now(),
      };
      return [entry, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  useSocketEvent('service:item_ready', (payload) => {
    if (!isWaiter) return;
    addNotification(payload);
  });

  useSocketEvent('service:item_served', (payload) => {
    if (!isWaiter || !payload?.itemId) return;
    setNotifications((prev) => prev.filter((n) => n.itemId !== payload.itemId && n.id !== payload.itemId));
  });

  const markRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (
      n.id === id ? { ...n, read: true } : n
    )));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      clearAll,
      isWaiter,
    }),
    [notifications, unreadCount, markRead, markAllRead, clearAll, isWaiter],
  );

  return (
    <WaiterNotificationContext.Provider value={value}>
      {children}
    </WaiterNotificationContext.Provider>
  );
}

export function useWaiterNotifications() {
  const ctx = useContext(WaiterNotificationContext);
  if (!ctx) {
    throw new Error('useWaiterNotifications doit être utilisé dans WaiterNotificationProvider');
  }
  return ctx;
}
