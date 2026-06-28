import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import client from '../api/client';
import { hasAnyPermission, hasPermission } from '../utils/permissions';
import { clearLegacyAuthStorage } from '../utils/authStorage';
import { markSystemTerminal, clearSystemTerminal, getTerminalRequestHeaders, isSystemTerminalContext } from '../utils/terminalContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRequestId = useRef(0);
  const loginInProgressRef = useRef(false);

  const refreshUser = useCallback(async () => {
    const requestId = ++refreshRequestId.current;
    try {
      const [meRes, accessRes] = await Promise.all([
        client.get('/auth/me'),
        client.get('/auth/access'),
      ]);
      if (requestId !== refreshRequestId.current) return null;

      const me = meRes.data.data;
      const access = accessRes.data.data;
      const merged = {
        ...me,
        role: { role_key: access.role_key, name: access.role_name },
        permissions: access.permissions,
        is_pin_session: access.is_pin_session,
        is_quick_waiter_session: access.is_quick_waiter_session,
        capabilities: access.capabilities ?? [],
      };
      setSessionId(access.session_id || null);
      if (merged.role?.role_key === 'systempos' && !merged.is_pin_session) {
        markSystemTerminal();
      }
      if (merged.is_pin_session && !merged.is_quick_waiter_session) {
        markSystemTerminal();
      }
      setUser(merged);
      return merged;
    } catch (err) {
      if (requestId === refreshRequestId.current && !isSystemTerminalContext()) {
        setUser(null);
        setSessionId(null);
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    clearLegacyAuthStorage();
    refreshUser()
      .catch(() => {
        /* unauthenticated on first load */
      })
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (credentials, mode = 'password') => {
    loginInProgressRef.current = true;
    let endpoint = '/auth/login';
    let body = credentials;
    if (mode === 'pin') {
      endpoint = '/auth/login/pin';
      body = { pin: credentials.pin };
    } else if (mode === 'pin-direct') {
      endpoint = '/auth/login/pin-direct';
      body = { pin: credentials.pin };
      clearSystemTerminal();
    } else {
      clearSystemTerminal();
    }

    const deviceType = typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';

    try {
      const res = await client.post(endpoint, body, {
        headers: {
          'x-device-type': deviceType,
          ...getTerminalRequestHeaders(),
        },
      });
      const session = res.data.data;
      const u = await refreshUser();
      if (mode === 'pin' && !u?.is_quick_waiter_session) {
        markSystemTerminal();
      }
      return { ...session, user: u };
    } finally {
      loginInProgressRef.current = false;
    }
  };

  const logoutPinSession = async (options = {}) => {
    const reason = options.reason || 'manual';
    try {
      const res = await client.post('/auth/logout/pin', { reason });
      if (res.data?.data?.direct_pin_logout || res.data?.data?.quick_waiter_logout) {
        clearSystemTerminal();
        setUser(null);
        setSessionId(null);
        return { direct_pin_logout: true };
      }
      if (res.data?.data?.restored_systempos) {
        await refreshUser();
        return { restored_systempos: true };
      }
      if (res.data?.success && res.status === 200) {
        try {
          const u = await refreshUser();
          if (u?.role?.role_key === 'systempos' && !u.is_pin_session) {
            return { restored_systempos: true };
          }
        } catch {
          /* not restored */
        }
      }
    } catch (err) {
      if (err.response?.status === 400) {
        try {
          const u = await refreshUser();
          if (u?.role?.role_key === 'systempos' && !u.is_pin_session) {
            return { restored_systempos: true };
          }
        } catch {
          /* PIN session may already be closed server-side */
        }
      }
    }

    if (isSystemTerminalContext()) {
      try {
        const u = await refreshUser();
        if (u?.role?.role_key === 'systempos' && !u.is_pin_session) {
          return { restored_systempos: true };
        }
      } catch {
        /* shell not restored */
      }
    }

    if (!isSystemTerminalContext()) {
      setUser(null);
      setSessionId(null);
    }
    return { restored_systempos: false };
  };

  const logout = async (options = {}) => {
    const reason = options.reason || 'manual';
    try {
      await client.post('/auth/logout', { reason });
    } catch {
      /* ignore */
    }
    clearLegacyAuthStorage();
    if (user?.role?.role_key === 'systempos') {
      clearSystemTerminal();
    }
    setUser(null);
    setSessionId(null);
  };

  const isPinSession = Boolean(user?.is_pin_session);
  const isDirectPinSession = Boolean(user?.is_quick_waiter_session);
  const capabilities = user?.capabilities ?? [];

  const value = useMemo(
    () => ({
      user,
      sessionId,
      loading,
      login,
      logout,
      logoutPinSession,
      refreshUser,
      isPinSession,
      isQuickWaiterSession: isDirectPinSession,
      capabilities,
      loginInProgressRef,
      isAuthenticated: Boolean(user),
      hasPermission: (code) => hasPermission(user, code),
      hasAnyPermission: (codes) => hasAnyPermission(user, codes),
    }),
    [user, sessionId, loading, refreshUser, isPinSession, isDirectPinSession, capabilities],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
